/* Contenu des documents pour l'assistant (ADR 0086, point 12 ; décision A9).
   - Le texte de la version courante de chaque document est extrait par un processus séparé et sans droits, puis gardé dans
     la base avec un index de recherche. Il disparaît avec la version, avec le document, et dès qu'aucun profil de
     l'assistant n'est plus autorisé à lire les documents.
   - L'assistant ne lit un document qu'avec le droit « documents:lire » de la personne (ou du référent de la ronde), si le
     profil y est autorisé, et jusqu'au niveau de classification réglé pour ce profil.
   - Aucun texte de norme n'est reconstitué : seul ce que l'organisation a déposé est lu. */
import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'kysely';
import type { Logger } from 'pino';
import type { SessionUser } from '../auth.js';
import type { Config } from '../config.js';
import type { Db } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Vault } from '../security/crypto.js';
import { extraireTexte, type Extraction } from './extraction.js';
import { extrairePdf } from './extraction-pdf.js';
import type { Assistant } from './index.js';
import type { LectureDocuments } from './outils.js';

export const CLASSIFICATIONS = ['public', 'interne', 'restreint', 'confidentiel'] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];
const TAILLE_MAX = 50 * 1024 * 1024;
const PARTIE = 6000;
const DELAI_MS = 20_000;
const SORTIE_MAX = 4 * 1024 * 1024;

const ENTREE = fileURLToPath(new URL('../assistant-extracteur.js', import.meta.url));
/** En développement et en test, le code tourne depuis les sources TypeScript : l'extraction se fait alors dans le processus
    courant. L'isolation par processus séparé vaut pour l'image construite (dist). */
const ISOLE = !import.meta.url.endsWith('.ts');

/** Dossiers que le processus d'extraction peut lire : le code de l'application et la bibliothèque PDF, rien d'autre. */
function dossiersLisibles(entree: string): string[] {
  const dossiers = [path.dirname(entree)];
  // pnpm installe par lien symbolique : Node lit le lien (dans un dossier node_modules parent) puis sa cible. Les deux
  // doivent être lisibles ; rien d'autre de node_modules ne l'est.
  for (const base of createRequire(import.meta.url).resolve.paths('pdfjs-dist') ?? []) {
    const lien = path.join(base, 'pdfjs-dist');
    if (!existsSync(lien)) continue;
    dossiers.push(lien, realpathSync(lien));
    break;
  }
  return [...new Set(dossiers)];
}

/** Extraction dans un processus fils sans droits : pas d'écriture, lecture limitée au code de l'application, pas de
    processus fils, aucune variable d'environnement, mémoire et durée bornées. */
export function extraireIsole(ext: string, buf: Buffer, entree = ENTREE): Promise<Extraction> {
  return new Promise((resolve) => {
    const echec = (motif: string) => resolve({ etat: 'non_lu', motif });
    const fils = spawn(
      process.execPath,
      [
        '--permission',
        ...dossiersLisibles(entree).map((d) => `--allow-fs-read=${d}`),
        '--max-old-space-size=384',
        entree,
        ext,
      ],
      { env: {}, stdio: ['pipe', 'pipe', 'ignore'], timeout: DELAI_MS },
    );
    const morceaux: Buffer[] = [];
    let taille = 0;
    fils.stdout.on('data', (c: Buffer) => {
      taille += c.length;
      if (taille > SORTIE_MAX) fils.kill('SIGKILL');
      else morceaux.push(c);
    });
    fils.on('error', () => echec('L’extraction n’a pas pu démarrer.'));
    fils.on('close', (code) => {
      if (code !== 0) return echec('Le document n’a pas pu être lu (extraction interrompue).');
      try {
        const r = JSON.parse(Buffer.concat(morceaux).toString('utf8')) as Extraction;
        if (r.etat === 'extrait' && typeof r.texte === 'string') resolve({ etat: 'extrait', texte: r.texte });
        else echec(typeof (r as { motif?: unknown }).motif === 'string' ? (r as { motif: string }).motif : 'Non lu.');
      } catch {
        echec('Le document n’a pas pu être lu.');
      }
    });
    fils.stdin.on('error', () => {});
    fils.stdin.end(buf);
  });
}

