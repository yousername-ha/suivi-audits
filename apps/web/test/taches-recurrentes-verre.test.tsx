/* Tâches récurrentes, style « Verre » (dessin TachesTimeline validé par le RSSI le 27/11/2026) : vue d'ouverture, tuiles
   (séries actives, résultat attendu, en retard, tenue des échéances), total de la Timeline et ligne discrète des
   résultats, repères et règle du dessin. Calculs sur les fiches chargées ; données fictives, rendu statique. */
import { MantineProvider } from '@mantine/core';
import { businessDefaults, type GrcObject } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  anneeAffichee,
  colonneCourante,
  filetResultats,
  libelleRecap,
  recapPeriode,
  resultatsParColonne,
  syntheseOccurrences,
  syntheseSeries,
  tuilesRecurrences,
  vueParDefaut,
} from '../src/grc/taches-recurrentes';
import { CarreOccurrence, IconeLegende, PiedTemps, RegleTemps } from '../src/grc/TimelineCommun';
import { LigneResultats } from '../src/grc/TimelineOccurrences';
import { TuilesRecurrences } from '../src/grc/TuilesRecurrences';
import type { Placement } from '../src/grc/timeline-calendrier';

const html = (n: ReactNode) => renderToStaticMarkup(createElement(MantineProvider, null, n));
const decode = (h: string) => h.replace(/&#x27;/g, '’').replace(/&amp;/g, '&');
const policy = businessDefaults();
const MAINTENANT = Date.parse('2026-11-27T10:00:00Z');

const serie = (id: string, name: string, recurrence: unknown) =>
  ({ id, name, kind: 'task_series', data: { recurrence } }) as unknown as GrcObject;
let n = 0;
const occ = (seriesId: string, dueAt: string, result?: 'ok' | 'ko' | 'na', status = 'todo') =>
  ({
    id: `o${++n}`,
    name: `Occurrence fictive ${n}`,
    kind: 'action',
    data: { seriesId, dueAt, status },
    validation: result ? { result } : null,
  }) as unknown as GrcObject;

describe('vue d’ouverture', () => {
  it('en style « Verre », les tâches récurrentes et le plan d’actions s’ouvrent sur la Timeline', () => {
    expect(vueParDefaut('verre', 'list')).toBe('timeline');
  });
  it('les autres styles gardent la vue par défaut de la politique', () => {
    expect(vueParDefaut('sage', 'list')).toBe('list');
    expect(vueParDefaut('clair', 'kanban')).toBe('kanban');
  });
});

describe('tuiles', () => {
  const series = [
    serie('s1', 'Contrôle fictif des sauvegardes', { unit: 'month', interval: 1, active: true }),
    serie('s2', 'Revue fictive trimestrielle', { unit: 'month', interval: 3 }),
    serie('s3', 'Série fictive en pause', { unit: 'month', interval: 1, active: false }),
    serie('s4', 'Série fictive illisible', null),
    serie('s5', 'Revue fictive des accès', { unit: 'week', interval: 1 }),
  ];
  const items = [
    occ('s1', '2026-10-04T08:00:00Z', 'ok'),
    occ('s1', '2026-09-04T08:00:00Z', 'ko'),
    occ('s1', '2026-08-04T08:00:00Z', 'ok'),
    occ('s1', '2026-07-04T08:00:00Z', 'na'),
    occ('s1', '2025-12-04T08:00:00Z', 'ko'), // autre année : hors de la tenue 2026
    occ('s5', '2026-11-22T08:00:00Z'), // en retard, la plus ancienne
    occ('s1', '2026-11-25T08:00:00Z'), // en retard
    occ('s2', '2026-11-20T08:00:00Z', undefined, 'done'), // échue, close sans résultat : attendue, pas en retard
    occ('s1', '2026-12-04T08:00:00Z'), // à venir
  ];

  it('séries actives : réglage lisible et non en pause ; mensuelles : tous les mois', () => {
    expect(syntheseSeries(series)).toEqual({ actives: 3, mensuelles: 1 });
  });

  it('résultat attendu, retard le plus ancien, tenue des échéances sur l’année affichée', () => {
    const s = syntheseOccurrences(items, series, policy, MAINTENANT, 2026);
    expect(s.attendus).toBe(3);
    expect(s.retards).toBe(2);
    expect(s.plusEnRetard).toEqual({ nom: 'Revue fictive des accès', date: '22/11' });
    expect([s.ok, s.ko]).toEqual([2, 1]);
    expect(s.tenue).toBe(67);
    // Aucune donnée inventée : sans résultat OK ni KO dans l'année, pas de pourcentage.
    expect(syntheseOccurrences(items, series, policy, MAINTENANT, 2024).tenue).toBeNull();
  });

  it('tuiles en toutes lettres, lien entre « Résultat attendu » et « En retard » écrit', () => {
    const t = tuilesRecurrences(syntheseSeries(series), syntheseOccurrences(items, series, policy, MAINTENANT, 2026));
    expect(t.map((x) => [x.titre, x.valeur, x.detail, x.ton])).toEqual([
      ['Séries actives', '3', 'dont 1 mensuelle', 'neutre'],
      ['Résultat attendu', '3', 'échues sans résultat, dont 2 en retard', 'orange'],
      ['En retard', '2', 'Revue fictive des accès · 22/11', 'rouge'],
      ['Tenue des échéances', '67 %', '2 OK sur 3 résultats en 2026', 'vert'],
    ]);
    const vide = tuilesRecurrences(
      { actives: 0, mensuelles: 0 },
      syntheseOccurrences([], [], policy, MAINTENANT, 2026),
    );
    expect(vide.map((x) => [x.valeur, x.detail])).toEqual([
      ['0', 'aucune mensuelle'],
      ['0', 'occurrences échues sans résultat'],
      ['0', 'aucune échéance dépassée'],
      ['—', 'aucun résultat OK ou KO en 2026'],
    ]);
  });

  it('année affichée : début de période choisi, sinon l’année en cours', () => {
    expect(anneeAffichee('2025-01-01', MAINTENANT)).toBe(2025);
    expect(anneeAffichee('', MAINTENANT)).toBe(2026);
    expect(anneeAffichee('illisible', MAINTENANT)).toBe(2026);
  });

  it('rendu : une liste nommée, chaque tuile lue en une phrase ; données partielles signalées', () => {
    const t = tuilesRecurrences(syntheseSeries(series), syntheseOccurrences(items, series, policy, MAINTENANT, 2026));
    const h = decode(html(<TuilesRecurrences tuiles={t} partiel />));
    expect(h).toContain('aria-label="Synthèse des tâches récurrentes"');
    expect(h).toMatch(/data-tuile="tenue" data-sens="vert">.*Tenue des échéances.*67 %.*2 OK sur 3 résultats en 2026/);
    expect(h).toContain('Calculé sur les fiches chargées');
    expect(html(<TuilesRecurrences tuiles={t} />)).not.toContain('Calculé sur les fiches chargées');
  });
});

describe('total et résultats de la Timeline', () => {
  const colonnes = [
    { debut: Date.UTC(2026, 9, 1), fin: Date.UTC(2026, 10, 1), libelle: 'oct. 26', court: 'oct.' },
    { debut: Date.UTC(2026, 10, 1), fin: Date.UTC(2026, 11, 1), libelle: 'nov. 26', court: 'nov.' },
    { debut: Date.UTC(2026, 11, 1), fin: Date.UTC(2027, 0, 1), libelle: 'déc. 26', court: 'déc.' },
  ];
  const place = (o: GrcObject): Placement => {
    const t = Math.floor(Date.parse(String(o.data.dueAt)) / 86_400_000) * 86_400_000;
    return { objet: o, debut: t, fin: t };
  };
  const visibles = [
    occ('s1', '2026-10-04T08:00:00Z', 'ok'),
    occ('s2', '2026-10-10T08:00:00Z', 'ok'),
    occ('s3', '2026-10-20T08:00:00Z', 'ko'),
    occ('s1', '2026-11-04T08:00:00Z', 'na'),
    occ('s2', '2026-11-22T08:00:00Z'),
    occ('s1', '2026-12-04T08:00:00Z'),
  ].map(place);

  it('récapitulatif : total, faites (OK, KO, NA), à venir ou attendues, en retard', () => {
    const r = recapPeriode(visibles, policy, MAINTENANT);
    expect(r).toEqual({ total: 6, faites: 4, ok: 2, ko: 1, na: 1, retards: 1, aVenir: 1 });
    expect(libelleRecap(r, true)).toBe(
      '6 sur l’année · 4 faites (2 OK, 1 KO, 1 NA) · 1 à venir ou attendue · 1 en retard',
    );
    expect(libelleRecap({ ...r, retards: 0, aVenir: 8, faites: 1 }, false)).toBe(
      '6 sur la période · 1 faite (2 OK, 1 KO, 1 NA) · 8 à venir ou attendues',
    );
  });

  it('résultats par période : OK et KO seulement ; filet proportionnel ; colonne courante', () => {
    const r = resultatsParColonne(colonnes, visibles);
    expect(r).toEqual([
      { ok: 2, ko: 1 },
      { ok: 0, ko: 0 },
      { ok: 0, ko: 0 },
    ]);
    expect(filetResultats({ ok: 6, ko: 2 }, 32)).toEqual({ ok: 24, ko: 8 });
    expect(filetResultats({ ok: 0, ko: 0 }, 32)).toEqual({ ok: 0, ko: 0 });
    expect(colonneCourante(colonnes, MAINTENANT)).toBe(1);
    expect(colonneCourante(colonnes, Date.UTC(2030, 0, 1))).toBe(-1);
  });

  it('ligne discrète des résultats : nombres en petit, « · » sans résultat, nom accessible complet', () => {
    const x = (t: number) => ((t - colonnes[0]!.debut) / (colonnes[2]!.fin - colonnes[0]!.debut)) * 300;
    const h = decode(
      html(
        <LigneResultats
          colonnes={colonnes}
          resultats={[
            { ok: 6, ko: 1 },
            { ok: 3, ko: 0 },
            { ok: 0, ko: 0 },
          ]}
          x={x}
          largeur={300}
        />,
      ),
    );
    expect(h).toContain(
      'aria-label="Résultats du mois : oct. 26, 6 OK, 1 KO · nov. 26, 3 OK, 0 KO · déc. 26, aucun résultat"',
    );
    expect(h).toContain('role="img"');
    expect(h).toMatch(
      /frise-resultats__nb-ok">6<\/tspan><tspan class="frise-resultats__sep"> · <\/tspan><tspan class="frise-resultats__nb-ko">1/,
    );
    // Sans KO : le seul nombre des OK ; sans résultat : un point grisé, sans filet.
    expect(h).toMatch(/frise-resultats__nb-ok">3<\/tspan><\/text>/);
    expect(h.match(/class="frise-resultats__ko"/g)).toHaveLength(1);
    expect(h).toMatch(/class="frise-resultats__sep">·<\/text>/);
    expect(h).not.toMatch(/style=/);
  });

  it('pied : période courante mise en évidence, pastilles plus grandes en Verre', () => {
    const x = (t: number) => ((t - colonnes[0]!.debut) / (colonnes[2]!.fin - colonnes[0]!.debut)) * 600;
    const h = html(
      <PiedTemps
        titre="Occurrences du mois"
        colonnes={colonnes}
        comptes={[3, 4, 0]}
        x={x}
        largeur={600}
        hauteur={50}
        courante={1}
        verre
      />,
    );
    expect(h).toContain('aria-label="Occurrences par période : oct. 26, 3 · nov. 26, 4 · déc. 26, 0"');
    expect(h).toContain('class="frise-nb frise-nb--courant"');
    expect(h).toContain('height="26"');
    // Hors du style « Verre » : rendu inchangé.
    const sobre = html(
      <PiedTemps
        titre="Occurrences du mois"
        colonnes={colonnes}
        comptes={[3, 4, 0]}
        x={x}
        largeur={600}
        hauteur={38}
      />,
    );
    expect(sobre).not.toContain('frise-nb--courant');
    expect(sobre).toContain('height="16"');
  });
});

describe('repères et règle du dessin', () => {
  it('chaque état a son carré arrondi et sa classe ; la lueur reste réservée au retard', () => {
    for (const etat of ['ok', 'ko', 'na', 'attendu', 'retard', 'avenir'] as const) {
      const h = html(
        <svg>
          <CarreOccurrence cx={10} cy={10} etat={etat} verre />
        </svg>,
      );
      expect(h).toContain(`frise-v frise-v--${etat}`);
      expect(h.includes('frise-lueur')).toBe(etat === 'retard');
    }
    expect(html(<IconeLegende etat="attendu" verre />)).toContain('frise-v__point');
    // Les autres styles gardent les icônes du 20/11/2026.
    expect(html(<IconeLegende etat="ok" />)).toContain('frise-icone__corps');
  });

  it('règle : période courante en gélule, trait d’aujourd’hui sans étiquette', () => {
    const colonnes = [
      { debut: Date.UTC(2026, 9, 1), fin: Date.UTC(2026, 10, 1), libelle: 'oct. 26', court: 'oct.' },
      { debut: Date.UTC(2026, 10, 1), fin: Date.UTC(2026, 11, 1), libelle: 'nov. 26', court: 'nov.' },
    ];
    const x = (t: number) => ((t - colonnes[0]!.debut) / (colonnes[1]!.fin - colonnes[0]!.debut)) * 800;
    const h = decode(
      html(<RegleTemps colonnes={colonnes} x={x} largeur={800} hauteur={46} aujourdhui={MAINTENANT} verre />),
    );
    expect(h).toMatch(/frise-regle__colonne--courante"><line[^>]*><\/line><rect class="frise-regle__gelule"/);
    expect(h.match(/frise-regle__gelule/g)).toHaveLength(1);
    expect(h).toContain('grc-timeline__aujourdhui');
    expect(h).not.toContain('Aujourd’hui');
    const sobre = decode(
      html(<RegleTemps colonnes={colonnes} x={x} largeur={800} hauteur={46} aujourdhui={MAINTENANT} />),
    );
    expect(sobre).toContain('Aujourd’hui');
    expect(sobre).not.toContain('frise-regle__gelule');
  });
});
