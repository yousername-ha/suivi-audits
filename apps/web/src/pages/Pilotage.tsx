import { Alert, Anchor, Button, Card, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { Page, PageHeader } from '@suivi/ui';
import {
  type BusinessPolicy,
  type CfgKind,
  type GrcKind,
  type GrcObject,
  type PilotageRecord,
  type Module,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { PILOTAGE_LABELS } from '../pilotage-navigation';
import { Overview } from '../grc/Overview';
import { Tasks } from '../grc/Tasks';
import { ObjectEditor } from '../grc/ObjectEditor';
import { ParcoursIso } from '../parcours-iso/ParcoursIso';
import { Publication } from '../grc/Publication';
import { RiskEvaluation } from '../grc/Risks';
import { RiskMap } from '../grc/RiskMap';
import { Imports } from '../grc/Imports';
import { BusinessPolicyPanel } from '../grc/BusinessPolicy';
import { MappingPanel, Registry } from './Grc';
import { BusinessRegistry } from '../pilotage/Registry';
import { cheminRetourSur } from '../retour';
import { RecordEditor } from '../pilotage/RecordEditor';
import { Decision } from '../pilotage/Decision';
import { Members } from '../pilotage/Members';
import { Bibliotheque } from '../pilotage/Bibliotheque';
import { Perimetres } from '../pilotage/Perimetres';
import { Fournisseurs } from '../pilotage/Fournisseurs';
import { CriteresFournisseurs } from '../pilotage/CriteresFournisseurs';
import { FournisseursPerimetre } from '../pilotage/FournisseursPerimetre';
import { Rapprochements } from '../pilotage/Rapprochements';
import { Couverture } from '../pilotage/Couverture';
import { CorrespondancesBibliotheque } from '../pilotage/CorrespondancesBibliotheque';
import { useRapprochementsEnAttente } from '../pilotage/compteur-rapprochements';
import { Journey } from '../pilotage/Journey';
import { Relations } from '../grc/Relations';
import { pilotageReport } from '../pilotage/report';
import { EtudesEbios } from '../grc/Ebios';
import { ConfigurationGrc } from '../config-grc/ConfigurationGrc';
import { RegistreRisques } from '../grc/RegistreRisques';
import { ObjectifsProcessus } from '../pilotage/ObjectifsProcessus';
import { CartesProcessus } from '../processus/CartesProcessus';
import { Pestel, SynthesePartiesBandeau } from '../pilotage/Pestel';
import { PreparationRevue } from '../pilotage/PreparationRevue';
import { SeriesProposees } from '../pilotage/SeriesProposees';
import { PlansSmsi } from '../pilotage/Plans';
import { AnalyserService } from '../pilotage/AnalyserService';
import { GapApplications } from '../pilotage/Gap';
import { CelluleCriseVue, ContactsCrise, ScenariosCrise } from '../incidents/Crise';
import { QualifierSignalement, RegistreIncidents } from '../incidents/Incidents';
import { RetexIncidents } from '../incidents/Retex';
import { DeclarationApplicabilite } from '../dda/Dda';
import { EtablissementsCrrc, OffresCrrc, VueEnsembleCrrc } from '../crrc/Contrats';
import { AlertesCrrc, RapportsCrrc, RessourcesCrrc, RestaurationsCrrc, TableauSauvegardes } from '../crrc/Sauvegardes';
import { EvaluationsClausier } from '../pilotage/EvaluationsClausier';
import { Investissements } from '../pilotage/Investissements';
import { RevuesAcces } from '../pilotage/RevuesAcces';
import { CouvertureCycle } from '../audit/Couverture';
import { Organisation } from '../audit/Organisation';
import { Pronostic } from '../audit/Pronostic';
import { CartesPilotage, type SyntheseApi } from '../components/Synthese';

const SOCLE = '00000000-0000-4000-8000-000000000001';
const REGISTERS: Record<string, { kind: GrcKind; legacy?: string; description: string }> = {
  contexte: {
    kind: 'context',
    legacy: 'scope',
    description: 'Décrivez votre organisation, ses activités et le périmètre piloté.',
  },
  parties: {
    kind: 'stakeholder',
    legacy: 'interested',
    description: 'Identifiez les acteurs, leurs besoins et les exigences pertinentes.',
  },
  swot: {
    kind: 'swot',
    legacy: 'swots',
    description: 'Rassemblez les forces, faiblesses, opportunités et menaces de vos processus.',
  },
  responsabilites: {
    kind: 'governance',
    legacy: 'roles',
    description: 'Attribuez les responsabilités, décisions et moyens.',
  },
  opportunites: {
    kind: 'opportunity',
    description:
      'Opportunités de l’article 6.1 (ISO 9001:2015), traitées avec les risques : origine, bénéfice attendu, décision et revue.',
  },
  processus: {
    kind: 'process',
    legacy: 'processes',
    description: 'Les processus relient activités, objectifs, risques et référentiels.',
  },
  objectifs: {
    kind: 'objective',
    legacy: 'objectives',
    description: 'Fixez les résultats attendus et leurs échéances.',
  },
  indicateurs: {
    kind: 'indicator',
    legacy: 'indicators',
    description: 'Suivez les résultats avec des valeurs réellement mesurées.',
  },
  applicabilite: {
    kind: 'soa',
    legacy: 'dda',
    description:
      'Déclaration d’applicabilité : clauses ISO 27001, Annexe A et HDS de l’outil de suivi, puis vos justifications propres.',
  },
  mesures: { kind: 'measure', description: 'Suivez la mise en œuvre des mesures et leurs justificatifs.' },
  amelioration: {
    kind: 'nonconformity',
    description: 'Analysez les constats, suivez les actions et vérifiez leur efficacité avant clôture.',
  },
  preuves: {
    kind: 'evidence',
    legacy: 'evidences',
    description: 'Réutilisez vos documents et conservez la version exacte examinée.',
  },
  controles: {
    kind: 'control',
    description: 'Définissez les contrôles, leur échéance et leurs critères, puis enregistrez les résultats.',
  },
  bia: {
    kind: 'bia',
    description: 'Évaluez les conséquences d’une interruption et définissez vos besoins de continuité.',
  },
  continuite: {
    kind: 'continuity_plan',
    description: 'Préparez vos stratégies et procédures de continuité ou de reprise à partir des BIA.',
  },
  exercices: {
    kind: 'continuity_exercise',
    description: 'Planifiez les exercices, enregistrez leurs résultats et suivez les améliorations du RETEX.',
  },
  audits: { kind: 'audit', description: 'Préparez les audits internes et reliez leurs constats, preuves et actions.' },
  revues: {
    kind: 'management_review',
    legacy: 'reviews',
    description: 'Préparez les résultats à examiner et conservez les décisions de la direction.',
  },
};
export function PilotagePage() {
  const { section = 'synthese' } = useParams(),
    can = useCan(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  // `?perimetre=<id>` (lien d'une carte de périmètre) l'emporte sur le dernier choix mémorisé.
  const perimetreUrl = params.get('perimetre');
  const [selected, setSelected] = useState<string | null>(() => {
      if (perimetreUrl) return perimetreUrl;
      try {
        return sessionStorage.getItem('pilotage-scope');
      } catch {
        return null;
      }
    }),
    [editing, setEditing] = useState<GrcObject | null>(null),
    [kind, setKind] = useState<GrcKind>('context'),
    [opened, setOpened] = useState(false),
    [cfgKind, setCfgKind] = useState<CfgKind | 'modeles'>('scale'),
    [evaluation, setEvaluation] = useState<GrcObject | null>(null),
    [relation, setRelation] = useState<string | null>(null),
    [decision, setDecision] = useState<{
      object: GrcObject;
      operation: PilotageRecord['operation'];
      step?: string;
    } | null>(null),
    [schedule, setSchedule] = useState<GrcObject | null>(null),
    [initial, setInitial] = useState<Record<string, unknown> | undefined>(undefined),
    [preset, setPreset] = useState<{ name?: string; data?: Record<string, unknown> } | undefined>(undefined);
  useEffect(() => {
    if (perimetreUrl) setSelected(perimetreUrl);
  }, [perimetreUrl]);
  const scopes = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
  });
  const smsi =
    scopes.data?.find((s) => s.id === selected)?.id ??
    scopes.data?.find((s) => s.id === '00000000-0000-4000-8000-000000000001')?.id ??
    scopes.data?.[0]?.id;
  const policy = useQuery({
    queryKey: ['grc', smsi, 'policy'],
    queryFn: () => get<{ definition: BusinessPolicy }>(`/api/grc/${smsi}/policy`),
    enabled: !!smsi,
  });
  const chooseScope = (v: string | null) => {
    setSelected(v);
    try {
      if (v) sessionStorage.setItem('pilotage-scope', v);
      else sessionStorage.removeItem('pilotage-scope');
    } catch {
      /* Stockage facultatif : le choix reste actif en mémoire. */
    }
    setOpened(false);
    setDecision(null);
    setEvaluation(null);
    setRelation(null);
    setSchedule(null);
  };
  const config = REGISTERS[section];
  const open = (o: GrcObject) => {
    setEditing(o);
    setKind(o.kind);
    setOpened(true);
  };
  // Ouverture contextuelle (`?ouvrir=<fiche>`) depuis une autre page ; `?retour=` garde le chemin d'origine.
  const retour = cheminRetourSur(params.get('retour'));
  const ouvrirId = params.get('ouvrir');
  const dejaOuverte = useRef<string | null>(null);
  useEffect(() => {
    if (!ouvrirId || !smsi || !policy.data || dejaOuverte.current === ouvrirId) return;
    dejaOuverte.current = ouvrirId;
    get<GrcObject>(`/api/grc/${smsi}/objects/${encodeURIComponent(ouvrirId)}`)
      .then((o) => open(o))
      .catch(() =>
        notifications.show({ color: 'red', message: 'Fiche introuvable ou non accessible dans le périmètre affiché.' }),
      )
      .finally(() =>
        setParams(
          (p) => {
            p.delete('ouvrir');
            return p;
          },
          { replace: true },
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirId, smsi, policy.data]);
  const create = (k: GrcKind, init?: Record<string, unknown>) => {
    setEditing(null);
    setKind(k);
    setInitial(init);
    setPreset(undefined);
    setOpened(true);
  };
  /** Fiche préparée (série proposée, par exemple) : intitulé et valeurs préremplis, à compléter avant enregistrement. */
  const createPreset = (k: GrcKind, name: string, data: Record<string, unknown>) => {
    setEditing(null);
    setKind(k);
    setInitial(undefined);
    setPreset({ name, data });
    setOpened(true);
  };
  /** Risque du registre issu d'une étude EBIOS RM : intitulé, étude et scénario préremplis. */
  const createRisk = (name: string, data: Record<string, unknown>) => {
    setEditing(null);
    setKind('risk');
    setInitial(undefined);
    setPreset({ name, data });
    setOpened(true);
  };
  const decide = (o: GrcObject, operation: PilotageRecord['operation'], step?: string) =>
    setDecision({ object: o, operation, step });
  const allowed =
    !config ||
    can(
      (
        { nonconformity: 'ecarts', evidence: 'documents', measure: 'audit', audit: 'plan_audit' } as Record<
          string,
          Module
        >
      )[config.kind] ?? 'pilotage',
      'lire',
    );
  return (
    <Page>
      <PageHeader
        title={PILOTAGE_LABELS[section] ?? 'Pilotage'}
        description={
          config?.description ??
          'Qualité, sécurité et référentiels : pilotez vos travaux à partir des données existantes.'
        }
      />
      <Stack>
        {retour && (
          <Anchor component={Link} to={retour}>
            ← Retour à la page précédente
          </Anchor>
        )}
        <ErrorAlert error={scopes.error ?? policy.error} />
        {(scopes.data?.length ?? 0) > 1 && (
          <Select
            label="Périmètre affiché"
            description="Les accès existants sont conservés."
            data={scopes.data!.map((s) => ({ value: s.id, label: s.name }))}
            value={smsi ?? null}
            onChange={chooseScope}
          />
        )}
        {!allowed && <Text>Vous ne disposez pas du droit de consulter cette rubrique.</Text>}
        {allowed && smsi && policy.data && (
          <>
            {config && (
              <>
                {section === 'amelioration' && <ImprovementIndicators smsi={smsi} />}
                {section === 'parties' && <SynthesePartiesBandeau smsi={smsi} />}
                {section === 'revues' && (
                  <PreparationRevue smsi={smsi} onCreer={(initial) => create('management_review', initial)} />
                )}
                {section === 'processus' && <ObjectifsProcessus smsi={smsi} vue="processus" />}
                {section === 'objectifs' && <ObjectifsProcessus smsi={smsi} vue="objectif" />}
                {section === 'indicateurs' && <ObjectifsProcessus smsi={smsi} vue="compacte" />}
                {section === 'audits' && can('pilotage', 'lire') && smsi === SOCLE && <PlansSmsi vue="audit" />}
                {section === 'exercices' && smsi === SOCLE && <PlansSmsi vue="exo" />}
                {(smsi !== '00000000-0000-4000-8000-000000000001' ||
                  !['processus', 'objectifs', 'indicateurs'].includes(section)) && (
                  <BusinessRegistry
                    key={smsi + section}
                    smsi={smsi}
                    kind={config.kind}
                    legacyKey={config.legacy}
                    onOpen={open}
                    onCreate={create}
                    onDecision={decide}
                    onSchedule={setSchedule}
                  />
                )}
                {['bia', 'continuite', 'exercices', 'preuves', 'controles', 'amelioration', 'revues'].includes(
                  section,
                ) &&
                  can('import_export', 'exporter') && <ExportRegister smsi={smsi} kind={config.kind} />}
              </>
            )}
            {section === 'processus-cartes' && smsi === SOCLE && <CartesProcessus smsi={smsi} />}
            {section === 'parcours-iso' && <ParcoursIso key={smsi} smsi={smsi} />}
            {section === 'synthese' && (
              <>
                {smsi && <BandeauRapprochements smsi={smsi} />}
                <Card withBorder>
                  <Stack>
                    <Text fw={600}>Vos travaux de pilotage</Text>
                    <Text>
                      Commencez par vos référentiels et votre contexte, ou reprenez les actions et contrôles en cours.
                      Le parcours guidé accompagne une démarche qualité, sécurité ou intégrée.
                    </Text>
                    <Group>
                      <Button component={Link} to="/pilotage/parcours">
                        Ouvrir le parcours guidé
                      </Button>
                      <Button component={Link} to="/pilotage/actions" variant="light">
                        Voir les actions
                      </Button>
                      <Button component={Link} to="/pilotage/referentiels" variant="default">
                        Voir les référentiels
                      </Button>
                    </Group>
                  </Stack>
                </Card>
                {smsi === '00000000-0000-4000-8000-000000000001' && <TableauPilotage />}
                <Overview smsi={smsi} />
              </>
            )}
            {section === 'parcours' && (
              <Journey
                smsi={smsi}
                onCreate={() => create('journey')}
                onOpen={open}
                onValidate={(o, step) => decide(o, 'step_validation', step)}
              />
            )}
            {['actions', 'recurrences'].includes(section) && can('ecarts', 'lire') && (
              <>
                <Group>
                  {can('ecarts', 'modifier') && (
                    <>
                      <Button onClick={() => create('action')}>Ajouter une action</Button>
                      <Button variant="light" onClick={() => create('task_series')}>
                        Ajouter une tâche récurrente
                      </Button>
                    </>
                  )}
                </Group>
                <Tasks key={smsi + section} smsi={smsi} policy={policy.data.definition} onOpen={open} />
                {section === 'recurrences' && can('ecarts', 'modifier') && (
                  <SeriesProposees onPreparer={(name, data) => createPreset('task_series', name, data)} />
                )}
                {section === 'recurrences' && (
                  <Registry
                    smsi={smsi}
                    fixedKind="task_series"
                    onOpen={open}
                    onEvaluation={setEvaluation}
                    onRelation={setRelation}
                  />
                )}
              </>
            )}
            {section === 'risques' && can('pilotage', 'lire') && (
              <>
                <Group>
                  {can('pilotage', 'modifier') && <Button onClick={() => create('risk')}>Ajouter un risque</Button>}
                  <Anchor component={Link} to="/pilotage/configuration">
                    Choisir ou adapter la méthode d’appréciation
                  </Anchor>
                </Group>
                <RegistreRisques
                  key={smsi}
                  smsi={smsi}
                  onOpen={open}
                  onEvaluation={setEvaluation}
                  onAcceptation={(o) => decide(o, 'risk_acceptance')}
                  onRelation={setRelation}
                />
              </>
            )}
            {section === 'etudes' && can('pilotage', 'lire') && (
              <EtudesEbios
                key={smsi}
                smsi={smsi}
                onOpen={open}
                onCreate={create}
                onCreateRisk={createRisk}
                onDecision={decide}
              />
            )}
            {section === 'traitements' && can('pilotage', 'lire') && (
              <>
                <Button onClick={() => create('treatment')}>Ajouter un traitement</Button>
                <Registry
                  smsi={smsi}
                  fixedKind="treatment"
                  onOpen={open}
                  onEvaluation={setEvaluation}
                  onRelation={setRelation}
                />
              </>
            )}
            {section === 'scenarios' && can('pilotage', 'lire') && (
              <Registry
                smsi={smsi}
                onOpen={open}
                onCreate={create}
                onEvaluation={setEvaluation}
                onRelation={setRelation}
                choices={[
                  'business_asset',
                  'support_asset',
                  'risk_source',
                  'feared_event',
                  'strategic_scenario',
                  'operational_scenario',
                ]}
              />
            )}
            {section === 'configuration-analyses' && can('pilotage', 'lire') && (
              <ConfigurationGrc kind={cfgKind} onKind={setCfgKind} contexte="analyses" />
            )}
            {section === 'carte' && can('cartographie', 'lire') && can('pilotage', 'lire') && (
              <RiskMap smsi={smsi} onOpen={open} />
            )}
            {section === 'pestel' && can('pilotage', 'lire') && <Pestel smsi={smsi} />}
            {section === 'analyser-service' && can('conformite', 'lire') && smsi && (
              <AnalyserService smsi={smsi} onChoisir={chooseScope} />
            )}
            {section === 'gap-applications' && can('conformite', 'lire') && <GapApplications />}
            {section === 'crrc-ensemble' && can('crrc', 'lire') && <VueEnsembleCrrc />}
            {section === 'crrc-etablissements' && can('crrc', 'lire') && <EtablissementsCrrc />}
            {section === 'crrc-offres' && can('crrc', 'lire') && <OffresCrrc />}
            {section === 'crrc-tableau' && can('crrc', 'lire') && <TableauSauvegardes />}
            {section === 'crrc-ressources' && can('crrc', 'lire') && <RessourcesCrrc />}
            {section === 'crrc-restaurations' && can('crrc', 'lire') && <RestaurationsCrrc />}
            {section === 'crrc-alertes' && can('crrc', 'lire') && <AlertesCrrc />}
            {section === 'crrc-rapports' && can('crrc', 'lire') && <RapportsCrrc />}
            {section === 'dda-iso' && can('audit', 'lire') && <DeclarationApplicabilite reference="ISO" />}
            {section === 'dda-annexe-a' && can('audit', 'lire') && <DeclarationApplicabilite reference="A" />}
            {section === 'dda-hds' && can('audit', 'lire') && <DeclarationApplicabilite reference="HDS" />}
            {section === 'crise-cellule' && can('incidents', 'lire') && <CelluleCriseVue />}
            {section === 'crise-contacts' && can('incidents', 'lire') && <ContactsCrise />}
            {section === 'crise-scenarios' && can('incidents', 'lire') && <ScenariosCrise />}
            {section === 'incidents-registre' && can('incidents', 'lire') && <RegistreIncidents />}
            {section === 'incidents-qualifier' && can('incidents', 'lire') && <QualifierSignalement />}
            {section === 'incidents-retex' && can('incidents', 'lire') && <RetexIncidents />}
            {section === 'evaluations-clausier' && can('fournisseurs', 'lire') && <EvaluationsClausier />}
            {section === 'investissements' && can('investissements', 'lire') && <Investissements />}
            {section === 'revues-acces' && can('pilotage', 'lire') && <RevuesAcces />}
            {section === 'audit-pronostic' && can('audit', 'lire') && <Pronostic />}
            {section === 'audit-couverture' && can('audit', 'lire') && <CouvertureCycle />}
            {section === 'audit-deroule' && can('plan_audit', 'lire') && <Organisation vue="deroule" />}
            {section === 'audit-planning' && can('plan_audit', 'lire') && <Organisation vue="planning" />}
            {section === 'audit-participants' && can('plan_audit', 'lire') && <Organisation vue="participants" />}
            {section === 'plans-calendrier' && can('pilotage', 'lire') && <PlansSmsi vue="calendrier" />}
            {section === 'plans-planning' && can('pilotage', 'lire') && <PlansSmsi vue="planning" />}
            {section === 'plans-formation' && can('pilotage', 'lire') && <PlansSmsi vue="formation" />}
            {section === 'plans-sensibilisation' && can('pilotage', 'lire') && <PlansSmsi vue="sensi" />}
            {section === 'referentiels' && can('conformite', 'lire') && <Publication smsi={smsi} type="frameworks" />}
            {section === 'correspondances' && can('conformite', 'lire') && <MappingPanel smsi={smsi} />}
            {section === 'imports' && can('import_export', 'lire') && <Imports smsi={smsi} />}
            {section === 'configuration' && can('pilotage', 'lire') && (
              <>
                <Text>Paramètres réservés aux personnes qui configurent les méthodes et les règles de gestion.</Text>
                <Publication smsi={smsi} type="methods" />
                {can('administration', 'lire') && <BusinessPolicyPanel smsi={smsi} />}
                {can('pilotage', 'administrer') && smsi !== '00000000-0000-4000-8000-000000000001' && (
                  <Card withBorder>
                    <Stack>
                      <Text fw={600}>Accès au périmètre existant</Text>
                      <Members smsi={smsi} />
                    </Stack>
                  </Card>
                )}
              </>
            )}
            {section === 'bibliotheque' && can('conformite', 'lire') && <Bibliotheque />}
            {section === 'rapprochements' && can('conformite', 'lire') && smsi && <Rapprochements smsi={smsi} />}
            {section === 'couverture' && can('conformite', 'lire') && smsi && <Couverture smsi={smsi} />}
            {section === 'correspondances-bibliotheque' && can('conformite', 'lire') && <CorrespondancesBibliotheque />}
            {section === 'fournisseurs' && can('fournisseurs', 'lire') && <Fournisseurs />}
            {section === 'criteres-fournisseurs' && can('fournisseurs', 'lire') && <CriteresFournisseurs />}
            {section === 'fournisseurs-perimetre' && can('fournisseurs', 'lire') && smsi && (
              <FournisseursPerimetre smsi={smsi} />
            )}
            {section === 'perimetres' && can('pilotage', 'lire') && (
              <Perimetres
                affiche={smsi}
                onChoisir={(id) => {
                  chooseScope(id);
                  navigate('/pilotage/synthese');
                }}
              />
            )}
            {section === 'rappels' && <Reminders smsi={smsi} onOpen={open} />}
            {!config && !PILOTAGE_LABELS[section] && <Text>Rubrique introuvable. Utilisez le menu Pilotage.</Text>}
            {['action', 'task_series', 'risk'].includes(kind) ? (
              <ObjectEditor
                key={editing?.id ?? kind + smsi}
                smsi={editing && !editing.id.startsWith('legacy:') ? editing.smsiId : smsi}
                policy={policy.data.definition}
                kind={kind}
                object={editing}
                opened={opened}
                onClose={() => setOpened(false)}
                preset={preset}
                onOpenObject={open}
              />
            ) : (
              <RecordEditor
                key={editing?.id ?? kind + smsi}
                smsi={editing && !editing.id.startsWith('legacy:') ? editing.smsiId : smsi}
                policy={policy.data.definition}
                kind={kind}
                object={editing}
                opened={opened}
                onClose={() => setOpened(false)}
                initial={initial}
              />
            )}
            <RiskEvaluation smsi={smsi} risk={evaluation} onClose={() => setEvaluation(null)} />
            <Decision
              smsi={decision?.object && !decision.object.id.startsWith('legacy:') ? decision.object.smsiId : smsi}
              object={decision?.object ?? null}
              operation={decision?.operation ?? 'proof_review'}
              step={decision?.step}
              onClose={() => setDecision(null)}
            />
            <ControlSchedule smsi={smsi} object={schedule} onClose={() => setSchedule(null)} />
            <Modal opened={!!relation} onClose={() => setRelation(null)} title="Liens et justificatifs">
              {relation && <Relations smsi={smsi} source={relation} />}
            </Modal>
          </>
        )}
        {scopes.data && !smsi && <Text>Aucun périmètre accessible. Contactez votre administrateur.</Text>}
      </Stack>
    </Page>
  );
}
/** Indicateurs, écarts, conformité et plans de l'outil de suivi (périmètre de l'instance), selon les droits. */
function TableauPilotage() {
  const q = useQuery({ queryKey: ['synthese'], queryFn: () => get<SyntheseApi>('/api/mur/synthese') });
  return (
    <>
      <ErrorAlert error={q.error} />
      {q.data && <CartesPilotage s={q.data} />}
    </>
  );
}
function ImprovementIndicators({ smsi }: { smsi: string }) {
  const q = useQuery({
    queryKey: ['grc', smsi, 'improvement-indicators'],
    queryFn: () =>
      get<{
        tasks: { total: number; closed: number; overdue: number };
        findings: number;
        closed: number;
        effective: number;
        verified: number;
        meanDays: number | null;
        durationSamples: number;
        repeatedCauses: { cause: string; count: number }[];
        note: string;
      }>(`/api/grc/${smsi}/pilotage/improvement-indicators`),
  });
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      {q.data && (
        <>
          <div className="grc-dashboard-grid">
            <Card withBorder>
              <Text fw={600}>Actions</Text>
              <Text>
                {q.data.tasks.total - q.data.tasks.closed} ouvertes · {q.data.tasks.closed} closes ·{' '}
                {q.data.tasks.overdue} en retard
              </Text>
            </Card>
            <Card withBorder>
              <Text fw={600}>Constats</Text>
              <Text>
                {q.data.findings} au total · {q.data.closed} clos
              </Text>
            </Card>
            <Card withBorder>
              <Text fw={600}>Efficacité vérifiée</Text>
              <Text>
                {q.data.effective} résultats positifs sur {q.data.verified} vérifications renseignées
              </Text>
            </Card>
            <Card withBorder>
              <Text fw={600}>Délai moyen de traitement</Text>
              <Text>
                {q.data.meanDays === null
                  ? 'Dates insuffisantes'
                  : q.data.meanDays.toFixed(1) + ' jours · ' + q.data.durationSamples + ' constats datés'}
              </Text>
            </Card>
          </div>
          {q.data.repeatedCauses.map((c) => (
            <Text key={c.cause}>
              Cause récurrente : {c.cause} · {c.count} constats
            </Text>
          ))}
          <Text size="sm">{q.data.note}</Text>
        </>
      )}
    </Stack>
  );
}
function ControlSchedule({ smsi, object, onClose }: { smsi: string; object: GrcObject | null; onClose: () => void }) {
  const qc = useQueryClient(),
    [start, setStart] = useState(new Date().toLocaleDateString('sv-SE')),
    [unit, setUnit] = useState('month'),
    [interval, setInterval] = useState(1),
    [error, setError] = useState<unknown>(null),
    [saving, setSaving] = useState(false);
  return (
    <Modal opened={!!object} onClose={onClose} title="Planifier les répétitions du contrôle">
      <Stack>
        <Text>{object?.name}</Text>
        <TextInput
          label="Première échéance"
          type="date"
          value={start}
          onChange={(e) => setStart(e.currentTarget.value)}
        />
        <Select
          label="Unité de récurrence"
          data={[
            { value: 'day', label: 'Jour' },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
            { value: 'year', label: 'Année' },
          ]}
          value={unit}
          onChange={(v) => setUnit(v ?? 'month')}
        />
        <NumberInput label="Tous les" min={1} max={365} value={interval} onChange={(v) => setInterval(Number(v))} />
        <Text>
          Une action sera générée à chaque échéance. Réalisez ensuite le contrôle depuis son registre pour enregistrer
          le résultat et les preuves.
        </Text>
        <ErrorAlert error={error} />
        <Button
          loading={saving}
          onClick={async () => {
            if (!object) return;
            setSaving(true);
            try {
              await api('POST', `/api/grc/${smsi}/pilotage/controls/${object.id}/schedule`, {
                ifMatch: object.version,
                body: {
                  recurrence: {
                    start,
                    time: '09:00',
                    timezone: 'Europe/Paris',
                    unit,
                    interval,
                    until: null,
                    count: null,
                    reminderDays: 7,
                    active: true,
                  },
                },
              });
              await qc.invalidateQueries({ queryKey: ['grc', smsi] });
              onClose();
            } catch (e) {
              setError(e);
            } finally {
              setSaving(false);
            }
          }}
        >
          Confirmer la planification
        </Button>
      </Stack>
    </Modal>
  );
}
function BandeauRapprochements({ smsi }: { smsi: string }) {
  const n = useRapprochementsEnAttente(smsi);
  if (!n) return null;
  return (
    <Alert color="suivi" title="Rapprochements à valider" role="status">
      <Group justify="space-between">
        <Text>
          {n} rapprochement(s) proposé(s) à partir des mesures déjà déclarées attendent une décision du pilote.
        </Text>
        <Button component={Link} to="/pilotage/rapprochements" size="xs">
          Examiner les rapprochements
        </Button>
      </Group>
    </Alert>
  );
}
function Reminders({ smsi, onOpen }: { smsi: string; onOpen: (o: GrcObject) => void }) {
  const qc = useQueryClient(),
    navigate = useNavigate(),
    [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['grc', 'notifications'],
    queryFn: () =>
      get<
        {
          id: string;
          smsiId: string;
          objectId: string;
          kind: string;
          title: string;
          message: string;
          readAt: string | null;
        }[]
      >('/api/grc/notifications'),
  });
  return (
    <Stack>
      <ErrorAlert error={error ?? q.error} />
      {q.data
        ?.filter((n) => n.smsiId === smsi)
        .map((n) => (
          <Card key={n.id} withBorder>
            <Text fw={600}>{n.title}</Text>
            <Text>{n.message}</Text>
            <Group>
              <Button
                variant="light"
                onClick={async () => {
                  if (n.kind === 'rapprochement') {
                    navigate('/pilotage/rapprochements');
                    return;
                  }
                  try {
                    onOpen(await get<GrcObject>(`/api/grc/${smsi}/objects/${n.objectId}`));
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                Ouvrir
              </Button>
              {!n.readAt && (
                <Button
                  variant="subtle"
                  onClick={async () => {
                    try {
                      await api('PUT', `/api/grc/notifications/${n.id}/read`);
                      await qc.invalidateQueries({ queryKey: ['grc'] });
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  Marquer comme lu
                </Button>
              )}
            </Group>
          </Card>
        ))}
      {q.data && !q.data.some((n) => n.smsiId === smsi) && <Text>Aucun rappel pour le moment.</Text>}
    </Stack>
  );
}
function ExportRegister({ smsi, kind }: { smsi: string; kind: GrcKind }) {
  const [error, setError] = useState<unknown>(null);
  const download = async (html: boolean) => {
    try {
      const data = await get<unknown>(`/api/grc/${smsi}/pilotage/export?kind=${kind}`);
      const { saveBlob } = await import('../api');
      saveBlob(
        'pilotage-' + kind + (html ? '.html' : '.json'),
        html ? pilotageReport(data) : JSON.stringify(data, null, 2),
        html ? 'text/html' : 'application/json',
      );
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Stack>
      <ErrorAlert error={error} />
      <Button variant="default" onClick={() => void download(false)}>
        Exporter le registre et ses décisions
      </Button>
      <Button variant="light" onClick={() => void download(true)}>
        Télécharger le rapport imprimable
      </Button>
    </Stack>
  );
}
