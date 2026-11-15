/* Module Vulnérabilités (ADR 0100), lot V1 : registre des produits surveillés, au niveau de l'organisation (sans périmètre),
   comme les fournisseurs (ADR 0032). Les droits de module sont contrôlés par route() ; ce service est seul juge du reste :
   doublon (même éditeur, produit et version, à la casse près), version attendue (If-Match), fournisseur lié lisible par la
   personne à travers la porte de lecture (ADR 0083), responsable existant et actif. Chaque écriture est journalisée
   (`vulnerabilites.produit.*`) sans secret. Accès aux données en Kysely (ADR 0062). */
import {
  type FamilleProduit,
  type ProduitSurveilleBody,
  type ProduitSurveilleDto,
  type ProduitSurveillePatch,
  type ResponsableRef,
  type ResponsablesProposables,
} from '@suivi/shared';
import { isObject } from '@suivi/shared/legacy';
import { sql, type Selectable } from 'kysely';
import { PorteeLecture } from '../acces/portee.js';
import type { SessionUser } from '../auth.js';
import type { Db, Kdb } from '../db/db.js';
import type { VulnerabilitesProduits } from '../db/types.generated.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';

type Ligne = Selectable<VulnerabilitesProduits>;

const DOUBLON =
  'Ce produit est déjà surveillé : même éditeur, même produit et même version (sans tenir compte de la casse).';
const nomAffiche = sql<string>`coalesce(nullif(display_name, ''), username)`;

/** Même éditeur, même produit, même version, à la casse près (index unique vulnerabilites_produits_doublon). */
const memeProduit = (p: { editeur: string; nom: string; versionProduit: string }) =>
  sql<boolean>`lower(editeur) = lower(${p.editeur}) AND lower(nom) = lower(${p.nom}) AND lower(version_produit) = lower(${p.versionProduit})`;

const versDto = (r: Ligne, libelles: Map<string, string>): ProduitSurveilleDto => {
  const responsable = (r.responsable as ResponsableRef | null) ?? null;
  return {
    id: r.id,
    fournisseurId: r.fournisseur_id,
    editeur: r.editeur,
    nom: r.nom,
    versionProduit: r.version_produit,
    cpe: r.cpe,
    famille: r.famille,
    criticite: r.criticite,
    responsable,
    responsableLibelle: responsable ? (libelles.get(`${responsable.type}:${responsable.id}`) ?? null) : null,
    origine: r.origine,
    version: r.version,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
    updatedBy: r.updated_by,
    updatedAt: r.updated_at.toISOString(),
  };
};

/** Champs comparés et journalisés (aucun secret dans cette fiche). */
const resume = (p: ProduitSurveilleDto) => ({
  fournisseurId: p.fournisseurId,
  editeur: p.editeur,
  nom: p.nom,
  versionProduit: p.versionProduit,
  cpe: p.cpe,
  famille: p.famille,
  criticite: p.criticite,
  responsable: p.responsable,
});

const doublonEnBase = (e: unknown): never => {
  if ((e as { code?: string }).code === '23505') throw new HttpError(409, DOUBLON);
  throw e;
};

export class ProduitsSurveilles {
  constructor(
    private readonly db: Db,
    private readonly grc: Grc,
  ) {}

  /** Registre, éventuellement filtré par famille ; ordre : éditeur, produit, version. */
  async lister(famille?: FamilleProduit): Promise<ProduitSurveilleDto[]> {
    let q = this.db.k.selectFrom('vulnerabilites_produits').selectAll();
    if (famille) q = q.where('famille', '=', famille);
    const lignes = await q
      .orderBy(sql`lower(editeur)`)
      .orderBy(sql`lower(nom)`)
      .orderBy(sql`lower(version_produit)`)
      .orderBy('id')
      .execute();
    const libelles = await this.libelles(lignes, this.db.k);
    return lignes.map((r) => versDto(r, libelles));
  }

  async lire(id: string, k: Kdb = this.db.k, verrou = false): Promise<ProduitSurveilleDto> {
    let q = k.selectFrom('vulnerabilites_produits').selectAll().where('id', '=', id);
    if (verrou) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    if (!r) throw new HttpError(404, 'Produit surveillé introuvable.');
    return versDto(r, await this.libelles([r], k));
  }

  /** Annuaire des responsables désignables (personnes actives, groupes, fonctions) : registre sans périmètre, le droit de
      modifier les produits surveillés (contrôlé par la route) suffit, comme « droit de modification d'un module métier »
      pour l'annuaire d'un périmètre. */
  responsables(): Promise<ResponsablesProposables> {
    return this.grc.annuaires.annuaire();
  }

