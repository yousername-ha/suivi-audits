/* Assistant RSSI intégré (ADR 0086, lot A1) : réglages du modèle, clé scellée, profils et périmètres, conversations.
   - L'assistant lit avec les droits de la personne, bornés aux périmètres du profil ; il n'écrit dans aucun registre.
   - La clé du modèle est scellée par le coffre (settings, « secret:assistant »), écriture seule, jamais renvoyée ni journalisée.
   - Une réponse se prépare en tâche de fond : la requête rend la main tout de suite, l'interface relit le fil.
   - Chaque message est tracé au journal d'audit, sans contenu : profil, outils appelés, jetons consommés. */
import {
  PROFIL_ASSISTANT_LIBELLES,
  PROFILS_ASSISTANT,
  type ConversationAssistantDetailDto,
  type ConversationAssistantDto,
  type EtatAssistantDto,
  type MessageAssistantDto,
  type ProfilAssistant,
  type ReglagesAssistantBody,
  type ReglagesAssistantDto,
  type SourceAssistant,
  type TestModeleDto,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { Kdb } from '../db/db.js';
import type { Logger } from 'pino';
import type { SessionUser } from '../auth.js';
import type { Actor, Db } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { HttpError } from '../http/errors.js';
import type { Vault } from '../security/crypto.js';
import { consigne, repondre } from './agent.js';
import type { TransportModele } from './modele.js';
import { OUTILS } from './outils.js';
import type { Classification, DocumentsAssistant } from './documents.js';
import type { RondesAssistant } from './rondes.js';

const CLE = 'secret:assistant';
const AAD = 'assistant:cle-modele';
const CONVERSATIONS_MAX = 50;
const MESSAGES_MAX = 200;
/** Messages du fil remis au modèle (les plus récents). */
const FIL_MAX = 20;

const hote = (adresse: string): string | null => {
  try {
    return new URL(adresse).host;
  } catch {
    return null;
  }
};

export class Assistant {
  /** Réponses en préparation, par conversation (une seule instance d'API : ADR 0086, DAT). */
  private readonly taches = new Map<string, Promise<void>>();
  /** Rondes autonomes (lot A3) : branchées par les services, elles valident le référent d'un profil. */
  rondes?: RondesAssistant;
  /** Contenu des documents (lot A4) : branché par les services. */
  documents?: DocumentsAssistant;

  constructor(
    private readonly db: Db,
    private readonly vault: Vault,
    private readonly grc: Grc,
    private readonly transport: TransportModele,
    private readonly log: Logger,
  ) {}

  /* ---------------------------------------------------------------- Réglages (assistant:administrer) */
  async lire() {
    const r = await this.db.k
      .selectFrom('assistant_reglages')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    const profils = await this.db.k.selectFrom('assistant_profils').selectAll().execute();
    return { r, profils: new Map(profils.map((p) => [p.id, p])) };
  }

  async cleDefinie(): Promise<boolean> {
    return !!(await this.db.k.selectFrom('settings').select('key').where('key', '=', CLE).executeTakeFirst());
  }

  async lireCle(): Promise<string> {
    const l = await this.db.k.selectFrom('settings').select('value').where('key', '=', CLE).executeTakeFirst();
    if (!l) return '';
    return this.vault.openSmall(Buffer.from((l.value as { sealed: string }).sealed, 'base64'), AAD).toString('utf8');
  }

  async reglages(): Promise<ReglagesAssistantDto> {
    const { r, profils } = await this.lire();
    return {
      actif: r.actif,
      adresse: r.adresse,
      modele: r.modele,
      budgetJetonsJour: r.budget_jetons_jour,
      enPause: r.en_pause,
      heureRonde: r.heure_ronde,
      plafondRappelsJour: r.plafond_rappels_jour,
      delaiRelanceJours: r.delai_relance_jours,
      jourSynthese: r.jour_synthese,
      rondesSurEvenement: r.rondes_sur_evenement,
      contexte: r.contexte,
      profils: PROFILS_ASSISTANT.map((id) => ({
        id,
        libelle: PROFIL_ASSISTANT_LIBELLES[id],
        actif: profils.get(id)?.actif ?? false,
        perimetres: profils.get(id)?.perimetres ?? [],
        rondeQuotidienne: profils.get(id)?.ronde_quotidienne ?? false,
        referent: profils.get(id)?.referent_id ?? null,
        documents: profils.get(id)?.documents ?? false,
        classificationMax: (profils.get(id)?.classification_max ?? 'interne') as Classification,
      })),
      version: r.version,
      indexDocuments: (await this.documents?.etat()) ?? { extraits: 0, nonLus: 0, enAttente: 0 },
      cleDefinie: await this.cleDefinie(),
      relaisDeclare: this.transport.declare(),
      updatedAt: r.updated_at?.toISOString() ?? null,
      updatedBy: r.updated_by,
    };
  }

  async modifierReglages(b: ReglagesAssistantBody, user: Actor, ip: string): Promise<ReglagesAssistantDto> {
    for (const p of b.profils) if (p.referent) await this.rondes?.exigerReferent(p.referent);
    await this.db.tx(async (c, k) => {
      const cur = await k
        .selectFrom('assistant_reglages')
        .select('version')
        .where('id', '=', 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (cur.version !== b.version)
        throw new HttpError(409, 'Les réglages ont été modifiés entre-temps. Rechargez la page.');
      const demandes = [...new Set(b.profils.flatMap((p) => p.perimetres))];
      if (demandes.length) {
        const connus = await k.selectFrom('grc_smsis').select('id').where('id', 'in', demandes).execute();
        if (connus.length !== demandes.length) throw new HttpError(422, 'Un périmètre choisi n’existe pas.');
      }
      await k
        .updateTable('assistant_reglages')
        .set({
          actif: b.actif,
          adresse: b.adresse,
          modele: b.modele,
          budget_jetons_jour: b.budgetJetonsJour,
          ...(b.enPause === undefined ? {} : { en_pause: b.enPause }),
          ...(b.heureRonde === undefined ? {} : { heure_ronde: b.heureRonde }),
          ...(b.plafondRappelsJour === undefined ? {} : { plafond_rappels_jour: b.plafondRappelsJour }),
          ...(b.contexte === undefined ? {} : { contexte: b.contexte }),
          ...(b.delaiRelanceJours === undefined ? {} : { delai_relance_jours: b.delaiRelanceJours }),
          ...(b.jourSynthese === undefined ? {} : { jour_synthese: b.jourSynthese }),
          ...(b.rondesSurEvenement === undefined ? {} : { rondes_sur_evenement: b.rondesSurEvenement }),
          version: cur.version + 1,
          updated_at: sql`now()`,
          updated_by: user.username,
        })
        .where('id', '=', 1)
        .execute();
      for (const p of b.profils) {
        const avant = await k
          .selectFrom('assistant_profils')
          .select(['perimetres', 'ronde_quotidienne', 'referent_id'])
          .where('id', '=', p.id)
          .executeTakeFirstOrThrow();
        const referent = p.referent === undefined ? avant.referent_id : p.referent;
        const quotidienne = p.rondeQuotidienne ?? avant.ronde_quotidienne;
        if (quotidienne && !referent)
          throw new HttpError(422, 'Désignez un référent avant d’activer la ronde quotidienne.');
        await k
          .updateTable('assistant_profils')
          .set({
            actif: p.actif,
            perimetres: [...new Set(p.perimetres)],
            ronde_quotidienne: quotidienne,
            referent_id: referent,
            ...(p.documents === undefined ? {} : { documents: p.documents }),
            ...(p.classificationMax === undefined ? {} : { classification_max: p.classificationMax }),
          })
          .where('id', '=', p.id)
          .execute();
        // Un périmètre retiré au profil : sa mémoire peut en garder des éléments, elle est purgée (ADR 0086, point 13).
        if (avant.perimetres.some((x) => !p.perimetres.includes(x))) {
          const purge = await k.deleteFrom('assistant_memoire').where('profil', '=', p.id).returning('id').execute();
          if (purge.length)
            await this.db.audit(user, ip, 'assistant.memoire_purgee', '', { profil: p.id, notes: purge.length }, c);
        }
      }
      // Le journal dit vers quel fournisseur partent les extraits et combien de périmètres sont ouverts : aucun secret.
      await this.db.audit(
        user,
        ip,
        'assistant.reglages_modifies',
        '',
        {
          actif: b.actif,
          fournisseur: hote(b.adresse),
          modele: b.modele,
          budgetJetonsJour: b.budgetJetonsJour,
          ...(b.enPause === undefined ? {} : { enPause: b.enPause }),
          profils: b.profils.map((p) => ({
            id: p.id,
            actif: p.actif,
            perimetres: p.perimetres.length,
            ...(p.rondeQuotidienne === undefined ? {} : { rondeQuotidienne: p.rondeQuotidienne }),
          })),
        },
        c,
      );
    }, user.username);
    return this.reglages();
  }

  async definirCle(cle: string, user: Actor, ip: string): Promise<void> {
    const scelle = this.vault.sealSmall(Buffer.from(cle, 'utf8'), AAD).toString('base64');
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('settings')
        .values({ key: CLE, value: JSON.stringify({ sealed: scelle }) })
        .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
        .execute();
      await this.db.audit(user, ip, 'assistant.cle_definie', '', {}, c);
    }, user.username);
  }

  async retirerCle(user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      await k.deleteFrom('settings').where('key', '=', CLE).execute();
      await this.db.audit(user, ip, 'assistant.cle_retiree', '', {}, c);
    }, user.username);
  }

  /** Appel réel, minimal, au modèle réglé : dit ce qui a marché ou pourquoi cela échoue. Aucune donnée métier n'est envoyée. */
  async tester(user: Actor, ip: string): Promise<TestModeleDto> {
    const { r } = await this.lire();
    const cle = await this.lireCle();
    let resultat: TestModeleDto;
    if (!r.adresse || !r.modele)
      resultat = { ok: false, detail: 'Renseignez l’adresse et le modèle, puis enregistrez.' };
    else if (!cle) resultat = { ok: false, detail: 'Aucune clé n’est enregistrée.' };
    else if (!this.transport.declare())
      resultat = { ok: false, detail: 'Le relais de modèle n’est pas installé sur le serveur.' };
    else
      try {
        await this.transport.completer(r.adresse, cle, {
          model: r.modele,
          messages: [{ role: 'user', content: 'Répondez par le seul mot : prêt.' }],
          max_tokens: 10,
          temperature: 0,
        });
        resultat = { ok: true, detail: 'Le modèle a répondu.' };
      } catch (e) {
        resultat = {
          ok: false,
          detail: e instanceof HttpError ? e.message : 'Échec de l’appel au modèle.',
        };
      }
    await this.db.audit(user, ip, 'assistant.test', '', { ok: resultat.ok, fournisseur: hote(r.adresse) });
    return resultat;
  }

  /* ---------------------------------------------------------------- État (assistant:lire) */
  async jetonsDuJour(): Promise<number> {
    const l = await this.db.k
      .selectFrom('assistant_consommation')
      .select(sql<number>`(jetons_entree + jetons_sortie)::float8`.as('n'))
      .where('jour', '=', sql<Date>`(now() AT TIME ZONE 'UTC')::date`)
      .executeTakeFirst();
    return Number(l?.n ?? 0);
  }

  /** Pourquoi l'assistant ne peut pas répondre, ou null s'il est prêt. */
  async empechement(): Promise<string | null> {
    const { r } = await this.lire();
    if (!r.actif) return 'L’assistant n’est pas activé.';
    if (!r.adresse || !r.modele) return 'Le modèle de l’assistant n’est pas réglé.';
    if (!(await this.cleDefinie())) return 'Aucune clé de modèle n’est enregistrée.';
    if (!this.transport.declare()) return 'Le relais de modèle n’est pas installé sur le serveur.';
    return null;
  }

  async etat(user: SessionUser): Promise<EtatAssistantDto> {
    const { r, profils } = await this.lire();
    const motif = await this.empechement();
    // Seuls les périmètres que la personne peut elle-même ouvrir sont nommés.
    const lisibles = new Map((await this.grc.listSmsis(user)).map((s) => [s.id, s.name]));
    return {
      actif: r.actif,
      pret: motif === null,
      motif,
      fournisseur: r.adresse ? hote(r.adresse) : null,
      modele: r.modele || null,
      profils: PROFILS_ASSISTANT.filter((id) => profils.get(id)?.actif).map((id) => ({
        id,
        libelle: PROFIL_ASSISTANT_LIBELLES[id],
        perimetres: (profils.get(id)?.perimetres ?? [])
          .filter((p) => lisibles.has(p))
          .map((p) => ({ id: p, nom: lisibles.get(p)! })),
      })),
      jetonsDuJour: await this.jetonsDuJour(),
      budgetJetonsJour: r.budget_jetons_jour,
      enPause: r.en_pause,
    };
  }

  /** Ajoute à la consommation du jour (UTC), dans la transaction de l'appelant. */
  async consommer(k: Kdb, jetonsEntree: number, jetonsSortie: number, appels: number): Promise<void> {
    if (!appels) return;
    await k
      .insertInto('assistant_consommation')
      .values({
        jour: sql<Date>`(now() AT TIME ZONE 'UTC')::date`,
        jetons_entree: jetonsEntree,
        jetons_sortie: jetonsSortie,
        appels,
      })
      .onConflict((oc) =>
        oc.column('jour').doUpdateSet((eb) => ({
          jetons_entree: sql<number>`assistant_consommation.jetons_entree + ${eb.ref('excluded.jetons_entree')}`,
          jetons_sortie: sql<number>`assistant_consommation.jetons_sortie + ${eb.ref('excluded.jetons_sortie')}`,
          appels: sql<number>`assistant_consommation.appels + ${eb.ref('excluded.appels')}`,
        })),
      )
      .execute();
  }

  /* ---------------------------------------------------------------- Conversations (assistant:lire) */
  private dto(c: {
    id: string;
    profil: string;
    titre: string;
    etat: 'pret' | 'en_cours';
    created_at: Date;
    updated_at: Date;
  }): ConversationAssistantDto {
    return {
      id: c.id,
      profil: c.profil as ProfilAssistant,
      titre: c.titre,
      // Une réponse « en cours » sans tâche vivante (API redémarrée) n'arrivera plus : le fil est rendu disponible.
      etat: c.etat === 'en_cours' && !this.taches.has(c.id) ? 'pret' : c.etat,
      createdAt: c.created_at.toISOString(),
      updatedAt: c.updated_at.toISOString(),
    };
  }

  /** Le fil d'une autre personne est introuvable, comme un fil absent. */
  private async charger(id: string, user: SessionUser) {
    const c = await this.db.k
      .selectFrom('assistant_conversations')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (!c) throw new HttpError(404, 'Conversation introuvable.');
    return c;
  }

  async conversations(user: SessionUser): Promise<ConversationAssistantDto[]> {
    const l = await this.db.k
      .selectFrom('assistant_conversations')
      .selectAll()
      .where('user_id', '=', user.id)
      .orderBy('updated_at', 'desc')
      .orderBy('id')
      .limit(CONVERSATIONS_MAX)
      .execute();
    return l.map((c) => this.dto(c));
  }

  async creer(profil: ProfilAssistant, user: SessionUser): Promise<ConversationAssistantDto> {
    const { profils } = await this.lire();
    if (!profils.get(profil)?.actif) throw new HttpError(409, 'Ce profil de l’assistant n’est pas activé.');
    const { n } = await this.db.k
      .selectFrom('assistant_conversations')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('user_id', '=', user.id)
      .executeTakeFirstOrThrow();
    if (n >= CONVERSATIONS_MAX)
      throw new HttpError(
        409,
        'Nombre maximal de conversations atteint : supprimez-en une avant d’en ouvrir une autre.',
      );
    const c = await this.db.k
      .insertInto('assistant_conversations')
      .values({ user_id: user.id, profil })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.dto(c);
  }

  async detail(id: string, user: SessionUser): Promise<ConversationAssistantDetailDto> {
    const c = await this.charger(id, user);
    const messages = await this.db.k
      .selectFrom('assistant_messages')
      .selectAll()
      .where('conversation_id', '=', id)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return {
      ...this.dto(c),
      messages: messages.map((m): MessageAssistantDto => ({
        id: m.id,
        role: m.role,
        contenu: m.contenu,
        sources: m.sources as unknown as SourceAssistant[],
        outils: m.outils as unknown as { nom: string; elements: number }[],
        erreur: m.erreur,
        createdAt: m.created_at.toISOString(),
      })),
    };
  }

  async supprimer(id: string, user: SessionUser, ip: string): Promise<void> {
    await this.charger(id, user);
    if (this.taches.has(id)) throw new HttpError(409, 'Une réponse est en préparation : réessayez dans un instant.');
    await this.db.tx(async (c, k) => {
      await k.deleteFrom('assistant_conversations').where('id', '=', id).where('user_id', '=', user.id).execute();
      await this.db.audit(user, ip, 'assistant.conversation_supprimee', id, {}, c);
    }, user.username);
  }

  /** Enregistre la demande et lance la préparation de la réponse ; rend le fil tout de suite (état « en cours »). */
  async envoyer(id: string, texte: string, user: SessionUser, ip: string): Promise<ConversationAssistantDetailDto> {
    const conv = await this.charger(id, user);
    const profil = conv.profil as ProfilAssistant;
    const motif = await this.empechement();
    if (motif) throw new HttpError(409, motif);
    const { r, profils } = await this.lire();
    const p = profils.get(profil);
    if (!p?.actif) throw new HttpError(409, 'Ce profil de l’assistant n’est pas activé.');
    if ((await this.jetonsDuJour()) >= r.budget_jetons_jour)
      throw new HttpError(429, 'Le budget quotidien de l’assistant est atteint. Il sera de nouveau disponible demain.');
    if (this.taches.has(id)) throw new HttpError(409, 'Une réponse est déjà en préparation dans cette conversation.');

    const fil = await this.db.tx(async (_c, k) => {
      const verrou = await k
        .selectFrom('assistant_conversations')
        .select('id')
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const { n } = await k
        .selectFrom('assistant_messages')
        .select(sql<number>`count(*)::int`.as('n'))
        .where('conversation_id', '=', verrou.id)
        .executeTakeFirstOrThrow();
      if (n >= MESSAGES_MAX) throw new HttpError(409, 'Cette conversation est trop longue : ouvrez-en une nouvelle.');
      await k
        .insertInto('assistant_messages')
        .values({ conversation_id: id, role: 'utilisateur', contenu: texte })
        .execute();
      await k
        .updateTable('assistant_conversations')
        .set({ etat: 'en_cours', updated_at: sql`now()`, ...(n === 0 ? { titre: texte.slice(0, 80) } : {}) })
        .where('id', '=', id)
        .execute();
      const recents = await k
        .selectFrom('assistant_messages')
        .select(['role', 'contenu'])
        .where('conversation_id', '=', id)
        .where('erreur', '=', false)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(FIL_MAX)
        .execute();
      return recents.reverse();
    }, user.username);

    const cle = await this.lireCle();
    const tache = this.preparer({
      id,
      profil,
      fil,
      user,
      ip,
      adresse: r.adresse,
      modele: r.modele,
      cle,
      perimetres: new Set(p.perimetres),
      documents: p.documents ? (p.classification_max as Classification) : null,
    }).finally(() => this.taches.delete(id));
    this.taches.set(id, tache);
    return this.detail(id, user);
  }

  /** Attend la fin de la réponse en préparation (tests et arrêt propre). */
  async attendre(id: string): Promise<void> {
    await this.taches.get(id);
  }

  private async preparer(t: {
    id: string;
    profil: ProfilAssistant;
    fil: { role: 'utilisateur' | 'assistant'; contenu: string }[];
    user: SessionUser;
    ip: string;
    adresse: string;
    modele: string;
    cle: string;
    perimetres: ReadonlySet<string>;
    documents: Classification | null;
  }): Promise<void> {
    let contenu: string;
    let erreur = false;
    let sources: SourceAssistant[] = [];
    let outils: { nom: string; elements: number }[] = [];
    let jetonsEntree = 0;
    let jetonsSortie = 0;
    let appels = 0;
    try {
      const res = await repondre({
        transport: this.transport,
        adresse: t.adresse,
        cle: t.cle,
        modele: t.modele,
        profil: t.profil,
        // Contexte de l'organisation et fiches de méthode validées : relus aussi en conversation.
        consigne: [
          consigne(t.profil, new Date().toISOString().slice(0, 10)),
          (await this.rondes?.annexes(t.profil)) ?? '',
        ]
          .filter(Boolean)
          .join('\n'),
        fil: t.fil,
        outils: OUTILS,
        ctx: {
          g: this.grc,
          user: t.user,
          perimetres: t.perimetres,
          ...(t.documents && this.documents ? { documents: this.documents.pour(t.user, t.documents) } : {}),
        },
        log: this.log,
      });
      ({ texte: contenu, sources, outils, jetonsEntree, jetonsSortie, appels } = res);
    } catch (e) {
      erreur = true;
      contenu = e instanceof HttpError ? e.message : 'L’assistant n’a pas pu répondre. Réessayez dans un instant.';
      if (!(e instanceof HttpError)) this.log.error({ err: (e as Error).message }, 'assistant : échec de la réponse');
    }
    try {
      await this.db.tx(async (c, k) => {
        // Le fil a pu être supprimé avec le compte pendant la préparation : rien à écrire alors.
        const present = await k
          .selectFrom('assistant_conversations')
          .select('id')
          .where('id', '=', t.id)
          .executeTakeFirst();
        if (present) {
          await k
            .insertInto('assistant_messages')
            .values({
              conversation_id: t.id,
              role: 'assistant',
              contenu,
              sources: JSON.stringify(sources),
              outils: JSON.stringify(outils),
              erreur,
            })
            .execute();
          await k
            .updateTable('assistant_conversations')
            .set({ etat: 'pret', updated_at: sql`now()` })
            .where('id', '=', t.id)
            .execute();
        }
        await this.consommer(k, jetonsEntree, jetonsSortie, appels);
        await this.db.audit(
          t.user,
          t.ip,
          'assistant.message',
          t.id,
          { profil: t.profil, fournisseur: hote(t.adresse), outils, appels, jetonsEntree, jetonsSortie, erreur },
          c,
        );
      }, t.user.username);
    } catch (e) {
      this.log.error({ err: (e as Error).message }, 'assistant : enregistrement de la réponse impossible');
    }
  }
}
