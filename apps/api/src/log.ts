/* Journaux JSON (pino) sur la sortie standard, collectables par le SIEM via le pilote de logs Docker.
   Les secrets (cookies, jetons, mots de passe) sont masqués. */
import { pino, type Logger } from 'pino';

const REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.current',
  '*.next',
  '*.token',
  '*.code',
  '*.privateKey',
  'req.body.privateKey',
  '*.secret',
];

/** Niveaux de la journalisation technique, du plus détaillé au plus sobre. Les erreurs (error, fatal) sont toujours collectées. */
export const NIVEAUX_TECHNIQUES = ['debug', 'info', 'warn', 'error'] as const;
export type NiveauTechnique = (typeof NIVEAUX_TECHNIQUES)[number];
const RANG: Record<string, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

export interface EntreeJournal {
  n: number;
  date: string;
  niveau: string;
  message: string;
  contexte: Record<string, unknown>;
}
const CONTEXTE_MAX = 4000;

/** Dernières entrées du journal technique, gardées en mémoire (les secrets sont déjà masqués par pino). La sortie
    standard reste la source complète, collectée par le pilote de logs Docker ; ce tampon n'en garde que la fin. */
export class Tampon {
  private entrees: EntreeJournal[] = [];
  private compteur = 0;
  constructor(readonly capacite = 5000) {}

  ajouter(ligne: string): void {
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(ligne) as Record<string, unknown>;
    } catch {
      return;
    }
    const { level, time, msg, app: _app, ...contexte } = o;
    const brut = JSON.stringify(contexte);
    this.entrees.push({
      n: ++this.compteur,
      date: typeof time === 'string' ? time : new Date().toISOString(),
      niveau: typeof level === 'string' ? level : 'info',
      message: typeof msg === 'string' ? msg : '',
      contexte: brut.length > CONTEXTE_MAX ? { tronque: true } : contexte,
    });
    if (this.entrees.length > this.capacite) this.entrees.splice(0, this.entrees.length - this.capacite);
  }

  /** Entrées de la plus récente à la plus ancienne ; `avant` : numéro de la dernière entrée déjà reçue. */
  lister(f: { niveauMin?: string; q?: string; avant?: number; limite: number }): {
    entrees: EntreeJournal[];
    reste: boolean;
  } {
    const seuil = RANG[f.niveauMin ?? 'debug'] ?? 0;
    const q = f.q?.toLowerCase();
    const out: EntreeJournal[] = [];
    let reste = false;
    for (let i = this.entrees.length - 1; i >= 0; i--) {
      const e = this.entrees[i]!;
      if (f.avant !== undefined && e.n >= f.avant) continue;
      if ((RANG[e.niveau] ?? 0) < seuil) continue;
      if (q && !(e.message.toLowerCase().includes(q) || JSON.stringify(e.contexte).toLowerCase().includes(q))) continue;
      if (out.length === f.limite) {
        reste = true;
        break;
      }
      out.push(e);
    }
    return { entrees: out, reste };
  }

  get taille(): number {
    return this.entrees.length;
  }
  get plusAncienne(): string | null {
    return this.entrees[0]?.date ?? null;
  }
}

const TAMPONS = new WeakMap<Logger, Tampon>();
/** Tampon associé à un journal créé par `createLogger`. */
export const tamponDe = (l: Logger): Tampon => TAMPONS.get(l) ?? new Tampon(1);

export function createLogger(level = process.env.LOG_LEVEL || 'info'): Logger {
  const tampon = new Tampon();
  // Sortie standard inchangée, avec copie dans le tampon consultable depuis l'administration.
  const sortie = {
    write(ligne: string) {
      process.stdout.write(ligne);
      tampon.ajouter(ligne);
    },
  };
  const l = pino(
    {
      level,
      base: { app: 'suivi-audits' },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: REDACT, censor: '[masqué]' },
      formatters: { level: (label) => ({ level: label }) },
    },
    sortie,
  );
  TAMPONS.set(l, tampon);
  return l;
}

export const log = createLogger();
