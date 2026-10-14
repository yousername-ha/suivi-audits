/* Fournisseurs de l'organisation (ADR 0032, lot M4) : le registre est celui de l'outil historique, l'évaluation est
   indépendante des périmètres, le rattachement à un périmètre ne porte aucune donnée d'évaluation. */
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { FREQUENCES_CONTROLE, TYPES_CERTIFICAT, partSaas, type EtatSuivi, type ResumeControles } from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { api, get, post } from '../api';
import { ErrorAlert } from '../components/common';
import { Filtres } from '../components/Filtres';
import { useCan } from '../session';

export interface EvaluationCourante {
  id: string;
  evaluatedAt: string;
  evaluator: string;
  nextReviewAt: string | null;
  items: number;
  meets: number;
  notMeets: number;
  notAssessed: number;
}
export interface CertificatFournisseur {
  type: string;
  validUntil?: string;
  received?: string;
  scope?: string;
  location?: string;
}
export interface ControleFournisseur {
  id?: string;
  t: string;
  ref?: string;
  freq?: number;
  last?: string;
  result?: string;
  comment?: string;
}
export interface Fournisseur {
  id: string;
  name: string;
  saas: boolean;
  rattachement: string;
  contact: string;
  notes: string;
  sso: string;
  mfa: string;
  critical: string;
  hds: string;
  certs: CertificatFournisseur[];
  controls: ControleFournisseur[];
  certificateState: EtatSuivi;
  controlSummary: ResumeControles;
  current: EvaluationCourante | null;
  toReview: boolean;
  scopes: string[];
}
export interface Critere {
  id: string;
  label: string;
  description: string;
  purposes: string[];
  requirementRefs: string[];
  version: number;
  archived: boolean;
}
interface Perimetre {
  id: string;
  name: string;
}
interface Historique {
  id: string;
  evaluatedAt: string;
  evaluator: string;
  conclusion: string;
  nextReviewAt: string | null;
  items: {
    criterionId: string;
    criterionLabel: string;
    criterionVersion: number;
    meets: boolean | null;
    result: string;
  }[];
}

export const REPONSE: Record<string, string> = { oui: 'Répond', non: 'Ne répond pas', nonevalue: 'Non évalué' };
const versOption = (m: boolean | null) => (m === true ? 'oui' : m === false ? 'non' : 'nonevalue');
const depuisOption = (v: string | null) => (v === 'oui' ? true : v === 'non' ? false : null);
const jour = (d: Date) => d.toISOString().slice(0, 10);
const NIVEAU: Record<string, Etat> = { ok: 'succes', mid: 'attention', bad: 'erreur', '': 'neutre' };
const jourFr = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');
const FILTRES = [
  { value: 'all', label: 'Tous' },
  { value: 'nomfa', label: 'Sans MFA' },
  { value: 'ctl', label: 'Contrôles à faire' },
  { value: 'cert', label: 'Certificats à traiter' },
  { value: 'crit', label: 'Critiques' },
];
const OPTIONS_SSO_MFA = ['', 'Oui', 'En cours', 'Non', 'N/A'].map((v) => ({ value: v, label: v || '–' }));
const OPTIONS_OUI_NON = ['', 'Oui', 'Non', 'N/A'].map((v) => ({ value: v, label: v || '–' }));
const classeOuiNon = (v: string): Etat =>
  v === 'Oui' ? 'succes' : v === 'Non' ? 'erreur' : v === 'En cours' ? 'attention' : 'neutre';

/** Liste « Fournisseurs et applications » : colonnes et filtres de l'outil de suivi (type, SSO, MFA, criticité, hébergeur
    HDS, certificats, contrôles, prochain contrôle), plus l'évaluation propre à l'organisation. */
