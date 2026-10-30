/* Formulaire d'un événement de chronologie RETEX (date et heure, type, gravité, acteur, intitulé, description), partagé par
   la saisie du pilote, la correction d'une proposition et la page de contribution. */
import { Button, Group, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { GRAVITES_RETEX, TYPES_EVENEMENT_RETEX, type EvenementRetex } from '@suivi/shared';
import { useState } from 'react';

export type SaisieRetex = Omit<EvenementRetex, 'id' | 'source' | 'apport'>;

/** Date et heure locales courantes au format du champ « datetime-local ». */
export const maintenantLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
/** Horodatage ISO (UTC) converti en heure locale « AAAA-MM-JJThh:mm » (vide s'il est invalide). */
export const isoVersLocal = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const saisieVide = (ts: string, type = 'Détection'): SaisieRetex => ({
  ts,
  type,
  titre: '',
  description: '',
  acteur: '',
  gravite: '',
});
/** Corps envoyé à l'API : champs du formulaire, textes rognés. */
export const nettoyerSaisie = (s: SaisieRetex) => ({
  ts: s.ts,
  type: s.type,
  titre: s.titre.trim(),
  description: s.description.trim(),
  acteur: s.acteur.trim(),
  gravite: s.gravite,
});

export function FormulaireEvenementRetex({
  initial,
  libelle,
  valider,
  aideActeur,
}: {
  initial: SaisieRetex;
  libelle: string;
  /** Retourne vrai si l'enregistrement a réussi (le formulaire est alors réinitialisé par la clé du parent). */
  valider: (s: SaisieRetex) => Promise<boolean>;
  aideActeur?: string;
}) {
  const [s, setS] = useState<SaisieRetex>({ ...initial });
  const [envoi, setEnvoi] = useState(false);
  const champ = <K extends keyof SaisieRetex>(k: K, v: SaisieRetex[K]) => setS((x) => ({ ...x, [k]: v }));
  const complet = !!s.ts && !!s.titre.trim();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!complet || envoi) return;
        setEnvoi(true);
        try {
          await valider(s);
        } finally {
          setEnvoi(false);
        }
      }}
    >
      <Stack gap="sm">
        <div className="grille-formulaire">
          <div className="grille-formulaire__champs">
            <TextInput
              label="Date et heure"
              type="datetime-local"
              required
              value={s.ts}
              onChange={(e) => champ('ts', e.currentTarget.value)}
            />
            <Select
              label="Type d’événement"
              required
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
              data={[...TYPES_EVENEMENT_RETEX]}
              value={s.type}
              onChange={(v) => champ('type', v ?? 'Autre')}
            />
            <Select
              label="Gravité à ce moment"
              placeholder="Reprendre la précédente"
              clearable
              comboboxProps={{ withinPortal: true }}
              data={[...GRAVITES_RETEX]}
              value={s.gravite || null}
              onChange={(v) => champ('gravite', v ?? '')}
            />
            <TextInput
              label="Acteur"
              description={aideActeur}
              value={s.acteur}
              onChange={(e) => champ('acteur', e.currentTarget.value)}
            />
          </div>
        </div>
        <TextInput
          label="Intitulé"
          required
          placeholder="ex. Alerte EDR sur le poste de la comptabilité"
          value={s.titre}
          onChange={(e) => champ('titre', e.currentTarget.value)}
        />
        <Textarea
          label="Description"
          autosize
          minRows={2}
          value={s.description}
          onChange={(e) => champ('description', e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" disabled={!complet} loading={envoi}>
            {libelle}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
