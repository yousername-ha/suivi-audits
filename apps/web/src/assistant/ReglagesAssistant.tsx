/* Réglages de l'assistant RSSI (Plateforme, ADR 0086). L'activation tient en quatre gestes : activer, choisir le
   fournisseur du modèle (trois préenregistrés, ou « Personnalisé »), saisir la clé (écriture seule), choisir le niveau
   d'habilitation. Le reste (budget, profils, périmètres, rondes, autonomie) garde ses valeurs par défaut sous « Réglages
   avancés ». L'écran dit en clair vers quel fournisseur partent les extraits lus par l'assistant. Droit requis :
   assistant:administrer (le serveur reste seul juge). */
import {
  Accordion,
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
import { FormSection, StatusChip } from '@suivi/ui';
import {
  CONTEXTE_ASSISTANT_MAX,
  FOURNISSEUR_PERSONNALISE,
  FOURNISSEURS_ASSISTANT,
  fournisseurDeAdresse,
  type ReferentAssistantDto,
  type ReglagesAssistantDto,
  type TestModeleDto,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ConfirmButton, ErrorAlert } from '../components/common';
import { CLE_FLUX_EXTERNES, FluxFermeAlerte } from '../components/FluxExternes';
import { useValidationFlux } from '../components/ValidationFlux';
import { ASSISTANT_GLOBAL } from './cles';
import { corpsReglages, saisieDe, type Saisie } from './reglages-corps';
import { MemoireAssistant, MesuresAssistant, MethodesAssistant, MissionsAssistant } from './AutonomieAssistant';

export const CLE_ETAT_ASSISTANT = ['assistant', 'etat'];
const CLE_REGLAGES = ['assistant', 'reglages'];

const NIVEAUX = [
  { value: 'public', label: 'Public' },
  { value: 'interne', label: 'Interne' },
  { value: 'restreint', label: 'Restreint' },
  { value: 'confidentiel', label: 'Confidentiel' },
];
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
  // « Personnalisé » choisi à la main : il reste affiché même si l'adresse saisie est celle d'un fournisseur connu.
  const [personnalise, setPersonnalise] = useState(false);
  const flux = useValidationFlux();

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
  const enregistrer = async () => {
    // Activer l'assistant ouvre son flux (ADR 0097, précision du RSSI du 15/11/2026) : validation explicite une fois, puis
    // activation et ouverture en une seule opération.
    const valide = saisie.actif && !d.fluxOuvert ? await flux.valider('assistant') : null;
    if (valide === false) return;
    await agir(async () => {
      // La clé saisie est scellée d'abord : un seul bouton pour la clé et les réglages.
      if (cle) {
        await api('PUT', '/api/assistant/reglages/cle', { body: { cle } });
        setCle('');
      }
      if (!modifie && !valide) return;
      const enregistre = await api<ReglagesAssistantDto>('PUT', '/api/assistant/reglages', {
        body: corpsReglages(saisie, d.version, !!valide),
      });
      qc.setQueryData(CLE_REGLAGES, enregistre);
      setSaisie(saisieDe(enregistre));
      await qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES });
    }, 'Réglages de l’assistant enregistrés.');
  };
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
  const connu = personnalise ? null : fournisseurDeAdresse(saisie.adresse);
  const choixFournisseur = connu?.id ?? (personnalise || saisie.adresse ? FOURNISSEUR_PERSONNALISE : null);
  const choisirFournisseur = (v: string | null) => {
    const f = FOURNISSEURS_ASSISTANT.find((x) => x.id === v);
    setPersonnalise(!f);
    if (f)
      changer({
        adresse: f.adresse,
        modele: (f.modeles as readonly string[]).includes(saisie.modele) ? saisie.modele : f.modeles[0],
      });
    else if (fournisseurDeAdresse(saisie.adresse)) changer({ adresse: '', modele: '' });
  };
  const modeles = connu
    ? [...new Set([...connu.modeles, ...(saisie.modele ? [saisie.modele] : [])])].map((m) => ({ value: m, label: m }))
    : [];
  // Un seul niveau d'habilitation pour les deux profils ; null quand ils diffèrent (réglés un par un, plus bas).
  const niveaux = new Set(saisie.profils.map((p) => p.classificationMax));
  const niveauCommun = niveaux.size === 1 ? saisie.profils[0]!.classificationMax : null;
  // Assistant activé mais flux encore fermé : « Enregistrer » sert aussi à valider l'ouverture du flux.
  const aEnregistrer = modifie || cle.length >= 8 || (saisie.actif && !d.fluxOuvert);
  const erreurTexte = erreur ? errorMessage(erreur) : null;
  const choixReferents = (referents.data ?? []).map((r) => ({ value: r.id, label: r.nom }));

  return (
    <Stack>
      {flux.fenetre}
      {!d.fluxOuvert ? (
        <FluxFermeAlerte module="assistant" />
      ) : (
        !d.relaisDeclare && (
          <Alert color="red" title="Relais de modèle absent">
            Aucune adresse de relais de modèle n’est connue du serveur : l’assistant ne peut pas répondre. Voir le guide
            d’installation, « Assistant RSSI ».
          </Alert>
        )
      )}

      <FormSection
        title="Assistant RSSI"
        description={`Pour répondre, l’assistant envoie au fournisseur du modèle la question posée et les extraits qu’il a lus (intitulés d’écarts, descriptions de risques, noms d’éléments). Il ne lit jamais plus que la personne qui l’interroge. Par défaut, il lit tous les périmètres et tous les documents : restreignez-le dans les réglages avancés si une partie ne doit pas être confiée à ce fournisseur.${fournisseur ? ` Fournisseur réglé : ${fournisseur}.` : ''}`}
        dirty={aEnregistrer}
        saving={envoi}
        onSave={enregistrer}
        error={erreurTexte}
      >
        <Switch
          label="Activer l’assistant RSSI"
          description="Coché : le bouton de l’assistant apparaît en bas à droite pour les personnes autorisées. Décoché : plus aucun appel au modèle, les réglages sont conservés."
          checked={saisie.actif}
          onChange={(e) => changer({ actif: e.currentTarget.checked })}
        />
        <Select
          label="Fournisseur du modèle"
          description="L’adresse et les modèles des trois fournisseurs sont préenregistrés. « Personnalisé » : tout autre service compatible, à régler vous-même."
          placeholder="Choisissez un fournisseur"
          data={[
            ...FOURNISSEURS_ASSISTANT.map((f) => ({ value: f.id, label: f.libelle })),
            { value: FOURNISSEUR_PERSONNALISE, label: 'Personnalisé' },
          ]}
          value={choixFournisseur}
          onChange={choisirFournisseur}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        {connu && (
          <Select
            label="Modèle"
            description={`Adresse préenregistrée : ${connu.adresse}. Pour un autre modèle de ce fournisseur, choisissez « Personnalisé ».`}
            data={modeles}
            value={saisie.modele}
            onChange={(v) => changer({ modele: v ?? connu.modeles[0] })}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        )}
        {choixFournisseur === FOURNISSEUR_PERSONNALISE && (
          <>
            <TextInput
              label="Adresse du service de modèle"
              description="Adresse HTTPS d’une API « chat completions » compatible OpenAI, par exemple https://modele.exemple.fr/v1"
              value={saisie.adresse}
              onChange={(e) => changer({ adresse: e.currentTarget.value })}
            />
            <TextInput
              label="Nom du modèle"
              description="Tel que le service le nomme. Le modèle doit gérer l’appel d’outils."
              value={saisie.modele}
              onChange={(e) => changer({ modele: e.currentTarget.value })}
            />
          </>
        )}
        {choixFournisseur && (
          <PasswordInput
            label={d.cleDefinie ? 'Remplacer la clé d’API' : 'Clé d’API du fournisseur'}
            description="Scellée sur le serveur : jamais réaffichée ni écrite dans un journal. Laissez vide pour garder la clé enregistrée."
            value={cle}
            onChange={(e) => setCle(e.currentTarget.value)}
            autoComplete="off"
          />
        )}
        {choixFournisseur && (
          <Select
            label="Niveau d’habilitation de l’assistant"
            description="Classification la plus élevée que l’assistant peut lire dans les documents. « Confidentiel » : tous les documents. Un niveau plus bas : les documents classés au-dessus ne sont ni trouvés ni lus."
            placeholder="Différent selon le profil (voir les réglages avancés)"
            data={NIVEAUX}
            value={niveauCommun}
            onChange={(v) => {
              if (v)
                changer({
                  profils: saisie.profils.map((p) => ({ ...p, classificationMax: v as typeof p.classificationMax })),
                });
            }}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        )}
        <Group>
          <Button variant="default" onClick={() => void tester()} loading={envoi} disabled={aEnregistrer}>
            Tester le modèle
          </Button>
          {test && <StatusChip etat={test.ok ? 'succes' : 'erreur'}>{test.detail}</StatusChip>}
          <StatusChip etat={d.cleDefinie ? 'succes' : 'neutre'}>
            {d.cleDefinie ? 'Clé enregistrée' : 'Aucune clé enregistrée'}
          </StatusChip>
        </Group>
        <Text size="xs" c="dimmed">
          Le test est un appel réel et minimal au modèle, avec les réglages enregistrés. Aucune donnée de la plateforme
          n’est envoyée.{d.updatedBy ? ` Dernière modification par ${d.updatedBy}.` : ''}
        </Text>
      </FormSection>

      <Accordion variant="contained">
        <Accordion.Item value="avances">
          <Accordion.Control>Réglages avancés</Accordion.Control>
          <Accordion.Panel>
            <Stack>
              <Text size="sm" c="dimmed">
                Ces réglages ont des valeurs par défaut : l’assistant fonctionne sans y toucher. Ils s’enregistrent avec
                le même bouton « Enregistrer ».
              </Text>
              <Card withBorder>
                <NumberInput
                  label="Budget quotidien, en jetons"
                  description="Plafond de dépense : un jeton vaut à peu près trois quarts de mot, une ronde en consomme 30 000 à 90 000. Au-delà du budget, l’assistant ne répond plus et aucune ronde ne part jusqu’au lendemain."
                  min={1000}
                  max={50_000_000}
                  step={50_000}
                  value={saisie.budgetJetonsJour}
                  onChange={(v) => changer({ budgetJetonsJour: typeof v === 'number' ? v : saisie.budgetJetonsJour })}
                />
              </Card>

              <Card withBorder>
                <Stack>
                  <Title order={3} size="h5">
                    Profils et périmètres
                  </Title>
                  <Text size="sm" c="dimmed">
                    Documents : {d.indexDocuments.extraits} lus, {d.indexDocuments.nonLus} non lus (anciens formats,
                    images, PDF numérisés), {d.indexDocuments.enAttente} en attente de lecture.
                  </Text>
                  <Text size="sm" c="dimmed">
                    Un profil est un rôle de l’assistant, avec ses propres accès, sa mémoire et ses missions. Les deux
                    profils restent séparés : un auditeur n’audite pas son propre travail. Dans tous les cas,
                    l’assistant ne lit jamais plus que la personne qui l’interroge.
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
                          description="Coché (par défaut) : l’assistant cherche et lit le texte des documents déposés (PDF compris ; pas les images ni les PDF numérisés). Ce texte est gardé en clair dans la base pour la recherche, et les extraits lus partent chez le fournisseur du modèle. Décoché pour les deux profils : cet index est effacé."
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
                    Pendant une ronde, l’assistant travaille sans être interrogé : il lit, envoie des rappels aux
                    responsables, tient sa mémoire et rédige un rapport. Il n’écrit dans aucun registre.
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
                    onChange={(v) =>
                      changer({ plafondRappelsJour: typeof v === 'number' ? v : saisie.plafondRappelsJour })
                    }
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
                    onChange={(v) =>
                      changer({ delaiRelanceJours: typeof v === 'number' ? v : saisie.delaiRelanceJours })
                    }
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

              <Group justify="flex-end">
                <Button onClick={() => void enregistrer()} loading={envoi} disabled={!aEnregistrer}>
                  Enregistrer
                </Button>
              </Group>
              {d.cleDefinie && (
                <Card withBorder>
                  <Group>
                    <ConfirmButton
                      variant="default"
                      message="Retirer la clé du modèle ? L’assistant ne pourra plus répondre."
                      onConfirm={() =>
                        agir(() => api('DELETE', '/api/assistant/reglages/cle'), 'Clé du modèle retirée.')
                      }
                    >
                      Retirer la clé
                    </ConfirmButton>
                    <Text size="sm" c="dimmed">
                      L’assistant ne pourra plus répondre tant qu’une nouvelle clé n’est pas enregistrée.
                    </Text>
                  </Group>
                </Card>
              )}
              <MissionsAssistant profils={d.profils} />
              <MethodesAssistant profils={d.profils} />
              <MemoireAssistant profils={d.profils} />
              <MesuresAssistant />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
