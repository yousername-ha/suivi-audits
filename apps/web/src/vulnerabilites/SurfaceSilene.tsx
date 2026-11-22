/* Module Vulnérabilités (ADR 0100, lot SI1) : surface externe importée de Silène (ANSSI) dans l'écran « Surface externe »,
   à côté d'AlgoLightHouse. Note Silène en tête (note, sous-note réseau, nombres par famille, date du rapport, évolution
   depuis l'import précédent), ports ouverts réunis avec les services d'AlgoLightHouse dans la liste des actifs (la source de
   chaque information visible), fiche Silène d'un actif, onglet « Constats Silène » avec la fiche d'un constat, liaison de
   chaque instance à un périmètre (onglet « Périmètres », administration du module). Lecture seule ; le serveur est seul juge
   des droits. Composants de la charte, CSP stricte (ADR 0006) : ni style ni script en ligne. Un constat Silène s'affiche
   avec sa classe, sans priorité P1-P4 (correspondance classe → priorité en attente du RSSI). */
import {
  Anchor,
  Button,
  Group,
  List,
  Modal,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  type ActifSurfaceDto,
  type ConstatSileneDto,
  type FicheActifSileneDto,
  type FicheConstatSileneDto,
  fusionnerPortsActif,
  type NoteSileneDto,
  type PageSurface,
  type PerimetreAffectableDto,
  type PerimetreSileneDto,
  sourcesPort,
  TYPE_NOM_SILENE_LIBELLES,
  type TypeActifAlh,
} from '@suivi/shared';
import { DataTable, ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import { resumeBilanSilene } from '../integrations/silene';
import { PictoSource, PictosSources } from './PictoSource';
import {
  dateRapport,
  detailsPortActif,
  etatDernierImport,
  famillesNote,
  libelleClasse,
  libelleLigneSilene,
  libellePortActif,
  libellePortSilene,
  libelleProduitSilene,
  nombreSilene,
  PICTO_SURFACE,
  pictosSurface,
  produitPortSilene,
  resumePortsSilene,
  texteEvolution,
  URL_PERIMETRES_SILENE,
  urlConstatsSilene,
  urlFicheActifSilene,
  urlFicheConstatSilene,
  urlLierSilene,
} from './surface-silene';
import { nombrePages } from './veille';
import { NOMS_PAGINATION } from './pagination';

const CLE = ['vulnerabilites', 'surface', 'silene'] as const;

/* ------------------------------------------------------------------ Note */
/** Note Silène de chaque instance lisible (sans état), avec sa pastille de source. Le lien « Configurer l'intégration »
    n'est pas répété : celui de l'état d'AlgoLightHouse, juste à côté, mène à la même carte. */
export function NoteSilene({ notes, peutConfigurer = false }: { notes: NoteSileneDto[]; peutConfigurer?: boolean }) {
  return (
    <Stack gap="sm" component="section" aria-label="Note Silène" className="ss-source">
      <Group gap="xs">
        <PictoSource source="silene" avecNom decoratif />
        <Title order={2} size="h5">
          Note Silène (ANSSI)
        </Title>
      </Group>
      {notes.length === 0 && (
        <Text size="sm" c="dimmed" role="status">
          Aucune instance Silène que vous pouvez lire.
          {peutConfigurer
            ? ' Ajoutez « Silène, import de fichier » dans la carte « Intégrations » pour importer un rapport.'
            : ' Un administrateur des intégrations l’ajoute dans la page Plateforme.'}
        </Text>
      )}
      {notes.map((n) => {
        const e = etatDernierImport(n);
        const c = n.courante;
        return (
          <Stack key={n.integrationId} gap="2xs">
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <StatusChip etat={e.etat}>{e.libelle}</StatusChip>
              <Stack gap="2xs">
                <Text size="sm" fw={600}>
                  {n.nom}
                </Text>
                <Text size="xs" c="dimmed">
                  Périmètre : {n.perimetreNom ?? 'non relié (administration du module seulement)'}
                </Text>
              </Stack>
            </Group>
            {c ? (
              <>
                <Text size="sm">
                  Note : <strong>{nombreSilene(c.note)}</strong> · sous-note réseau :{' '}
                  <strong>{nombreSilene(c.noteReseau)}</strong> · rapport du {dateRapport(c.date)}
                </Text>
                <Text size="xs" c="dimmed" role="status">
                  {texteEvolution(c, n.precedente)}
                </Text>
                <List size="xs" aria-label="Nombres par famille du rapport">
                  {famillesNote(c).map((f) => (
                    <List.Item key={f.famille}>
                      {f.libelle} : {f.valeur}
                    </List.Item>
                  ))}
                </List>
                <Text size="xs" c="dimmed">
                  {n.hotes} hôte{n.hotes > 1 ? 's' : ''} et {n.constats} constat{n.constats > 1 ? 's' : ''} présents ·
                  périmètre déclaré : {n.perimetre.domaines} nom{n.perimetre.domaines > 1 ? 's' : ''} de domaine,{' '}
                  {n.perimetre.plages} adresse{n.perimetre.plages > 1 ? 's' : ''} ou plage
                  {n.perimetre.plages > 1 ? 's' : ''} · importé le{' '}
                  <span className="horodatage">{fmtDate(c.importeLe)}</span>
                </Text>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                Aucun rapport importé pour le moment.
              </Text>
            )}
            {n.derniere && n.derniere.etat !== 'recu' && n.derniere.erreur && (
              <Text size="xs" role="status">
                <strong>Erreur du dernier import :</strong> {n.derniere.erreur}
              </Text>
            )}
            {n.derniere?.bilan && (
              <Text size="xs" c="dimmed">
                {resumeBilanSilene(n.derniere.bilan)}
              </Text>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

/* ------------------------------------------------------------------ Actifs */
/** Pastilles des sources qui voient un actif (liste nommée). */
export function SourcesActif({ sources }: { sources: ActifSurfaceDto['sources'] }) {
  return <PictosSources sources={pictosSurface(sources)} libelle="Sources" />;
}

/** Ports ouverts (Silène, sur la ligne de l'hôte) et services (AlgoLightHouse) d'un actif, réunis sans doublon : trois
    premiers dans la liste, la source de chaque information nommée. */
export function PortsActif({ actif, max = 3 }: { actif: ActifSurfaceDto; max?: number }) {
  const s = actif.silene!;
  // Les ports ouverts de Silène appartiennent à l'hôte : montrés sur sa ligne, pas sur celle d'un nom qu'il porte.
  const ports = fusionnerPortsActif(actif.services, actif.type === 'hote' ? s.ports : []);
  return (
    <>
      {ports.slice(0, max).map((p) => (
        <div key={`${p.port}/${p.protocole ?? ''}`}>
          <Group gap="2xs" wrap="nowrap">
            <Text size="sm" className="veille-code">
              {libellePortActif(p)}
            </Text>
            <PictosSources sources={sourcesPort(p).map((x) => PICTO_SURFACE[x])} decoratif infobulle={false} />
          </Group>
          {detailsPortActif(p).map((d) => (
            <Text key={d.source} size="xs" c="dimmed" className="veille-texte">
              {d.texte}
            </Text>
          ))}
        </div>
      ))}
      {!ports.length && actif.type === 'hote' && (
        <Text size="sm" c="dimmed">
          Aucun port ouvert connu
        </Text>
      )}
      {actif.type === 'hote' && (
        <Text size="xs" c="dimmed">
          {resumePortsSilene(s)}
          {ports.length > max ? ` · ${ports.length - max} autre${ports.length - max > 1 ? 's' : ''} dans la fiche` : ''}
        </Text>
      )}
      {actif.type === 'domaine' && s.adresses.length > 0 && (
        <Text size="xs" c="dimmed">
          Selon Silène, porté par {s.adresses.join(', ')}
        </Text>
      )}
    </>
  );
}

/** Ce que Silène dit d'un actif (sans état) : adresses, noms, ports ouverts, produits, constats. */
export function FicheActifSilene({ fiche }: { fiche: FicheActifSileneDto }) {
  return (
    <Stack gap="sm" component="section" aria-label="Vu par Silène">
      <Group gap="xs">
        <PictoSource source="silene" avecNom decoratif />
        <Title order={3} size="h6">
          Vu par Silène
        </Title>
      </Group>
      <Text size="sm">
        Adresse{fiche.adresses.length > 1 ? 's' : ''} IP :{' '}
        <span className="veille-code">{fiche.adresses.join(', ')}</span> ·{' '}
        {fiche.instances.map((i) => i.nom).join(', ')} · Périmètre : {fiche.perimetreNom ?? 'non relié'}
      </Text>
      <DataTable label="Ports ouverts selon Silène">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Port ouvert</Table.Th>
              <Table.Th>Produit</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {fiche.ports.map((p) => (
              <Table.Tr key={`${p.port}/${p.protocole}`}>
                <Table.Td className="veille-code">{libellePortSilene(p)}</Table.Td>
                <Table.Td>{produitPortSilene(p) ?? '—'}</Table.Td>
              </Table.Tr>
            ))}
            {fiche.ports.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Text size="sm" c="dimmed">
                    Aucun port ouvert selon Silène.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </DataTable>
      <Text size="xs" c="dimmed">
        {resumePortsSilene(fiche)}.
      </Text>
      {fiche.noms.length > 0 && (
        <Stack gap="2xs">
          <Title order={4} size="h6">
            Noms
          </Title>
          <List size="sm">
            {fiche.noms.map((n) => (
              <List.Item key={`${n.type}|${n.nom}`}>
                <span className="veille-code">{n.nom}</span> ({TYPE_NOM_SILENE_LIBELLES[n.type]})
              </List.Item>
            ))}
          </List>
        </Stack>
      )}
      {fiche.produits.length > 0 && (
        <Stack gap="2xs">
          <Title order={4} size="h6">
            Produits vus
          </Title>
          <List size="sm">
            {fiche.produits.map((p) => (
              <List.Item key={libelleProduitSilene(p)}>{libelleProduitSilene(p)}</List.Item>
            ))}
          </List>
          <Text size="xs" c="dimmed">
            Ces produits ne sont pas encore rapprochés des CVE.
          </Text>
        </Stack>
      )}
      <Stack gap="2xs">
        <Title order={4} size="h6">
          Constats Silène
        </Title>
        {fiche.listeConstats.length ? (
          <List size="sm">
            {fiche.listeConstats.map((c) => (
              <List.Item key={c.id}>
                {c.controle} ({libelleClasse(c.classe)})
              </List.Item>
            ))}
          </List>
        ) : (
          <Text size="sm" c="dimmed">
            Aucun constat ne concerne cet actif.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

/** Fiche Silène d'un actif, lue à l'ouverture. */
export function FicheActifSileneLue({ type, valeur }: { type: TypeActifAlh; valeur: string }) {
  const q = useQuery({
    queryKey: [...CLE, 'actif', type, valeur],
    queryFn: () => get<FicheActifSileneDto>(urlFicheActifSilene(type, valeur)),
  });
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      {q.data && <FicheActifSilene fiche={q.data} />}
    </Stack>
  );
}

/** Résumé d'un actif vu par Silène seul, pour la colonne « Machine interne » (aucune liaison possible). */
export const SILENE_SEUL = 'Vu par Silène seul : aucune liaison.';

/* ------------------------------------------------------------------ Constats */
/** Constats Silène (sans état) : contrôle, classe, hôtes concernés, points ; `onOuvrir` ouvre la fiche. */
export function ConstatsSileneTable({
  constats,
  onOuvrir,
}: {
  constats: ConstatSileneDto[];
  onOuvrir?: (c: ConstatSileneDto) => void;
}) {
  return (
    <DataTable label="Constats Silène">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Contrôle</Table.Th>
            <Table.Th>Classe</Table.Th>
            <Table.Th>Hôtes concernés</Table.Th>
            <Table.Th>Points</Table.Th>
            <Table.Th>Périmètre</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {constats.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td>
                {onOuvrir ? (
                  <Anchor component="button" type="button" onClick={() => onOuvrir(c)}>
                    {c.controle}
                  </Anchor>
                ) : (
                  <Text size="sm">{c.controle}</Text>
                )}
                <Text size="xs" c="dimmed" className="veille-code">
                  {c.identifiant}
                </Text>
              </Table.Td>
              <Table.Td>{libelleClasse(c.classe)}</Table.Td>
              <Table.Td>{c.hotes}</Table.Td>
              <Table.Td>{nombreSilene(c.points)}</Table.Td>
              <Table.Td>
                {c.perimetreNom ?? 'Non relié'}
                <Text size="xs" c="dimmed">
                  {c.integration.nom}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
          {constats.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed">
                  Aucun constat Silène ne correspond, parmi ceux que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Fiche d'un constat (sans état) : classe, points, détail par hôte. */
export function FicheConstatSilene({ c }: { c: FicheConstatSileneDto }) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <PictoSource source="silene" avecNom decoratif />
        <Text size="sm">
          Contrôle <strong>{c.controle}</strong> · {libelleClasse(c.classe)} · points : {nombreSilene(c.points)}
          {c.note !== null ? ` · note : ${nombreSilene(c.note)}` : ''}
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        Identifiant {c.identifiant} · {c.integration.nom} · Périmètre : {c.perimetreNom ?? 'non relié'}. Sans priorité :
        un constat Silène n’a pas de CVE ; sa classe est celle du rapport (sens à confirmer).
      </Text>
      <DataTable label="Détail par hôte">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Hôte (adresse IP)</Table.Th>
              <Table.Th>Détail</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {c.parHote.map((h) => (
              <Table.Tr key={h.hote}>
                <Table.Td className="veille-code">{h.hote}</Table.Td>
                <Table.Td>
                  {h.lignes.length ? (
                    h.lignes.map((l) => (
                      <Text key={l.rang} size="sm">
                        {libelleLigneSilene(l)}
                      </Text>
                    ))
                  ) : (
                    <Text size="sm" c="dimmed">
                      Concerné, sans détail
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
    </Stack>
  );
}

function Pages({
  donnees,
  page,
  onPage,
}: {
  donnees: PageSurface<unknown>;
  page: number;
  onPage: (p: number) => void;
}) {
  const pages = nombrePages(donnees.total, donnees.parPage);
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed" role="status">
        {donnees.total} résultat{donnees.total > 1 ? 's' : ''}
      </Text>
      {pages > 1 && (
        <Pagination
          {...NOMS_PAGINATION}
          total={pages}
          value={page}
          onChange={onPage}
          aria-label="Pages des constats Silène"
        />
      )}
    </Group>
  );
}

/** Onglet « Constats Silène » : recherche, liste, fiche. */
export function OngletConstatsSilene() {
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [ouvert, setOuvert] = useState<ConstatSileneDto | null>(null);
  const q = useQuery({
    queryKey: [...CLE, 'constats', recherche, page],
    queryFn: () => get<PageSurface<ConstatSileneDto>>(urlConstatsSilene(recherche, page)),
  });
  const fiche = useQuery({
    queryKey: [...CLE, 'constat', ouvert?.id],
    queryFn: () => get<FicheConstatSileneDto>(urlFicheConstatSilene(ouvert!.id)),
    enabled: !!ouvert,
  });
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Constats du dernier rapport Silène importé, par contrôle. La classe est celle du rapport (« classe N » tant que
        sa correspondance n’est pas confirmée) ; aucun constat Silène n’a de priorité P1 à P4, faute de CVE.
      </Text>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setRecherche(saisie.trim());
          setPage(1);
        }}
      >
        <Group align="flex-end">
          <TextInput
            label="Rechercher un constat"
            description="Contrôle, identifiant ou adresse IP d’un hôte concerné."
            maxLength={100}
            value={saisie}
            onChange={(e) => setSaisie(e.currentTarget.value)}
          />
          <Button type="submit" variant="default">
            Rechercher
          </Button>
        </Group>
      </form>
      <ErrorAlert error={q.error} />
      {q.data && <ConstatsSileneTable constats={q.data.elements} onOuvrir={setOuvert} />}
      {q.data && <Pages donnees={q.data} page={page} onPage={setPage} />}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouvert}
        onClose={() => setOuvert(null)}
        title={ouvert ? `Constat Silène : ${ouvert.controle}` : 'Constat Silène'}
        size="xl"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={fiche.error} />
        {fiche.data && <FicheConstatSilene c={fiche.data} />}
      </Modal>
    </Stack>
  );
}

/* ------------------------------------------------------------------ Périmètres */
/** Instances Silène et leur périmètre (sans état) ; `onLier` reçoit le périmètre visé (null : délier). */
export function PerimetresSileneTable({
  instances,
  options,
  enCours,
  onLier,
}: {
  instances: PerimetreSileneDto[];
  options: PerimetreAffectableDto[];
  enCours: string | null;
  onLier: (p: PerimetreSileneDto, perimetreId: string | null) => void;
}) {
  return (
    <DataTable label="Instances Silène">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Instance Silène</Table.Th>
            <Table.Th>Contenu</Table.Th>
            <Table.Th>Périmètre de la plateforme</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {instances.map((p) => (
            <Table.Tr key={p.integrationId}>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {p.nom}
                </Text>
              </Table.Td>
              <Table.Td>
                {p.hotes} hôte{p.hotes > 1 ? 's' : ''} · {p.constats} constat{p.constats > 1 ? 's' : ''}
              </Table.Td>
              <Table.Td>
                <Select
                  label={`Périmètre de la plateforme pour ${p.nom}`}
                  placeholder="Non relié"
                  clearable
                  disabled={enCours === p.integrationId}
                  value={p.perimetreId}
                  onChange={(v) => {
                    if ((v ?? null) !== p.perimetreId) onLier(p, v ?? null);
                  }}
                  data={[
                    ...options.map((o) => ({ value: o.id, label: o.nom })),
                    ...(p.perimetreId && !options.some((o) => o.id === p.perimetreId)
                      ? [{ value: p.perimetreId, label: p.perimetreNom ?? 'Périmètre non accessible' }]
                      : []),
                  ]}
                  comboboxProps={{ withinPortal: false }}
                />
                {!p.perimetreId && (
                  <Text size="xs" c="dimmed">
                    Non relié : visible de l’administration du module seulement.
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
          {instances.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text size="sm" c="dimmed">
                  Aucune instance Silène : ajoutez « Silène, import de fichier » dans la carte « Intégrations ».
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Section Silène de l'onglet « Périmètres » : chaque instance se relie à un périmètre de la plateforme. */
export function PerimetresSilene({ options }: { options: PerimetreAffectableDto[] }) {
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const q = useQuery({
    queryKey: [...CLE, 'perimetres'],
    queryFn: () => get<PerimetreSileneDto[]>(URL_PERIMETRES_SILENE),
  });
  const lier = async (p: PerimetreSileneDto, perimetreId: string | null) => {
    setEnCours(p.integrationId);
    try {
      await api('PUT', urlLierSilene(p.integrationId), { body: { perimetreId }, ifMatch: p.version });
      notifications.show({ color: 'teal', message: perimetreId ? 'Instance Silène reliée.' : 'Liaison retirée.' });
      await qc.invalidateQueries({ queryKey: ['vulnerabilites', 'surface'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
      await qc.invalidateQueries({ queryKey: [...CLE, 'perimetres'] });
    } finally {
      setEnCours(null);
    }
  };
  return (
    <Stack component="section" aria-label="Instances Silène et périmètres">
      <Group gap="xs">
        <PictoSource source="silene" avecNom decoratif />
        <Title order={3} size="h5">
          Silène
        </Title>
      </Group>
      <Text size="sm">
        Reliez chaque instance Silène à un périmètre de la plateforme : sa note, ses hôtes et ses constats deviennent
        lisibles par les personnes qui lisent ce périmètre. Mêmes règles que pour AlgoLightHouse ; un import ne change
        jamais une liaison.
      </Text>
      <ErrorAlert error={q.error} />
      {q.data && (
        <PerimetresSileneTable
          instances={q.data}
          options={options}
          enCours={enCours}
          onLier={(p, v) => void lier(p, v)}
        />
      )}
    </Stack>
  );
}