export class DocumentsAssistant {
  constructor(
    private readonly db: Db,
    private readonly vault: Vault,
    private readonly cfg: Config,
    private readonly assistant: Assistant,
    private readonly log: Logger,
  ) {}

  /** Un profil actif au moins est autorisé à lire les documents, et l'assistant est activé. */
  private async voulu(): Promise<boolean> {
    const { r, profils } = await this.assistant.lire();
    return r.actif && [...profils.values()].some((p) => p.actif && p.documents);
  }

  /** Appelé par le tic de l'API : extrait le texte de quelques documents en attente. Sans profil autorisé, l'index est vidé. */
  async indexer(max = 5): Promise<number> {
    if (!(await this.voulu())) {
      await this.db.k.deleteFrom('document_textes').execute();
      return 0;
    }
    // Versions remplacées et documents supprimés : leur texte n'a plus à être gardé.
    await sql`DELETE FROM document_textes t USING documents d
               WHERE d.id = t.document_id AND (d.deleted_at IS NOT NULL OR d.current_version <> t.version)`.execute(
      this.db.k,
    );
    const attente = await this.db.k
      .selectFrom('documents as d')
      .innerJoin('document_versions as v', (j) =>
        j.onRef('v.document_id', '=', 'd.id').onRef('v.version', '=', 'd.current_version'),
      )
      .leftJoin('document_textes as t', (j) =>
        j.onRef('t.document_id', '=', 'd.id').onRef('t.version', '=', 'v.version'),
      )
      .select([
        'd.id',
        'v.version',
        'v.filename',
        'v.size',
        'v.scan_status',
        'v.iv',
        'v.auth_tag',
        'v.content',
        'v.key_id',
      ])
      .where('d.deleted_at', 'is', null)
      .where('t.document_id', 'is', null)
      .orderBy('d.updated_at')
      .limit(max)
      .execute();
    for (const v of attente) {
      let r: Extraction;
      if (Number(v.size) > TAILLE_MAX) r = { etat: 'non_lu', motif: 'Document trop volumineux pour être lu.' };
      // Après le contrôle antivirus (ADR 0086, point 12) : quand un antivirus est installé, seul un fichier sain est lu.
      else if (this.cfg.clamav && v.scan_status !== 'sain')
        r = { etat: 'non_lu', motif: 'Document non analysé par l’antivirus : il n’est pas lu.' };
      else
        try {
          const clair = this.vault.decrypt(
            { iv: v.iv, tag: v.auth_tag, content: v.content, keyId: v.key_id },
            `doc:${v.id}:${v.version}`,
          );
          const ext = v.filename.split('.').pop() ?? '';
          r = ISOLE
            ? await extraireIsole(ext, clair)
            : ext.toLowerCase() === 'pdf'
              ? await extrairePdf(clair)
              : extraireTexte(ext, clair);
        } catch (e) {
          this.log.warn({ id: v.id, err: (e as Error).message }, 'assistant : extraction impossible');
          r = { etat: 'non_lu', motif: 'Le document n’a pas pu être déchiffré.' };
        }
      await this.db.k
        .insertInto('document_textes')
        .values({
          document_id: v.id,
          version: v.version,
          etat: r.etat,
          motif: r.etat === 'non_lu' ? r.motif : '',
          texte: r.etat === 'extrait' ? r.texte : '',
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
    return attente.length;
  }

  /** Lecture des documents pour une personne et un profil : rien sans le droit « documents:lire ». */
  pour(user: SessionUser, classificationMax: Classification): LectureDocuments {
    const niveaux = CLASSIFICATIONS.slice(0, CLASSIFICATIONS.indexOf(classificationMax) + 1);
    const exiger = () => {
      if (!user.rights.can('documents', 'lire'))
        throw new HttpError(403, 'Les documents ne sont pas accessibles à cette personne.');
    };
    return {
      chercher: async (recherche) => {
        exiger();
        const { rows } = await this.db.pool.query<{
          id: string;
          title: string;
          category: string;
          classification: string;
          extrait: string;
        }>(
          `SELECT d.id::text, d.title, d.category, d.classification,
                  ts_headline('french', left(t.texte, 50000), q, 'MaxWords=40, MinWords=15, MaxFragments=2') AS extrait
             FROM document_textes t
             JOIN documents d ON d.id = t.document_id AND d.current_version = t.version,
                  websearch_to_tsquery('french', $1) q
            WHERE d.deleted_at IS NULL AND t.etat = 'extrait' AND d.classification = ANY($2::text[])
              AND (t.recherche @@ q OR position(lower($1) in lower(d.title)) > 0)
            ORDER BY ts_rank(t.recherche, q) DESC, d.updated_at DESC
            LIMIT 8`,
          [recherche, niveaux],
        );
        // Liens : titre, adresse, catégorie et description seulement. La page visée n'est jamais ouverte (l'API n'a aucun
        // accès sortant) ; chaque mot cherché doit apparaître dans l'une de ces métadonnées.
        const mots = recherche
          .toLowerCase()
          .split(/\s+/)
          .filter((m) => m.length >= 2)
          .slice(0, 6);
        const liens = mots.length
          ? await this.db.pool.query<{ id: string; title: string; url: string; category: string; description: string }>(
              `SELECT l.id::text, l.title, l.url, l.category, l.description
                 FROM links l
                WHERE l.deleted_at IS NULL
                  AND (SELECT bool_and(position(m in lower(l.title || ' ' || l.description || ' ' || l.category || ' ' || l.url)) > 0)
                         FROM unnest($1::text[]) m)
                ORDER BY l.updated_at DESC
                LIMIT 8`,
              [mots],
            )
          : { rows: [] };
        return {
          documents: rows.map((d) => ({
            id: d.id,
            titre: d.title,
            categorie: d.category,
            classification: d.classification,
            extrait: d.extrait.replace(/<\/?b>/g, ''),
          })),
          liens: liens.rows.map((l) => ({
            id: l.id,
            titre: l.title,
            adresse: l.url.slice(0, 500),
            categorie: l.category,
            description: l.description.slice(0, 300),
          })),
        };
      },
      lire: async (id, partie) => {
        exiger();
        const d = await this.db.k
          .selectFrom('documents as d')
          .leftJoin('document_textes as t', (j) =>
            j.onRef('t.document_id', '=', 'd.id').onRef('t.version', '=', 'd.current_version'),
          )
          .select([
            'd.id',
            'd.title',
            'd.category',
            'd.classification',
            'd.current_version',
            't.etat',
            't.motif',
            't.texte',
          ])
          .where('d.id', '=', id)
          .where('d.deleted_at', 'is', null)
          .where('d.classification', 'in', niveaux)
          .executeTakeFirst();
        // Document absent, supprimé ou classé au-dessus du niveau du profil : même réponse.
        if (!d) throw new HttpError(404, 'Document introuvable ou non ouvert à ce profil de l’assistant.');
        const base = { id: d.id, titre: d.title, categorie: d.category, version: d.current_version };
        if (d.etat !== 'extrait')
          return { ...base, lisible: false, motif: d.motif || 'Le texte de ce document n’est pas encore disponible.' };
        const texte = d.texte ?? '';
        const parties = Math.max(1, Math.ceil(texte.length / PARTIE));
        const n = Math.min(Math.max(partie, 1), parties);
        return { ...base, lisible: true, partie: n, parties, texte: texte.slice((n - 1) * PARTIE, n * PARTIE) };
      },
    };
  }

  /** État de l'index, pour l'écran de réglages. */
  async etat(): Promise<{ extraits: number; nonLus: number; enAttente: number }> {
    const { rows } = await this.db.pool.query<{ extraits: number; non_lus: number; en_attente: number }>(
      `SELECT count(*) FILTER (WHERE t.etat = 'extrait')::int AS extraits,
              count(*) FILTER (WHERE t.etat IN ('non_lu', 'echec'))::int AS non_lus,
              count(*) FILTER (WHERE t.document_id IS NULL)::int AS en_attente
         FROM documents d
         LEFT JOIN document_textes t ON t.document_id = d.id AND t.version = d.current_version
        WHERE d.deleted_at IS NULL AND d.current_version > 0`,
    );
    return { extraits: rows[0]!.extraits, nonLus: rows[0]!.non_lus, enAttente: rows[0]!.en_attente };
  }
}
