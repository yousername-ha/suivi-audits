/* Fréquence de synchronisation (ADR 0100, lot F1) : liste déroulante native sur une liste fermée d'heures, et avertissement
   éventuel relié au champ par aria-describedby (texte « Attention : … », jamais la couleur seule). Sans état ni appel réseau :
   l'appelant décide quand enregistrer ; le serveur reste seul juge de la liste (422 hors liste). Sous la CSP stricte
   (ADR 0006) : composants de la charte, aucun style en ligne. */
import { NativeSelect, Text } from '@mantine/core';
import { libelleFrequence } from '@suivi/shared';

export function ChampFrequence({
  label,
  ariaLabel,
  frequences,
  valeur,
  onChange,
  avertissement,
  disabled = false,
  size = 'sm',
  libelle = libelleFrequence,
}: {
  /** Libellé visible ; sinon `ariaLabel` (cellule d'un tableau dont l'en-tête nomme la colonne). */
  label?: string;
  ariaLabel?: string;
  frequences: readonly number[];
  valeur: number;
  onChange: (heures: number) => void;
  avertissement: string | null;
  disabled?: boolean;
  size?: 'xs' | 'sm';
  /** Libellé d'une valeur (heures par défaut ; lot CVE-INC : minutes pour les sources facultatives de la veille). */
  libelle?: (valeur: number) => string;
}) {
  return (
    <NativeSelect
      size={size}
      label={label}
      aria-label={label ? undefined : ariaLabel}
      // Avertissement en description du champ : Mantine le relie au champ par aria-describedby, sous la liste.
      description={
        avertissement ? (
          <Text span size="xs" className="champ-frequence-avertissement">
            <strong>Attention :</strong> {avertissement}
          </Text>
        ) : undefined
      }
      // Un avertissement n'est jamais replié derrière le bouton d'aide des fiches.
      descriptionProps={{ 'data-aide-permanente': true }}
      inputWrapperOrder={['label', 'input', 'description']}
      value={String(valeur)}
      disabled={disabled}
      data={frequences.map((h) => ({ value: String(h), label: libelle(h) }))}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
    />
  );
}
