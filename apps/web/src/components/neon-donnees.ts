/** Agrégations d'affichage sur les réponses déjà autorisées ; aucune règle métier ni aucun score nouveau. */
import type { SerieNeon } from '@suivi/ui';
export interface EvenementNeon {
  ts: string;
  action: string;
}
export function journalNeon(lignes: readonly EvenementNeon[], cases = 12) {
  const dates = lignes.map((l) => ({ ...l, t: Date.parse(l.ts) })).filter((l) => Number.isFinite(l.t));
  const debut = Math.min(...dates.map((l) => l.t)),
    fin = Math.max(...dates.map((l) => l.t));
  if (!dates.length) return { series: [] as SerieNeon[], debut: '—', fin: '—' };
  const compte = new Map<string, number>();
  for (const l of dates) {
    const k = l.action.split('.')[0] || 'Autres';
    compte.set(k, (compte.get(k) ?? 0) + 1);
  }
  const groupes = [...compte]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);
  if (compte.size > 4) groupes.push('Autres');
  const series = groupes.map((libelle) => ({ libelle, valeurs: Array<number>(cases).fill(0) }));
  for (const l of dates) {
    const prefixe = l.action.split('.')[0] || 'Autres';
    const g = series.find((s) => s.libelle === (groupes.includes(prefixe) ? prefixe : 'Autres'))!;
    const i = fin === debut ? 0 : Math.min(cases - 1, Math.floor(((l.t - debut) / (fin - debut)) * cases));
    g.valeurs[i]!++;
  }
  const libelle = (t: number) =>
    new Date(t).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  return { series, debut: libelle(debut), fin: libelle(fin) };
}
export function compterMois(lignes: readonly { date: string }[]) {
  const compte = new Map<string, number>();
  for (const l of lignes) {
    if (!/^\d{4}-\d{2}/.test(l.date) || !Number.isFinite(Date.parse(l.date))) continue;
    const mois = l.date.slice(0, 7);
    compte.set(mois, (compte.get(mois) ?? 0) + 1);
  }
  return [...compte].sort(([a], [b]) => a.localeCompare(b)).map(([libelle, valeur]) => ({ libelle, valeur }));
}
