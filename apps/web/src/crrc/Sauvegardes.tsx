/* Gestion CRRC — offre de sauvegarde : tableau de bord, ressources, restaurations, alertes et rapports mensuels
   (reprise de l'outil de suivi). L'import de rapports Excel, l'export Excel et la création d'un incident depuis une
   alerte ne sont pas repris dans cette page. */
import {
  Anchor,
  Button,
  Card,
  Group,
  Select,
  SegmentedControl,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import {
  CONFLITS_RESTAURATION_CRRC,
  DESTINATIONS_RESTAURATION_CRRC,
  FREQUENCES_CRRC,
  MOTIFS_RESTAURATION_CRRC,
  SEVERITES_CRRC,
  STATUTS_ALERTE_CRRC,
  STATUTS_RESTAURATION_CRRC,
  STATUTS_SAUVEGARDE_CRRC,
  TECHNOLOGIES_CRRC,
  TYPES_SAUVEGARDE_CRRC,
  DEPARTEMENTS_CARTE,
  centreDepartement,
  derniereSauvegarde,
  evolutionVolume,
  formaterAxeVolume,
  formaterDuree,
  formaterHorodatage,
  formaterVolume,
  libelleTechnologie,
  pointsCarteCrrc,
  rapportMensuelCrrc,
  referenceCrrc,
  sauvegardesDe,
  sommetVolume,
  statistiquesCrrc,
  statutEtablissement,
  statutRessource,
  volumeProtegeRessource,
  type EtatCrrc,
  type PeriodeCrrc,
  type Ressource,
} from '@suivi/shared';
import { ConfirmButton, DataTable } from '@suivi/ui';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone } from '../historique/champs';
import { Anneau, BarresEmpilees, Chiffres, LegendeSeries } from '../historique/graphiques';
import { useCan } from '../session';
import { nomEtablissement, nomRessource, Pastille, useCrrc, usePage, type AgirCrrc } from './commun';

