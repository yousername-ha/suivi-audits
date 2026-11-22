/* Mandataire sortant de l'établissement (ADR 0101, lot P1) : réglage unique de la configuration système, inactif par défaut.
   Adresse http://hôte:port, identifiant facultatif, mot de passe en écriture seule (défini ou non, jamais relu), autorité de
   certification de l'établissement facultative. L'écran dit quels flux l'utilisent (la veille), lesquels restent en accès
   direct par construction (Tenable, courriel) et lesquels ne le peuvent pas encore. Droit : administration:administrer (le
   serveur reste seul juge). */
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  PasswordInput,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { REGLAGE_MANDATAIRE_DEFAUT, type MandataireOut, type ReglageMandataire } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, get } from '../api';
import { effaceraMotDePasse, erreurAdresse, lignesFluxMandataire, peutEnregistrer } from '../mandataire';
import { ErrorAlert } from './common';
import { CLE_FLUX_EXTERNES } from './FluxExternes';

export const CLE_MANDATAIRE = ['admin', 'mandataire'] as const;
const COULEURS_USAGE = { utilise: 'green', direct: 'blue', non_pris_en_charge: 'gray' } as const;

export function MandatairePanel({ onDirty }: { onDirty?: (modifie: boolean) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CLE_MANDATAIRE, queryFn: () => get<MandataireOut>('/api/admin/mandataire') });
  const [saisie, setSaisie] = useState<ReglageMandataire | null>(null);
  const [mdp, setMdp] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const enregistre = q.data?.values ?? REGLAGE_MANDATAIRE_DEFAUT;
  const v = saisie ?? enregistre;
  const modifie = saisie !== null && JSON.stringify(saisie) !== JSON.stringify(enregistre);
  useEffect(() => onDirty?.(modifie || mdp !== ''), [modifie, mdp, onDirty]);
  if (!q.data) return <ErrorAlert error={q.error} />;
  const defini = q.data.motDePasseDefini;
  const set = <K extends keyof ReglageMandataire>(k: K, x: ReglageMandataire[K]) => setSaisie({ ...v, [k]: x });
  const efface = effaceraMotDePasse(enregistre, v, defini);
  const agir = async (fn: () => Promise<void>) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES });
      await qc.invalidateQueries({ queryKey: ['vulnerabilites'] });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const enregistrer = () =>
    agir(async () => {
      const r = await api<MandataireOut>('PUT', '/api/admin/mandataire', { body: v, ifMatch: q.data!.version });
      qc.setQueryData(CLE_MANDATAIRE, r);
      setSaisie(null);
      notifications.show({ color: 'teal', message: 'Réglage du mandataire enregistré.' });
    });
  const definirMotDePasse = () =>
    agir(async () => {
      await api('PUT', '/api/admin/mandataire/mot-de-passe', { body: { password: mdp } });
      setMdp('');
      await qc.invalidateQueries({ queryKey: CLE_MANDATAIRE });
      notifications.show({ color: 'teal', message: 'Mot de passe enregistré.' });
    });
  const retirerMotDePasse = () =>
    agir(async () => {
      await api('DELETE', '/api/admin/mandataire/mot-de-passe');
      await qc.invalidateQueries({ queryKey: CLE_MANDATAIRE });
      notifications.show({ color: 'teal', message: 'Mot de passe retiré.' });
    });
  const adresseErreur = erreurAdresse(v.adresse);
  return (
    <Stack>
      <Text size="sm">
        Si le serveur ne sort vers Internet que par le mandataire (proxy) de l’établissement, réglez-le ici. Inactif,
        les flux sortent directement. Les demandes passent par un tunnel chiffré de bout en bout : le certificat de
        chaque destination reste vérifié.
      </Text>
      <Alert color="orange" title="Inspection du trafic chiffré">
        Un mandataire qui inspecte le trafic lit ce qui passe. L’autorité de certification fournie ici est ajoutée aux
        autorités reconnues pour les seuls flux qui passent par le mandataire : elle doit venir d’une source sûre.
      </Alert>
      <ErrorAlert error={erreur} />
      <Switch
        label="Passer par le mandataire de l’établissement"
        checked={v.actif}
        onChange={(e) => set('actif', e.currentTarget.checked)}
      />
      <div className="grille-formulaire__champs">
        <TextInput
          label="Adresse du mandataire"
          description="http://hôte:port : nom ou adresse IP (IPv6 entre crochets), port obligatoire. Ni identifiant, ni chemin."
          descriptionProps={{ 'data-aide-permanente': true }}
          placeholder="http://mandataire.exemple:3128"
          value={v.adresse}
          onChange={(e) => set('adresse', e.currentTarget.value)}
          error={adresseErreur}
          spellCheck={false}
          autoComplete="off"
        />
        <TextInput
          label="Identifiant (facultatif)"
          description="Authentification simple seulement : NTLM et Kerberos ne sont pas pris en charge."
          value={v.identifiant}
          onChange={(e) => set('identifiant', e.currentTarget.value)}
          autoComplete="off"
        />
      </div>
      <Textarea
        label="Autorité de certification de l’établissement (facultatif)"
        description="Seulement si le mandataire inspecte le trafic chiffré : collez le certificat PEM de son autorité. Vide : autorités reconnues du système."
        autosize
        minRows={2}
        maxRows={8}
        value={v.autoriteCertification}
        onChange={(e) => set('autoriteCertification', e.currentTarget.value)}
        spellCheck={false}
      />
      {efface && (
        <Alert color="orange" role="status">
          L’adresse ou l’identifiant change : enregistrer efface le mot de passe enregistré, il faudra le ressaisir.
        </Alert>
      )}
      <Group>
        <Button loading={envoi} disabled={!modifie || !peutEnregistrer(v)} onClick={() => void enregistrer()}>
          Enregistrer
        </Button>
        {modifie && (
          <Button variant="default" disabled={envoi} onClick={() => setSaisie(null)}>
            Annuler les modifications
          </Button>
        )}
      </Group>
      <Stack gap="xs" role="group" aria-label="Mot de passe du mandataire">
        <Group gap="xs">
          <Text fw={600}>Mot de passe</Text>
          <Badge variant="light" color={defini ? 'green' : 'gray'}>
            {defini ? 'Défini' : 'Non défini'}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Scellé sur le serveur, jamais affiché ni relu. Il n’est envoyé qu’au mandataire, jamais aux destinations.
          Changer l’adresse ou l’identifiant le supprime.
        </Text>
        <Group align="flex-end">
          <PasswordInput
            label={defini ? 'Nouveau mot de passe' : 'Mot de passe'}
            value={mdp}
            onChange={(e) => setMdp(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <Button variant="default" loading={envoi} disabled={!mdp || modifie} onClick={() => void definirMotDePasse()}>
            Enregistrer le mot de passe
          </Button>
          {defini && (
            <Button variant="light" color="red" loading={envoi} onClick={() => void retirerMotDePasse()}>
              Retirer
            </Button>
          )}
        </Group>
        {modifie && mdp && (
          <Text size="sm" c="dimmed">
            Enregistrez d’abord le réglage, puis le mot de passe.
          </Text>
        )}
      </Stack>
      <Card withBorder>
        <Stack gap="xs">
          <Title order={3} size="h5">
            Flux concernés
          </Title>
          {lignesFluxMandataire().map((g) => (
            <Stack key={g.usage} gap="xs">
              <Group gap="xs">
                <Badge variant="light" color={COULEURS_USAGE[g.usage]}>
                  {g.libelle}
                </Badge>
              </Group>
              <List size="sm" spacing="xs">
                {g.flux.map((f) => (
                  <List.Item key={f.id}>
                    <strong>{f.libelle}</strong> : {f.motif}
                  </List.Item>
                ))}
              </List>
            </Stack>
          ))}
          <Text size="sm" c="dimmed">
            Le démon Docker de l’hôte (téléchargement des images) se règle hors de la plateforme : voir le guide
            d’installation.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
