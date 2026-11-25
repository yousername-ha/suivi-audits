/* Jour et heure civils de Paris, fuseau de l'organisation, pour l'interface et le serveur (même résultat quel que soit le
   fuseau du navigateur ou du conteneur). Un `Date` désigne un instant : `toISOString()` en donne l'heure UTC, fausse d'une
   heure (hiver) ou de deux (été) pour « aujourd'hui » ou « maintenant » à Paris. Fondé sur `Intl.DateTimeFormat`, sans
   dépendance. */

/** Fuseau des jours et heures civils de l'organisation. */
export const FUSEAU_PARIS = 'Europe/Paris';

const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU_PARIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const parties = (d: Date): Record<string, string> => {
  if (Number.isNaN(d.getTime())) throw new RangeError('Date invalide.');
  return Object.fromEntries(FORMAT.formatToParts(d).map((p) => [p.type, p.value]));
};

/** Jour civil de Paris (AAAA-MM-JJ) de l'instant `d` (maintenant par défaut). Lève une `RangeError` si `d` est invalide. */
export function jourParis(d: Date = new Date()): string {
  const p = parties(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Date et heure civiles de Paris de l'instant `d` (maintenant par défaut), au format d'un champ « datetime-local »
    (AAAA-MM-JJThh:mm, sans fuseau). Lève une `RangeError` si `d` est invalide. */
export function maintenantLocalParis(d: Date = new Date()): string {
  const p = parties(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
