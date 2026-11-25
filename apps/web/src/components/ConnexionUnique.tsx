/* Carte « Connexion unique (SAML) » de Configuration système > Sécurité (ADR 0114 ; décisions du RSSI du 25/11/2026) :
   métadonnées du service à recopier chez le fournisseur (entityID, adresse de retour, certificat des demandes signées),
   fournisseurs d'identité (Entra ID, Keycloak, SAML générique), état du flux « sso-saml », dernière lecture des métadonnées,
   expiration du certificat de signature, relecture et import manuel du fichier XML (secours, flux fermé). Enregistrer une
   adresse de métadonnées nouvelle ouvre le flux après la validation explicite (destination montrée). */
import {
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  LIBELLES_SSO_TYPES,
  SSO_TYPES,
  type ConnexionUniqueOut,
  type FluxExternesOut,
  type FournisseurSsoOut,
  type SsoType,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError, download, errorMessage, get } from '../api';
import {
  changerType,
  corpsFournisseur,
  etatMetadonnees,
  formulaireDepuis,
  precisionDestination,
  validationFluxRequise,
  type FormulaireFournisseur,
} from '../connexion-unique';
import { ConfirmButton, CopyCommand, ErrorAlert, fmtDate } from './common';
import { CLE_FLUX_EXTERNES } from './FluxExternes';
import { useValidationFlux } from './ValidationFlux';

export const CLE_SSO = ['admin', 'sso'];

export function ConnexionUniquePanel({ ecriture }: { ecriture: boolean }) {
  const q = useQuery({ queryKey: CLE_SSO, queryFn: () => get<ConnexionUniqueOut>('/api/admin/sso') });
  const flux = useQuery({
    queryKey: CLE_FLUX_EXTERNES,
    queryFn: () => get<FluxExternesOut>('/api/admin/flux-externes'),
  });
  const [edition, setEdition] = useState<{ f: FournisseurSsoOut | null } | null>(null);
  const etatFlux = flux.data?.modules.find((m) => m.module === 'sso-saml');
  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <Title order={2} size="h4">
            Connexion unique (SAML)
          </Title>
          {etatFlux && (
            <Badge variant="light" color={etatFlux.ouvert ? 'green' : 'gray'}>
              {etatFlux.ouvert
                ? `Flux des métadonnées ouvert${etatFlux.applique === 'ouvert' ? ', appliqué' : etatFlux.applique === 'erreur' ? ', en erreur' : ''}`
                : 'Flux des métadonnées fermé'}
            </Badge>
          )}
        </Group>
        <ErrorAlert error={q.error} />
        <Text size="sm">
          Microsoft Entra ID ou Keycloak prouvent l’identité et la double authentification ; les rôles, groupes et
          périmètres restent attribués ici. Seuls les comptes créés d’avance en « connexion unique » (Droits, comptes)
          se connectent ainsi. Un administrateur local (mot de passe et double authentification) reste toujours actif en
          secours. La déconnexion est locale.
        </Text>
        {q.data && <ServiceSaml sp={q.data.sp} />}
        {(q.data?.fournisseurs ?? []).map((f) => (
          <CarteFournisseur key={f.id} f={f} ecriture={ecriture} onModifier={() => setEdition({ f })} />
        ))}
        {q.data && !q.data.fournisseurs.length && (
          <Text size="sm" c="dimmed">
            Aucun fournisseur d’identité.
          </Text>
        )}
        {ecriture && q.data?.sp.disponible && (
          <Group>
            <Button onClick={() => setEdition({ f: null })}>Ajouter un fournisseur</Button>
          </Group>
        )}
      </Stack>
      <Modal
        opened={!!edition}
        onClose={() => setEdition(null)}
        title={edition?.f ? `Modifier « ${edition.f.libelle} »` : 'Nouveau fournisseur d’identité'}
        size="lg"
        centered
        lockScroll={false}
      >
        {edition && <EditeurFournisseur f={edition.f} onFini={() => setEdition(null)} />}
      </Modal>
    </Card>
  );
}

function ServiceSaml({ sp }: { sp: ConnexionUniqueOut['sp'] }) {
  if (!sp.disponible)
    return (
      <Alert color="orange" title="Connexion unique indisponible">
        {sp.raison}
      </Alert>
    );
  return (
    <Stack gap="xs">
      <Title order={3} size="h5">
        À déclarer chez le fournisseur
      </Title>
      <Text size="sm">
        Identifiant du service (entityID, « Identifiant » dans Entra ID, « Client ID » dans Keycloak) :
      </Text>
      <CopyCommand command={sp.entityId ?? ''} />
      {sp.certificat ? (
        <>
          <Text size="sm">
            Les demandes de connexion sont signées (RSA SHA-256). Certificat du service, valable jusqu’au{' '}
            {fmtDate(sp.certificatExpireLe)} :
          </Text>
          <CopyCommand command={sp.certificat.trim()} />
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Clé du service absente : les demandes de connexion partent sans signature.
        </Text>
      )}
    </Stack>
  );
}

