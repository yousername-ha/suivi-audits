import { Recurrence, type Recurrence as RecurrenceType } from './grc.js';
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(zone, f);
  }
  return f;
}
function parts(ms: number, zone: string) {
  return Object.fromEntries(
    formatter(zone)
      .formatToParts(new Date(ms))
      .filter((p) => ['year', 'month', 'day', 'hour', 'minute'].includes(p.type))
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', number>;
}
function stamp(y: number, m: number, d: number, h = 0, min = 0) {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  t.setUTCHours(h, min, 0, 0);
  return t.getTime();
}
/** Heure ambiguë : première occurrence. Heure inexistante : premier instant local valide suivant (max. 24 h). */
export function localDue(date: string, time: string, zone: string): string {
  const [y, m, d] = date.split('-').map(Number),
    [h, min] = time.split(':').map(Number);
  const base = stamp(y!, m!, d!, h!, min!);
  const offsets = new Set<number>();
  for (let i = -36; i <= 36; i += 6) {
    const sample = base + i * 3600000,
      p = parts(sample, zone);
    offsets.add(stamp(p.year, p.month, p.day, p.hour, p.minute) - sample);
  }
  for (let shift = 0; shift <= 1440; shift++) {
    const target = base + shift * 60000;
    const matches: number[] = [];
    for (const offset of offsets) {
      const candidate = target - offset,
        p = parts(candidate, zone);
      if (stamp(p.year, p.month, p.day, p.hour, p.minute) === target) matches.push(candidate);
    }
    if (matches.length) return new Date(Math.min(...matches)).toISOString();
  }
  throw new Error('Impossible de résoudre cette échéance dans le fuseau choisi.');
}
/** Index depuis la date d’origine : fins de mois bornées sans dérive (31 janvier → 28 février → 31 mars). */
export function recurrenceSlot(input: RecurrenceType, index: number) {
  const r = Recurrence.parse(input);
  if (!Number.isInteger(index) || index < 0 || index > 100000) throw new Error('Index de récurrence invalide.');
  if (r.count !== null && index >= r.count) return null;
  const [y, m, d] = r.start.split('-').map(Number);
  let date: Date;
  if (r.unit === 'day' || r.unit === 'week')
    date = new Date(stamp(y!, m!, d!) + index * r.interval * (r.unit === 'week' ? 7 : 1) * 86400000);
  else {
    const monthIndex = m! - 1 + index * r.interval * (r.unit === 'year' ? 12 : 1),
      year = y! + Math.floor(monthIndex / 12),
      month = ((monthIndex % 12) + 12) % 12;
    const maxDay = new Date(stamp(year, month + 2, 1) - 86400000).getUTCDate();
    date = new Date(stamp(year, month + 1, Math.min(d!, maxDay)));
  }
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) throw new Error('Échéance hors limites.');
  const day = date.toISOString().slice(0, 10);
  if (r.until !== null && day > r.until) return null;
  return { key: `${day}T${r.time}[${r.timezone}]`, local: day, dueAt: localDue(day, r.time, r.timezone) };
}
