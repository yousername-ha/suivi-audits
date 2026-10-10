import { Accordion, Button, Checkbox, Group, NumberInput, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
const labels: Record<string, string> = {
  motive: 'Motivation',
  resources: 'Ressources et capacités',
  targetObjective: 'Objectif visé',
  consequences: 'Conséquences',
  severity: 'Gravité',
  businessValue: 'Valeur métier',
  mission: 'Mission',
  entity: 'Entité',
  scope: 'Périmètre',
  securityDomain: 'Domaine de sécurité',
  assetType: 'Type d’actif',
  location: 'Localisation',
  attackPath: 'Chemin stratégique',
  ecosystem: 'Écosystème',
  attackSequence: 'Séquence d’attaque',
  expectedEffect: 'Effet attendu',
  verification: 'Vérification d’efficacité',
  reviewAt: 'Date de revue',
  frequency: 'Fréquence',
  result: 'Résultat',
  performedAt: 'Date du contrôle',
  validUntil: 'Validité',
  target: 'Cible',
  unit: 'Unité',
  measuredAt: 'Date de mesure',
  dueAt: 'Échéance',
  applicable: 'Applicable',
  implemented: 'Mis en œuvre',
  refs: 'Références liées',
  ownerId: 'Responsable',
  justification: 'Justification',
  name: 'Nom',
  identifier: 'Identifiant',
  id: 'Identifiant',
  label: 'Libellé',
  description: 'Description',
  definition: 'Définition',
  source: 'Source officielle',
  organisation: 'Organisme',
  document: 'Document',
  url: 'Adresse officielle',
  version: 'Version',
  date: 'Date',
  license: 'Licence et droits de reproduction',
  verifiedAt: 'Date de vérification',
  normative: 'Exigence normative',
  status: 'Statut',
  domains: 'Domaines',
  requirements: 'Exigences',
  title: 'Titre',
  domain: 'Domaine',
  applicability: 'Applicabilité',
  measureRefs: 'Références des mesures',
  family: 'Méthodologie',
  stages: 'Étapes et ateliers',
  requires: 'Étapes préalables',
  fields: 'Formulaires et champs',
  stage: 'Étape',
  type: 'Type',
  required: 'Obligatoire',
  options: 'Choix proposés',
  dimensions: 'Dimensions d’impact',
  levels: 'Échelles et niveaux',
  value: 'Valeur',
  likelihood: 'Vraisemblance',
  color: 'Couleur hexadécimale',
  acceptability: 'Acceptabilité',
  calculation: 'Règles de calcul',
  kind: 'Mode',
  dimension: 'Dimension utilisée',
  cells: 'Cellules de matrice',
  impact: 'Impact',
  level: 'Niveau de risque',
  score: 'Score facultatif',
  inputs: 'Entrées des règles',
  rules: 'Règles',
  when: 'Conditions',
  strategies: 'Stratégies',
  reevaluation: 'Réévaluation',
  months: 'Périodicité en mois',
  triggers: 'Déclencheurs',
  requireApproval: 'Approbation obligatoire',
  display: 'Affichage',
  groupings: 'Regroupements',
  defaultBasis: 'Base par défaut',
  showScores: 'Afficher les scores',
  showAcceptability: 'Afficher l’acceptabilité',
  statuses: 'États du workflow',
  terminal: 'État terminal',
  transitions: 'Transitions autorisées',
  from: 'Depuis',
  to: 'Vers',
  catalogues: 'Nomenclatures',
  actionCategories: 'Catégories d’actions',
  measureCategories: 'Catégories de mesures',
  proofCategories: 'Catégories de preuves',
  controlTypes: 'Types de contrôles',
  frequencies: 'Fréquences',
  riskDomains: 'Domaines de risques',
  dashboard: 'Tableau de bord',
  cards: 'Cartes visibles',
  showOverdue: 'Afficher les retards',
  showUnvalidated: 'Afficher les propositions',
  notifications: 'Rappels',
  enabled: 'Activé',
  leadDays: 'Anticipation en jours',
  message: 'Message',
  templates: 'Modèles d’actions',
  category: 'Catégorie',
  text: 'Contenu',
  defaultTaskView: 'Vue des actions par défaut',
  weekStartsOn: 'Premier jour de la semaine (0 dimanche, 1 lundi)',
  showClosed: 'Afficher les actions closes',
};
/** Éditeur structuré partagé : conserve les types JSON, n’exécute aucune expression. */
export function ConfigurationEditor({
  value,
  onChange,
  path = 'configuration',
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  path?: string;
}) {
  const [limit, setLimit] = useState(50);
  const last = path.split('.').at(-1) ?? '';
  const seed: Record<string, unknown> = {
    domains: { id: 'domaine', label: 'Domaine' },
    requirements: {
      id: 'EX-01',
      domain: 'governance',
      title: 'Exigence à définir',
      description: '',
      applicability: '',
      measureRefs: [],
    },
    stages: { id: 'etape', label: 'Étape', description: '', requires: [] },
    fields: { id: 'champ', label: 'Champ', stage: 'stage_1', type: 'text', required: false, options: [] },
    options: { id: 'choix', label: 'Choix' },
    strategies: { id: 'reduce', label: 'Réduire', kind: 'reduce' },
    rules: { when: { severity: 'impact_1', likelihood: 'likelihood_1' }, level: 'low', score: null },
    templates: { id: 'modele', label: 'Modèle', category: 'action', text: '' },
  };
  if (Array.isArray(value))
    return (
      <Stack gap="xs">
        {value.slice(0, limit).map((v, i) => (
          <Group key={i} align="start" wrap="nowrap">
            <div className="grc-grow">
              <ConfigurationEditor
                value={v}
                onChange={(next) => onChange(value.map((old, j) => (j === i ? next : old)))}
                path={`${path}.${i + 1}`}
              />
            </div>
            <Button
              variant="subtle"
              aria-label={`Retirer ${path} ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              Retirer
            </Button>
          </Group>
        ))}
        {value.length > limit && (
          <Button variant="subtle" onClick={() => setLimit(limit + 50)}>
            Afficher les 50 éléments suivants ({value.length} au total)
          </Button>
        )}
        <Button
          variant="light"
          onClick={() =>
            onChange([
              ...value,
              value.length ? structuredClone(value[value.length - 1]) : structuredClone(seed[last] ?? ''),
            ])
          }
        >
          Ajouter à {labels[path.split('.').at(-1) ?? ''] ?? path}
        </Button>
      </Stack>
    );
  if (value && typeof value === 'object')
    return (
      <Accordion multiple>
        {Object.entries(value).map(([key, v]) => (
          <Accordion.Item key={key} value={key}>
            <Accordion.Control>{labels[key] ?? key}</Accordion.Control>
            <Accordion.Panel>
              <ConfigurationEditor
                value={v}
                onChange={(next) => onChange({ ...value, [key]: next })}
                path={`${path}.${key}`}
              />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );
  const label = labels[path.split('.').at(-1) ?? ''] ?? path;
  if (typeof value === 'boolean')
    return <Checkbox label={label} checked={value} onChange={(e) => onChange(e.currentTarget.checked)} />;
  if (typeof value === 'number')
    return <NumberInput label={label} value={value} onChange={(v) => onChange(typeof v === 'number' ? v : 0)} />;
  if (value === null)
    return (
      <Group>
        <Text>{label} : non renseigné</Text>
        <Button variant="subtle" onClick={() => onChange(0)}>
          Définir une valeur
        </Button>
      </Group>
    );
  return typeof value === 'string' && value.length > 180 ? (
    <Textarea label={label} value={value} autosize minRows={3} onChange={(e) => onChange(e.currentTarget.value)} />
  ) : (
    <TextInput label={label} value={String(value ?? '')} onChange={(e) => onChange(e.currentTarget.value)} />
  );
}
