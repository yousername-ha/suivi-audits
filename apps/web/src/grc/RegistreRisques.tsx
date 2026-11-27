/* Registre des risques (lot U3, ADR 0027) : niveaux brut et résiduel de la dernière appréciation, option de
   traitement, état d'acceptation (décision formelle), prochaine revue ; filtres appliqués par le serveur. Recherche et
   filtres des listes (refonte Verre, 27/11/2026) : recherche par intitulé ou code, puces Démarche, Option, Acceptation,
   Étude, Revue dépassée et Écart avec la matrice, comptées sur le registre complet ; l'ajout au bout de la ligne. */
import { Table, Text } from '@mantine/core';
import { ETATS_ACCEPTATION, type EcartMatrice, type EtatAcceptation, type GrcObject } from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { get } from '../api';
import { BoiteOutils, Surligne, type CriterePuces } from '../components/BarreOutils';
import { compterPuces } from '../components/recherche-liste';
import { ErrorAlert } from '../components/common';
import { ficheCliquable } from '../fiche-cliquable';
import { useCan } from '../session';
import { CommandesRisque } from './CommandesRisque';
import { PlanTraitementRisque } from './PlanTraitementRisque';

interface Ligne {
  id: string;
  name: string;
  code: string;
  demarche: string | null;
  strategie: string;
  brut: string | null;
  residuel: string | null;
  acceptabilite: string | null;
  appreciationValidee: boolean;
  acceptation: EtatAcceptation;
  decisionAcceptation: { result: string; until: string | null; date: string; by: string } | null;
  prochaineRevue: string | null;
  enRetard: boolean;
  /** Référence « object:<id> » de l'étude dont le risque est issu. */
  etude: string | null;
  /** Écart entre le niveau enregistré et la matrice courante : signalé, jamais recalculé (le registre fait foi). */
  ecartMatrice: EcartMatrice | null;
}

const DEMARCHES: Record<string, string> = {
  ebios_rm: 'EBIOS RM',
  iso27005: 'ISO/IEC 27005',
  mehari: 'MÉHARI',
  custom: 'Personnalisée',
};
const OPTIONS: Record<string, string> = {
  reduce: 'Réduire',
  accept: 'Accepter',
  transfer: 'Transférer',
  avoid: 'Éviter',
  treated: 'Traité',
};
const ETAT_CHIP: Record<EtatAcceptation, Etat> = {
  sans_objet: 'neutre',
  a_decider: 'attention',
  acceptee: 'succes',
  refusee: 'erreur',
  echue: 'erreur',
};
const jour = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR') : '—');

