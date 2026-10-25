/* Chargement du kit IA dans l'interface (ADR 0055) : un ou plusieurs fichiers JSON, reconnus d'après leur contenu et non
   leur nom. Un fichier peut être le kit complet (objet avec « controls ») ou une liste (contrôles, correspondances,
   actions, scénarios, deltas HDS, mémos, questionnaire, sources). Aucune donnée n'est conservée dans le navigateur. */

export type RubriqueKit =
  'controls' | 'correspondances' | 'actions' | 'scenarios' | 'deltas' | 'memosHds' | 'questionnaire' | 'sources';

const LIBELLES: Record<RubriqueKit, string> = {
  controls: 'contrôles',
  correspondances: 'correspondances',
  actions: 'actions suggérées',
  scenarios: 'scénarios de risque',
  deltas: 'deltas HDS 2.1',
  memosHds: 'mémos HDS',
  questionnaire: 'questionnaire',
  sources: 'sources',
};
export const libelleRubrique = (r: RubriqueKit) => LIBELLES[r];

const a = (o: Record<string, unknown>, ...cles: string[]) => cles.some((c) => c in o);
/** Rubrique d'une liste d'après les champs de son premier élément ; null si elle n'est pas reconnue. */
export function reconnaitre(liste: readonly unknown[]): RubriqueKit | null {
  const premier = liste[0];
  if (!premier || typeof premier !== 'object' || Array.isArray(premier)) return null;
  const o = premier as Record<string, unknown>;
  if (a(o, 'internal_control_id')) return 'correspondances';
  if (a(o, 'requirement_fr')) return 'controls';
  if (a(o, 'delta_id')) return 'deltas';
  if (a(o, 'suggestion_fr')) return 'actions';
  if (a(o, 'scenario_fr')) return 'scenarios';
  if (a(o, 'question_fr')) return 'questionnaire';
  if (a(o, 'thematic_memo_fr', 'reference_memo_fr')) return 'memosHds';
  if (a(o, 'url') && a(o, 'title')) return 'sources';
  return null;
}

export interface KitCharge {
  kit: Record<string, unknown>;
  /** Rubriques trouvées avec leur effectif, dans l'ordre de lecture. */
  trouvees: { rubrique: RubriqueKit; n: number; fichier: string }[];
  problemes: string[];
}

/** Assemble les fichiers lus (nom, texte) en un kit ; les rubriques répétées sont refusées plutôt que fusionnées. */
export function assembler(fichiers: readonly { nom: string; texte: string }[]): KitCharge {
  const kit: Record<string, unknown> = {};
  const trouvees: KitCharge['trouvees'] = [];
  const problemes: string[] = [];
  const poser = (rubrique: RubriqueKit, valeur: unknown[], fichier: string) => {
    if (rubrique in kit) {
      problemes.push(`${fichier} : la rubrique « ${LIBELLES[rubrique]} » est déjà fournie par un autre fichier.`);
      return;
    }
    kit[rubrique] = valeur;
    trouvees.push({ rubrique, n: valeur.length, fichier });
  };
  for (const { nom, texte } of fichiers) {
    let json: unknown;
    try {
      json = JSON.parse(texte);
    } catch {
      problemes.push(`${nom} : ce fichier n’est pas un JSON valide.`);
      continue;
    }
    if (Array.isArray(json)) {
      if (!json.length) continue; // liste vide : rien à importer pour cette rubrique, ce n'est pas une erreur
      const rubrique = reconnaitre(json);
      if (rubrique) poser(rubrique, json, nom);
      else problemes.push(`${nom} : liste non reconnue (aucune rubrique du kit ne correspond à ses champs).`);
      continue;
    }
    if (!json || typeof json !== 'object') {
      problemes.push(`${nom} : contenu inattendu.`);
      continue;
    }
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.controls)) {
      for (const [k, v] of Object.entries(o)) {
        if (k === 'version') {
          if (typeof v === 'string') kit.version = v;
        } else if (k in LIBELLES && Array.isArray(v)) poser(k as RubriqueKit, v, nom);
      }
      continue;
    }
    if (typeof o.version === 'string' && Object.keys(o).length === 1) {
      kit.version = o.version;
      continue;
    }
    problemes.push(`${nom} : objet non reconnu (le kit complet porte une liste « controls »).`);
  }
  if (!('controls' in kit)) problemes.push('Aucun fichier de contrôles : le kit ne peut pas être importé.');
  return { kit, trouvees, problemes };
}
