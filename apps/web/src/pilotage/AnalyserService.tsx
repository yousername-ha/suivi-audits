/* Assistant « Analyser un service » (ADR 0056) : un service, une application interne ou un usage de l'IA est un périmètre
   enfant. L'assistant le crée, recueille sa qualification (données de santé, IA), propose les référentiels à rattacher
   (ISO/IEC 27001, HDS, contrôles IA) sans rien rattacher à l'insu de la personne, puis mène à la Couverture où chaque
   exigence s'évalue et où le plan d'action des écarts se crée. Aucune évaluation n'est déduite des réponses. */
import { Alert, Button, Checkbox, Group, Select, Stack, Stepper, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api, get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

interface Perimetre {
  id: string;
  name: string;
}
interface Referentiel {
  id: string;
  identifier: string;
  name: string;
  version: number;
}
type Reponse = 'oui' | 'non' | 'inconnu';
const REPONSES = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'inconnu', label: 'Je ne sais pas encore' },
];
const USAGES_IA = [
  { value: 'externe', label: 'Outils d’IA externes utilisés par les équipes' },
  { value: 'metier', label: 'IA intégrée aux applications métier' },
  { value: 'les_deux', label: 'Les deux' },
];
/** Référentiels proposés d'après la qualification, reconnus à leur identifiant de bibliothèque. */
const FAMILLES = [
  { cle: 'iso', prefixe: 'iso-27001', libelle: 'ISO/IEC 27001' },
  { cle: 'hds', prefixe: 'hds', libelle: 'HDS' },
  { cle: 'ia', prefixe: 'ia-controles-internes', libelle: 'Contrôles IA internes' },
] as const;
type Cle = (typeof FAMILLES)[number]['cle'];

