/* Contact de crise d'un compte (ADR 0107) : section de la fiche d'un compte dans Plateforme > Utilisateurs (l'administrateur
   marque le compte, choisit le rôle de crise, la case clé et les périmètres) et carte de Mon compte (la personne ne met à
   jour que ses téléphones et sa disponibilité). Enregistrements séparés de ceux du compte, avec la version lue (If-Match).
   L'affichage suit les droits de la session ; le serveur reste seul juge. */
import { Alert, Button, Card, Checkbox, Group, MultiSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ContactCriseCompteAdminOut, ContactCriseCompteSoiOut } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError, errorMessage, get } from '../api';
import { ErrorAlert } from './common';
import { usePerimetres, type Perimetre } from './selecteurs';

const message = (e: unknown, recharger: string) =>
  e instanceof ApiError && e.status === 412 ? `${e.message} ${recharger}` : errorMessage(e);

/** Corps de l'enregistrement par l'administrateur : la fiche entière, ou le seul retrait. */
export type CorpsContactCriseAdmin =
  { actif: false } | (Omit<ContactCriseCompteAdminOut, 'version' | 'actif'> & { actif: true });

/* ---------------------------------------------------------------- Administration des comptes */
/** Section « Contact de crise » de la fiche d'un compte existant (administration:administrer). */
export function ContactCriseCompteEditeur({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const url = `/api/admin/users/${userId}/contact-crise`;
  const cle = ['admin', 'users', userId, 'contact-crise'];
  const q = useQuery({ queryKey: cle, queryFn: () => get<ContactCriseCompteAdminOut>(url) });
  const perimetres = usePerimetres();
  const d = q.data;
  return (
    <Stack gap="xs">
      <Title order={3} size="h5">
        Contact de crise
      </Title>
      <ErrorAlert error={q.error} />
      {d && (
        <FormulaireContactCriseAdmin
          key={d.version}
          fiche={d}
          perimetres={perimetres.data ?? []}
          enregistrer={async (corps) => {
            await api('PUT', url, { body: corps, ifMatch: d.version });
            await qc.invalidateQueries({ queryKey: cle });
          }}
        />
      )}
    </Stack>
  );
}

/** Formulaire de l'administrateur. Un périmètre déjà choisi que la session ne voit pas reste choisi, sans son nom. */
export function FormulaireContactCriseAdmin({
  fiche,
  perimetres,
  enregistrer,
}: {
  fiche: ContactCriseCompteAdminOut;
  perimetres: readonly Perimetre[];
  enregistrer: (corps: CorpsContactCriseAdmin) => Promise<void>;
}) {
  const [f, setF] = useState(fiche);
  const [err, setErr] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const connus = new Set(perimetres.map((p) => p.id));
  const options = [
    ...perimetres.map((p) => ({ value: p.id, label: p.name })),
    ...f.perimetres.filter((id) => !connus.has(id)).map((id) => ({ value: id, label: 'Périmètre non visible' })),
  ];
  const valider = async () => {
    setErr(null);
    setOccupe(true);
    try {
      const { version: _v, actif: _a, ...champs } = f;
      await enregistrer(f.actif ? { ...champs, actif: true } : { actif: false });
      notifications.show({
        color: 'teal',
        message: f.actif ? 'Contact de crise enregistré.' : 'Le compte n’est plus contact de crise.',
      });
    } catch (e) {
      setErr(message(e, 'Fermez cette fenêtre pour recharger.'));
    } finally {
      setOccupe(false);
    }
  };
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Le compte apparaît dans la page Contacts de crise et dans la cellule de crise, pour les personnes qui lisent les
        incidents de ses périmètres. La personne met à jour elle-même ses téléphones et sa disponibilité dans Mon
        compte.
      </Text>
      {err && (
        <Alert color="red" role="alert">
          {err}
        </Alert>
      )}
      <Checkbox
        label="Contact de crise"
        checked={f.actif}
        onChange={(e) => setF({ ...f, actif: e.currentTarget.checked })}
      />
      {f.actif && (
        <>
          <TextInput
            label="Rôle de crise"
            maxLength={200}
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.currentTarget.value })}
          />
          <TextInput
            label="Téléphone"
            type="tel"
            maxLength={100}
            value={f.telephone}
            onChange={(e) => setF({ ...f, telephone: e.currentTarget.value })}
          />
          <TextInput
            label="Téléphone 2"
            type="tel"
            maxLength={100}
            value={f.telephone2}
            onChange={(e) => setF({ ...f, telephone2: e.currentTarget.value })}
          />
          <TextInput
            label="Disponibilité"
            maxLength={200}
            value={f.disponibilite}
            onChange={(e) => setF({ ...f, disponibilite: e.currentTarget.value })}
          />
          <Checkbox
            label="Contact clé"
            description="Priorité dans la cellule de crise."
            checked={f.cle}
            onChange={(e) => setF({ ...f, cle: e.currentTarget.checked })}
          />
          <Checkbox
            label="Tous les périmètres"
            checked={f.tousPerimetres}
            onChange={(e) => setF({ ...f, tousPerimetres: e.currentTarget.checked })}
          />
          {!f.tousPerimetres && (
            <MultiSelect
              label="Périmètres"
              description="Le compte n’apparaît que dans les contacts de crise de ces périmètres."
              required
              searchable
              data={options}
              value={f.perimetres}
              onChange={(v) => setF({ ...f, perimetres: v })}
            />
          )}
        </>
      )}
      <Group justify="flex-end">
        <Button variant="default" loading={occupe} disabled={!f.actif && !fiche.actif} onClick={() => void valider()}>
          Enregistrer le contact de crise
        </Button>
      </Group>
    </Stack>
  );
}

