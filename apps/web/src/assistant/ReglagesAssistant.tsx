/* Réglages de l'assistant RSSI (Plateforme, ADR 0086) : fournisseur du modèle, clé en écriture seule, profils et périmètres,
   budget quotidien. L'écran dit en clair vers quel fournisseur partent les extraits lus par l'assistant. Droit requis :
   assistant:administrer (le serveur reste seul juge). */
import {
  Alert,
  Button,
  Card,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusChip } from '@suivi/ui';
import {
  CONTEXTE_ASSISTANT_MAX,
  type ReferentAssistantDto,
  type ReglagesAssistantDto,
  type TestModeleDto,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert } from '../components/common';
import { ASSISTANT_GLOBAL } from './cles';
import { MemoireAssistant, MesuresAssistant, MethodesAssistant, MissionsAssistant } from './AutonomieAssistant';

export const CLE_ETAT_ASSISTANT = ['assistant', 'etat'];
const CLE_REGLAGES = ['assistant', 'reglages'];

type Saisie = Pick<
  ReglagesAssistantDto,
  | 'actif'
  | 'adresse'
  | 'modele'
  | 'budgetJetonsJour'
  | 'enPause'
  | 'heureRonde'
  | 'plafondRappelsJour'
  | 'delaiRelanceJours'
  | 'jourSynthese'
  | 'rondesSurEvenement'
  | 'contexte'
  | 'profils'
>;
const saisieDe = (d: ReglagesAssistantDto): Saisie => ({
  actif: d.actif,
  adresse: d.adresse,
  modele: d.modele,
  budgetJetonsJour: d.budgetJetonsJour,
  enPause: d.enPause,
  heureRonde: d.heureRonde,
  plafondRappelsJour: d.plafondRappelsJour,
  delaiRelanceJours: d.delaiRelanceJours,
  jourSynthese: d.jourSynthese,
  rondesSurEvenement: d.rondesSurEvenement,
  contexte: d.contexte,
  profils: d.profils,
});
const hote = (adresse: string) => {
  try {
    return new URL(adresse).host;
  } catch {
    return '';
  }
};

