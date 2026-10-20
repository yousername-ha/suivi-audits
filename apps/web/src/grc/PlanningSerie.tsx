/* Planning d'une série de tâches récurrentes : fenêtre de réalisation, jours exclus (dates et jours de la semaine) et
   import d'un calendrier iCalendar (aperçu, puis import tout ou rien). Les règles vivent dans `@suivi/shared` : l'écran
   n'en décide aucune, le serveur les applique et les refuse. */
import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  TagsInput,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ICAL_MAX_OCTETS, validDate, type ApercuCalendrier, type Recurrence } from '@suivi/shared';
import { useState } from 'react';
import { api } from '../api';
import { ErrorAlert } from '../components/common';

const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((label, i) => ({
  value: String(i),
  label,
}));
const dateFr = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' });

export function PlanningSerie({
  smsi,
  serieId,
  version,
  recurrence,
  onChange,
  onImporte,
  readonly,
}: {
  smsi: string;
  /** Identifiant et version de la série enregistrée : l'import de calendrier agit sur la série enregistrée. */
  serieId: string | null;
  version: number | null;
  recurrence: Recurrence;
  onChange: (r: Recurrence) => void;
  /** Appelé après un import appliqué : la série a changé de version, l'éditeur doit être rechargé. */
  onImporte: () => void;
  readonly?: boolean;
}) {
  const [texte, setTexte] = useState('');
  const [apercu, setApercu] = useState<ApercuCalendrier | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const fenetre = recurrence.window ?? null;
  const jours = recurrence.excludedDays ?? [];
  const enregistree = !!serieId && version !== null;
  const lireFichier = async (f: File | null) => {
    setApercu(null);
    setErreur(null);
    if (!f) return;
    if (f.size > ICAL_MAX_OCTETS) {
      setErreur(new Error(`Fichier trop volumineux (${Math.round(ICAL_MAX_OCTETS / 1024)} Ko au plus).`));
      return;
    }
    setTexte(await f.text());
  };
  const envoyer = async (appliquer: boolean) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api<ApercuCalendrier>('POST', `/api/grc/${smsi}/series/${serieId}/calendrier`, {
        body: { ics: texte, apercu: !appliquer },
        ifMatch: appliquer ? version! : undefined,
      });
      setApercu(r);
      if (appliquer && r.applique) {
        notifications.show({ color: 'teal', message: `${r.nouveaux.length} jour(s) exclu(s) ajouté(s).` });
        onImporte();
      } else if (appliquer) notifications.show({ color: 'gray', message: 'Aucun nouveau jour : calendrier inchangé.' });
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Stack gap="sm" role="group" aria-label="Planning de la série">
      <Text fw={600}>Fenêtre de réalisation</Text>
      <Checkbox
        label="Limiter la période pendant laquelle une occurrence peut être réalisée"
        checked={!!fenetre}
        disabled={readonly}
        onChange={(e) =>
          onChange({ ...recurrence, window: e.currentTarget.checked ? { openDays: 0, closeDays: 0 } : null })
        }
      />
      {fenetre && (
        <Group grow align="flex-start">
          <NumberInput
            label="Ouverture (jours avant l’échéance)"
            min={0}
            max={365}
            allowDecimal={false}
            value={fenetre.openDays}
            disabled={readonly}
            onChange={(v) => onChange({ ...recurrence, window: { ...fenetre, openDays: Number(v) || 0 } })}
          />
          <NumberInput
            label="Clôture (jours après l’échéance)"
            min={0}
            max={365}
            allowDecimal={false}
            value={fenetre.closeDays}
            disabled={readonly}
            onChange={(v) => onChange({ ...recurrence, window: { ...fenetre, closeDays: Number(v) || 0 } })}
          />
        </Group>
      )}
      <Text fw={600}>Jours exclus</Text>
      <Text size="sm" c="dimmed">
        Une échéance qui tombe un jour exclu est reportée au prochain jour disponible ; deux échéances reportées sur le
        même jour n’en font qu’une.
      </Text>
      <MultiSelect
        label="Jours de la semaine exclus"
        data={JOURS_SEMAINE}
        value={(recurrence.excludedWeekdays ?? []).map(String)}
        disabled={readonly}
        onChange={(v) =>
          onChange({
            ...recurrence,
            excludedWeekdays: v.length < 7 ? v.map(Number) : (recurrence.excludedWeekdays ?? []),
          })
        }
      />
      <TagsInput
        label="Dates exclues (AAAA-MM-JJ)"
        description="Saisissez une date puis Entrée."
        value={jours}
        disabled={readonly}
        onChange={(v) => onChange({ ...recurrence, excludedDays: [...new Set(v.filter(validDate))].sort() })}
      />
      <Text fw={600}>Importer un calendrier iCalendar</Text>
      {!enregistree ? (
        <Alert>Enregistrez d’abord la série : l’import ajoute ses jours à la série enregistrée.</Alert>
      ) : (
        !readonly && (
          <Stack gap="xs">
            <FileInput
              label="Fichier .ics"
              accept=".ics,text/calendar"
              clearable
              onChange={(f) => void lireFichier(f)}
            />
            <Textarea
              label="Ou collez le contenu du calendrier"
              description="Les événements deviennent des jours exclus (jours fériés, fermetures). Aucune adresse distante n’est consultée."
              autosize
              minRows={3}
              maxRows={8}
              value={texte}
              onChange={(e) => {
                setTexte(e.currentTarget.value);
                setApercu(null);
              }}
            />
            <ErrorAlert error={erreur} />
            <Group>
              <Button variant="default" loading={envoi} disabled={!texte.trim()} onClick={() => void envoyer(false)}>
                Prévisualiser l’import
              </Button>
              <Button
                loading={envoi}
                disabled={!apercu || apercu.erreurs.length > 0 || apercu.nouveaux.length === 0}
                onClick={() => void envoyer(true)}
              >
                Importer ces jours
              </Button>
            </Group>
            {apercu && <ApercuImport apercu={apercu} />}
          </Stack>
        )
      )}
    </Stack>
  );
}

function ApercuImport({ apercu }: { apercu: ApercuCalendrier }) {
  return (
    <Stack gap="2xs" role="region" aria-label="Aperçu de l’import">
      {apercu.erreurs.length > 0 && (
        <Alert color="red" role="alert" title="Le fichier contient des erreurs : rien ne sera importé">
          {apercu.erreurs.map((e, i) => (
            <Text key={i} size="sm">
              Ligne {e.ligne} : {e.message}
            </Text>
          ))}
        </Alert>
      )}
      <Text size="sm">
        {apercu.nouveaux.length} nouveau(x) jour(s) à ajouter
        {apercu.nouveaux.length
          ? ` : ${apercu.nouveaux.slice(0, 12).map(dateFr).join(', ')}${apercu.nouveaux.length > 12 ? '…' : ''}`
          : ''}
        . {apercu.dejaPresents.length} déjà exclu(s). Total après import : {apercu.total}.
      </Text>
      {apercu.ignores.map((e, i) => (
        <Text key={i} size="xs" c="dimmed">
          Ligne {e.ligne} : {e.message}
        </Text>
      ))}
    </Stack>
  );
}