function CarteFournisseur({
  f,
  ecriture,
  onModifier,
}: {
  f: FournisseurSsoOut;
  ecriture: boolean;
  onModifier: () => void;
}) {
  const qc = useQueryClient();
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const etat = etatMetadonnees(f);
  const agir = async (fn: () => Promise<unknown>) => {
    setErreur(null);
    setEnvoi(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: CLE_SSO });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const importer = (fichier: File | null) =>
    fichier &&
    void agir(async () =>
      api('POST', `/api/admin/sso/fournisseurs/${f.id}/metadonnees`, { body: { xml: await fichier.text() } }),
    );
  return (
    <Card withBorder className="sso-fournisseur" aria-label={`Fournisseur ${f.libelle}`}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>{f.libelle}</Text>
            <Badge variant="outline">{LIBELLES_SSO_TYPES[f.type]}</Badge>
          </Group>
          <Group gap="xs">
            <Badge color={f.actif ? 'green' : 'gray'} variant="light">
              {f.actif ? 'Actif' : 'Désactivé'}
            </Badge>
            <Badge color={f.pret ? 'teal' : 'gray'} variant="light">
              {f.pret ? 'Prêt' : 'Métadonnées à lire'}
            </Badge>
          </Group>
        </Group>
        <ErrorAlert error={erreur} />
        <Text size="sm" c={etat.couleur === 'gray' ? 'dimmed' : `${etat.couleur}.8`} role="status">
          {etat.texte}
        </Text>
        <Text size="sm">Identifiant attendu (entityID) : {f.entityId}</Text>
        <Text size="sm">
          Métadonnées : {f.urlMetadonnees ? `lues à ${f.urlMetadonnees}` : 'import manuel (aucune lecture automatique)'}
          {f.metadonnees.lueLe && (
            <span className="horodatage"> · dernière lecture le {fmtDate(f.metadonnees.lueLe)}</span>
          )}
        </Text>
        {f.certificatExpireLe && (
          <Text size="sm">
            Certificat de signature valable jusqu’au <span className="horodatage">{fmtDate(f.certificatExpireLe)}</span>
            {f.certificats.length > 1 ? ` (${f.certificats.length} certificats)` : ''}.
          </Text>
        )}
        <Text size="sm">Adresse de retour (ACS, « URL de réponse » dans Entra ID) :</Text>
        <CopyCommand command={f.sp.acsUrl} />
        <Text size="sm" c="dimmed">
          {f.comptes} compte(s) rattaché(s) · double authentification prouvée par{' '}
          {f.mfaSource === 'attribut' ? `l’attribut ${f.mfaAttribut}` : 'la classe du contexte (AuthnContextClassRef)'}
        </Text>
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="default"
            onClick={() => download(`/api/admin/sso/fournisseurs/${f.id}/metadonnees-sp`)}
          >
            Métadonnées du service (XML)
          </Button>
          {ecriture && (
            <>
              <Button size="compact-sm" variant="default" onClick={onModifier}>
                Modifier
              </Button>
              {f.urlMetadonnees && (
                <Button
                  size="compact-sm"
                  variant="default"
                  loading={envoi}
                  onClick={() =>
                    void agir(() => api('POST', `/api/admin/sso/fournisseurs/${f.id}/relire`, { body: {} }))
                  }
                >
                  Relire les métadonnées
                </Button>
              )}
              <FileButton onChange={importer} accept=".xml,application/xml,text/xml,application/samlmetadata+xml">
                {(props) => (
                  <Button size="compact-sm" variant="default" loading={envoi} {...props}>
                    Importer le fichier XML
                  </Button>
                )}
              </FileButton>
              {f.comptes === 0 && (
                <ConfirmButton
                  size="compact-sm"
                  variant="light"
                  message={`Supprimer le fournisseur « ${f.libelle} » ?`}
                  onConfirm={() => void agir(() => api('DELETE', `/api/admin/sso/fournisseurs/${f.id}`))}
                >
                  Supprimer
                </ConfirmButton>
              )}
            </>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

export function EditeurFournisseur({ f, onFini }: { f: FournisseurSsoOut | null; onFini: () => void }) {
  const qc = useQueryClient();
  const validation = useValidationFlux();
  const [v, setV] = useState<FormulaireFournisseur>(() => formulaireDepuis(f));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = <K extends keyof FormulaireFournisseur>(k: K, x: FormulaireFournisseur[K]) => setV({ ...v, [k]: x });
  const enregistrer = async () => {
    setErreur(null);
    const corps = corpsFournisseur(v);
    let fluxConfirme: true | undefined;
    if (validationFluxRequise(f?.urlMetadonnees ?? null, corps.urlMetadonnees)) {
      if (!(await validation.valider('sso-saml', precisionDestination(corps.urlMetadonnees!)))) return;
      fluxConfirme = true;
    }
    setEnvoi(true);
    try {
      const body = { ...corps, ...(fluxConfirme ? { fluxConfirme } : {}) };
      if (f) await api('PUT', `/api/admin/sso/fournisseurs/${f.id}`, { body, ifMatch: f.version });
      else await api('POST', '/api/admin/sso/fournisseurs', { body });
      await qc.invalidateQueries({ queryKey: CLE_SSO });
      await qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES });
      onFini();
    } catch (e) {
      setErreur(e instanceof ApiError && e.status === 412 ? `${e.message} Fermez cette fenêtre.` : errorMessage(e));
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack>
      {erreur && (
        <Alert color="red" role="alert">
          {erreur}
        </Alert>
      )}
      <Select
        label="Type de fournisseur"
        data={SSO_TYPES.map((t) => ({ value: t, label: LIBELLES_SSO_TYPES[t] }))}
        value={v.type}
        onChange={(t) => t && setV(changerType(v, t as SsoType))}
        allowDeselect={false}
      />
      <TextInput
        label="Nom affiché sur la page de connexion"
        description="Le bouton s’intitule « Se connecter avec » suivi de ce nom."
        required
        value={v.libelle}
        onChange={(e) => champ('libelle', e.currentTarget.value)}
      />
      <TextInput
        label="Identifiant du fournisseur (entityID)"
        description={
          v.type === 'entra'
            ? 'Entra ID : « Identificateur Microsoft Entra », https://sts.windows.net/<identifiant du locataire>/'
            : 'Keycloak : https://<hôte>/realms/<royaume>'
        }
        required
        value={v.entityId}
        onChange={(e) => champ('entityId', e.currentTarget.value)}
      />
      <TextInput
        label="Adresse des métadonnées (lecture automatique)"
        description={
          v.type === 'entra'
            ? 'https://login.microsoftonline.com/… (« URL des métadonnées de fédération de l’application »). Vide : import manuel du fichier XML.'
            : 'https://<hôte>/realms/<royaume>/protocol/saml/descriptor. Vide : import manuel du fichier XML.'
        }
        value={v.urlMetadonnees}
        onChange={(e) => champ('urlMetadonnees', e.currentTarget.value)}
      />
      {v.type !== 'entra' && (
        <Textarea
          label="Autorité de certification du serveur du fournisseur (facultative, PEM)"
          description="Pour un fournisseur interne dont le certificat HTTPS est émis par l’autorité de l’établissement."
          autosize
          minRows={2}
          maxRows={6}
          value={v.autoriteTls}
          onChange={(e) => champ('autoriteTls', e.currentTarget.value)}
        />
      )}
      <Select
        label="Preuve de la double authentification"
        data={[
          { value: 'attribut', label: 'Un attribut de l’assertion' },
          { value: 'authn_context', label: 'La classe du contexte d’authentification (AuthnContextClassRef)' },
        ]}
        value={v.mfaSource}
        onChange={(x) => x && champ('mfaSource', x as FormulaireFournisseur['mfaSource'])}
        allowDeselect={false}
      />
      {v.mfaSource === 'attribut' && (
        <TextInput
          label="Nom de l’attribut"
          required
          value={v.mfaAttribut}
          onChange={(e) => champ('mfaAttribut', e.currentTarget.value)}
        />
      )}
      <Textarea
        label="Valeurs acceptées (une par ligne)"
        description="Sans l’une de ces valeurs dans l’assertion, la connexion est refusée."
        autosize
        minRows={2}
        required
        value={v.mfaValeurs}
        onChange={(e) => champ('mfaValeurs', e.currentTarget.value)}
      />
      <Select
        label="Identifiant attendu des comptes"
        data={[
          { value: 'nameid', label: 'NameID de l’assertion' },
          { value: 'attribut', label: 'Un attribut nommé' },
        ]}
        value={v.rapprochement}
        onChange={(x) => x && champ('rapprochement', x as FormulaireFournisseur['rapprochement'])}
        allowDeselect={false}
      />
      {v.rapprochement === 'attribut' && (
        <TextInput
          label="Nom de l’attribut qui porte l’identifiant"
          required
          value={v.rapprochementAttribut}
          onChange={(e) => champ('rapprochementAttribut', e.currentTarget.value)}
        />
      )}
      <Switch
        label="Proposé sur la page de connexion"
        checked={v.actif}
        onChange={(e) => champ('actif', e.currentTarget.checked)}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onFini}>
          Annuler
        </Button>
        <Button loading={envoi} onClick={() => void enregistrer()}>
          Enregistrer
        </Button>
      </Group>
      {validation.fenetre}
    </Stack>
  );
}
