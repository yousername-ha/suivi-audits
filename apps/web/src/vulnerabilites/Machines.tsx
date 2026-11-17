/* Module Vulnérabilités (ADR 0100, lot V5) : écran « Machines ». Machines lues dans Tenable Security Center, visibles à
   travers les droits du périmètre de chacune (une machine sans périmètre n'est visible qu'avec le droit d'administrer le
   module). Recherche par nom, filtres par rôle et par périmètre, constats présents par gravité, bandeau des machines sans
   rôle ; rôle et périmètre indiqués une machine à la fois ou en masse (sélection multiple), avec le droit de modifier le
   module et l'écriture sur le périmètre visé : le serveur en est seul juge, les boutons ne font que suivre la session.
   Lot V4a : machines rangées de la plus critique à la moins critique (rang calculé par la plateforme, faits affichés),
   fiche d'une machine avec ses produits surveillés reliés à la main (relier, délier : droit de modifier le module).
   Composants de la charte, CSP stricte (ADR 0006). */
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
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
  type MachineDto,
  type PageMachines,
  type PerimetreAffectableDto,
  type ProduitRelieDto,
  type ProduitSurveilleDto,
  ROLES_MACHINE,
  ROLE_MACHINE_LIBELLES,
  type RoleMachine,
} from '@suivi/shared';
import { DataTable, ErrorAlert, Page, PageHeader, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, errorMessage, get } from '../api';
import { useCan } from '../session';
import {
  corpsAffectation,
  faitsDuRang,
  FILTRES_MACHINES_VIDES,
  type FiltresMachines,
  libelleMachine,
  libelleRole,
  urlMachines,
} from './failles';
import { nombrePages } from './veille';

const CLE = ['vulnerabilites', 'machines'] as const;
const OPTIONS_ROLE = [
  ...ROLES_MACHINE.map((r) => ({ value: r, label: ROLE_MACHINE_LIBELLES[r] })),
  { value: 'aucun', label: 'Rôle non renseigné' },
];

/** Machines (sans état), dans l'ordre du rang ; avec `selection`, une case par machine pour l'affectation en masse ; avec
    `onOuvrir`, le nom ouvre la fiche de la machine. */
