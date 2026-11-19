/* Module Vulnérabilités (ADR 0100, lot S3 ; décision du RSSI du 18/11/2026) : vue « Correctifs » de l'écran « Failles
   détectées ». En tête, « n mises à jour à faire pour m failles » ; une ligne par correctif (texte de la solution de Tenable,
   en anglais, tel quel), triée par gain, avec ses failles, ses CVE, les machines lues, la priorité la plus haute, les marques
   (exploitation avérée et sa précision « sans correctif connu », exploitable, fin de support), l'état de délai le plus
   défavorable (lot S1) et l'état du correctif avec ses sources. Clic : fenêtre du groupe (ses failles, les machines lues) ;
   une faille ouvre sa fiche existante, une machine la sienne. Sous la CSP stricte (ADR 0006) : aucun style en ligne,
   `lockScroll={false}`, bouton de fermeture nommé ; jamais la seule couleur. */
import { Alert, Anchor, Button, Group, Modal, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import {
  type CorrectifDetailDto,
  type CorrectifDto,
  type CorrectifsDto,
  enteteCorrectifs,
  ETAT_CORRECTIF_LIBELLES,
  type FailleCorrectifDto,
  FIN_SUPPORT_DEFINITION,
  type MachineDto,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  SANS_CORRECTIF_LIBELLE,
  SITUATION_EXPLOITATION_LIBELLES,
} from '@suivi/shared';
import { DataTable, ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { useCan } from '../session';
import {
  CLE_CORRECTIFS,
  ETAT_CORRECTIF_PUCE,
  EXPLICATION_CORRECTIFS,
  HORS_VUE_CORRECTIFS,
  libelleMachinesLues,
  repartitionCorrectif,
  sourceEtatCorrectif,
  sourcesCorrectif,
  urlCorrectif,
  urlCorrectifs,
} from './correctifs';
import { ETAT_DELAI_PUCE, libelleEtatDelai } from './delais';
import { ETAT_PRIORITE, libelleMachine, libelleRole } from './failles';
import { DelaiFaille } from './FaillesDetectees';
import { FicheMachine } from './Machines';
import { MentionFinSupport, MarqueExploitable, MarqueZeroDay } from './ParcMachines';

/** Marques d'un groupe, en texte (jamais la seule couleur). */
function MarquesGroupe({ g }: { g: CorrectifDto }) {
  const rien = !g.exploitees && !g.exploitables && !g.finDeSupport;
  return (
    <Stack gap="2xs">
      {g.exploitees > 0 && (
        <Group gap="2xs" wrap="nowrap">
          <MarqueZeroDay />
          <Text size="xs">
            {g.exploitees} à exploitation avérée
            {g.exploiteesSansCorrectif > 0 ? `, dont ${g.exploiteesSansCorrectif} sans correctif connu` : ''}
          </Text>
        </Group>
      )}
      {g.exploitables > 0 && (
        <Group gap="2xs" wrap="nowrap">
          <MarqueExploitable />
          <Text size="xs">{g.exploitables} exploitable(s)</Text>
        </Group>
      )}
      {g.finDeSupport > 0 && (
        <Group gap="2xs" wrap="nowrap">
          <MentionFinSupport court />
          <Text size="xs">{g.finDeSupport}</Text>
        </Group>
      )}
      {rien && (
        <Text size="xs" c="dimmed">
          Aucune
        </Text>
      )}
    </Stack>
  );
}

/** Table des correctifs (sans état). */
export function CorrectifsTable({ groupes, onOuvrir }: { groupes: CorrectifDto[]; onOuvrir: (cle: string) => void }) {
  return (
    <DataTable label="Correctifs">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Correctif indiqué par Tenable</Table.Th>
            <Table.Th>Failles corrigées</Table.Th>
            <Table.Th>Machines</Table.Th>
            <Table.Th>Marques</Table.Th>
            <Table.Th>Délai le plus défavorable</Table.Th>
            <Table.Th>État du correctif</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {groupes.map((g) => (
            <Table.Tr key={g.cle}>
              <Table.Td>
                <StatusChip etat={ETAT_PRIORITE[g.priorite]}>{g.priorite}</StatusChip>
              </Table.Td>
              <Table.Td>
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => onOuvrir(g.cle)}
                  className="veille-texte"
                  lang={g.solution ? 'en' : 'fr'}
                >
                  {g.solution ?? SANS_CORRECTIF_LIBELLE}
                </Anchor>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {g.failles} faille{g.failles > 1 ? 's' : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {g.cves} CVE distincte{g.cves > 1 ? 's' : ''}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{libelleMachinesLues(g.machines)}</Text>
              </Table.Td>
              <Table.Td>
                <MarquesGroupe g={g} />
              </Table.Td>
              <Table.Td>
                <StatusChip etat={ETAT_DELAI_PUCE[g.delai.etat]}>{libelleEtatDelai(g.delai.etat)}</StatusChip>
                {g.delai.enDepassement > 0 && (
                  <Text size="xs" c="dimmed">
                    {g.delai.enDepassement} en dépassement
                  </Text>
                )}
                {g.delai.echeance && (
                  <Text size="xs" c="dimmed">
                    Échéance la plus proche : <span className="horodatage">{fmtDate(g.delai.echeance)}</span>
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="xs">{repartitionCorrectif(g.correctif)}</Text>
                <Text size="xs" c="dimmed">
                  {sourcesCorrectif(g.sourcesCorrectif)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
          {groupes.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text size="sm" c="dimmed">
                  Aucune faille détectée à traiter ne correspond.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Failles d'un groupe (sans état). */
export function FaillesCorrectifTable({
  failles,
  onOuvrir,
}: {
  failles: FailleCorrectifDto[];
  onOuvrir: (id: string) => void;
}) {
  return (
    <DataTable label="Failles corrigées par ce correctif">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priorité</Table.Th>
            <Table.Th>Contrôle de Tenable</Table.Th>
            <Table.Th>État du correctif</Table.Th>
            <Table.Th>Délai</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {failles.map((f) => {
            const source = sourceEtatCorrectif(f.correctif, fmtDate);
            return (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <StatusChip etat={ETAT_PRIORITE[f.priorite]}>{f.priorite}</StatusChip>
                </Table.Td>
                <Table.Td>
                  {f.lisible ? (
                    <Anchor component="button" type="button" onClick={() => onOuvrir(f.id)} lang="en">
                      {f.nom}
                    </Anchor>
                  ) : (
                    <Text size="sm" lang="en">
                      {f.nom}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    Contrôle n° {f.plugin} · {f.cves} CVE
                    {f.lisible ? '' : ' · aucune de ses machines n’est lue par vous'}
                  </Text>
                  <Group gap="2xs">
                    {f.exploitee && <StatusChip etat="erreur">Zero-day : exploitation avérée</StatusChip>}
                    {f.situation && (
                      <StatusChip etat={f.situation === 'sans_correctif' ? 'erreur' : 'neutre'}>
                        {SITUATION_EXPLOITATION_LIBELLES[f.situation]}
                      </StatusChip>
                    )}
                    {!f.exploitee && f.exploitable && <StatusChip etat="attention">Exploitable</StatusChip>}
                    {f.finDeSupport && <MentionFinSupport court />}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <StatusChip etat={ETAT_CORRECTIF_PUCE[f.correctif.etat]}>
                    {ETAT_CORRECTIF_LIBELLES[f.correctif.etat]}
                  </StatusChip>
                  {source && (
                    <Text size="xs" c="dimmed">
                      {source}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <DelaiFaille d={f.delai} />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Machines lues d'un groupe (sans état). */
export function MachinesCorrectifTable({
  machines,
  onOuvrir,
}: {
  machines: CorrectifDetailDto['machines'];
  onOuvrir: (id: string) => void;
}) {
  return (
    <DataTable label="Machines concernées que vous lisez">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Machine</Table.Th>
            <Table.Th>Rôle</Table.Th>
            <Table.Th>Périmètre</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {machines.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>
                <Anchor component="button" type="button" onClick={() => onOuvrir(m.id)} className="veille-texte">
                  {libelleMachine(m)}
                </Anchor>
                {m.finDeSupport && (
                  <div>
                    <MentionFinSupport court />
                  </div>
                )}
              </Table.Td>
              <Table.Td>{libelleRole(m.role)}</Table.Td>
              <Table.Td>{m.perimetreNom ?? 'Sans périmètre'}</Table.Td>
            </Table.Tr>
          ))}
          {machines.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text size="sm" c="dimmed">
                  Aucune machine que vous lisez.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** En-tête de la vue (sans état). */
export function EnteteCorrectifs({ d }: { d: CorrectifsDto }) {
  return (
    <Stack gap="2xs">
      <Title order={2} size="h3">
        {enteteCorrectifs(d.misesAJour, d.failles)}
      </Title>
      <Text size="sm">
        {d.sansCorrectif > 0
          ? `Et ${d.sansCorrectif} faille${d.sansCorrectif > 1 ? 's' : ''} sans correctif indiqué par la source.`
          : 'Toutes les failles détectées à traiter ont un correctif indiqué par Tenable.'}
      </Text>
      <Text size="xs" c="dimmed">
        {EXPLICATION_CORRECTIFS}
      </Text>
      <Text size="xs" c="dimmed">
        {HORS_VUE_CORRECTIFS}
      </Text>
      <Text size="xs" c="dimmed">
        {FIN_SUPPORT_DEFINITION}
      </Text>
    </Stack>
  );
}

/** Vue « Correctifs » : lecture, filtres, fenêtre d'un groupe. `onOuvrirConstat` ouvre la fiche existante d'une faille. */
export function CorrectifsVue({ onOuvrirConstat }: { onOuvrirConstat: (id: string) => void }) {
  const [saisie, setSaisie] = useState('');
  const [filtres, setFiltres] = useState<{ q: string; priorite: NiveauPriorite | '' }>({ q: '', priorite: '' });
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [machine, setMachine] = useState<string | null>(null);
  const modifier = useCan()('vulnerabilites', 'modifier');
  const liste = useQuery({
    queryKey: [...CLE_CORRECTIFS, filtres],
    queryFn: () => get<CorrectifsDto>(urlCorrectifs(filtres)),
  });
  const detail = useQuery({
    queryKey: [...CLE_CORRECTIFS, 'detail', ouvert],
    queryFn: () => get<CorrectifDetailDto>(urlCorrectif(ouvert!)),
    enabled: !!ouvert,
  });
  const ficheMachine = useQuery({
    queryKey: ['vulnerabilites', 'machines', 'fiche', machine],
    queryFn: () => get<MachineDto>(`/api/vulnerabilites/machines/${machine}`),
    enabled: !!machine,
  });
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    setFiltres({ ...filtres, q: saisie.trim() });
  };
  const g = detail.data?.groupe;
  return (
    <Stack>
      <ErrorAlert error={liste.error} />
      {liste.data && <EnteteCorrectifs d={liste.data} />}
      <form onSubmit={chercher} role="search">
        <Group align="flex-end">
          <TextInput
            label="Rechercher un correctif"
            description="Mot du texte de la solution (en anglais)."
            maxLength={100}
            value={saisie}
            onChange={(e) => setSaisie(e.currentTarget.value)}
          />
          <Button type="submit" variant="default">
            Rechercher
          </Button>
          <Select
            label="Priorité du correctif"
            placeholder="Toutes"
            clearable
            value={filtres.priorite || null}
            onChange={(v) => setFiltres({ ...filtres, priorite: (v ?? '') as NiveauPriorite | '' })}
            data={NIVEAUX_PRIORITE.map((p) => ({ value: p, label: p }))}
            comboboxProps={{ withinPortal: false }}
          />
        </Group>
      </form>
      {liste.data && <CorrectifsTable groupes={liste.data.groupes} onOuvrir={setOuvert} />}
      {liste.data?.tronquee && (
        <Alert color="gray" role="status">
          {liste.data.groupes.length} correctifs listés sur {liste.data.total} : affinez la recherche.
        </Alert>
      )}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouvert}
        onClose={() => setOuvert(null)}
        title={g ? (g.solution ? 'Correctif indiqué par Tenable' : SANS_CORRECTIF_LIBELLE) : 'Correctif'}
        size="xl"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={detail.error} />
        {g && detail.data && (
          <Stack>
            {g.solution && (
              <Text size="sm" lang="en" className="veille-texte">
                {g.solution}
              </Text>
            )}
            <Text size="sm">
              {g.failles} faille{g.failles > 1 ? 's' : ''} corrigée{g.failles > 1 ? 's' : ''} · {g.cves} CVE · priorité
              la plus haute {g.priorite} · {libelleMachinesLues(g.machines)}.
            </Text>
            <Title order={3} size="h6">
              Failles ({g.failles})
            </Title>
            <FaillesCorrectifTable failles={detail.data.failles} onOuvrir={onOuvrirConstat} />
            {detail.data.faillesTronquees && (
              <Text size="xs" c="dimmed">
                Seules les premières failles sont listées.
              </Text>
            )}
            <Title order={3} size="h6">
              Machines concernées que vous lisez ({g.machines.lisibles})
            </Title>
            {g.machines.horsLecture && (
              <Text size="xs" c="dimmed">
                Ce correctif concerne aussi des machines que vous ne pouvez pas lire : elles ne sont ni nommées ni
                comptées.
              </Text>
            )}
            <MachinesCorrectifTable machines={detail.data.machines} onOuvrir={setMachine} />
            {detail.data.machinesTronquees && (
              <Text size="xs" c="dimmed">
                Seules les premières machines sont listées.
              </Text>
            )}
          </Stack>
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!machine}
        onClose={() => setMachine(null)}
        title={ficheMachine.data ? libelleMachine(ficheMachine.data) : 'Machine'}
        size="lg"
        centered
        lockScroll={false}
      >
        <ErrorAlert error={ficheMachine.error} />
        {ficheMachine.data && <FicheMachine machine={ficheMachine.data} modifier={modifier} />}
      </Modal>
    </Stack>
  );
}