const PERIODES: { value: PeriodeCrrc; label: string }[] = [
  { value: '24h', label: 'Dernières 24 heures' },
  { value: '7j', label: '7 derniers jours' },
  { value: '30j', label: '30 derniers jours' },
  { value: '12m', label: '12 derniers mois' },
];
const pct = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString('fr-FR')} %`;
const SERIES = TECHNOLOGIES_CRRC.map((t) => ({ cle: t.cle, libelle: t.libelle, teinte: t.teinte }));

/* ------------------------------------------------------------------------------------------ tableau de bord */
export function TableauSauvegardes() {
  const { d, erreur } = useCrrc(),
    [periode, setPeriode] = useState<PeriodeCrrc>('7j');
  const e = d?.etat;
  const maintenant = Date.now();
  const st = e ? statistiquesCrrc(e, periode, maintenant) : null;
  const evolution = e ? evolutionVolume(e, periode, maintenant) : [];
  const { sommet, unite } = sommetVolume(
    Math.max(0, ...evolution.map((c) => Object.values(c.valeurs).reduce((a, v) => a + v, 0))),
  );
  const parts = e
    ? TECHNOLOGIES_CRRC.map((t) => ({
        libelle: t.libelle,
        teinte: t.teinte,
        valeur: e.resources.filter((r) => r.tech === t.cle).reduce((a, r) => a + volumeProtegeRessource(e, r.id), 0),
      }))
    : [];
  const total = parts.reduce((a, p) => a + p.valeur, 0);
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Tableau de bord</Text>
          <Text size="sm" c="dimmed">
            Vue d’ensemble du service de sauvegarde.
          </Text>
        </div>
        <Select
          aria-label="Période"
          allowDeselect={false}
          data={PERIODES}
          value={periode}
          onChange={(v) => setPeriode((v as PeriodeCrrc) ?? '7j')}
        />
      </Group>
      {e && st && (
        <>
          <Chiffres
            items={[
              { valeur: st.etablissements, libelle: 'Établissements', detail: `dont ${st.actifs} actif(s)` },
              { valeur: formaterVolume(st.volume), libelle: 'Données protégées', detail: 'volume total sauvegardé' },
              {
                valeur: st.taux == null ? '–' : pct(st.taux),
                libelle: 'Taux de succès',
                detail: `${st.variation == null ? '' : `${st.variation >= 0 ? '+' : ''}${pct(st.variation)} · `}${st.sauvegardes} sauvegarde(s) sur la période`,
              },
              {
                valeur: st.alertes.length,
                libelle: 'Alertes actives',
                detail: st.alertes.filter((a) => a.severity === 'Haute').length
                  ? `${st.alertes.filter((a) => a.severity === 'Haute').length} haute(s) · à traiter`
                  : 'à traiter',
              },
            ]}
          />
          <Group align="flex-start" grow>
            <Stack gap="xs">
              <Text fw={600}>Évolution des sauvegardes</Text>
              <Text size="xs" c="dimmed">
                Volume protégé : dernière sauvegarde complète et incrémentales suivantes.
              </Text>
              <BarresEmpilees
                ariaLabel="Évolution du volume protégé"
                colonnes={evolution}
                series={SERIES}
                sommet={sommet}
                formatAxe={(v) => formaterAxeVolume(v, unite)}
              />
              <LegendeSeries series={SERIES} />
            </Stack>
            <Stack gap="xs">
              <Text fw={600}>Répartition des données</Text>
              <Anneau
                ariaLabel="Répartition des données protégées par technologie"
                centre={formaterVolume(total)}
                sous="Total"
                parts={parts.map((p) => ({ ...p, texte: formaterVolume(p.valeur) }))}
              />
            </Stack>
            <Stack gap="xs">
              <Text fw={600}>Activité par établissement</Text>
              <CarteNormandie e={e} />
            </Stack>
          </Group>
          <Text fw={600}>Dernières alertes</Text>
          <TableauAlertes e={e} lignes={st.alertes.slice(0, 5)} />
        </>
      )}
    </Stack>
  );
}

function CarteNormandie({ e }: { e: EtatCrrc }) {
  return (
    <>
      <svg
        viewBox="0 0 290 190"
        role="img"
        aria-label="Carte schématique des établissements par département"
        className="gr-svg"
      >
        {Object.entries(DEPARTEMENTS_CARTE).map(([nom, pts]) => {
          const [x, y] = centreDepartement(nom);
          return (
            <g key={nom}>
              <polygon points={pts.map((p) => p.join(',')).join(' ')} className="crrc-dept">
                <title>{nom}</title>
              </polygon>
              <text x={x} y={y + 28} textAnchor="middle" className="crrc-dept-nom">
                {nom}
              </text>
            </g>
          );
        })}
        {pointsCarteCrrc(e).map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="9" className={`crrc-halo crrc-n-${p.niveau}`} />
            <circle cx={p.x} cy={p.y} r="4.5" className={`crrc-point crrc-n-${p.niveau}`} />
            <title>
              {p.nom}
              {'\n'}
              {p.detail}
            </title>
          </g>
        ))}
      </svg>
      <ul className="gr-legende gr-legende-ligne">
        {[
          ['ok', 'Opérationnel'],
          ['mid', 'Alerte'],
          ['na', 'Non configuré'],
        ].map(([n, l]) => (
          <li key={n}>
            <span className={`gr-pastille crrc-n-${n}`} aria-hidden="true" />
            <Text size="sm" component="span">
              {l}
            </Text>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------------------------------------------------------------------------------------------- alertes */
function TableauAlertes({ e, lignes, agir }: { e: EtatCrrc; lignes: EtatCrrc['alerts']; agir?: AgirCrrc }) {
  return (
    <DataTable label="Alertes">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Sévérité</Table.Th>
            <Table.Th>Ressource</Table.Th>
            <Table.Th>Établissement</Table.Th>
            <Table.Th>Message</Table.Th>
            <Table.Th>Statut</Table.Th>
            {agir && <Table.Th>Incident</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lignes.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>{formaterHorodatage(a.date)}</Table.Td>
              <Table.Td>
                <Pastille s={a.severity} />
              </Table.Td>
              <Table.Td>{nomRessource(e, a.res) || '–'}</Table.Td>
              <Table.Td>{nomEtablissement(e, a.est) || '–'}</Table.Td>
              <Table.Td>{a.message}</Table.Td>
              <Table.Td>
                {agir ? (
                  <ChampChoix
                    ariaLabel={`Statut de l’alerte ${a.id}`}
                    value={a.status}
                    options={STATUTS_ALERTE_CRRC}
                    onCommit={(v) => void agir('PATCH', `/api/crrc/alertes/${encodeURIComponent(a.id)}`, { status: v })}
                  />
                ) : (
                  <Pastille s={a.status} />
                )}
              </Table.Td>
              {agir && <Table.Td>{a.incident || '–'}</Table.Td>}
            </Table.Tr>
          ))}
          {!lignes.length && (
            <Table.Tr>
              <Table.Td colSpan={agir ? 7 : 6}>Aucune alerte.</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

export function AlertesCrrc() {
  const can = useCan(),
    modifiable = can('crrc', 'modifier'),
    { d, agir, erreur } = useCrrc(),
    [onglet, setOnglet] = useState('open'),
    [ajout, setAjout] = useState(false),
    [n, setN] = useState({ severity: 'Moyenne', res: '', message: '' });
  const e = d?.etat;
  const filtre = (a: EtatCrrc['alerts'][number], k: string) =>
    k === 'all' || (k === 'open' ? a.status === 'Ouverte' : a.status === k);
  const liste = (e?.alerts ?? []).filter((a) => filtre(a, onglet)).sort((a, b) => b.date.localeCompare(a.date));
  const p = usePage(liste, 25);
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Alertes</Text>
          <Text size="sm" c="dimmed">
            Suivi des alertes et incidents de sauvegarde.
          </Text>
        </div>
        {modifiable && <Button onClick={() => setAjout(!ajout)}>Ajouter une alerte</Button>}
      </Group>
      {e && (
        <>
          <SegmentedControl
            aria-label="Statut des alertes"
            value={onglet}
            onChange={(v) => {
              setOnglet(v);
              p.retour();
            }}
            data={[
              ['all', 'Toutes'],
              ['open', 'Ouvertes'],
              ['En cours', 'En cours'],
              ['Résolue', 'Résolues'],
            ].map(([v, l]) => ({ value: v!, label: `${l} (${e.alerts.filter((a) => filtre(a, v!)).length})` }))}
          />
          {ajout && modifiable && (
            <Group align="flex-end">
              <Select
                label="Sévérité"
                allowDeselect={false}
                data={[...SEVERITES_CRRC]}
                value={n.severity}
                onChange={(v) => setN({ ...n, severity: v ?? 'Moyenne' })}
              />
              <Select
                label="Ressource"
                placeholder="Choisir…"
                data={e.resources.map((r) => ({ value: r.id, label: `${r.name} — ${nomEtablissement(e, r.est)}` }))}
                value={n.res || null}
                onChange={(v) => setN({ ...n, res: v ?? '' })}
              />
              <TextInput
                label="Message"
                value={n.message}
                onChange={(ev) => setN({ ...n, message: ev.currentTarget.value })}
              />
              <Button
                disabled={!n.res}
                onClick={async () => {
                  if (await agir('POST', '/api/crrc/alertes', n)) {
                    setAjout(false);
                    setN({ severity: 'Moyenne', res: '', message: '' });
                  }
                }}
              >
                Enregistrer
              </Button>
            </Group>
          )}
          <TableauAlertes e={e} lignes={p.lignes} agir={modifiable ? agir : undefined} />
          {p.nav}
        </>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------------- ressources */
export function RessourcesCrrc() {
  const can = useCan(),
    modifiable = can('crrc', 'modifier'),
    { d, agir, erreur } = useCrrc(),
    [sel, setSel] = useState<string | null>(null),
    [f, setF] = useState({ tab: 'all', q: '', est: '', st: '' });
  const e = d?.etat;
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const base =
    e?.resources.filter(
      (r) =>
        (!f.est || r.est === f.est) &&
        (!f.st || statutRessource(e, r)[0] === f.st) &&
        (!f.q || norm(`${r.name} ${nomEtablissement(e, r.est)}`).includes(norm(f.q))),
    ) ?? [];
  const liste = base
    .filter((r) => f.tab === 'all' || r.tech === f.tab)
    .sort((a, b) =>
      String(e && derniereSauvegarde(e, b.id)?.date).localeCompare(String(e && derniereSauvegarde(e, a.id)?.date)),
    );
  const p = usePage(liste, 25);
  const detail = e?.resources.find((r) => r.id === sel) ?? null;
  if (e && detail)
    return (
      <Stack>
        <ErrorAlert error={erreur} />
        <DetailRessource e={e} r={detail} agir={agir} modifiable={modifiable} onRetour={() => setSel(null)} />
      </Stack>
    );
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Sauvegardes</Text>
          <Text size="sm" c="dimmed">
            Suivi et gestion des sauvegardes par ressource.
          </Text>
        </div>
        {modifiable && (
          <Button
            onClick={async () => {
              const r = await agir<{ id: string }>(
                'POST',
                '/api/crrc/ressources',
                f.tab !== 'all' ? { tech: f.tab } : {},
              );
              if (r) setSel(r.id);
            }}
          >
            Ajouter une ressource
          </Button>
        )}
      </Group>
      {e && (
        <>
          <SegmentedControl
            aria-label="Technologie"
            value={f.tab}
            onChange={(v) => {
              setF({ ...f, tab: v });
              p.retour();
            }}
            data={[
              { value: 'all', label: `Toutes (${base.length})` },
              ...TECHNOLOGIES_CRRC.map((t) => ({
                value: t.cle,
                label: `${t.libelle} (${base.filter((r) => r.tech === t.cle).length})`,
              })),
            ]}
          />
          <Group align="flex-end">
            <TextInput
              label="Rechercher"
              placeholder="Rechercher une ressource…"
              value={f.q}
              onChange={(ev) => setF({ ...f, q: ev.currentTarget.value })}
            />
            <Select
              aria-label="Établissement"
              placeholder="Tous les établissements"
              clearable
              data={e.establishments.map((x) => ({ value: x.id, label: x.name }))}
              value={f.est || null}
              onChange={(v) => setF({ ...f, est: v ?? '' })}
            />
            <Select
              aria-label="Statut"
              placeholder="Tous les statuts"
              clearable
              data={[...STATUTS_SAUVEGARDE_CRRC, 'Non configuré']}
              value={f.st || null}
              onChange={(v) => setF({ ...f, st: v ?? '' })}
            />
          </Group>
          <DataTable label="Ressources sauvegardées">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ressource</Table.Th>
                  <Table.Th>Établissement</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Dernière sauvegarde</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th>Volume</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {p.lignes.map((r) => {
                  const l = derniereSauvegarde(e, r.id);
                  return (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Anchor component="button" type="button" fw={600} onClick={() => setSel(r.id)}>
                          {r.name}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>{nomEtablissement(e, r.est) || '–'}</Table.Td>
                      <Table.Td>{libelleTechnologie(r.tech)}</Table.Td>
                      <Table.Td>{formaterHorodatage(l?.date ?? '')}</Table.Td>
                      <Table.Td>
                        <Pastille s={statutRessource(e, r)[0]} />
                      </Table.Td>
                      <Table.Td>{l ? formaterVolume(volumeProtegeRessource(e, r.id)) : '–'}</Table.Td>
                    </Table.Tr>
                  );
                })}
                {!p.lignes.length && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>Aucune ressource.</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </DataTable>
          {p.nav}
        </>
      )}
    </Stack>
  );
}

function DetailRessource({
  e,
  r,
  agir,
  modifiable,
  onRetour,
}: {
  e: EtatCrrc;
  r: Ressource;
  agir: AgirCrrc;
  modifiable: boolean;
  onRetour: () => void;
}) {
  const [nouv, setNouv] = useState({
    date: new Date().toISOString().slice(0, 16),
    type: 'Incrémentale',
    status: 'Réussie',
    volumeGb: '0',
    durationMin: '0',
  });
  const [restaurer, setRestaurer] = useState(false);
  const runs = sauvegardesDe(e, r.id),
    l = runs[0],
    [statut] = statutRessource(e, r);
  const recentes = runs.filter((x) => Date.parse(x.date) > referenceCrrc(e, Date.now()) - 30 * 864e5);
  const taux = recentes.length
    ? Math.round((recentes.filter((x) => x.status === 'Réussie').length * 100) / recentes.length)
    : null;
  const maj = (champ: Record<string, unknown>) =>
    void agir('PATCH', `/api/crrc/ressources/${encodeURIComponent(r.id)}`, champ);
  const tableauRuns = (lignes: typeof runs) => (
    <DataTable label="Historique des sauvegardes">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Statut</Table.Th>
            <Table.Th>Volume</Table.Th>
            <Table.Th>Durée</Table.Th>
            {modifiable && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lignes.map((x) => (
            <Table.Tr key={x.id}>
              <Table.Td>{formaterHorodatage(x.date)}</Table.Td>
              <Table.Td>{x.type}</Table.Td>
              <Table.Td>
                <Pastille s={x.status} />
              </Table.Td>
              <Table.Td>{formaterVolume(x.volumeGb)}</Table.Td>
              <Table.Td>{formaterDuree(x.durationMin)}</Table.Td>
              {modifiable && (
                <Table.Td>
                  <ConfirmButton
                    message="Supprimer cette sauvegarde ?"
                    onConfirm={() => agir('DELETE', `/api/crrc/sauvegardes/${encodeURIComponent(x.id)}`)}
                    variant="subtle"
                  >
                    Supprimer
                  </ConfirmButton>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {!lignes.length && (
            <Table.Tr>
              <Table.Td colSpan={6}>Aucune sauvegarde enregistrée.</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
  return (
    <Stack key={r.id}>
      <Group justify="space-between">
        <Anchor component="button" type="button" onClick={onRetour}>
          ← Sauvegardes
        </Anchor>
        {modifiable && <Button onClick={() => setRestaurer(true)}>Restaurer</Button>}
      </Group>
      <Group>
        <Text fw={700} size="lg">
          {r.name}
        </Text>
        <Text size="sm" c="dimmed">
          {libelleTechnologie(r.tech)} · {nomEtablissement(e, r.est) || 'établissement'}
        </Text>
        <Pastille s={statut === 'Réussie' ? 'Opérationnel' : statut} />
      </Group>
      <Tabs defaultValue="ov" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="ov">Vue d’ensemble</Tabs.Tab>
          <Tabs.Tab value="hist">Historique</Tabs.Tab>
          <Tabs.Tab value="rest">Restaurations</Tabs.Tab>
          <Tabs.Tab value="conf">Configuration</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="ov" pt="md">
          <Stack>
            <Chiffres
              items={[
                {
                  valeur: l ? formaterVolume(volumeProtegeRessource(e, r.id)) : '–',
                  libelle: 'Volume sauvegardé',
                  detail: l ? `dernière sauvegarde : ${formaterVolume(l.volumeGb)}` : 'aucune sauvegarde',
                },
                { valeur: l ? formaterHorodatage(l.date) : '–', libelle: 'Dernière sauvegarde', detail: l?.type },
                {
                  valeur: taux == null ? '–' : `${taux} %`,
                  libelle: 'Taux de succès (30 j)',
                  detail: `${recentes.length} sauvegarde(s)`,
                },
              ]}
            />
            <Text fw={600}>Historique des sauvegardes</Text>
            {tableauRuns(runs.slice(0, 5))}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="hist" pt="md">
          <Stack>
            {modifiable && (
              <Group align="flex-end">
                <TextInput
                  label="Date et heure"
                  type="datetime-local"
                  value={nouv.date}
                  onChange={(ev) => setNouv({ ...nouv, date: ev.currentTarget.value })}
                />
                <Select
                  label="Type"
                  allowDeselect={false}
                  data={[...TYPES_SAUVEGARDE_CRRC]}
                  value={nouv.type}
                  onChange={(v) => setNouv({ ...nouv, type: v ?? 'Incrémentale' })}
                />
                <Select
                  label="Statut"
                  allowDeselect={false}
                  data={[...STATUTS_SAUVEGARDE_CRRC]}
                  value={nouv.status}
                  onChange={(v) => setNouv({ ...nouv, status: v ?? 'Réussie' })}
                />
                <TextInput
                  label="Volume (Go)"
                  type="number"
                  value={nouv.volumeGb}
                  onChange={(ev) => setNouv({ ...nouv, volumeGb: ev.currentTarget.value })}
                />
                <TextInput
                  label="Durée (min)"
                  type="number"
                  value={nouv.durationMin}
                  onChange={(ev) => setNouv({ ...nouv, durationMin: ev.currentTarget.value })}
                />
                <Button
                  disabled={!nouv.date}
                  onClick={() =>
                    void agir('POST', `/api/crrc/ressources/${encodeURIComponent(r.id)}/sauvegardes`, {
                      date: nouv.date,
                      type: nouv.type,
                      status: nouv.status,
                      volumeGb: Math.max(0, parseFloat(nouv.volumeGb) || 0),
                      durationMin: Math.max(0, Math.round(parseInt(nouv.durationMin, 10) || 0)),
                    })
                  }
                >
                  Ajouter la sauvegarde
                </Button>
              </Group>
            )}
            {tableauRuns(runs)}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="rest" pt="md">
          <Stack>
            {modifiable && (
              <div>
                <Button onClick={() => setRestaurer(true)}>Restaurer</Button>
              </div>
            )}
            <TableauRestaurations
              e={e}
              lignes={e.restores.filter((x) => x.res === r.id)}
              agir={modifiable ? agir : undefined}
            />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="conf" pt="md">
          <Stack>
            <div className="grille-formulaire">
              <div className="grille-formulaire__champs">
                <ChampTexte
                  label="Nom de la ressource"
                  value={r.name}
                  requis
                  disabled={!modifiable}
                  onCommit={(v) => maj({ name: v })}
                />
                <ChampChoix
                  label="Technologie"
                  value={r.tech}
                  options={TECHNOLOGIES_CRRC.map((t) => ({ value: t.cle, label: t.libelle }))}
                  disabled={!modifiable}
                  onCommit={(v) => maj({ tech: v })}
                />
                <ChampChoix
                  label="Établissement"
                  value={r.est}
                  options={e.establishments.map((x) => ({ value: x.id, label: x.name }))}
                  disabled={!modifiable}
                  onCommit={(v) => maj({ est: v })}
                />
                <ChampChoix
                  label="Fréquence attendue"
                  value={r.freq}
                  options={FREQUENCES_CRRC}
                  disabled={!modifiable}
                  onCommit={(v) => maj({ freq: v })}
                />
                <ChampTexte
                  label="Rétention (jours)"
                  type="number"
                  value={String(r.retention ?? e.establishments.find((x) => x.id === r.est)?.retentionDays ?? '')}
                  disabled={!modifiable}
                  onCommit={(v) => maj({ retention: Math.max(0, Math.round(Number(v) || 0)) })}
                />
              </div>
            </div>
            <ChampZone label="Notes" value={r.notes} disabled={!modifiable} onCommit={(v) => maj({ notes: v })} />
            {modifiable && (
              <Group justify="flex-end">
                <ConfirmButton
                  message={`Supprimer la ressource « ${r.name} » et son historique ?`}
                  onConfirm={async () => {
                    await agir('DELETE', `/api/crrc/ressources/${encodeURIComponent(r.id)}`);
                    onRetour();
                  }}
                  variant="light"
                >
                  Supprimer la ressource
                </ConfirmButton>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
      {restaurer && (
        <Card withBorder>
          <AssistantRestauration e={e} agir={agir} depart={r.id} onFini={() => setRestaurer(false)} />
        </Card>
      )}
    </Stack>
  );
}

/* --------------------------------------------------------------------------------------------- restaurations */
function TableauRestaurations({ e, lignes, agir }: { e: EtatCrrc; lignes: EtatCrrc['restores']; agir?: AgirCrrc }) {
  const maj = (id: string, champ: Record<string, unknown>) =>
    void agir?.('PATCH', `/api/crrc/restaurations/${encodeURIComponent(id)}`, champ);
  return (
    <DataTable label="Restaurations">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Établissement</Table.Th>
            <Table.Th>Ressource</Table.Th>
            <Table.Th>Périmètre</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Statut</Table.Th>
            <Table.Th>Responsable</Table.Th>
            <Table.Th>Durée</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...lignes]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((x) => (
              <Table.Tr key={x.id}>
                <Table.Td>{formaterHorodatage(x.date)}</Table.Td>
                <Table.Td>{nomEtablissement(e, x.est) || x.est || '–'}</Table.Td>
                <Table.Td>{nomRessource(e, x.res) || '–'}</Table.Td>
                <Table.Td>{x.scope}</Table.Td>
                <Table.Td>{x.type}</Table.Td>
                <Table.Td>
                  {agir ? (
                    <ChampChoix
                      ariaLabel={`Statut de la restauration ${x.id}`}
                      value={x.status}
                      options={STATUTS_RESTAURATION_CRRC}
                      onCommit={(v) => maj(x.id, { status: v })}
                    />
                  ) : (
                    <Pastille s={x.status} />
                  )}
                </Table.Td>
                <Table.Td>
                  {agir ? (
                    <ChampTexte
                      ariaLabel={`Responsable de la restauration ${x.id}`}
                      value={x.owner}
                      onCommit={(v) => maj(x.id, { owner: v })}
                    />
                  ) : (
                    x.owner
                  )}
                </Table.Td>
                <Table.Td>
                  {agir ? (
                    <ChampTexte
                      ariaLabel={`Durée de la restauration ${x.id}`}
                      value={x.duration}
                      onCommit={(v) => maj(x.id, { duration: v })}
                    />
                  ) : (
                    x.duration
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          {!lignes.length && (
            <Table.Tr>
              <Table.Td colSpan={8}>Aucune restauration.</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

interface Assistant {
  tech: string;
  est: string;
  res: string;
  point: string;
  scope: string;
  dest: string;
  path: string;
  conflict: string;
  type: string;
  owner: string;
}
const ETAPES = ['Sélectionner la source', 'Choisir les données', 'Options de restauration', 'Lancer la restauration'];

function AssistantRestauration({
  e,
  agir,
  depart,
  onFini,
}: {
  e: EtatCrrc;
  agir: AgirCrrc;
  depart?: string;
  onFini: () => void;
}) {
  const r0 = e.resources.find((r) => r.id === depart);
  const [etape, setEtape] = useState(r0 ? 2 : 1);
  const [w, setW] = useState<Assistant>({
    tech: r0?.tech ?? '',
    est: r0?.est ?? '',
    res: r0?.id ?? '',
    point: '',
    scope: '',
    dest: 'Emplacement d’origine',
    path: '',
    conflict: 'Ne pas écraser',
    type: 'Demande utilisateur',
    owner: '',
  });
  const ressources = e.resources.filter((r) => r.tech === w.tech && (!w.est || r.est === w.est));
  const points = w.res ? sauvegardesDe(e, w.res).filter((x) => x.status !== 'Échec') : [];
  const r = e.resources.find((x) => x.id === w.res);
  return (
    <Stack>
      <Text fw={600}>
        Étape {etape} sur 4 — {ETAPES[etape - 1]}
      </Text>
      {etape === 1 && (
        <Group>
          {TECHNOLOGIES_CRRC.map((t) => (
            <Card key={t.cle} withBorder padding="sm">
              <Text fw={600}>{t.libelle}</Text>
              <Text size="xs" c="dimmed">
                {t.description}
              </Text>
              <Button
                variant="default"
                size="compact-sm"
                aria-label={`Sélectionner ${t.libelle}`}
                onClick={() => {
                  setW({ ...w, tech: t.cle, res: '', point: '' });
                  setEtape(2);
                }}
              >
                Sélectionner →
              </Button>
            </Card>
          ))}
        </Group>
      )}
      {etape === 2 && (
        <>
          <div className="grille-formulaire">
            <div className="grille-formulaire__champs">
              <Select
                label="Établissement"
                placeholder="Tous"
                clearable
                data={e.establishments.map((x) => ({ value: x.id, label: x.name }))}
                value={w.est || null}
                onChange={(v) => setW({ ...w, est: v ?? '', res: '', point: '' })}
              />
              <Select
                label="Ressource"
                placeholder="Choisir…"
                data={ressources.map((x) => ({ value: x.id, label: `${x.name} — ${nomEtablissement(e, x.est)}` }))}
                value={w.res || null}
                onChange={(v) => setW({ ...w, res: v ?? '', point: '' })}
              />
              <Select
                label="Point de restauration"
                placeholder="Choisir…"
                data={points.map((x) => ({
                  value: x.date,
                  label: `${formaterHorodatage(x.date)} — ${x.type} — ${formaterVolume(x.volumeGb)}`,
                }))}
                value={w.point || null}
                onChange={(v) => setW({ ...w, point: v ?? '' })}
              />
              <TextInput
                label="Éléments à restaurer"
                placeholder="Dossiers, boîtes aux lettres, volumes…"
                value={w.scope}
                onChange={(ev) => setW({ ...w, scope: ev.currentTarget.value })}
              />
            </div>
          </div>
          <Group>
            <Button variant="default" onClick={() => setEtape(1)}>
              ← Retour
            </Button>
            <Button disabled={!w.res || !w.point} onClick={() => setEtape(3)}>
              Continuer →
            </Button>
          </Group>
        </>
      )}
      {etape === 3 && (
        <>
          <div className="grille-formulaire">
            <div className="grille-formulaire__champs">
              <Select
                label="Destination"
                allowDeselect={false}
                data={[...DESTINATIONS_RESTAURATION_CRRC]}
                value={w.dest}
                onChange={(v) => setW({ ...w, dest: v ?? w.dest })}
              />
              <TextInput
                label="Chemin alternatif"
                value={w.path}
                onChange={(ev) => setW({ ...w, path: ev.currentTarget.value })}
              />
              <Select
                label="En cas de conflit"
                allowDeselect={false}
                data={[...CONFLITS_RESTAURATION_CRRC]}
                value={w.conflict}
                onChange={(v) => setW({ ...w, conflict: v ?? w.conflict })}
              />
              <Select
                label="Motif"
                allowDeselect={false}
                data={[...MOTIFS_RESTAURATION_CRRC]}
                value={w.type}
                onChange={(v) => setW({ ...w, type: v ?? w.type })}
              />
              <TextInput
                label="Responsable"
                value={w.owner}
                onChange={(ev) => setW({ ...w, owner: ev.currentTarget.value })}
              />
            </div>
          </div>
          <Group>
            <Button variant="default" onClick={() => setEtape(2)}>
              ← Retour
            </Button>
            <Button onClick={() => setEtape(4)}>Continuer →</Button>
          </Group>
        </>
      )}
      {etape === 4 && (
        <>
          <ul>
            <li>
              <b>Source</b> : {libelleTechnologie(w.tech)} — {r?.name} ({nomEtablissement(e, r?.est ?? '')})
            </li>
            <li>
              <b>Point de restauration</b> : {formaterHorodatage(w.point)}
            </li>
            <li>
              <b>Éléments</b> : {w.scope || 'intégralité'}
            </li>
            <li>
              <b>Destination</b> : {w.dest}
              {w.path ? ` — ${w.path}` : ''}, {w.conflict.toLowerCase()}
            </li>
            <li>
              <b>Motif</b> : {w.type} · responsable {w.owner || 'à désigner'}
            </li>
          </ul>
          <Text size="sm" c="dimmed">
            La restauration est enregistrée comme « demandée » pour suivi ; l’opération technique est réalisée par
            l’exploitant.
          </Text>
          <Group>
            <Button variant="default" onClick={() => setEtape(3)}>
              ← Retour
            </Button>
            <Button
              onClick={async () => {
                const ok = await agir('POST', '/api/crrc/restaurations', {
                  res: w.res,
                  point: w.point,
                  scope: w.scope,
                  type: w.type,
                  owner: w.owner,
                  dest: w.dest,
                  path: w.path,
                  conflict: w.conflict,
                });
                if (ok) onFini();
              }}
            >
              Lancer la restauration
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}

export function RestaurationsCrrc() {
  const can = useCan(),
    modifiable = can('crrc', 'modifier'),
    { d, agir, erreur } = useCrrc(),
    [onglet, setOnglet] = useState(modifiable ? 'new' : 'hist');
  const e = d?.etat;
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <div>
        <Text fw={600}>Restaurations</Text>
        <Text size="sm" c="dimmed">
          Effectuer et suivre les restaurations de données.
        </Text>
      </div>
      {e && (
        <Tabs value={onglet} onChange={(v) => setOnglet(v ?? 'hist')} keepMounted={false}>
          <Tabs.List>
            {modifiable && <Tabs.Tab value="new">Nouvelle restauration</Tabs.Tab>}
            <Tabs.Tab value="hist">Historique ({e.restores.length})</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="new" pt="md">
            <AssistantRestauration key={e.restores.length} e={e} agir={agir} onFini={() => setOnglet('hist')} />
          </Tabs.Panel>
          <Tabs.Panel value="hist" pt="md">
            <TableauRestaurations e={e} lignes={e.restores} agir={modifiable ? agir : undefined} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}

/* --------------------------------------------------------------------------------------------------- rapports */
export function RapportsCrrc() {
  const { d, erreur } = useCrrc();
  const e = d?.etat;
  const [mois, setMois] = useState<string | null>(null);
  const m = mois ?? new Date(e ? referenceCrrc(e, Date.now()) : Date.now()).toISOString().slice(0, 7);
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Rapports</Text>
          <Text size="sm" c="dimmed">
            Synthèse mensuelle par établissement : sauvegardes, taux de succès, volume protégé, alertes et
            restaurations.
          </Text>
        </div>
        <TextInput label="Mois" type="month" value={m} onChange={(ev) => setMois(ev.currentTarget.value)} />
      </Group>
      {e && (
        <DataTable label="Rapport mensuel">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Établissement</Table.Th>
                <Table.Th>Sauvegardes</Table.Th>
                <Table.Th>Taux de succès</Table.Th>
                <Table.Th>Volume protégé</Table.Th>
                <Table.Th>Alertes</Table.Th>
                <Table.Th>Restaurations</Table.Th>
                <Table.Th>Exploitation</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rapportMensuelCrrc(e, m).map((x) => (
                <Table.Tr key={x.etablissement.id}>
                  <Table.Td>
                    <b>{x.etablissement.name}</b>
                  </Table.Td>
                  <Table.Td>{x.sauvegardes}</Table.Td>
                  <Table.Td>{x.taux == null ? '–' : `${x.taux.toLocaleString('fr-FR')} %`}</Table.Td>
                  <Table.Td>{formaterVolume(x.volume)}</Table.Td>
                  <Table.Td>{x.alertes}</Table.Td>
                  <Table.Td>{x.restaurations}</Table.Td>
                  <Table.Td>
                    <Pastille s={statutEtablissement(e, x.etablissement)[0]} />
                  </Table.Td>
                </Table.Tr>
              ))}
              {!e.establishments.length && (
                <Table.Tr>
                  <Table.Td colSpan={7}>Aucun établissement.</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </DataTable>
      )}
    </Stack>
  );
}
