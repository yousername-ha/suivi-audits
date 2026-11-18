/* Appel du modèle de langage (ADR 0086, point 2). L'API n'a aucun accès sortant : elle remet la demande au relais
   (conteneur « assistant-relais », réseau interne), seul à joindre le fournisseur. Format « chat completions » compatible
   OpenAI. La clé ne quitte l'API que vers le relais, jamais vers le navigateur ni un journal. */
import { z } from 'zod';
import { HttpError } from '../http/errors.js';

export interface AppelOutil {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
export interface MessageModele {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: AppelOutil[];
  tool_call_id?: string;
  name?: string;
}
export interface OutilDeclare {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}
export interface DemandeModele {
  model: string;
  messages: MessageModele[];
  tools?: OutilDeclare[];
  tool_choice?: 'auto';
  temperature?: number;
  max_tokens?: number;
}
export interface ReponseModele {
  message: MessageModele;
  jetonsEntree: number;
  jetonsSortie: number;
}
export interface TransportModele {
  /** Une adresse de relais est connue (sinon l'assistant ne peut pas répondre, et l'interface le dit). Le flux vers le
      fournisseur, lui, est contrôlé par l'assistant avant tout appel (ADR 0097). */
  declare(): boolean;
  completer(adresse: string, cle: string, demande: DemandeModele): Promise<ReponseModele>;
}

/** Réponse du fournisseur : seuls les champs utilisés sont lus ; le reste est ignoré. */
const Reponse = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([z.string(), z.null()]).optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().max(200),
                function: z.object({ name: z.string().max(200), arguments: z.string().max(100_000) }),
              }),
            )
            .max(16)
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().min(0).optional(),
      completion_tokens: z.number().int().min(0).optional(),
    })
    .optional(),
});
const DuRelais = z.object({ statut: z.number().int(), corps: z.unknown(), erreur: z.string().max(400).optional() });

/** Message court et sans détail interne, selon la réponse du fournisseur. */
function messageFournisseur(statut: number): string {
  if (statut === 401 || statut === 403) return 'Le fournisseur du modèle refuse la clé enregistrée.';
  if (statut === 404) return 'Le fournisseur du modèle ne connaît pas cette adresse ou ce modèle.';
  if (statut === 429) return 'Le fournisseur du modèle limite les appels : réessayez dans un instant.';
  if (statut >= 500) return 'Le fournisseur du modèle est momentanément indisponible.';
  return `Le fournisseur du modèle a refusé la demande (code ${statut}).`;
}

/** Écarts connus au format « chat completions » classique, par hôte du fournisseur (documentation publique, relevé du
    15/11/2026). Tout autre hôte reçoit la demande telle quelle.
    - OpenAI : ses modèles actuels raisonnent ; l'appel d'outils n'y est accepté qu'avec `reasoning_effort: "none"`, le
      plafond de sortie s'appelle `max_completion_tokens` et la température n'est pas réglable.
    - Anthropic : ses modèles actuels refusent une température inférieure à 1 et réfléchissent d'office ; ce travail compte
      dans le plafond de sortie, relevé pour ne pas tronquer la réponse. */
const PLANCHER_SORTIE_ANTHROPIC = 4096;
export function adapterDemande(adresse: string, demande: DemandeModele): Record<string, unknown> {
  let hote = '';
  try {
    hote = new URL(adresse).hostname;
  } catch {
    /* adresse illisible : demande inchangée, le relais la refusera */
  }
  if (hote === 'api.openai.com') {
    const { temperature: _t, max_tokens, ...reste } = demande;
    return { ...reste, ...(max_tokens ? { max_completion_tokens: max_tokens } : {}), reasoning_effort: 'none' };
  }
  if (hote === 'api.anthropic.com') {
    const { temperature: _t, max_tokens, ...reste } = demande;
    return { ...reste, ...(max_tokens ? { max_tokens: Math.max(max_tokens, PLANCHER_SORTIE_ANTHROPIC) } : {}) };
  }
  return { ...demande };
}

export class RelaisModele implements TransportModele {
  constructor(
    private readonly url: string,
    private readonly delaiMs = 150_000,
  ) {}

  declare(): boolean {
    return this.url !== '';
  }

  async completer(adresse: string, cle: string, demande: DemandeModele): Promise<ReponseModele> {
    if (!this.url) throw new HttpError(409, 'Le relais de modèle n’est pas installé sur le serveur.');
    let r: Response;
    try {
      r = await fetch(this.url.replace(/\/+$/, '') + '/v1/completer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adresse, cle, corps: adapterDemande(adresse, demande) }),
        signal: AbortSignal.timeout(this.delaiMs),
      });
    } catch {
      // Flux ouvert mais relais injoignable : il démarre dans la minute qui suit l'ouverture, sinon l'état appliqué le dit.
      throw new HttpError(
        502,
        'Le relais de modèle ne répond pas. Après l’ouverture du flux, il démarre en moins d’une minute ; sinon, consultez l’état appliqué dans Administration, Configuration système, Flux vers l’extérieur.',
      );
    }
    const brut = DuRelais.safeParse(await r.json().catch(() => null));
    if (!r.ok || !brut.success) throw new HttpError(502, 'Le relais de modèle a renvoyé une réponse inattendue.');
    if (brut.data.erreur) throw new HttpError(502, brut.data.erreur);
    if (brut.data.statut < 200 || brut.data.statut >= 300)
      throw new HttpError(502, messageFournisseur(brut.data.statut));
    return lireReponse(brut.data.corps);
  }
}

export function lireReponse(corps: unknown): ReponseModele {
  const p = Reponse.safeParse(corps);
  if (!p.success) throw new HttpError(502, 'Le fournisseur du modèle a renvoyé une réponse illisible.');
  const m = p.data.choices[0]!.message;
  return {
    message: {
      role: 'assistant',
      content: m.content ?? null,
      ...(m.tool_calls?.length
        ? { tool_calls: m.tool_calls.map((t) => ({ id: t.id, type: 'function' as const, function: t.function })) }
        : {}),
    },
    jetonsEntree: p.data.usage?.prompt_tokens ?? 0,
    jetonsSortie: p.data.usage?.completion_tokens ?? 0,
  };
}