export function Fournisseurs() {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('fournisseurs', 'modifier'),
    [nom, setNom] = useState<string | null>(null),
    [evaluer, setEvaluer] = useState<Fournisseur | null>(null),
    [historique, setHistorique] = useState<Fournisseur | null>(null),
    [perimetres, setPerimetres] = useState<Fournisseur | null>(null),
    [fiche, setFiche] = useState<Fournisseur | null>(null),
    [filtre, setFiltre] = useState('all'),
    [type, setType] = useState('all'),
    [recherche, setRecherche] = useState(''),
    [erreur, setErreur] = useState<unknown>(null);
  const liste = useQuery({ queryKey: ['suppliers'], queryFn: () => get<Fournisseur[]>('/api/suppliers') });
  const creer = async () => {
    if (nom === null) return;
    try {
      setErreur(null);
      await api('POST', '/api/suppliers', { body: { name: nom.trim() } });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
      setNom(null);
    } catch (e) {
      setErreur(e);
    }
  };
  const modifierChamp = async (f: Fournisseur, champ: 'sso' | 'mfa' | 'critical' | 'hds', valeur: string | null) => {
    try {
      setErreur(null);
      await api('PATCH', `/api/suppliers/${encodeURIComponent(f.id)}`, { body: { [champ]: valeur ?? '' } });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['synthese'] });
    } catch (e) {
      setErreur(e);
    }
  };
  const tous = liste.data ?? [];
  const affiches = tous.filter(
    (f) =>
      (filtre === 'all' ||
        (filtre === 'nomfa' && f.mfa !== 'Oui') ||
        (filtre === 'ctl' &&
          f.controlSummary.enRetard + f.controlSummary.aRealiser + f.controlSummary.nonConformes > 0) ||
        (filtre === 'cert' && ['bad', 'mid'].includes(f.certificateState[1])) ||
        (filtre === 'crit' && f.critical === 'Oui')) &&
      (type === 'all' || (type === 'saas' ? f.saas : !f.saas)) &&
      (!recherche.trim() || f.name.toLowerCase().includes(recherche.trim().toLowerCase())),
  );
  const mfa = partSaas(tous, 'mfa'),
    sso = partSaas(tous, 'sso');
  const actifs = (filtre !== 'all' ? 1 : 0) + (type !== 'all' ? 1 : 0);
  const cellule = (f: Fournisseur, champ: 'sso' | 'mfa' | 'critical' | 'hds') =>
    modifier ? (
      <Select
        size="xs"
        className="select-compact"
        aria-label={`${{ sso: 'SSO', mfa: 'MFA', critical: 'Critique', hds: 'Hébergeur HDS' }[champ]} de ${f.name}`}
        allowDeselect={false}
        data={champ === 'sso' || champ === 'mfa' ? OPTIONS_SSO_MFA : OPTIONS_OUI_NON}
        value={f[champ]}
        onChange={(v) => void modifierChamp(f, champ, v)}
      />
    ) : f[champ] ? (
      <StatusChip etat={classeOuiNon(f[champ])}>{f[champ]}</StatusChip>
    ) : (
      '–'
    );
  return (
    <Stack>
      <Alert>
        Les fournisseurs et leurs évaluations appartiennent à l’organisation, pas à un périmètre : un fournisseur évalué
        l’est de la même façon dans tous les périmètres où il est rattaché. Les critères sont définis par vos soins ;
        aucune grille ni aucun seuil n’est fourni. La fiche d’un fournisseur regroupe ses informations de suivi (MFA,
        SSO, criticité, hébergeur HDS), ses certificats et ses contrôles périodiques.
      </Alert>
      <ErrorAlert error={erreur ?? liste.error} />
      <Group gap="lg" aria-label="Indicateurs des services SaaS">
        <div>
          <Text fw={700} size="xl">
            {mfa.pct} %
          </Text>
          <Text size="sm">
            SaaS avec MFA ({mfa.oui}/{mfa.saas})
          </Text>
        </div>
        <div>
          <Text fw={700} size="xl">
            {sso.pct} %
          </Text>
          <Text size="sm">
            SaaS avec SSO ({sso.oui}/{sso.saas})
          </Text>
        </div>
        <div>
          <Text fw={700} size="xl">
            {tous.filter((f) => f.mfa !== 'Oui').length}
          </Text>
          <Text size="sm">sans MFA confirmée</Text>
        </div>
      </Group>
      <Group justify="space-between">
        <Group>
          <TextInput
            aria-label="Rechercher un fournisseur"
            placeholder="Rechercher un fournisseur"
            value={recherche}
            onChange={(e) => setRecherche(e.currentTarget.value)}
          />
          <Filtres
            actifs={actifs}
            onReinitialiser={() => {
              setFiltre('all');
              setType('all');
            }}
          >
            <Select
              label="Situation"
              allowDeselect={false}
              data={FILTRES}
              value={filtre}
              onChange={(v) => setFiltre(v ?? 'all')}
            />
            <Select
              label="Type"
              allowDeselect={false}
              data={[
                { value: 'all', label: 'Tous les types' },
                { value: 'saas', label: 'Services SaaS' },
                { value: 'autre', label: 'Hors SaaS' },
              ]}
              value={type}
              onChange={(v) => setType(v ?? 'all')}
            />
          </Filtres>
          <Text size="sm">
            {liste.data
              ? `${affiches.length} fournisseur${affiches.length > 1 ? 's' : ''}`
              : 'Chargement des fournisseurs…'}
          </Text>
        </Group>
        {modifier && <Button onClick={() => setNom('')}>Ajouter un fournisseur</Button>}
      </Group>
      <DataTable label="Fournisseurs et applications, défilement horizontal possible">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fournisseur ou application</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>SSO</Table.Th>
              <Table.Th>MFA</Table.Th>
              <Table.Th>Critique</Table.Th>
              <Table.Th>Hébergeur HDS</Table.Th>
              <Table.Th>Certificats</Table.Th>
              <Table.Th>Contrôles</Table.Th>
              <Table.Th>Prochain</Table.Th>
              <Table.Th>Évaluation courante</Table.Th>
              <Table.Th>Périmètres</Table.Th>
              <Table.Th className="col-actions">Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {affiches.map((f) => {
              const c = f.controlSummary;
              return (
                <Table.Tr key={f.id}>
                  <Table.Td>
                    <Text fw={600}>{f.name}</Text>
                    <Text size="xs" c="dimmed">
                      {[f.rattachement, f.notes && f.notes.slice(0, 70) + (f.notes.length > 70 ? '…' : '')]
                        .filter(Boolean)
                        .join(' — ') || f.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>{f.saas ? 'SaaS' : ''}</Table.Td>
                  <Table.Td>{cellule(f, 'sso')}</Table.Td>
                  <Table.Td>{cellule(f, 'mfa')}</Table.Td>
                  <Table.Td>{cellule(f, 'critical')}</Table.Td>
                  <Table.Td>{cellule(f, 'hds')}</Table.Td>
                  <Table.Td>
                    {f.certificateState[0] ? (
                      <StatusChip etat={NIVEAU[f.certificateState[1]] ?? 'neutre'}>{f.certificateState[0]}</StatusChip>
                    ) : (
                      '–'
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="2xs">
                      {c.enRetard > 0 && <StatusChip etat="erreur">{c.enRetard} en retard</StatusChip>}
                      {c.nonConformes > 0 && <StatusChip etat="erreur">{c.nonConformes} non conforme</StatusChip>}
                      {c.aRealiser > 0 && <StatusChip etat="attention">{c.aRealiser} à réaliser</StatusChip>}
                      {!c.enRetard && !c.aRealiser && !c.nonConformes && c.total > 0 && (
                        <StatusChip etat="succes">À jour</StatusChip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>{jourFr(c.prochain)}</Table.Td>
                  <Table.Td>
                    {f.current ? (
                      <>
                        <Text>
                          Le {f.current.evaluatedAt} · {f.current.evaluator}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {f.current.meets} répond · {f.current.notMeets} ne répond pas · {f.current.notAssessed} non
                          évalué
                        </Text>
                        {f.current.nextReviewAt && (
                          <Text size="xs">
                            Réévaluation {f.current.nextReviewAt}
                            {f.toReview && <StatusChip etat="erreur">À réévaluer</StatusChip>}
                          </Text>
                        )}
                      </>
                    ) : (
                      <StatusChip etat="neutre">Non évalué</StatusChip>
                    )}
                  </Table.Td>
                  <Table.Td>{f.scopes.length ? `${f.scopes.length} rattaché(s)` : 'Aucun'}</Table.Td>
                  <Table.Td className="col-actions">
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Fiche du fournisseur ${f.name}`}
                        onClick={() => setFiche(f)}
                      >
                        Fiche
                      </Button>
                      {modifier && (
                        <Button size="xs" aria-label={`Évaluer le fournisseur ${f.name}`} onClick={() => setEvaluer(f)}>
                          Évaluer
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Historique des évaluations de ${f.name}`}
                        onClick={() => setHistorique(f)}
                      >
                        Historique
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Périmètres de rattachement de ${f.name}`}
                        onClick={() => setPerimetres(f)}
                      >
                        Périmètres
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </DataTable>
      {liste.data && !liste.data.length && <Text>Aucun fournisseur dans le registre.</Text>}
      {liste.data && !!liste.data.length && !affiches.length && (
        <Text>Aucun fournisseur ne correspond aux filtres.</Text>
      )}
      <Modal opened={nom !== null} onClose={() => setNom(null)} title="Ajouter un fournisseur">
        <Stack>
          <ErrorAlert error={erreur} />
          <TextInput label="Nom" required value={nom ?? ''} onChange={(e) => setNom(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNom(null)}>
              Annuler
            </Button>
            <Button disabled={(nom ?? '').trim().length < 2} onClick={creer}>
              Ajouter
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={!!fiche} onClose={() => setFiche(null)} size="xl" title={fiche ? `Fiche de ${fiche.name}` : ''}>
        {fiche && <FicheFournisseur fournisseur={fiche} modifiable={modifier} onDone={() => setFiche(null)} />}
      </Modal>
      <Modal
        opened={!!evaluer}
        onClose={() => setEvaluer(null)}
        size="xl"
        title={evaluer ? `Évaluer ${evaluer.name}` : ''}
      >
        {evaluer && <EvaluationForm fournisseur={evaluer} onDone={() => setEvaluer(null)} />}
      </Modal>
      <Modal
        opened={!!historique}
        onClose={() => setHistorique(null)}
        size="xl"
        title={historique ? `Évaluations de ${historique.name}` : ''}
      >
        {historique && <HistoriqueEvaluations fournisseur={historique} />}
      </Modal>
      <Modal
        opened={!!perimetres}
        onClose={() => setPerimetres(null)}
        title={perimetres ? `Périmètres de ${perimetres.name}` : ''}
      >
        {perimetres && <RattachementPerimetres fournisseurId={perimetres.id} />}
      </Modal>
    </Stack>
  );
}

/** Contrôles types proposés à un fournisseur (références propres à l'outil de suivi historique, modifiables). */
function controlesTypes(hds: boolean): ControleFournisseur[] {
  const base: [string, string][] = [
    ['Vérifier l’activation de l’authentification multifacteur', 'A.8.5 ; INDOBJ3.2 ; ReCyF 8.3'],
    ['Vérifier l’intégration au SSO', 'INDOBJ3.3'],
    ['Revue des comptes et des droits d’accès', 'A.5.18 ; ReCyF 10.A.6 et 10.C.4 (au moins annuelle)'],
    ['Revue du service et de la sécurité du fournisseur', 'A.5.22 ; ReCyF 3.B.2'],
  ];
  if (hds) base.push(['Vérifier la validité du certificat HDS', 'HDS EXI 06 et 14']);
  return base.map(([t, ref]) => ({ t, ref, freq: 12, last: '', result: '', comment: '' }));
}

/** Fiche d'un fournisseur : identité, certificats et contrôles périodiques (mêmes informations que l'outil de suivi). */
function FicheFournisseur({
  fournisseur,
  modifiable,
  onDone,
}: {
  fournisseur: Fournisseur;
  modifiable: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient(),
    [nom, setNom] = useState(fournisseur.name),
    [saas, setSaas] = useState(fournisseur.saas),
    [rattachement, setRattachement] = useState(fournisseur.rattachement),
    [contact, setContact] = useState(fournisseur.contact),
    [notes, setNotes] = useState(fournisseur.notes),
    [certs, setCerts] = useState<CertificatFournisseur[]>(fournisseur.certs),
    [controles, setControles] = useState<ControleFournisseur[]>(fournisseur.controls),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const majCert = (i: number, p: Partial<CertificatFournisseur>) =>
    setCerts((l) => l.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const majCtl = (i: number, p: Partial<ControleFournisseur>) =>
    setControles((l) => l.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      await api('PATCH', `/api/suppliers/${encodeURIComponent(fournisseur.id)}`, {
        body: {
          name: nom,
          saas,
          rattachement,
          contact,
          notes,
          certs: certs.map((c) => ({
            type: c.type,
            validUntil: c.validUntil ?? '',
            received: c.received ?? '',
            scope: c.scope ?? '',
            location: c.location ?? '',
          })),
          controls: controles.map((c) => ({
            ...(c.id ? { id: c.id } : {}),
            t: c.t,
            ref: c.ref ?? '',
            freq: c.freq ?? 12,
            last: c.last ?? '',
            result: c.result ?? '',
            comment: c.comment ?? '',
          })),
        },
      });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
      onDone();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group grow align="flex-start">
        <TextInput label="Nom" disabled={!modifiable} value={nom} onChange={(e) => setNom(e.currentTarget.value)} />
        <Checkbox
          label="Service SaaS"
          disabled={!modifiable}
          checked={saas}
          onChange={(e) => setSaas(e.currentTarget.checked)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="Rattachement (annuaire)"
          disabled={!modifiable}
          value={rattachement}
          onChange={(e) => setRattachement(e.currentTarget.value)}
        />
        <TextInput
          label="Contact"
          disabled={!modifiable}
          value={contact}
          onChange={(e) => setContact(e.currentTarget.value)}
        />
      </Group>
      <Textarea
        label="Notes"
        autosize
        minRows={2}
        disabled={!modifiable}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      {fournisseur.mfa !== 'Oui' && (
        <Alert>
          {fournisseur.mfa === 'Non' ? 'MFA non activée.' : 'MFA non confirmée.'} Activer la MFA ou documenter une
          mesure de réduction du risque.
        </Alert>
      )}
      <Text fw={600}>Certificats</Text>
      {!certs.length && (
        <Text size="sm">
          {fournisseur.hds === 'Oui' || fournisseur.critical === 'Oui'
            ? 'Certificat attendu (fournisseur critique ou hébergeur HDS).'
            : 'Aucun certificat enregistré.'}
        </Text>
      )}
      {certs.map((c, i) => (
        <Group key={i} align="flex-end" wrap="wrap">
          <Select
            label="Certificat"
            allowDeselect={false}
            disabled={!modifiable}
            data={[...TYPES_CERTIFICAT]}
            value={(TYPES_CERTIFICAT as readonly string[]).includes(c.type) ? c.type : 'Autre'}
            onChange={(v) => majCert(i, { type: v ?? 'Autre' })}
          />
          <TextInput
            label="Valide jusqu’au"
            type="date"
            disabled={!modifiable}
            value={c.validUntil ?? ''}
            onChange={(e) => majCert(i, { validUntil: e.currentTarget.value })}
          />
          <TextInput
            label="Reçu le"
            type="date"
            disabled={!modifiable}
            value={c.received ?? ''}
            onChange={(e) => majCert(i, { received: e.currentTarget.value })}
          />
          <TextInput
            label="Périmètre couvert"
            disabled={!modifiable}
            value={c.scope ?? ''}
            onChange={(e) => majCert(i, { scope: e.currentTarget.value })}
          />
          <TextInput
            label="Emplacement du fichier"
            disabled={!modifiable}
            value={c.location ?? ''}
            onChange={(e) => majCert(i, { location: e.currentTarget.value })}
          />
          {modifiable && (
            <Button variant="subtle" onClick={() => setCerts((l) => l.filter((_, k) => k !== i))}>
              Retirer le certificat
            </Button>
          )}
        </Group>
      ))}
      {modifiable && (
        <Group>
          <Button variant="default" onClick={() => setCerts((l) => [...l, { type: 'ISO 27001' }])}>
            Ajouter un certificat
          </Button>
        </Group>
      )}
      <Text fw={600}>Contrôles à effectuer</Text>
      {!controles.length && <Text size="sm">Aucun contrôle.</Text>}
      {controles.map((c, i) => (
        <Group key={c.id ?? i} align="flex-end" wrap="wrap">
          <TextInput
            label="Contrôle"
            disabled={!modifiable}
            value={c.t}
            onChange={(e) => majCtl(i, { t: e.currentTarget.value })}
          />
          <TextInput
            label="Référence"
            disabled={!modifiable}
            value={c.ref ?? ''}
            onChange={(e) => majCtl(i, { ref: e.currentTarget.value })}
          />
          <Select
            label="Fréquence"
            allowDeselect={false}
            disabled={!modifiable}
            data={Object.entries(FREQUENCES_CONTROLE).map(([m, l]) => ({ value: m, label: l }))}
            value={String(c.freq ?? 12)}
            onChange={(v) => majCtl(i, { freq: Number(v ?? 12) })}
          />
          <TextInput
            label="Dernier contrôle"
            type="date"
            disabled={!modifiable}
            value={c.last ?? ''}
            onChange={(e) => majCtl(i, { last: e.currentTarget.value })}
          />
          <Select
            label="Résultat"
            allowDeselect={false}
            disabled={!modifiable}
            data={[
              { value: '', label: '–' },
              { value: 'Conforme', label: 'Conforme' },
              { value: 'Non conforme', label: 'Non conforme' },
            ]}
            value={c.result ?? ''}
            onChange={(v) => majCtl(i, { result: v ?? '' })}
          />
          <TextInput
            label="Commentaire"
            disabled={!modifiable}
            value={c.comment ?? ''}
            onChange={(e) => majCtl(i, { comment: e.currentTarget.value })}
          />
          {modifiable && (
            <Button variant="subtle" onClick={() => setControles((l) => l.filter((_, k) => k !== i))}>
              Retirer le contrôle
            </Button>
          )}
        </Group>
      ))}
      {modifiable && (
        <Group>
          <Button variant="default" onClick={() => setControles((l) => [...l, { t: 'Nouveau contrôle', freq: 12 }])}>
            Ajouter un contrôle
          </Button>
          <Button
            variant="default"
            onClick={() => setControles((l) => [...l, ...controlesTypes(fournisseur.hds === 'Oui')])}
          >
            Ajouter les contrôles types
          </Button>
        </Group>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Fermer
        </Button>
        {modifiable && (
          <Button loading={envoi} disabled={nom.trim().length < 2} onClick={enregistrer}>
            Enregistrer la fiche
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function EvaluationForm({ fournisseur, onDone }: { fournisseur: Fournisseur; onDone: () => void }) {
  const can = useCan(),
    qc = useQueryClient(),
    [date, setDate] = useState(jour(new Date())),
    [prochaine, setProchaine] = useState(''),
    [conclusion, setConclusion] = useState(''),
    [choix, setChoix] = useState<Record<string, { meets: string; result: string }>>({}),
    [erreur, setErreur] = useState<unknown>(null);
  const criteres = useQuery({
    queryKey: ['suppliers', 'criteria'],
    queryFn: () => get<Critere[]>('/api/suppliers/criteria'),
  });
  const retenus = Object.keys(choix);
  const enregistrer = async () => {
    try {
      setErreur(null);
      await api('POST', `/api/suppliers/${encodeURIComponent(fournisseur.id)}/evaluations`, {
        body: {
          evaluatedAt: date,
          conclusion,
          nextReviewAt: prochaine || null,
          items: retenus.map((id) => ({
            criterionId: id,
            meets: depuisOption(choix[id]!.meets),
            result: choix[id]!.result,
          })),
          confirm: 'ENREGISTRER',
        },
      });
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
      onDone();
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack>
      <Alert>
        Une évaluation enregistrée ne se modifie plus : pour la corriger, enregistrez-en une nouvelle (la plus récente
        devient l’évaluation courante). « Répond » est un oui, un non ou un non évalué : il n’y a ni note ni seuil.
      </Alert>
      <ErrorAlert error={erreur ?? criteres.error} />
      {criteres.data && !criteres.data.length && (
        <Text>
          Aucun critère n’est défini.{' '}
          {can('fournisseurs', 'administrer') ? (
            <Anchor component={Link} to="/pilotage/criteres-fournisseurs">
              Définir les critères d’évaluation
            </Anchor>
          ) : (
            'Une personne habilitée doit d’abord les définir (rubrique « Critères d’évaluation »).'
          )}
        </Text>
      )}
      <Group grow align="flex-start">
        <TextInput
          label="Date de l’évaluation"
          type="date"
          value={date}
          onChange={(e) => setDate(e.currentTarget.value)}
        />
        <TextInput
          label="Prochaine réévaluation (facultatif)"
          type="date"
          value={prochaine}
          onChange={(e) => setProchaine(e.currentTarget.value)}
        />
      </Group>
      {(criteres.data ?? []).map((k) => {
        const c = choix[k.id];
        return (
          <Stack key={k.id} gap="xs">
            <Checkbox
              label={k.label}
              description={k.description || undefined}
              checked={!!c}
              onChange={(e) =>
                setChoix((v) => {
                  const next = { ...v };
                  if (e.currentTarget.checked) next[k.id] = { meets: 'nonevalue', result: '' };
                  else delete next[k.id];
                  return next;
                })
              }
            />
            {c && (
              <Group grow align="flex-start">
                <Select
                  label={`Répond au critère « ${k.label} » ?`}
                  allowDeselect={false}
                  data={Object.entries(REPONSE).map(([value, label]) => ({ value, label }))}
                  value={c.meets}
                  onChange={(v) => setChoix((x) => ({ ...x, [k.id]: { ...c, meets: v ?? 'nonevalue' } }))}
                />
                <TextInput
                  label={`Résultat pour « ${k.label} »`}
                  value={c.result}
                  onChange={(e) => setChoix((x) => ({ ...x, [k.id]: { ...c, result: e.currentTarget.value } }))}
                />
              </Group>
            )}
          </Stack>
        );
      })}
      <Textarea label="Conclusion" value={conclusion} onChange={(e) => setConclusion(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={!retenus.length || !date} onClick={enregistrer}>
          Enregistrer l’évaluation
        </Button>
      </Group>
    </Stack>
  );
}

function HistoriqueEvaluations({ fournisseur }: { fournisseur: Fournisseur }) {
  const modifier = useCan()('fournisseurs', 'modifier'),
    [suite, setSuite] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['suppliers', fournisseur.id, 'evaluations'],
    queryFn: () => get<Historique[]>(`/api/suppliers/${encodeURIComponent(fournisseur.id)}/evaluations`),
  });
  return (
    <Stack>
      <ErrorAlert error={q.error} />
      {q.data && !q.data.length && <Text>Aucune évaluation enregistrée.</Text>}
      {(q.data ?? []).map((e, i) => (
        <Stack key={e.id} gap="xs">
          <Group>
            <Text fw={600}>
              Évaluation du {e.evaluatedAt} · {e.evaluator}
            </Text>
            {i === 0 && <StatusChip etat="succes">Courante</StatusChip>}
            {e.nextReviewAt && <Text size="sm">Réévaluation prévue le {e.nextReviewAt}</Text>}
          </Group>
          {e.conclusion && <Text>{e.conclusion}</Text>}
          {modifier &&
            (suite === e.id ? (
              <SuiteEvaluation fournisseur={fournisseur} evaluation={e} onClose={() => setSuite(null)} />
            ) : (
              <div>
                <Button
                  size="xs"
                  variant="default"
                  aria-label={`Donner suite à l’évaluation du ${e.evaluatedAt}`}
                  onClick={() => setSuite(e.id)}
                >
                  Donner suite
                </Button>
              </div>
            ))}
          <DataTable label={`Critères de l’évaluation du ${e.evaluatedAt}`}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Critère (version au moment de l’évaluation)</Table.Th>
                  <Table.Th>Répond</Table.Th>
                  <Table.Th>Résultat</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {e.items.map((it) => (
                  <Table.Tr key={it.criterionId}>
                    <Table.Td>
                      {it.criterionLabel} (v{it.criterionVersion})
                    </Table.Td>
                    <Table.Td>{REPONSE[versOption(it.meets)]}</Table.Td>
                    <Table.Td>{it.result || '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </DataTable>
        </Stack>
      ))}
    </Stack>
  );
}

function RattachementPerimetres({ fournisseurId }: { fournisseurId: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    modifier = can('fournisseurs', 'modifier'),
    [erreur, setErreur] = useState<unknown>(null);
  const scopes = useQuery({ queryKey: ['grc', 'smsis'], queryFn: () => get<Perimetre[]>('/api/grc/smsis') });
  const liste = useQuery({ queryKey: ['suppliers'], queryFn: () => get<Fournisseur[]>('/api/suppliers') });
  const rattaches = new Set(liste.data?.find((f) => f.id === fournisseurId)?.scopes ?? []);
  const changer = async (smsi: string, rattacher: boolean) => {
    try {
      setErreur(null);
      await api(rattacher ? 'PUT' : 'DELETE', `/api/grc/${smsi}/suppliers/${encodeURIComponent(fournisseurId)}`);
      await qc.invalidateQueries({ queryKey: ['suppliers'] });
      await qc.invalidateQueries({ queryKey: ['grc'] });
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Stack>
      <Text size="sm">
        Le rattachement ne contient aucune donnée d’évaluation : le retirer ne supprime ni le fournisseur ni ses
        évaluations.
      </Text>
      <ErrorAlert error={erreur ?? scopes.error ?? liste.error} />
      {(scopes.data ?? []).map((p) => (
        <Group key={p.id} justify="space-between">
          <Text>{p.name}</Text>
          {rattaches.has(p.id) ? (
            <Group gap="xs">
              <StatusChip etat="succes">Rattaché</StatusChip>
              {modifier && (
                <Button
                  size="xs"
                  variant="default"
                  aria-label={`Retirer le rattachement au périmètre ${p.name}`}
                  onClick={() => changer(p.id, false)}
                >
                  Retirer
                </Button>
              )}
            </Group>
          ) : (
            modifier && (
              <Button size="xs" aria-label={`Rattacher au périmètre ${p.name}`} onClick={() => changer(p.id, true)}>
                Rattacher
              </Button>
            )
          )}
        </Group>
      ))}
    </Stack>
  );
}

const UNITES = [
  { value: 'day', label: 'jour(s)' },
  { value: 'week', label: 'semaine(s)' },
  { value: 'month', label: 'mois' },
  { value: 'year', label: 'an(s)' },
];

/* Suite donnée à une évaluation (ADR 0032) : une action ou une série de tâches de réévaluation, créée dans le
   périmètre choisi et liée au fournisseur. Aucune fréquence n'est proposée par défaut : elle vient de l'organisation. */
function SuiteEvaluation({
  fournisseur,
  evaluation,
  onClose,
}: {
  fournisseur: Fournisseur;
  evaluation: Historique;
  onClose: () => void;
}) {
  const scopes = useQuery({ queryKey: ['grc', 'smsis'], queryFn: () => get<Perimetre[]>('/api/grc/smsis') });
  const [kind, setKind] = useState<string | null>('action'),
    [smsi, setSmsi] = useState<string | null>(() => {
      try {
        return sessionStorage.getItem('pilotage-scope');
      } catch {
        return null;
      }
    }),
    [name, setName] = useState(''),
    [note, setNote] = useState(''),
    [dueAt, setDueAt] = useState(''),
    [start, setStart] = useState(''),
    [interval, setIntervalle] = useState<number | string>(''),
    [unit, setUnit] = useState<string | null>(null),
    [erreur, setErreur] = useState<unknown>(null),
    [cree, setCree] = useState<{ kind: string; name: string; smsiId: string } | null>(null);
  const serie = kind === 'task_series';
  const valide = !!smsi && name.trim().length >= 3 && (!serie || (!!start && Number(interval) >= 1 && !!unit));
  const creer = async () => {
    try {
      setErreur(null);
      const r = await post<{ kind: string; name: string; smsiId: string }>(
        `/api/suppliers/${encodeURIComponent(fournisseur.id)}/evaluations/${encodeURIComponent(evaluation.id)}/follow-up`,
        serie
          ? { smsi, kind, name: name.trim(), note, start, interval: Number(interval), unit }
          : { smsi, kind, name: name.trim(), note, dueAt: dueAt || null },
      );
      setCree(r);
    } catch (e) {
      setErreur(e);
    }
  };
  if (cree)
    return (
      <Alert color="green" title="Suite créée" role="status">
        <Stack gap="xs">
          <Text>
            « {cree.name} » a été créée et liée au fournisseur {fournisseur.name}.
          </Text>
          <Group>
            <Anchor component={Link} to={cree.kind === 'action' ? '/pilotage/actions' : '/pilotage/recurrences'}>
              Ouvrir {cree.kind === 'action' ? 'le plan d’actions' : 'les tâches récurrentes'}
            </Anchor>
            <Button size="xs" variant="default" onClick={onClose}>
              Fermer
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  return (
    <Stack gap="xs">
      <ErrorAlert error={erreur ?? scopes.error} />
      <Group align="flex-end">
        <Select
          label="Type de suite"
          data={[
            { value: 'action', label: 'Action corrective ou d’amélioration' },
            { value: 'task_series', label: 'Série de réévaluation' },
          ]}
          value={kind}
          onChange={setKind}
          allowDeselect={false}
        />
        <Select
          label="Périmètre où la créer"
          placeholder="Choisir un périmètre"
          data={(scopes.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          value={smsi}
          onChange={setSmsi}
          allowDeselect={false}
        />
      </Group>
      <TextInput label="Intitulé" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
      <Textarea label="Précisions" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      {serie ? (
        <Group align="flex-end">
          <TextInput
            label="Première échéance"
            type="date"
            value={start}
            onChange={(e) => setStart(e.currentTarget.value)}
            required
          />
          <NumberInput label="Tous les" min={1} max={365} value={interval} onChange={setIntervalle} required />
          <Select label="Unité" data={UNITES} value={unit} onChange={setUnit} required />
        </Group>
      ) : (
        <TextInput
          label="Échéance (facultative)"
          type="date"
          value={dueAt}
          min={evaluation.evaluatedAt}
          onChange={(e) => setDueAt(e.currentTarget.value)}
        />
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Annuler
        </Button>
        <Button disabled={!valide} onClick={creer}>
          {serie ? 'Planifier la réévaluation' : 'Créer l’action'}
        </Button>
      </Group>
    </Stack>
  );
}
