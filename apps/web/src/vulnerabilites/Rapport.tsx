/* Module Vulnérabilités (ADR 0100, lot S2) : rapport de pilotage pour la direction et l'audit. La plateforme ne produit
   aucun PDF côté serveur et le lot n'ajoute aucune dépendance : le rapport est une page imprimable (A4, feuille
   d'impression de packages/ui/src/neon-tendances.css : ni menu ni bouton à l'impression, lisible en noir et blanc), que le
   navigateur enregistre en PDF, et ses tableaux s'exportent en CSV (route du serveur). Les tableaux sont composés par le
   paquet partagé (tableauxRapport), les mêmes à l'écran et dans le fichier. Aucun nom de machine, de domaine ni d'adresse ;
   chaque production est tracée au journal par le serveur. Sous la CSP stricte (ADR 0006) : aucun style en ligne. */
import { Alert, Button, Group, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import {
  fmtHorodatage,
  fmtJour,
  libellePortee,
  type RapportVulnerabilitesDto,
  type TableauRapport,
  tableauxRapport,
  type TendancesDto,
} from '@suivi/shared';
import { ErrorAlert, Page, PageHeader } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { download, get } from '../api';
import { useCan } from '../session';
import {
  aujourdhui,
  CLE_TENDANCES,
  type ModePeriode,
  moisProposes,
  optionsPortee,
  PORTEE_TOUT,
  urlRapport,
  urlTendances,
} from './tendances';

/** Un tableau du rapport, en tableau HTML simple (lisible à l'écran et à l'impression). */
function TableauDuRapport({ t }: { t: TableauRapport }) {
  const id = useId();
  return (
    <section className="rp-section" aria-labelledby={id}>
      <h2 id={id}>{t.titre}</h2>
      <div className="rp-defile">
        <table className="rp-table">
          <thead>
            <tr>
              {t.entetes.map((e) => (
                <th key={e} scope="col">
                  {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.lignes.map((l, i) => (
              <tr key={i}>
                {l.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
            {!t.lignes.length && (
              <tr>
                <td colSpan={t.entetes.length}>{t.vide}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {t.note && <p className="rp-note">{t.note}</p>}
    </section>
  );
}

/** Le document du rapport : en-tête, tableaux, pied. Sans état. */
export function DocumentRapport({ r }: { r: RapportVulnerabilitesDto }) {
  const periode = `du ${fmtJour(r.du)} au ${fmtJour(r.au)}`;
  const produit = fmtHorodatage(r.produitLe);
  return (
    <article className="rapport-doc" aria-label="Rapport de pilotage des vulnérabilités">
      <header className="rp-entete">
        <p className="rp-surtitre">{r.etablissement}</p>
        <h1>Rapport de pilotage des vulnérabilités</h1>
        <dl className="rp-identite">
          <div>
            <dt>Période</dt>
            <dd>{periode}</dd>
          </div>
          <div>
            <dt>Portée</dt>
            <dd>{libellePortee(r.perimetre)}</dd>
          </div>
          <div>
            <dt>Produit le</dt>
            <dd>
              <span className="horodatage">{produit}</span>
            </dd>
          </div>
        </dl>
        <p className="rp-note">
          Document destiné à la direction et à l’audit. Il ne contient aucun nom de machine, de domaine ni d’adresse :
          des CVE, des produits et des nombres. Priorités, niveau d’alerte et alertes sont calculés par la plateforme,
          les mêmes pour tout le monde ; aucun texte n’est rédigé par l’assistant.
        </p>
      </header>
      {tableauxRapport(r).map((t) => (
        <TableauDuRapport key={t.id} t={t} />
      ))}
      <footer className="rp-pied">
        <p>
          {r.etablissement} · Rapport de pilotage des vulnérabilités · {libellePortee(r.perimetre)} · {periode}
        </p>
        <p>
          Document produit par la plateforme le <span className="horodatage">{produit}</span>.
        </p>
      </footer>
    </article>
  );
}

export function RapportPage() {
  const lire = useCan()('vulnerabilites', 'lire');
  const jour = aujourdhui();
  const mois = moisProposes(jour);
  const [mode, setMode] = useState<ModePeriode>('mois');
  const [moisChoisi, setMois] = useState(mois[0]!.value);
  const [du, setDu] = useState(`${jour.slice(0, 7)}-01`);
  const [au, setAu] = useState(jour);
  const [portee, setPortee] = useState(PORTEE_TOUT);
  const [demande, setDemande] = useState<string | null>(null);
  // Choix du périmètre : les périmètres lus, donnés par la lecture des tendances (aucune route de plus).
  const perimetres = useQuery({
    queryKey: [...CLE_TENDANCES, '30', PORTEE_TOUT],
    queryFn: () => get<TendancesDto>(urlTendances(30, PORTEE_TOUT)),
    enabled: lire,
  });
  const rapport = useQuery({
    queryKey: ['vulnerabilites', 'rapport', demande],
    queryFn: () => get<RapportVulnerabilitesDto>(demande!),
    enabled: lire && demande !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  const q = { mode, mois: moisChoisi, du, au, perimetre: portee };
  const r = rapport.data;
  return (
    <Page>
      <div className="rapport-ecran">
        <PageHeader
          title="Rapport de pilotage"
          description="Rapport mensuel (ou d’une période libre) pour la direction et l’audit : niveau d’alerte et son évolution, failles critiques, délais de correction, dépassements, exceptions, tendances, alertes critiques et état des sources. Le navigateur l’enregistre en PDF par « Imprimer » ; ses tableaux s’exportent en CSV. Chaque production est tracée au journal."
        />
        <Stack>
          <SegmentedControl
            aria-label="Choix de la période"
            value={mode}
            onChange={(x) => setMode(x as ModePeriode)}
            data={[
              { value: 'mois', label: 'Un mois' },
              { value: 'libre', label: 'Période libre' },
            ]}
          />
          <Group align="flex-end">
            {mode === 'mois' ? (
              <Select
                label="Mois"
                allowDeselect={false}
                value={moisChoisi}
                onChange={(x) => setMois(x ?? mois[0]!.value)}
                data={mois}
                comboboxProps={{ withinPortal: false }}
              />
            ) : (
              <>
                <TextInput
                  label="Du"
                  type="date"
                  value={du}
                  max={jour}
                  onChange={(e) => setDu(e.currentTarget.value)}
                />
                <TextInput
                  label="Au"
                  type="date"
                  value={au}
                  max={jour}
                  onChange={(e) => setAu(e.currentTarget.value)}
                />
              </>
            )}
            <Select
              label="Périmètre"
              allowDeselect={false}
              value={portee}
              onChange={(x) => setPortee(x ?? PORTEE_TOUT)}
              data={
                perimetres.data
                  ? optionsPortee(perimetres.data)
                  : [{ value: PORTEE_TOUT, label: 'Toute la plateforme' }]
              }
              comboboxProps={{ withinPortal: false }}
            />
            <Button onClick={() => setDemande(urlRapport(q, 'json'))} loading={rapport.isFetching}>
              Produire le rapport
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Le rapport ne contient aucun nom de machine, de domaine ni d’adresse. Le détail des machines n’est pas
            proposé. Toute personne qui lit le module peut le produire, pour ce qu’elle lit (règle à confirmer par le
            RSSI).
          </Text>
          <ErrorAlert error={rapport.error ?? perimetres.error} />
          {r && (
            <Group>
              <Button variant="light" onClick={() => window.print()}>
                Imprimer ou enregistrer en PDF
              </Button>
              <Button variant="default" onClick={() => download(urlRapport(q, 'csv'))}>
                Télécharger les tableaux (CSV)
              </Button>
            </Group>
          )}
        </Stack>
      </div>
      {r && <DocumentRapport r={r} />}
    </Page>
  );
}
