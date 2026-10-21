/* Journaux techniques (012-13) : niveau de journalisation du serveur réglable à chaud, avec un niveau « debug » toujours
   temporaire, et consultation des dernières entrées. Le niveau est un seuil technique : il ne touche ni les erreurs
   (toujours collectées) ni le journal d'audit (table SQL en ajout seul, indépendante). L'état « appliqué » est celui du
   journal en cours d'exécution, pas la valeur demandée. */
import type { Logger } from 'pino';
import type { Actor, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import { tamponDe, type EntreeJournal } from './log.js';

export type NiveauPermanent = 'info' | 'warn';
export interface EtatJournalTechnique {
  /** Seuil permanent demandé (info ou warn). */
  niveauPermanent: NiveauPermanent;
  /** Niveau réellement appliqué par le serveur en ce moment. */
  niveauApplique: string;
  /** Fin du niveau debug temporaire, s'il est actif. */
  debugJusqua: string | null;
  modifiePar: string;
  modifieLe: string | null;
  tampon: { taille: number; capacite: number; plusAncienne: string | null };
}
interface Ligne {
  niveau: NiveauPermanent;
  debug_jusqua: Date | null;
  modifie_par: string;
  modifie_le: Date;
}

export const DUREE_DEBUG_MAX_MINUTES = 24 * 60;

export class JournalTechnique {
  private permanent: NiveauPermanent;
  private debugJusqua: Date | null = null;
  private modifiePar = '';
  private modifieLe: Date | null = null;

  constructor(
    private readonly db: Db,
    private readonly log: Logger,
  ) {
    this.permanent = this.log.level === 'warn' ? 'warn' : 'info';
  }

  /** Reprend la configuration enregistrée (au démarrage) : un debug échu n'est pas rétabli. */
  async charger(): Promise<void> {
    const r = (
      await this.db.q<Ligne>(
        'SELECT niveau, debug_jusqua, modifie_par, modifie_le FROM journal_technique_config WHERE id=1',
      )
    ).rows[0];
    if (!r) return;
    this.permanent = r.niveau;
    this.modifiePar = r.modifie_par;
    this.modifieLe = r.modifie_le;
    this.debugJusqua = r.debug_jusqua && r.debug_jusqua.getTime() > Date.now() ? r.debug_jusqua : null;
    this.log.level = this.debugJusqua ? 'debug' : this.permanent;
  }

  /** Ramène le seuil permanent quand le debug temporaire est échu ; appelée régulièrement. */
  async expirer(): Promise<boolean> {
    if (!this.debugJusqua || this.debugJusqua.getTime() > Date.now()) return false;
    this.debugJusqua = null;
    this.log.level = this.permanent;
    await this.db.q('UPDATE journal_technique_config SET debug_jusqua=NULL WHERE id=1');
    await this.db.audit(null, null, 'admin.journal_technique_debug_expire', '', { niveau: this.permanent });
    this.log.info({ niveau: this.permanent }, 'niveau debug échu : seuil permanent rétabli');
    return true;
  }

  etat(): EtatJournalTechnique {
    const t = tamponDe(this.log);
    return {
      niveauPermanent: this.permanent,
      niveauApplique: this.log.level,
      debugJusqua: this.debugJusqua?.toISOString() ?? null,
      modifiePar: this.modifiePar,
      modifieLe: this.modifieLe?.toISOString() ?? null,
      tampon: { taille: t.taille, capacite: t.capacite, plusAncienne: t.plusAncienne },
    };
  }

  /** Change le seuil. `debug` exige une durée (au plus 24 h) ; info et warn sont permanents et mettent fin à un debug. */
  async modifier(
    niveau: 'debug' | NiveauPermanent,
    dureeMinutes: number | undefined,
    reason: string,
    user: Actor,
    ip: string,
  ): Promise<EtatJournalTechnique> {
    if (niveau === 'debug' && !dureeMinutes)
      throw new HttpError(422, 'Le niveau debug est temporaire : indiquez une durée (24 heures au plus).');
    const permanent: NiveauPermanent = niveau === 'debug' ? this.permanent : niveau;
    const jusqua = niveau === 'debug' ? new Date(Date.now() + dureeMinutes! * 60_000) : null;
    const avant = this.etat();
    await this.db.q(
      `INSERT INTO journal_technique_config(id, niveau, debug_jusqua, modifie_par, modifie_le) VALUES (1,$1,$2,$3,now())
       ON CONFLICT (id) DO UPDATE SET niveau=$1, debug_jusqua=$2, modifie_par=$3, modifie_le=now()`,
      [permanent, jusqua, user.username],
    );
    this.permanent = permanent;
    this.debugJusqua = jusqua;
    this.modifiePar = user.username;
    this.modifieLe = new Date();
    this.log.level = niveau === 'debug' ? 'debug' : permanent;
    await this.db.audit(user, ip, 'admin.journal_technique_niveau', '', {
      avant: { permanent: avant.niveauPermanent, applique: avant.niveauApplique, debugJusqua: avant.debugJusqua },
      apres: { permanent, applique: this.log.level, debugJusqua: jusqua?.toISOString() ?? null },
      reason,
    });
    return this.etat();
  }

  lire(f: { niveauMin?: string; q?: string; avant?: number; limite: number }): {
    entrees: EntreeJournal[];
    reste: boolean;
  } {
    return tamponDe(this.log).lister(f);
  }
}