export function RegistreRisques({
  smsi,
  onOpen,
  onEvaluation,
  onAcceptation,
  onRelation,
  onAjouterTraitement,
  ajout,
}: {
  smsi: string;
  onOpen: (o: GrcObject) => void;
  onEvaluation: (o: GrcObject) => void;
  onAcceptation: (o: GrcObject) => void;
  onRelation: (ref: string) => void;
  /** Ouvre la création d'un traitement déjà rattaché au risque. */
  onAjouterTraitement: (risqueId: string) => void;
  /** Commande d'ajout placée au bout de la boîte d'outils (« Ajouter un risque »). */
  ajout?: ReactNode;
}) {
  const can = useCan();
  const [demarche, setDemarche] = useState<string | null>(null),
    [strategie, setStrategie] = useState<string | null>(null),
    [acceptation, setAcceptation] = useState<string | null>(null),
    [etude, setEtude] = useState<string | null>(null),
    [retard, setRetard] = useState(false),
    [ecart, setEcart] = useState(false),
    [recherche, setRecherche] = useState(''),
    [plan, setPlan] = useState<{ id: string; name: string } | null>(null);
  const params = new URLSearchParams();
  if (demarche) params.set('demarche', demarche);
  if (strategie) params.set('strategie', strategie);
  if (acceptation) params.set('acceptation', acceptation);
  if (etude) params.set('etude', etude);
  if (retard) params.set('enRetard', '1');
  if (ecart) params.set('ecart', '1');
  if (recherche) params.set('recherche', recherche);
  const q = useQuery({
    queryKey: ['grc', smsi, 'risk-register', params.toString()],
    queryFn: () => get<{ items: Ligne[]; tronque: boolean }>(`/api/grc/${smsi}/risks/register?${params}`),
  });
  // Registre complet, sans filtre (même requête que la liste quand aucun filtre n'est posé) : nombres des puces et seuil.
  const complet = useQuery({
    queryKey: ['grc', smsi, 'risk-register', ''],
    queryFn: () => get<{ items: Ligne[]; tronque: boolean }>(`/api/grc/${smsi}/risks/register?`),
  });
  const etudes = useQuery({
    queryKey: ['grc', smsi, 'objects', 'risk_study'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=risk_study`),
  });
  const nomEtude = new Map((etudes.data?.items ?? []).map((e) => ['object:' + e.id, e.name] as const));
  const objet = (id: string) => get<GrcObject>(`/api/grc/${smsi}/objects/${id}`);
  const tous = complet.data?.items ?? [];
  const reinitialiser = () => {
    setDemarche(null);
    setEtude(null);
    setStrategie(null);
    setAcceptation(null);
    setRetard(false);
    setEcart(false);
  };
  const puces: CriterePuces[] = [
    {
      cle: 'demarche',
      libelle: 'Démarche',
      valeur: demarche,
      options: compterPuces(tous, (r) => r.demarche, {
        ordre: Object.keys(DEMARCHES),
        libelle: (v) => DEMARCHES[v] ?? v,
      }),
      onChange: setDemarche,
    },
    {
      cle: 'option',
      libelle: 'Option de traitement',
      valeur: strategie,
      options: compterPuces(tous, (r) => r.strategie, { ordre: Object.keys(OPTIONS), libelle: (v) => OPTIONS[v] ?? v }),
      onChange: setStrategie,
    },
    {
      cle: 'acceptation',
      libelle: 'Acceptation',
      valeur: acceptation,
      options: compterPuces(tous, (r) => r.acceptation, {
        ordre: Object.keys(ETATS_ACCEPTATION),
        libelle: (v) => ETATS_ACCEPTATION[v as EtatAcceptation] ?? v,
        ton: (v) => (v === 'a_decider' || v === 'echue' ? 'alerte' : undefined),
      }),
      onChange: setAcceptation,
    },
    {
      cle: 'etude',
      libelle: 'Étude',
      valeur: etude,
      options: compterPuces(tous, (r) => r.etude?.replace(/^object:/, ''), {
        ordre: (etudes.data?.items ?? []).map((e) => e.id),
        libelle: (v) => nomEtude.get('object:' + v) ?? 'Étude liée',
      }),
      onChange: setEtude,
    },
    {
      cle: 'retard',
      libelle: 'Revue',
      valeur: retard ? 'oui' : null,
      options: [
        { value: 'oui', label: 'Revue dépassée', compte: tous.filter((r) => r.enRetard).length, ton: 'alerte' },
      ],
      onChange: (v) => setRetard(v === 'oui'),
    },
    {
      cle: 'ecart',
      libelle: 'Matrice',
      valeur: ecart ? 'oui' : null,
      options: [{ value: 'oui', label: 'Écart avec la matrice', compte: tous.filter((r) => r.ecartMatrice).length }],
      onChange: (v) => setEcart(v === 'oui'),
    },
  ];
  return (
    <>
      <BoiteOutils
        label="Outils du registre des risques"
        titre={complet.data ? `${tous.length} risque${tous.length > 1 ? 's' : ''}` : undefined}
        total={complet.isPending ? 0 : complet.data ? tous.length : undefined}
        affiches={q.data?.items.length}
        recherche={{
          label: 'Rechercher dans les risques',
          value: recherche,
          onChange: setRecherche,
          placeholder: 'Intitulé ou code…',
        }}
        puces={puces}
        libelleTout="Tous"
        onToutEffacer={() => {
          setRecherche('');
          reinitialiser();
        }}
        ajout={ajout}
      />
      <ErrorAlert error={q.error} />
      {q.data?.tronque && <Text size="sm">Seuls les 500 premiers risques sont affichés : précisez les filtres.</Text>}
      {q.data && !q.data.items.length && <Text>Aucun risque ne correspond.</Text>}
      {!!q.data?.items.length && (
        <DataTable label="Registre des risques">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Risque</Table.Th>
                <Table.Th className="col-p2">Démarche</Table.Th>
                <Table.Th className="col-p3">Étude</Table.Th>
                <Table.Th>Brut</Table.Th>
                <Table.Th>Résiduel</Table.Th>
                <Table.Th className="col-p2">Option</Table.Th>
                <Table.Th>Acceptation</Table.Th>
                <Table.Th className="col-p3">Prochaine revue</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data.items.map((r) => (
                <Table.Tr key={r.id} {...ficheCliquable(() => void objet(r.id).then(onOpen), `Afficher ${r.name}`)}>
                  <Table.Td>
                    <Surligne texte={`${r.code ? `${r.code} · ` : ''}${r.name}`} recherche={recherche} />
                  </Table.Td>
                  <Table.Td className="col-p2">{r.demarche ? (DEMARCHES[r.demarche] ?? r.demarche) : '—'}</Table.Td>
                  <Table.Td className="col-p3">{r.etude ? (nomEtude.get(r.etude) ?? 'Étude liée') : '—'}</Table.Td>
                  <Table.Td>{r.brut ?? 'Non apprécié'}</Table.Td>
                  <Table.Td>
                    {r.residuel ?? '—'}
                    {r.residuel && !r.appreciationValidee ? ' (brouillon)' : ''}
                    {r.ecartMatrice && <EcartMatriceNote ecart={r.ecartMatrice} />}
                  </Table.Td>
                  <Table.Td className="col-p2">{OPTIONS[r.strategie] ?? r.strategie}</Table.Td>
                  <Table.Td>
                    <StatusChip etat={ETAT_CHIP[r.acceptation]}>{ETATS_ACCEPTATION[r.acceptation]}</StatusChip>
                    {r.decisionAcceptation?.until && (
                      <Text size="xs" c="dimmed">
                        jusqu’au {jour(r.decisionAcceptation.until)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td className="col-p3">
                    {r.enRetard ? (
                      <StatusChip etat="erreur">{jour(r.prochaineRevue)}</StatusChip>
                    ) : (
                      jour(r.prochaineRevue)
                    )}
                  </Table.Td>
                  <Table.Td>
                    <CommandesRisque
                      nom={r.name}
                      onOpen={() => void objet(r.id).then(onOpen)}
                      onPlan={() => setPlan({ id: r.id, name: r.name })}
                      onRelation={() => onRelation('object:' + r.id)}
                      onEvaluation={() => void objet(r.id).then(onEvaluation)}
                      onAcceptation={
                        can('pilotage', 'administrer') && r.strategie === 'accept'
                          ? () => void objet(r.id).then(onAcceptation)
                          : undefined
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
      <PlanTraitementRisque
        smsi={smsi}
        risque={plan}
        onClose={() => setPlan(null)}
        onAjouter={onAjouterTraitement}
        onOpen={onOpen}
      />
    </>
  );
}

/** Signalement d'un écart avec la matrice courante : le niveau enregistré est conservé, rien n'est recalculé. */
export function EcartMatriceNote({ ecart }: { ecart: EcartMatrice }) {
  return (
    <div data-testid="ecart-matrice">
      <StatusChip etat="attention">
        {ecart.etat === 'ecart' ? 'Écart avec la matrice courante' : 'Matrice courante non comparable'}
      </StatusChip>
      <Text size="xs" c="dimmed">
        {ecart.etat === 'ecart' && ecart.courant
          ? `Enregistré (méthode v${ecart.versionEnregistree}) : brut ${ecart.enregistre.brut ?? '—'}, résiduel ${ecart.enregistre.residuel ?? '—'}. Avec la méthode v${ecart.versionCourante} : brut ${ecart.courant.brut ?? '—'}, résiduel ${ecart.courant.residuel ?? '—'}. `
          : `Les cotations enregistrées (méthode v${ecart.versionEnregistree}) n’existent plus dans la méthode v${ecart.versionCourante}. `}
        Le niveau enregistré fait foi ; réévaluez le risque pour l’aligner.
      </Text>
    </div>
  );
}