export function AnalyserService({ smsi, onChoisir }: { smsi: string; onChoisir: (id: string) => void }) {
  const can = useCan(),
    navigate = useNavigate(),
    qc = useQueryClient(),
    [etape, setEtape] = useState(0),
    [nom, setNom] = useState(''),
    [description, setDescription] = useState(''),
    [parent, setParent] = useState<string | null>(smsi),
    [heritage, setHeritage] = useState(true),
    [sante, setSante] = useState<Reponse>('inconnu'),
    [ia, setIa] = useState<Reponse>('inconnu'),
    [usageIa, setUsageIa] = useState<string | null>(null),
    [choix, setChoix] = useState<Record<string, boolean> | null>(null),
    [cree, setCree] = useState<Perimetre | null>(null),
    [rattaches, setRattaches] = useState<string[]>([]),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false);
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<Perimetre[]>('/api/grc/smsis'),
  });
  const bibliotheque = useQuery({
    queryKey: ['library', 'frameworks'],
    queryFn: () => get<Referentiel[]>('/api/library/frameworks'),
  });
  const modifier = can('conformite', 'modifier');
  const trouve = (cle: Cle) =>
    (bibliotheque.data ?? []).find((f) => f.identifier.startsWith(FAMILLES.find((x) => x.cle === cle)!.prefixe));
  const propose: Record<Cle, boolean> = { iso: true, hds: sante === 'oui', ia: ia === 'oui' };
  const retenus = (choix ?? propose) as Record<Cle, boolean>;
  const qualification = [
    `Données de santé : ${sante === 'oui' ? 'oui' : sante === 'non' ? 'non' : 'à préciser'}`,
    `IA : ${ia === 'oui' ? (USAGES_IA.find((u) => u.value === usageIa)?.label ?? 'oui') : ia === 'non' ? 'non' : 'à préciser'}`,
  ].join(' ; ');
  const creer = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      const p = await api<Perimetre>('POST', '/api/grc/smsis', {
        body: {
          name: nom.trim(),
          scope: `${description.trim()}${description.trim() ? '\n\n' : ''}Qualification : ${qualification}.`.slice(
            0,
            5000,
          ),
          nature: 'Service',
          parentId: parent,
          inheritFrameworks: !!parent && heritage,
          timezone: 'Europe/Paris',
        },
      });
      setCree(p);
      setEtape(2); // d'abord : un échec d'actualisation ne doit pas permettre de créer le service une deuxième fois
      void qc.invalidateQueries({ queryKey: ['grc', 'smsis'] });
      void qc.invalidateQueries({ queryKey: ['grc', 'perimetres'] });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const rattacher = async () => {
    if (!cree) return;
    setEnvoi(true);
    try {
      setErreur(null);
      const faits: string[] = [];
      for (const f of FAMILLES) {
        const r = trouve(f.cle);
        if (!retenus[f.cle] || !r) continue;
        await api('PUT', `/api/grc/${cree.id}/framework-attachments/${r.id}`, {
          body: { version: r.version, confirm: 'RATTACHER' },
        });
        faits.push(r.name);
      }
      setRattaches(faits);
      setEtape(3);
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const evaluer = () => {
    if (!cree) return;
    onChoisir(cree.id);
    navigate('/pilotage/couverture');
  };
  return (
    <Stack data-testid="analyser-service">
      <Alert>
        Un service, une application interne ou un usage de l’IA devient un périmètre enfant : il hérite des droits et
        des référentiels que vous choisissez, s’évalue exigence par exigence, puis reçoit son plan d’action. Les
        réponses ci-dessous proposent des référentiels ; elles ne déduisent aucune évaluation.
      </Alert>
      {!modifier && (
        <Alert color="orange">Le droit de modifier la conformité est nécessaire pour analyser un service.</Alert>
      )}
      <ErrorAlert error={erreur ?? perimetres.error ?? bibliotheque.error} />
      <Stepper active={etape} allowNextStepsSelect={false}>
        <Stepper.Step label="Le service" description="Nom et rattachement">
          <Stack mt="md">
            <TextInput label="Nom du service" required value={nom} onChange={(e) => setNom(e.currentTarget.value)} />
            <Textarea
              label="Description"
              description="Ce que fait le service, qui l’utilise, quelles données il traite."
              autosize
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
            <Select
              label="Périmètre parent"
              description="Le service devient un périmètre enfant de celui-ci."
              clearable
              data={(perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              value={parent}
              onChange={setParent}
            />
            {parent && (
              <Checkbox
                label="Hériter des référentiels du parent"
                checked={heritage}
                onChange={(e) => setHeritage(e.currentTarget.checked)}
              />
            )}
            <Group justify="flex-end">
              <Button disabled={!nom.trim()} onClick={() => setEtape(1)}>
                Suivant
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>
        <Stepper.Step label="Qualification" description="Santé et IA">
          <Stack mt="md">
            <Select
              label="Le service peut-il traiter des données de santé ?"
              allowDeselect={false}
              data={REPONSES}
              value={sante}
              onChange={(v) => v && setSante(v as Reponse)}
            />
            <Select
              label="Le service embarque-t-il de l’IA, ou des outils d’IA y sont-ils utilisés ?"
              allowDeselect={false}
              data={REPONSES}
              value={ia}
              onChange={(v) => v && setIa(v as Reponse)}
            />
            {ia === 'oui' && (
              <Select label="Quel usage de l’IA ?" data={USAGES_IA} value={usageIa} onChange={setUsageIa} clearable />
            )}
            <Text size="sm">La qualification est conservée dans le texte du périmètre : {qualification}.</Text>
            <Group justify="space-between">
              <Button variant="default" onClick={() => setEtape(0)}>
                Retour
              </Button>
              <Button loading={envoi} disabled={!modifier} onClick={creer}>
                Créer le service
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>
        <Stepper.Step label="Référentiels" description="À rattacher">
          <Stack mt="md">
            <Text size="sm">
              Service « {cree?.name} » créé. Référentiels proposés d’après la qualification ; décochez ceux dont vous ne
              voulez pas.
            </Text>
            {FAMILLES.map((f) => {
              const r = trouve(f.cle);
              return (
                <Stack key={f.cle} gap="2xs">
                  <Checkbox
                    label={r ? `${f.libelle} — ${r.name} (version ${r.version})` : f.libelle}
                    checked={!!r && retenus[f.cle]}
                    disabled={!r}
                    onChange={(e) => setChoix({ ...retenus, [f.cle]: e.currentTarget.checked })}
                  />
                  {!r && (
                    <Text size="xs" c="dimmed">
                      Absent de la bibliothèque : importez-le d’abord (page Bibliothèque), puis rattachez-le au service
                      depuis la page Périmètres.
                    </Text>
                  )}
                </Stack>
              );
            })}
            <Group justify="flex-end">
              <Button loading={envoi} onClick={rattacher}>
                Rattacher les référentiels cochés
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>
        <Stepper.Step label="Évaluer" description="Couverture et plan">
          <Stack mt="md">
            <Text size="sm">
              {rattaches.length
                ? `Rattaché au service : ${rattaches.join(', ')}.`
                : 'Aucun référentiel n’a été rattaché par l’assistant.'}{' '}
              Ouvrez la Couverture du service pour déclarer, exigence par exigence, l’applicabilité et la mise en œuvre,
              puis utilisez « Créer le plan d’action des écarts ».
            </Text>
            <Group justify="flex-end">
              <Button onClick={evaluer}>Ouvrir la couverture du service</Button>
            </Group>
          </Stack>
        </Stepper.Step>
      </Stepper>
    </Stack>
  );
}