/* ---------------------------------------------------------------- Mon compte */
/** Carte « Contact de crise » de Mon compte : rien n'est affiché si la personne n'est pas contact de crise. */
export function ContactCriseCompteCarte() {
  const qc = useQueryClient();
  const cle = ['account', 'contact-crise'];
  const q = useQuery({
    queryKey: cle,
    queryFn: () => get<ContactCriseCompteSoiOut | null>('/api/account/contact-crise'),
    retry: false,
  });
  const d = q.data;
  if (!d && !q.error) return null;
  return (
    <Card withBorder>
      <Title order={2} size="h4" mb="xs">
        Contact de crise
      </Title>
      <ErrorAlert error={q.error} />
      {d && (
        <FormulaireContactCriseSoi
          key={d.version}
          fiche={d}
          enregistrer={async (corps) => {
            await api('PATCH', '/api/account/contact-crise', { body: corps, ifMatch: d.version });
            await qc.invalidateQueries({ queryKey: cle });
          }}
        />
      )}
    </Card>
  );
}

/** Formulaire de la personne : rôle de crise, case clé et périmètres affichés sans pouvoir les modifier. */
export function FormulaireContactCriseSoi({
  fiche,
  enregistrer,
}: {
  fiche: ContactCriseCompteSoiOut;
  enregistrer: (corps: { telephone: string; telephone2: string; disponibilite: string }) => Promise<void>;
}) {
  const [f, setF] = useState({
    telephone: fiche.telephone,
    telephone2: fiche.telephone2,
    disponibilite: fiche.disponibilite,
  });
  const [err, setErr] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const autres = fiche.perimetresNonLisibles;
  const perimetres = fiche.tousPerimetres
    ? 'tous les périmètres'
    : [
        ...fiche.perimetres.map((p) => p.nom),
        ...(autres ? [`${autres} périmètre${autres > 1 ? 's' : ''} que vous ne lisez pas`] : []),
      ].join(', ');
  const valider = async () => {
    setErr(null);
    setOccupe(true);
    try {
      await enregistrer(f);
      notifications.show({ color: 'teal', message: 'Coordonnées de crise enregistrées.' });
    } catch (e) {
      setErr(message(e, 'Rechargez la page.'));
    } finally {
      setOccupe(false);
    }
  };
  return (
    <Stack className="formulaire">
      <Text size="sm" c="dimmed" className="lecture">
        Vous êtes contact de crise. Vos téléphones, votre disponibilité et l’adresse courriel de votre compte sont
        montrés aux personnes qui lisent les incidents de vos périmètres. Le rôle de crise et les périmètres sont
        choisis par un administrateur.
      </Text>
      <Text size="sm">Rôle de crise : {fiche.role || 'non précisé'}</Text>
      <Text size="sm">Périmètres : {perimetres}</Text>
      {fiche.cle && <Text size="sm">Contact clé : prioritaire dans la cellule de crise.</Text>}
      <TextInput
        label="Téléphone"
        type="tel"
        maxLength={100}
        value={f.telephone}
        onChange={(e) => setF({ ...f, telephone: e.currentTarget.value })}
      />
      <TextInput
        label="Téléphone 2"
        type="tel"
        maxLength={100}
        value={f.telephone2}
        onChange={(e) => setF({ ...f, telephone2: e.currentTarget.value })}
      />
      <TextInput
        label="Disponibilité"
        maxLength={200}
        value={f.disponibilite}
        onChange={(e) => setF({ ...f, disponibilite: e.currentTarget.value })}
      />
      {err && <Alert color="red">{err}</Alert>}
      <Button w="fit-content" loading={occupe} onClick={() => void valider()}>
        Enregistrer mes coordonnées de crise
      </Button>
    </Stack>
  );
}