export function ReglagesAssistantPanel({ onDirty }: { onDirty?: (modifie: boolean) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CLE_REGLAGES, queryFn: () => get<ReglagesAssistantDto>('/api/assistant/reglages') });
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () => get<{ id: string; name: string }[]>('/api/grc/smsis'),
  });
  const referents = useQuery({
    queryKey: ['assistant', 'referents'],
    queryFn: () => get<ReferentAssistantDto[]>('/api/assistant/referents'),
  });
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [cle, setCle] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const [test, setTest] = useState<TestModeleDto | null>(null);

  useEffect(() => {
    if (q.data && !saisie) setSaisie(saisieDe(q.data));
  }, [q.data, saisie]);
  const modifie = !!q.data && !!saisie && JSON.stringify(saisie) !== JSON.stringify(saisieDe(q.data));
  useEffect(() => onDirty?.(modifie || cle !== ''), [modifie, cle, onDirty]);

  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data || !saisie) return <Text c="dimmed">Chargement des réglages…</Text>;
  const d = q.data;
  const changer = (c: Partial<Saisie>) => setSaisie({ ...saisie, ...c });
  /** Relit l'état affiché ailleurs (page de suivi, panneau flottant). Le formulaire en cours de saisie n'est pas touché. */
  const actualiser = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: CLE_REGLAGES }),
      qc.invalidateQueries({ queryKey: CLE_ETAT_ASSISTANT }),
      // Le panneau flottant relit aussitôt son état (activation, pause, profils).
      qc.invalidateQueries({ queryKey: [ASSISTANT_GLOBAL] }),
    ]);
  };
  const agir = async (fn: () => Promise<unknown>, message: string) => {
    setEnvoi(true);
    try {
      setErreur(null);
      await fn();
      notifications.show({ message, color: 'green' });
      await actualiser();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  // Le formulaire reprend la réponse du serveur : il affiche exactement ce qui est enregistré, et redevient « à jour ».
  const enregistrer = () =>
    agir(async () => {
      const enregistre = await api<ReglagesAssistantDto>('PUT', '/api/assistant/reglages', {
        body: {
          ...saisie,
          profils: saisie.profils.map(
            ({
              id,
              actif,
              perimetres: p,
              tousPerimetres,
              rondeQuotidienne,
              referent,
              documents,
              classificationMax,
            }) => ({
              id,
              actif,
              perimetres: p,
              tousPerimetres,
              rondeQuotidienne,
              referent,
              documents,
              classificationMax,
            }),
          ),
          version: d.version,
        },
      });
      qc.setQueryData(CLE_REGLAGES, enregistre);
      setSaisie(saisieDe(enregistre));
    }, 'Réglages de l’assistant enregistrés.');
  const tester = async () => {
    setEnvoi(true);
    try {
      setErreur(null);
      setTest(await api<TestModeleDto>('POST', '/api/assistant/reglages/test'));
    } catch (e) {
      setTest({ ok: false, detail: errorMessage(e) });
    } finally {
      setEnvoi(false);
    }
  };
  const choix = (perimetres.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const fournisseur = hote(saisie.adresse);
  const choixReferents = (referents.data ?? []).map((r) => ({ value: r.id, label: r.nom }));

  return (
    <Stack>
      <Alert color="orange" title="Ce qui quitte le serveur">
        Pour répondre, l’assistant envoie au fournisseur du modèle la question posée et les extraits qu’il a lus
        (intitulés d’écarts, descriptions de risques, noms d’éléments). Il ne lit que ce que les profils ci-dessous
        ouvrent, et jamais plus que la personne qui l’interroge. Par défaut, un profil lit tous les périmètres et tous
        les documents : restreignez-le si une partie ne doit pas être confiée à ce fournisseur.
        {fournisseur ? ` Fournisseur réglé : ${fournisseur}.` : ''}
      </Alert>
      {!d.relaisDeclare && (
        <Alert color="red" title="Relais de modèle absent">
          Le relais de modèle n’est pas installé sur le serveur : l’assistant ne peut pas répondre. Voir le guide
          d’installation, « Assistant RSSI ».
        </Alert>
      )}

      <Card withBorder>
        <Stack>
          <Title order={3} size="h5">
            Modèle
          </Title>
          <Switch
            label="Activer l’assistant"
            description="Coché : le bouton de l’assistant apparaît en bas à droite pour les personnes autorisées, et les rondes peuvent partir. Décoché : plus aucun appel au modèle, les réglages sont conservés."
            checked={saisie.actif}
            onChange={(e) => changer({ actif: e.currentTarget.checked })}
          />
          <TextInput
            label="Adresse du service de modèle"
            description="Adresse HTTPS d’une API compatible OpenAI, par exemple https://api.mistral.ai/v1"
            value={saisie.adresse}
            onChange={(e) => changer({ adresse: e.currentTarget.value })}
          />
          <TextInput
            label="Nom du modèle"
            description="Tel que le fournisseur le nomme. Le modèle doit gérer l’appel d’outils."
            value={saisie.modele}
            onChange={(e) => changer({ modele: e.currentTarget.value })}
          />
          <NumberInput
            label="Budget quotidien, en jetons"
            description="Plafond de dépense : un jeton vaut à peu près trois quarts de mot, une ronde en consomme 30 000 à 90 000. Au-delà du budget, l’assistant ne répond plus et aucune ronde ne part jusqu’au lendemain."
            min={1000}
            max={50_000_000}
            step={50_000}
            value={saisie.budgetJetonsJour}
            onChange={(v) => changer({ budgetJetonsJour: typeof v === 'number' ? v : saisie.budgetJetonsJour })}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={3} size="h5">
            Profils et périmètres
          </Title>
          <Text size="sm" c="dimmed">
            Documents : {d.indexDocuments.extraits} lus, {d.indexDocuments.nonLus} non lus (PDF, anciens formats,
            images), {d.indexDocuments.enAttente} en attente de lecture.
          </Text>
          <Text size="sm" c="dimmed">
            Un profil est un rôle de l’assistant, avec ses propres accès, sa mémoire et ses missions. Les deux profils
            restent séparés : un auditeur n’audite pas son propre travail. Dans tous les cas, l’assistant ne lit jamais
            plus que la personne qui l’interroge.
          </Text>
          {saisie.profils.map((p, i) => {
            const maj = (c: Partial<(typeof saisie.profils)[number]>) =>
              changer({ profils: saisie.profils.map((x, j) => (j === i ? { ...x, ...c } : x)) });
            return (
              <Stack key={p.id} gap="xs">
                <Switch
                  label={`Profil « ${p.libelle} »`}
                  description={
                    p.id === 'audit_interne'
                      ? 'Coché : ce profil est proposé dans le panneau. Il prépare l’audit interne et propose des constats, jamais d’action corrective.'
                      : 'Coché : ce profil est proposé dans le panneau. Il suit la mise en œuvre : retards, manques, rappels, propositions d’action.'
                  }
                  checked={p.actif}
                  onChange={(e) => maj({ actif: e.currentTarget.checked })}
                />
                <Switch
                  label={`Le profil « ${p.libelle} » lit tous les périmètres`}
                  description="Coché (par défaut) : tous les périmètres, y compris ceux créés plus tard. Décoché : seulement ceux de la liste ci-dessous."
                  checked={p.tousPerimetres}
                  onChange={(e) => maj({ tousPerimetres: e.currentTarget.checked })}
                  disabled={!p.actif}
                />
                <MultiSelect
                  label={`Périmètres ouverts au profil « ${p.libelle} »`}
                  description={
                    p.tousPerimetres
                      ? 'Sans effet tant que « tous les périmètres » est coché.'
                      : 'Seuls ces périmètres sont lus. Une liste vide : le profil ne lit rien.'
                  }
                  data={choix}
                  value={p.perimetres}
                  onChange={(v) => maj({ perimetres: v })}
                  searchable
                  clearable
                  disabled={!p.actif || p.tousPerimetres}
                  comboboxProps={{ withinPortal: true }}
                />
                <Switch
                  label={`Le profil « ${p.libelle} » peut lire les documents`}
                  description="Coché (par défaut) : l’assistant cherche et lit le texte des documents déposés (hors PDF et images). Ce texte est gardé en clair dans la base pour la recherche, et les extraits lus partent chez le fournisseur du modèle. Décoché pour les deux profils : cet index est effacé."
                  checked={p.documents}
                  onChange={(e) => maj({ documents: e.currentTarget.checked })}
                  disabled={!p.actif}
                />
                <Select
                  label={`Classification la plus élevée lisible par le profil « ${p.libelle} »`}
                  description="« Confidentiel » (par défaut) : tous les documents. Un niveau plus bas : les documents classés au-dessus ne sont ni trouvés ni lus par l’assistant."
                  data={[
                    { value: 'public', label: 'Public' },
                    { value: 'interne', label: 'Interne' },
                    { value: 'restreint', label: 'Restreint' },
                    { value: 'confidentiel', label: 'Confidentiel' },
                  ]}
                  value={p.classificationMax}
                  onChange={(v) => maj({ classificationMax: (v ?? 'interne') as typeof p.classificationMax })}
                  allowDeselect={false}
                  disabled={!p.actif || !p.documents}
                  comboboxProps={{ withinPortal: true }}
                />
                <Select
                  label={`Référent du profil « ${p.libelle} »`}
                  description="Nécessaire aux rondes seulement. Une ronde travaille sans personne : elle lit avec les droits de ce compte, jamais plus, et c’est lui qui lit ses rapports. Sans référent, pas de ronde ; le dialogue, lui, fonctionne."
                  data={choixReferents}
                  value={p.referent}
                  onChange={(v) => maj({ referent: v, ...(v ? {} : { rondeQuotidienne: false }) })}
                  clearable
                  disabled={!p.actif}
                  comboboxProps={{ withinPortal: true }}
                />
                <Switch
                  label={`Ronde quotidienne du profil « ${p.libelle} »`}
                  description="Coché : chaque jour, l’assistant fait seul le tour des périmètres, rappelle ou interroge les responsables et rend un rapport. Décoché : il ne travaille que lorsqu’on l’interroge ou qu’on lance une ronde à la main."
                  checked={p.rondeQuotidienne}
                  onChange={(e) => maj({ rondeQuotidienne: e.currentTarget.checked })}
                  disabled={!p.actif || !p.referent}
                />
              </Stack>
            );
          })}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={3} size="h5">
            Autonomie
          </Title>
          <Text size="sm" c="dimmed">
            Pendant une ronde, l’assistant travaille sans être interrogé : il lit, envoie des rappels aux responsables,
            tient sa mémoire et rédige un rapport. Il n’écrit dans aucun registre.
          </Text>
          <Switch
            label="Mettre l’assistant en pause"
            description="Coché : aucune ronde ne part, et la ronde en cours conclut tout de suite. Plus aucun rappel ni question n’est envoyé. Le dialogue reste disponible."
            checked={saisie.enPause}
            onChange={(e) => changer({ enPause: e.currentTarget.checked })}
          />
          <NumberInput
            label="Heure de la ronde quotidienne"
            description="Heure de Paris, de 0 à 23. La ronde part à la première minute disponible après cette heure."
            min={0}
            max={23}
            value={saisie.heureRonde}
            onChange={(v) => changer({ heureRonde: typeof v === 'number' ? v : saisie.heureRonde })}
          />
          <NumberInput
            label="Rappels et questions par personne et par jour, au plus"
            description="Au-delà, l’assistant ne peut plus écrire à cette personne jusqu’au lendemain."
            min={0}
            max={50}
            value={saisie.plafondRappelsJour}
            onChange={(v) => changer({ plafondRappelsJour: typeof v === 'number' ? v : saisie.plafondRappelsJour })}
          />
          <Select
            label="Synthèse de la semaine"
            description="Ce jour-là, la ronde quotidienne rend un bilan de la semaine au lieu du rapport habituel."
            data={[
              { value: '0', label: 'Jamais' },
              { value: '1', label: 'Le lundi' },
              { value: '2', label: 'Le mardi' },
              { value: '3', label: 'Le mercredi' },
              { value: '4', label: 'Le jeudi' },
              { value: '5', label: 'Le vendredi' },
              { value: '6', label: 'Le samedi' },
              { value: '7', label: 'Le dimanche' },
            ]}
            value={String(saisie.jourSynthese)}
            onChange={(v) => changer({ jourSynthese: Number(v ?? 0) })}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <Switch
            label="Ronde sur événement"
            description="Une ronde ciblée part quand une action vient de dépasser son échéance ou qu’un écart est créé, au plus toutes les quatre heures par profil."
            checked={saisie.rondesSurEvenement}
            onChange={(e) => changer({ rondesSurEvenement: e.currentTarget.checked })}
          />
          <NumberInput
            label="Délai avant relance d’une question, en jours"
            description="Sans réponse après ce délai, la personne est relancée une fois. Après un second délai, la question vous est signalée dans le rapport."
            min={1}
            max={30}
            value={saisie.delaiRelanceJours}
            onChange={(v) => changer({ delaiRelanceJours: typeof v === 'number' ? v : saisie.delaiRelanceJours })}
          />
          <Textarea
            label="Contexte de l’organisation"
            description="Relu par l’assistant à chaque ronde et à chaque conversation : périmètre de certification, vocabulaire, priorités de l’année. Ce texte part chez le fournisseur du modèle : n’y écrivez aucune donnée personnelle."
            value={saisie.contexte}
            onChange={(e) => changer({ contexte: e.currentTarget.value })}
            maxLength={CONTEXTE_ASSISTANT_MAX}
            autosize
            minRows={3}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="xs">
          {/* L'erreur s'affiche ici, à côté du bouton, et non en haut d'une longue page. */}
          <ErrorAlert error={erreur} />
          <Group>
            <Button onClick={() => void enregistrer()} loading={envoi} disabled={!modifie}>
              Enregistrer les réglages
            </Button>
            <Text size="sm" role="status">
              {modifie
                ? 'Modifications non enregistrées : elles ne prennent effet qu’après « Enregistrer les réglages ».'
                : 'Tous les réglages ci-dessus sont enregistrés.'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Ce bouton enregistre les trois blocs ci-dessus (modèle, profils, autonomie). La clé, les missions, les
            fiches de méthode et la mémoire s’enregistrent chacune avec leur propre bouton, plus bas.
            {d.updatedBy ? ` Dernière modification par ${d.updatedBy}.` : ''}
          </Text>
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Title order={3} size="h5">
              Clé du modèle
            </Title>
            <StatusChip etat={d.cleDefinie ? 'succes' : 'attention'}>
              {d.cleDefinie ? 'Clé enregistrée' : 'Aucune clé'}
            </StatusChip>
          </Group>
          <Text size="sm" c="dimmed">
            La clé est scellée sur le serveur. Elle n’est jamais réaffichée ni écrite dans un journal.
          </Text>
          <PasswordInput
            label={d.cleDefinie ? 'Remplacer la clé' : 'Clé fournie par le fournisseur du modèle'}
            value={cle}
            onChange={(e) => setCle(e.currentTarget.value)}
            autoComplete="off"
          />
          <Group>
            <Button
              variant="default"
              disabled={cle.length < 8}
              loading={envoi}
              onClick={() =>
                void agir(
                  () => api('PUT', '/api/assistant/reglages/cle', { body: { cle } }),
                  'Clé du modèle enregistrée.',
                ).then(() => setCle(''))
              }
            >
              Enregistrer la clé
            </Button>
            {d.cleDefinie && (
              <ConfirmButton
                variant="default"
                message="Retirer la clé du modèle ? L’assistant ne pourra plus répondre."
                onConfirm={() => agir(() => api('DELETE', '/api/assistant/reglages/cle'), 'Clé du modèle retirée.')}
              >
                Retirer la clé
              </ConfirmButton>
            )}
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={3} size="h5">
            Test de connexion
          </Title>
          <Text size="sm" c="dimmed">
            Un appel réel et minimal au modèle, avec les réglages enregistrés. Aucune donnée de la plateforme n’est
            envoyée.
          </Text>
          <Group>
            <Button variant="default" onClick={() => void tester()} loading={envoi} disabled={modifie}>
              Tester le modèle
            </Button>
            {test && <StatusChip etat={test.ok ? 'succes' : 'erreur'}>{test.detail}</StatusChip>}
          </Group>
        </Stack>
      </Card>

      <MissionsAssistant profils={d.profils} />
      <MethodesAssistant profils={d.profils} />
      <MemoireAssistant profils={d.profils} />
      <MesuresAssistant />
    </Stack>
  );
}
