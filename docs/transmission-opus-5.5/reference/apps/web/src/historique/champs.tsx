/* Champs à validation à la sortie du champ, pour les écrans des modules repris de l'outil de suivi : la valeur est
   enregistrée quand le champ perd le focus (comme l'enregistrement au fil de la saisie de l'outil historique) et le
   champ se réinitialise si la valeur enregistrée change ailleurs. */
import { Select, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';

interface Base {
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  value: string;
  onCommit: (v: string) => void;
  /** Valeur vide refusée (le champ revient à la valeur enregistrée). */
  requis?: boolean;
}

export function ChampTexte({
  label,
  ariaLabel,
  disabled,
  placeholder,
  value,
  onCommit,
  requis,
  type,
}: Base & { type?: string }) {
  return (
    <TextInput
      key={value}
      label={label}
      aria-label={ariaLabel}
      type={type}
      disabled={disabled}
      placeholder={placeholder}
      defaultValue={value}
      onBlur={(e) => {
        const v =
          type === 'date' || type === 'month' || type === 'time' ? e.currentTarget.value : e.currentTarget.value.trim();
        if (v === value) return;
        if (requis && !v) {
          e.currentTarget.value = value;
          return;
        }
        onCommit(v);
      }}
    />
  );
}

export function ChampZone({
  label,
  ariaLabel,
  disabled,
  placeholder,
  value,
  onCommit,
  lignes = 2,
}: Base & { lignes?: number }) {
  return (
    <Textarea
      key={value}
      label={label}
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      autosize
      minRows={lignes}
      defaultValue={value}
      onBlur={(e) => {
        if (e.currentTarget.value.trim() !== value) onCommit(e.currentTarget.value.trim());
      }}
    />
  );
}

export function ChampChoix({
  label,
  ariaLabel,
  disabled,
  value,
  options,
  onCommit,
  effacable,
  placeholder,
}: {
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onCommit: (v: string) => void;
  effacable?: boolean;
  placeholder?: string;
}) {
  const donnees = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  if (value && !donnees.some((o) => o.value === value)) donnees.push({ value, label: value });
  return (
    <Select
      label={label}
      aria-label={ariaLabel}
      disabled={disabled}
      allowDeselect={!!effacable}
      clearable={!!effacable}
      placeholder={placeholder}
      data={donnees}
      value={value || null}
      onChange={(v) => onCommit(v ?? '')}
    />
  );
}

/** Lecture et écriture d'un module repris : requête de la vue, appel d'écriture qui rafraîchit la vue. */
export function useModule<T>(cle: string, url: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [cle], queryFn: () => get<T>(url) });
  const [erreur, setErreur] = useState<unknown>(null);
  const agir = async <R,>(methode: string, chemin: string, corps?: unknown): Promise<R | undefined> => {
    try {
      setErreur(null);
      const r = await api<R>(methode, chemin, corps === undefined ? {} : { body: corps });
      await qc.invalidateQueries({ queryKey: [cle] });
      await qc.invalidateQueries({ queryKey: ['synthese'] });
      return r;
    } catch (e) {
      setErreur(e);
      return undefined;
    }
  };
  return { q, d: q.data, agir, erreur: q.error ?? erreur, effacerErreur: () => setErreur(null) };
}