  async creer(body: ProduitSurveilleBody, user: SessionUser, ip: string): Promise<ProduitSurveilleDto> {
    await this.verifierFournisseur(body.fournisseurId, user);
    return this.db
      .tx(async (c, k) => {
        if (await k.selectFrom('vulnerabilites_produits').select('id').where(memeProduit(body)).executeTakeFirst())
          throw new HttpError(409, DOUBLON);
        if (body.responsable) await this.grc.annuaires.resoudre(null, body.responsable, c);
        const { id } = await k
          .insertInto('vulnerabilites_produits')
          .values({
            fournisseur_id: body.fournisseurId,
            editeur: body.editeur,
            nom: body.nom,
            version_produit: body.versionProduit,
            cpe: body.cpe,
            famille: body.famille,
            criticite: body.criticite,
            responsable: body.responsable ? JSON.stringify(body.responsable) : null,
            origine: 'saisie',
            created_by: user.username,
            updated_by: user.username,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const cree = await this.lire(id, k);
        await this.db.audit(user, ip, 'vulnerabilites.produit.cree', id, { ...resume(cree), origine: cree.origine }, c);
        return cree;
      }, user.username)
      .catch(doublonEnBase);
  }

  async modifier(
    id: string,
    patch: ProduitSurveillePatch,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<ProduitSurveilleDto> {
    return this.db
      .tx(async (c, k) => {
        const avant = await this.lire(id, k, true);
        if (avant.version !== attendue) throw conflict({ ...avant });
        const apres = { ...resume(avant), ...patch };
        // Un lien inchangé reste valable même pour qui ne lit pas les fournisseurs ; un nouveau lien est contrôlé.
        if (patch.fournisseurId !== undefined && patch.fournisseurId !== avant.fournisseurId)
          await this.verifierFournisseur(patch.fournisseurId, user);
        if (
          await k
            .selectFrom('vulnerabilites_produits')
            .select('id')
            .where(memeProduit(apres))
            .where('id', '<>', id)
            .executeTakeFirst()
        )
          throw new HttpError(409, DOUBLON);
        if (patch.responsable) await this.grc.annuaires.resoudre(null, patch.responsable, c);
        await k
          .updateTable('vulnerabilites_produits')
          .set((eb) => ({
            fournisseur_id: apres.fournisseurId,
            editeur: apres.editeur,
            nom: apres.nom,
            version_produit: apres.versionProduit,
            cpe: apres.cpe,
            famille: apres.famille,
            criticite: apres.criticite,
            responsable: apres.responsable ? JSON.stringify(apres.responsable) : null,
            version: eb('version', '+', 1),
            updated_by: user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', id)
          .execute();
        const modifie = await this.lire(id, k);
        const champs = (Object.keys(patch) as (keyof ProduitSurveillePatch)[])
          .filter((cle) => JSON.stringify(resume(avant)[cle]) !== JSON.stringify(resume(modifie)[cle]))
          .sort();
        await this.db.audit(
          user,
          ip,
          'vulnerabilites.produit.modifie',
          id,
          { champs, avant: resume(avant), apres: resume(modifie), version: modifie.version },
          c,
        );
        return modifie;
      }, user.username)
      .catch(doublonEnBase);
  }

  async supprimer(id: string, attendue: number, user: SessionUser, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      const p = await this.lire(id, k, true);
      if (p.version !== attendue) throw conflict({ ...p });
      await k.deleteFrom('vulnerabilites_produits').where('id', '=', id).execute();
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.produit.supprime',
        id,
        { ...resume(p), origine: p.origine, version: p.version },
        c,
      );
    }, user.username);
  }

  /** Le fournisseur lié doit figurer au registre de l'organisation, lu avec les droits de la personne (porte de lecture,
      ADR 0083) : module « fournisseurs » actif et lisible, sinon le lien est refusé. */
  private async verifierFournisseur(fournisseurId: string | null, user: SessionUser) {
    if (fournisseurId === null) return;
    const porte = PorteeLecture.pour(this.grc, user);
    if (!(await porte.peutLireModule('fournisseurs')))
      throw new HttpError(
        422,
        'Lier un fournisseur demande le droit de lire les fournisseurs, module actif : laissez le champ vide et indiquez l’éditeur.',
      );
    const etat = await porte.etatHistoriqueSiPresent();
    const fiches = Array.isArray(etat?.data.suppliers) ? etat.data.suppliers : [];
    if (!fiches.some((s) => isObject(s) && s.id === fournisseurId))
      throw new HttpError(422, 'Fournisseur absent du registre de l’organisation.');
  }

  /** Libellés des responsables désignés (personne, groupe ou fonction), en trois requêtes au plus. */
  private async libelles(lignes: Ligne[], k: Kdb): Promise<Map<string, string>> {
    const ids = { utilisateur: new Set<string>(), groupe: new Set<string>(), fonction: new Set<string>() };
    for (const r of lignes) {
      const ref = r.responsable as ResponsableRef | null;
      if (ref && ids[ref.type]) ids[ref.type].add(ref.id);
    }
    const out = new Map<string, string>();
    const ajouter = (type: ResponsableRef['type'], rows: { id: string; l: string }[]) => {
      for (const r of rows) out.set(`${type}:${r.id}`, r.l);
    };
    if (ids.utilisateur.size)
      ajouter(
        'utilisateur',
        await k
          .selectFrom('users')
          .select(['id', nomAffiche.as('l')])
          .where('id', 'in', [...ids.utilisateur])
          .execute(),
      );
    if (ids.groupe.size)
      ajouter(
        'groupe',
        await k
          .selectFrom('groups')
          .select(['id', 'name as l'])
          .where('id', 'in', [...ids.groupe])
          .execute(),
      );
    if (ids.fonction.size)
      ajouter(
        'fonction',
        await k
          .selectFrom('fonctions')
          .select(['id', 'name as l'])
          .where('id', 'in', [...ids.fonction])
          .execute(),
      );
    return out;
  }
}