export function MachinesTable({
  machines,
  selection,
  onSelection,
  onOuvrir,
}: {
  machines: MachineDto[];
  selection?: ReadonlySet<string>;
  onSelection?: (id: string, choisie: boolean) => void;
  onOuvrir?: (m: MachineDto) => void;
}) {
  const choix = !!selection && !!onSelection;
  return (
    <DataTable label="Machines">
      <Table>
        <Table.Thead>
          <Table.Tr>
            {choix && <Table.Th>Choisir</Table.Th>}
            <Table.Th>Rang</Table.Th>
            <Table.Th>Machine</Table.Th>
            <Table.Th>Rôle</Table.Th>
            <Table.Th>Périmètre</Table.Th>
            <Table.Th>Failles présentes (critiques, élevées, moyennes, faibles)</Table.Th>
            <Table.Th>Exploitées, exploitables, déclarées</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {machines.map((m) => (
            <Table.Tr key={m.id}>
              {choix && (
                <Table.Td>
                  <Checkbox
                    aria-label={`Choisir ${libelleMachine(m)}`}
                    checked={selection.has(m.id)}
                    onChange={(e) => onSelection(m.id, e.currentTarget.checked)}
                  />
                </Table.Td>
              )}
              <Table.Td>
                <Text size="sm" fw={600}>
                  {m.rang.position} / {m.rang.total}
                </Text>
                <Text size="xs" c="dimmed">
                  {faitsDuRang(m.rang).join(' · ')}
                </Text>
              </Table.Td>
              <Table.Td>
                {onOuvrir ? (
                  <Anchor component="button" type="button" onClick={() => onOuvrir(m)} className="veille-texte">
                    {libelleMachine(m)}
                  </Anchor>
                ) : (
                  <Text size="sm" className="veille-texte">
                    {libelleMachine(m)}
                  </Text>
                )}
                {m.nom && m.adresse && (
                  <Text size="xs" c="dimmed" className="veille-code">
                    {m.adresse}
                  </Text>
                )}
                {m.systeme && (
                  <Text size="xs" c="dimmed" className="veille-texte" lang="en">
                    {m.systeme}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {m.role ? libelleRole(m.role) : <StatusChip etat="attention">{libelleRole(null)}</StatusChip>}
              </Table.Td>
              <Table.Td>{m.perimetreNom ?? 'Sans périmètre'}</Table.Td>
              <Table.Td>
                {m.compteurs.critique} · {m.compteurs.elevee} · {m.compteurs.moyenne} · {m.compteurs.faible}
              </Table.Td>
              <Table.Td>
                {m.compteurs.exploites} · {m.compteurs.exploitables} · {m.compteurs.declarees}
              </Table.Td>
            </Table.Tr>
          ))}
          {machines.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={choix ? 7 : 6}>
                <Text size="sm" c="dimmed">
                  Aucune machine ne correspond, parmi celles que vous pouvez lire.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Bandeau des machines sans rôle (sans état). */
export function BandeauSansRole({ n }: { n: number }) {
  if (!n) return null;
  return (
    <Alert color="orange" role="status" title="Machines sans rôle">
      {n} machine{n > 1 ? 's' : ''} lisible{n > 1 ? 's' : ''} sans rôle (front, back applicatif ou base de données) :
      indiquez-le pour préparer le classement par ligne.
    </Alert>
  );
}

/** Produits surveillés reliés à une machine (sans état). */
export function ProduitsRelies({
  produits,
  peutModifier,
  onDelier,
}: {
  produits: ProduitRelieDto[];
  peutModifier: boolean;
  onDelier: (p: ProduitRelieDto) => void;
}) {
  if (!produits.length)
    return (
      <Text size="sm" c="dimmed">
        Aucun produit surveillé relié à cette machine.
      </Text>
    );
  return (
    <DataTable label="Produits surveillés reliés">
      <Table>
        <Table.Tbody>
          {produits.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Text size="sm">
                  {p.nom} {p.versionProduit}
                </Text>
                <Text size="xs" c="dimmed">
                  {p.editeur}
                </Text>
              </Table.Td>
              <Table.Td>
                {p.cvesRattachees} CVE rattachée{p.cvesRattachees > 1 ? 's' : ''}
              </Table.Td>
              {peutModifier && (
                <Table.Td>
                  <Button
                    size="compact-sm"
                    variant="light"
                    color="red"
                    onClick={() => onDelier(p)}
                    aria-label={`Délier ${p.nom}`}
                  >
                    Délier
                  </Button>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </DataTable>
  );
}

/** Fiche d'une machine : rang et faits, produits surveillés reliés, relier un produit (droit de modifier le module). */
function FicheMachine({ machine, modifier }: { machine: MachineDto; modifier: boolean }) {
  const qc = useQueryClient();
  const [choix, setChoix] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const relies = useQuery({
    queryKey: [...CLE, 'produits', machine.id],
    queryFn: () => get<ProduitRelieDto[]>(`/api/vulnerabilites/machines/${machine.id}/produits`),
  });
  const produits = useQuery({
    queryKey: ['vulnerabilites', 'produits', 'toutes'],
    queryFn: () => get<ProduitSurveilleDto[]>('/api/vulnerabilites/produits'),
    enabled: modifier,
  });
  const dejaRelies = new Set((relies.data ?? []).map((p) => p.id));
  const action = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      await fn();
      notifications.show({ color: 'teal', message });
      setChoix(null);
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };
  const relier = () => {
    const p = (produits.data ?? []).find((x) => x.id === choix);
    if (!p) return;
    void action(
      () =>
        api('POST', `/api/vulnerabilites/produits/${p.id}/machines`, {
          body: { machineId: machine.id },
          ifMatch: p.version,
        }),
      'Produit relié à la machine.',
    );
  };
  return (
    <Stack>
      <Stack gap="2xs">
        <Title order={3} size="h6">
          Rang {machine.rang.position} sur {machine.rang.total}
        </Title>
        <Text size="sm">{faitsDuRang(machine.rang).join(' · ')}</Text>
      </Stack>
      <Title order={3} size="h6">
        Produits surveillés reliés
      </Title>
      <ErrorAlert error={relies.error ?? produits.error} />
      {relies.data && (
        <ProduitsRelies
          produits={relies.data}
          peutModifier={modifier}
          onDelier={(p) =>
            void action(
              () =>
                api('DELETE', `/api/vulnerabilites/produits/${p.id}/machines/${machine.id}`, { ifMatch: p.version }),
              'Produit délié de la machine.',
            )
          }
        />
      )}
      {modifier && (
        <Group align="flex-end">
          <Select
            label="Produit surveillé à relier"
            placeholder="Choisir un produit"
            searchable
            clearable
            value={choix}
            onChange={setChoix}
            data={(produits.data ?? [])
              .filter((p) => !dejaRelies.has(p.id))
              .map((p) => ({ value: p.id, label: `${p.nom} ${p.versionProduit} (${p.editeur})` }))}
            nothingFoundMessage="Aucun produit"
            comboboxProps={{ withinPortal: false }}
          />
          <Button loading={envoi} disabled={!choix} onClick={relier}>
            Relier
          </Button>
        </Group>
      )}
    </Stack>
  );
}

export function MachinesPage() {
  const can = useCan();
  const qc = useQueryClient();
  const lire = can('vulnerabilites', 'lire');
  const modifier = can('vulnerabilites', 'modifier');
  const administrer = can('vulnerabilites', 'administrer');
  const [saisie, setSaisie] = useState('');
  const [filtres, setFiltres] = useState<FiltresMachines>(FILTRES_MACHINES_VIDES);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<RoleMachine | 'aucun' | ''>('');
  const [perimetre, setPerimetre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [ouverte, setOuverte] = useState<MachineDto | null>(null);
  const machines = useQuery({
    queryKey: [...CLE, filtres, page],
    queryFn: () => get<PageMachines>(urlMachines(filtres, page)),
    enabled: lire,
  });
  const perimetres = useQuery({
    queryKey: [...CLE, 'perimetres'],
    queryFn: () => get<PerimetreAffectableDto[]>('/api/vulnerabilites/perimetres'),
    enabled: modifier,
  });
  const changer = (f: Partial<FiltresMachines>) => {
    setFiltres({ ...filtres, ...f });
    setPage(1);
    setSelection(new Set());
  };
  const chercher = (e: FormEvent) => {
    e.preventDefault();
    changer({ q: saisie.trim() });
  };
  const choisies = (machines.data?.elements ?? []).filter((m) => selection.has(m.id));
  const affecter = async () => {
    setEnvoi(true);
    try {
      const r = await api<{ machines: number }>('POST', '/api/vulnerabilites/machines/affectation', {
        body: corpsAffectation(choisies, role, perimetre),
      });
      notifications.show({
        color: 'teal',
        message: `${r.machines} machine${r.machines > 1 ? 's' : ''} mise${r.machines > 1 ? 's' : ''} à jour.`,
      });
      setSelection(new Set());
      setRole('');
      setPerimetre('');
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };

  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  const optionsPerimetre = [
    ...(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.nom })),
    ...(administrer ? [{ value: 'aucun', label: 'Retirer le périmètre' }] : []),
  ];
  const pages = machines.data ? nombrePages(machines.data.total, machines.data.parPage) : 1;
  return (
    <Page>
      <PageHeader
        title="Machines"
        description="Machines lues dans Tenable Security Center, de la plus critique à la moins critique : exploitation avérée d’abord, puis rôle (front, back applicatif, base de données), puis nombre de failles critiques et élevées. Vous voyez celles des périmètres que vous pouvez lire ; une machine sans périmètre n’est visible qu’avec le droit d’administrer le module. Le rôle et le périmètre sont indiqués ici, une machine à la fois ou en masse ; la fiche d’une machine relie ses produits surveillés."
      />
      <Stack>
        {machines.data && <BandeauSansRole n={machines.data.sansRole} />}
        <form onSubmit={chercher} role="search">
          <Group align="flex-end">
            <TextInput
              label="Rechercher"
              description="Nom de la machine."
              maxLength={100}
              value={saisie}
              onChange={(e) => setSaisie(e.currentTarget.value)}
            />
            <Button type="submit" variant="default">
              Rechercher
            </Button>
            <Select
              label="Rôle"
              placeholder="Tous"
              clearable
              value={filtres.role || null}
              onChange={(v) => changer({ role: (v ?? '') as FiltresMachines['role'] })}
              data={OPTIONS_ROLE}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label="Périmètre"
              placeholder="Tous"
              clearable
              value={filtres.perimetre || null}
              onChange={(v) => changer({ perimetre: v ?? '' })}
              data={[
                ...(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.nom })),
                { value: 'aucun', label: 'Sans périmètre' },
              ]}
              comboboxProps={{ withinPortal: false }}
            />
          </Group>
        </form>
        {modifier && (
          <Group align="flex-end" role="group" aria-label="Affectation des machines choisies">
            <Select
              label="Rôle à indiquer"
              placeholder="Inchangé"
              clearable
              value={role || null}
              onChange={(v) => setRole((v ?? '') as RoleMachine | 'aucun' | '')}
              data={OPTIONS_ROLE}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label="Périmètre à indiquer"
              placeholder="Inchangé"
              clearable
              value={perimetre || null}
              onChange={(v) => setPerimetre(v ?? '')}
              data={optionsPerimetre}
              comboboxProps={{ withinPortal: false }}
            />
            <Button
              loading={envoi}
              disabled={!choisies.length || (!role && !perimetre)}
              onClick={() => void affecter()}
            >
              Appliquer à {choisies.length} machine{choisies.length > 1 ? 's' : ''}
            </Button>
          </Group>
        )}
        <ErrorAlert error={machines.error ?? perimetres.error} />
        {machines.data && (
          <MachinesTable
            machines={machines.data.elements}
            selection={modifier ? selection : undefined}
            onSelection={
              modifier
                ? (id, choisie) => {
                    const s = new Set(selection);
                    if (choisie) s.add(id);
                    else s.delete(id);
                    setSelection(s);
                  }
                : undefined
            }
            onOuvrir={setOuverte}
          />
        )}
        {machines.data && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed" role="status">
              {machines.data.total} machine{machines.data.total > 1 ? 's' : ''}
            </Text>
            {pages > 1 && <Pagination total={pages} value={page} onChange={setPage} aria-label="Pages des machines" />}
          </Group>
        )}
      </Stack>
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouverte}
        onClose={() => setOuverte(null)}
        title={ouverte ? libelleMachine(ouverte) : 'Machine'}
        size="lg"
        centered
        lockScroll={false}
      >
        {ouverte && <FicheMachine machine={ouverte} modifier={modifier} />}
      </Modal>
    </Page>
  );
}
