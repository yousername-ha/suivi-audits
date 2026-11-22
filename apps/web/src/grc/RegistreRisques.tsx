/* Registre des risques (lot U3, ADR 0027) : niveaux brut et résiduel de la dernière appréciation, option de
   traitement, état d'acceptation (décision formelle), prochaine revue ; filtres appliqués par le serveur. Boîte d'outils
   commune (7.3.0) : recherche et filtres avancés ; Démarche, Étude, Option et Acceptation se filtrent aussi sur le titre
   de leur colonne ; l'ajout d'un risque se place au bout de la ligne. */
import { Checkbox, Select, Table, Text } from '@mantine/core';
import { ETATS_ACCEPTATION, type EcartMatrice, type EtatAcceptation, type GrcObject } from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { get } from '../api';
import { BoiteOutils, FiltreColonne, PastillesCriteres, type CritereActif } from '../components/BarreOutils';
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
  const etudes = useQuery({
    queryKey: ['grc', smsi, 'objects', 'risk_study'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=risk_study`),
  });
  const nomEtude = new Map((etudes.data?.items ?? []).map((e) => ['object:' + e.id, e.name] as const));
  const objet = (id: string) => get<GrcObject>(`/api/grc/${smsi}/objects/${id}`);
  // Valeurs des filtres : les mêmes pour le panneau des filtres avancés et pour les titres de colonnes.
  const optionsDemarche = Object.entries(DEMARCHES).map(([value, label]) => ({ value, label })),
    optionsEtude = (etudes.data?.items ?? []).map((e) => ({ value: e.id, label: e.name })),
    optionsOption = Object.entries(OPTIONS).map(([value, label]) => ({ value, label })),
    optionsAcceptation = Object.entries(ETATS_ACCEPTATION).map(([value, label]) => ({ value, label }));
  const libelleDe = (options: { value: string; label: string }[], v: string) =>
    options.find((o) => o.value === v)?.label ?? 'sélectionnée';
  const reinitialiser = () => {
    setDemarche(null);
    setEtude(null);
    setStrategie(null);
    setAcceptation(null);
    setRetard(false);
    setEcart(false);
  };
  const criteres: CritereActif[] = [
    ...(recherche ? [{ cle: 'q', libelle: 'Recherche', valeur: recherche, retirer: () => setRecherche('') }] : []),
    ...(demarche
      ? [
          {
            cle: 'demarche',
            libelle: 'Démarche',
            valeur: libelleDe(optionsDemarche, demarche),
            retirer: () => setDemarche(null),
          },
        ]
      : []),
    ...(etude
      ? [{ cle: 'etude', libelle: 'Étude', valeur: libelleDe(optionsEtude, etude), retirer: () => setEtude(null) }]
      : []),
    ...(strategie
      ? [
          {
            cle: 'option',
            libelle: 'Option de traitement',
            valeur: libelleDe(optionsOption, strategie),
            retirer: () => setStrategie(null),
          },
        ]
      : []),
    ...(acceptation
      ? [
          {
            cle: 'acceptation',
            libelle: 'Acceptation',
            valeur: libelleDe(optionsAcceptation, acceptation),
            retirer: () => setAcceptation(null),
          },
        ]
      : []),
    ...(retard ? [{ cle: 'retard', libelle: 'Revue dépassée', valeur: 'oui', retirer: () => setRetard(false) }] : []),
    ...(ecart
      ? [{ cle: 'ecart', libelle: 'Écart avec la matrice', valeur: 'oui', retirer: () => setEcart(false) }]
      : []),
  ];
  return (
    <>
      {/* Boîte d'outils commune (7.3.0) : recherche et filtres avancés, libellés inchangés ; Démarche, Étude, Option et
          Acceptation se filtrent aussi sur le titre de leur colonne (le panneau les garde : le tableau disparaît quand
          aucun risque ne correspond, et ses colonnes secondaires se masquent sur petit écran). */}
      <BoiteOutils
        label="Outils du registre des risques"
        recherche={{ label: 'Rechercher', value: recherche, onChange: setRecherche }}
        filtres={{
          actifs: [demarche, etude, strategie, acceptation, retard ? '1' : '', ecart ? '1' : ''].filter(Boolean).length,
          onReinitialiser: reinitialiser,
          contenu: (
            <>
              <Select
                label="Démarche"
                clearable
                data={optionsDemarche}
                value={demarche}
                onChange={setDemarche}
                comboboxProps={{ withinPortal: false }}
              />
              <Select
                label="Étude"
                clearable
                data={optionsEtude}
                value={etude}
                onChange={setEtude}
                comboboxProps={{ withinPortal: false }}
              />
              <Select
                label="Option de traitement"
                clearable
                data={optionsOption}
                value={strategie}
                onChange={setStrategie}
                comboboxProps={{ withinPortal: false }}
              />
              <Select
                label="Acceptation"
                clearable
                data={optionsAcceptation}
                value={acceptation}
                onChange={setAcceptation}
                comboboxProps={{ withinPortal: false }}
              />
              <Checkbox label="Revue dépassée" checked={retard} onChange={(e) => setRetard(e.currentTarget.checked)} />
              <Checkbox
                label="Écart avec la matrice"
                checked={ecart}
                onChange={(e) => setEcart(e.currentTarget.checked)}
              />
            </>
          ),
        }}
        ajout={ajout}
      />
      <PastillesCriteres
        criteres={criteres}
        onToutEffacer={() => {
          setRecherche('');
          reinitialiser();
        }}
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
                <Table.Th className="col-p2">
                  <FiltreColonne
                    libelle="Démarche"
                    valeur={demarche}
                    options={optionsDemarche}
                    onChange={setDemarche}
                  />
                </Table.Th>
                <Table.Th className="col-p3">
                  <FiltreColonne libelle="Étude" valeur={etude} options={optionsEtude} onChange={setEtude} />
                </Table.Th>
                <Table.Th>Brut</Table.Th>
                <Table.Th>Résiduel</Table.Th>
                <Table.Th className="col-p2">
                  <FiltreColonne libelle="Option" valeur={strategie} options={optionsOption} onChange={setStrategie} />
                </Table.Th>
                <Table.Th>
                  <FiltreColonne
                    libelle="Acceptation"
                    valeur={acceptation}
                    options={optionsAcceptation}
                    onChange={setAcceptation}
                  />
                </Table.Th>
                <Table.Th className="col-p3">Prochaine revue</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data.items.map((r) => (
                <Table.Tr key={r.id} {...ficheCliquable(() => void objet(r.id).then(onOpen), `Afficher ${r.name}`)}>
                  <Table.Td>
                    {r.code ? `${r.code} · ` : ''}
                    {r.name}
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
