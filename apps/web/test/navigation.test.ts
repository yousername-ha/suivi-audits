/* Menu à sept familles : aucune rubrique du Pilotage perdue ni doublée, droits et adresses d'origine conservés. */
import type { Action, Module } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { deplacerDansMenu, FAMILLES, famillesVisibles, localiser, ordonnerMenu, placer } from '../src/navigation';
import { PILOTAGE_NAV } from '../src/pilotage-navigation';

const tout = () => true;
const rubriques = FAMILLES.flatMap((f) => f.destinations.flatMap((d) => d.rubriques));

/** Inventaire de référence (020-01) : famille | destination | rubrique | adresse | module | action. Toute rubrique ajoutée,
    retirée ou déplacée, ou dont le droit change, doit modifier cette table : aucune fonction ne se perd en silence. */
const INVENTAIRE = [
  'organisation|contexte|contexte|/pilotage/contexte|pilotage|lire',
  'organisation|contexte|parties|/pilotage/parties|pilotage|lire',
  'organisation|contexte|swot|/pilotage/swot|pilotage|lire',
  'organisation|contexte|pestel|/pilotage/pestel|pilotage|lire',
  'organisation|perimetres|perimetres|/pilotage/perimetres|pilotage|lire',
  'organisation|processus|processus-cartes|/pilotage/processus-cartes|pilotage|lire',
  'organisation|responsabilites|responsabilites|/pilotage/responsabilites|pilotage|lire',
  'organisation|cartographie|cartographie|/cartographie|cartographie|lire',
  'organisation|fournisseurs|fournisseurs|/pilotage/fournisseurs|fournisseurs|lire',
  'organisation|fournisseurs|criteres-fournisseurs|/pilotage/criteres-fournisseurs|fournisseurs|lire',
  'organisation|fournisseurs|fournisseurs-perimetre|/pilotage/fournisseurs-perimetre|fournisseurs|lire',
  'organisation|fournisseurs|evaluations-clausier|/pilotage/evaluations-clausier|fournisseurs|lire',
  'organisation|revues-acces|revues-acces|/pilotage/revues-acces|pilotage|lire',
  'organisation|plans|plans-calendrier|/pilotage/plans-calendrier|pilotage|lire',
  'organisation|plans|plans-planning|/pilotage/plans-planning|pilotage|lire',
  'organisation|plans|plans-formation|/pilotage/plans-formation|pilotage|lire',
  'organisation|plans|plans-sensibilisation|/pilotage/plans-sensibilisation|pilotage|lire',
  'organisation|budget|investissements|/pilotage/investissements|investissements|lire',
  'pilotage|synthese|synthese|/pilotage/synthese|pilotage|lire',
  'pilotage|parcours|parcours-iso|/pilotage/parcours-iso|pilotage|lire',
  'pilotage|parcours|parcours|/pilotage/parcours|pilotage|lire',
  'pilotage|objectifs|processus|/pilotage/processus|pilotage|lire',
  'pilotage|objectifs|objectifs|/pilotage/objectifs|pilotage|lire',
  'pilotage|objectifs|indicateurs|/pilotage/indicateurs|pilotage|lire',
  'pilotage|revues|revues|/pilotage/revues|pilotage|lire',
  'pilotage|rappels|rappels|/pilotage/rappels|pilotage|lire',
  'pilotage|rappels|configuration|/pilotage/configuration|pilotage|lire',
  'risques|risques|risques|/pilotage/risques|pilotage|lire',
  'risques|risques|opportunites|/pilotage/opportunites|pilotage|lire',
  'risques|risques|etudes|/pilotage/etudes|pilotage|lire',
  'risques|risques|carte|/pilotage/carte|cartographie|lire',
  'risques|risques|traitements|/pilotage/traitements|pilotage|lire',
  'risques|risques|scenarios|/pilotage/scenarios|pilotage|lire',
  'risques|risques|configuration-analyses|/pilotage/configuration-analyses|pilotage|lire',
  'conformite|referentiels|referentiels|/pilotage/referentiels|conformite|lire',
  'conformite|referentiels|bibliotheque|/pilotage/bibliotheque|conformite|lire',
  'conformite|referentiels|correspondances|/pilotage/correspondances|conformite|lire',
  'conformite|referentiels|rapprochements|/pilotage/rapprochements|conformite|lire',
  'conformite|referentiels|couverture|/pilotage/couverture|conformite|lire',
  'conformite|referentiels|analyser-service|/pilotage/analyser-service|conformite|lire',
  'conformite|referentiels|gap-applications|/pilotage/gap-applications|conformite|lire',
  'conformite|referentiels|correspondances-bibliotheque|/pilotage/correspondances-bibliotheque|conformite|lire',
  'conformite|applicabilite|dda-iso|/pilotage/dda-iso|audit|lire',
  'conformite|applicabilite|dda-annexe-a|/pilotage/dda-annexe-a|audit|lire',
  'conformite|applicabilite|dda-hds|/pilotage/dda-hds|audit|lire',
  'conformite|applicabilite|applicabilite|/pilotage/applicabilite|pilotage|lire',
  'conformite|applicabilite|mesures|/pilotage/mesures|audit|lire',
  'conformite|audits|audit-pronostic|/pilotage/audit-pronostic|audit|lire',
  'conformite|audits|audit-couverture|/pilotage/audit-couverture|audit|lire',
  'conformite|audits|audit-deroule|/pilotage/audit-deroule|plan_audit|lire',
  'conformite|audits|audit-planning|/pilotage/audit-planning|plan_audit|lire',
  'conformite|audits|audit-participants|/pilotage/audit-participants|plan_audit|lire',
  'conformite|audits|audits|/pilotage/audits|plan_audit|lire',
  'conformite|preuves|preuves|/pilotage/preuves|documents|lire',
  'conformite|preuves|controles|/pilotage/controles|pilotage|lire',
  'actions|amelioration|amelioration|/pilotage/amelioration|ecarts|lire',
  'actions|plan-actions|actions|/pilotage/actions|ecarts|lire',
  'actions|recurrences|recurrences|/pilotage/recurrences|ecarts|lire',
  'actions|registres|registres|/registres|-|lire',
  'resilience|continuite|bia|/pilotage/bia|pilotage|lire',
  'resilience|continuite|continuite|/pilotage/continuite|pilotage|lire',
  'resilience|continuite|exercices|/pilotage/exercices|pilotage|lire',
  'resilience|incidents|incidents-registre|/pilotage/incidents-registre|incidents|lire',
  'resilience|incidents|incidents-qualifier|/pilotage/incidents-qualifier|incidents|lire',
  'resilience|incidents|incidents-retex|/pilotage/incidents-retex|incidents|lire',
  'resilience|incidents|crise-cellule|/pilotage/crise-cellule|incidents|lire',
  'resilience|incidents|crise-contacts|/pilotage/crise-contacts|incidents|lire',
  'resilience|incidents|crise-scenarios|/pilotage/crise-scenarios|incidents|lire',
  'resilience|sauvegardes|crrc-ensemble|/pilotage/crrc-ensemble|crrc|lire',
  'resilience|sauvegardes|crrc-etablissements|/pilotage/crrc-etablissements|crrc|lire',
  'resilience|sauvegardes|crrc-offres|/pilotage/crrc-offres|crrc|lire',
  'resilience|sauvegardes|crrc-tableau|/pilotage/crrc-tableau|crrc|lire',
  'resilience|sauvegardes|crrc-ressources|/pilotage/crrc-ressources|crrc|lire',
  'resilience|sauvegardes|crrc-restaurations|/pilotage/crrc-restaurations|crrc|lire',
  'resilience|sauvegardes|crrc-alertes|/pilotage/crrc-alertes|crrc|lire',
  'resilience|sauvegardes|crrc-rapports|/pilotage/crrc-rapports|crrc|lire',
  'documents|documents|documents|/documents|documents|lire',
  'documents|echanges|imports|/pilotage/imports|import_export|lire',
  'documents|echanges|exports|/exports|import_export|exporter',
];

describe('navigation', () => {
  it('garde l’inventaire des rubriques, adresses et droits (aucune fonction perdue)', () => {
    const actuel = FAMILLES.flatMap((f) =>
      f.destinations.flatMap((d) =>
        d.rubriques.map((r) => [f.id, d.id, r.id, r.to, r.module ?? '-', r.action ?? 'lire'].join('|')),
      ),
    );
    expect(actuel).toEqual(INVENTAIRE);
  });
  it('range les sept familles dans l’ordre validé', () => {
    expect(FAMILLES.map((f) => f.label)).toEqual([
      'Organisation',
      'Pilotage',
      'Risques',
      'Conformité et audits',
      'Actions',
      'Résilience',
      'Documents',
    ]);
  });
  it('reprend chaque rubrique du Pilotage une seule fois, avec son module', () => {
    const attendu: { id: string; module: string }[] = PILOTAGE_NAV.flatMap((g) => [...g.items]);
    const trouvees = rubriques.filter((r) => r.to.startsWith('/pilotage/'));
    expect(trouvees.map((r) => r.id).sort()).toEqual(attendu.map((i) => i.id).sort());
    for (const i of attendu) expect(trouvees.find((r) => r.id === i.id)?.module).toBe(i.module);
  });
  it('n’a aucune adresse ni aucun identifiant en double', () => {
    expect(new Set(rubriques.map((r) => r.to)).size).toBe(rubriques.length);
    expect(new Set(rubriques.map((r) => r.id)).size).toBe(rubriques.length);
    const destinations = FAMILLES.flatMap((f) => f.destinations.map((d) => d.id));
    expect(new Set(destinations).size).toBe(destinations.length);
  });
  it('conserve les pages hors Pilotage et leur droit', () => {
    const par = Object.fromEntries(rubriques.map((r) => [r.to, r]));
    expect(par['/documents']).toMatchObject({ module: 'documents' });
    expect(par['/cartographie']).toMatchObject({ module: 'cartographie' });
    expect(par['/exports']).toMatchObject({ module: 'import_export', action: 'exporter' });
  });
  it('masque ce qui n’est pas lisible : destination et famille disparaissent', () => {
    const seulement = (m: Module) => (module: Module, a: Action) => module === m && a === 'lire';
    const doc = famillesVisibles(seulement('documents'));
    // « Registres et droits » est ouvert à toute personne connectée : l'accès réel est décidé par l'API.
    expect(doc.map((f) => f.famille.id)).toEqual(['conformite', 'actions', 'documents']);
    expect(doc.find((f) => f.famille.id === 'documents')?.destinations.map((d) => d.id)).toEqual(['documents']);
    expect(famillesVisibles(() => false).map((f) => f.famille.id)).toEqual(['actions']);
    expect(famillesVisibles(tout)).toHaveLength(7);
  });
  it('conserve le droit de module de chaque rubrique du menu hors registres', () => {
    for (const r of rubriques.filter((x) => x.id !== 'registres')) expect(r.module).toBeDefined();
  });
  it('la cartographie des risques demande aussi la lecture du Pilotage', () => {
    const sansPilotage = (m: Module) => m === 'cartographie';
    const risques = famillesVisibles((m) => sansPilotage(m)).find((f) => f.famille.id === 'risques');
    expect(risques).toBeUndefined();
  });
  it('localise une adresse, y compris la racine /pilotage et les sous-adresses', () => {
    expect(localiser('/pilotage')?.rubrique.id).toBe('synthese');
    expect(localiser('/pilotage/risques')?.famille.id).toBe('risques');
    expect(localiser('/pilotage/parcours-iso')?.destination.label).toBe('Parcours guidé');
    expect(
      famillesVisibles(tout)
        .find((f) => f.famille.id === 'pilotage')
        ?.destinations.find((d) => d.id === 'parcours')?.to,
    ).toBe('/pilotage/parcours-iso');
    expect(localiser('/documents/abc')?.destination.id).toBe('documents');
    expect(localiser('/cartographie/risques')?.famille.id).toBe('organisation');
    expect(localiser('/account')).toBeUndefined();
  });
  it('les Périmètres sont une destination de l’Organisation, séparée de la Synthèse', () => {
    expect(localiser('/pilotage/perimetres')).toMatchObject({
      famille: { id: 'organisation' },
      destination: { id: 'perimetres', label: 'Périmètres' },
    });
    const synthese = FAMILLES.find((f) => f.id === 'pilotage')?.destinations.find((d) => d.id === 'synthese');
    expect(synthese?.rubriques.map((r) => r.id)).toEqual(['synthese']);
  });
});

describe('ordre du menu choisi par la personne', () => {
  const ids = (ordre?: Parameters<typeof ordonnerMenu>[0]) => ordonnerMenu(ordre).map((f) => f.id);
  it('identifiants compatibles avec la préférence enregistrée', () => {
    for (const f of FAMILLES) {
      expect(f.id).toMatch(/^[a-z0-9_-]{1,40}$/);
      for (const d of f.destinations) expect(d.id).toMatch(/^[a-z0-9_-]{1,40}$/);
    }
  });
  it('sans préférence : ordre par défaut', () => {
    expect(ids()).toEqual(FAMILLES.map((f) => f.id));
    expect(ordonnerMenu({})).toEqual(FAMILLES);
  });
  it('classe selon la préférence ; un identifiant oublié suit dans l’ordre d’origine, un inconnu est ignoré', () => {
    expect(ids({ familles: ['documents', 'inconnue', 'risques'] })).toEqual([
      'documents',
      'risques',
      'organisation',
      'pilotage',
      'conformite',
      'actions',
      'resilience',
    ]);
    const org = ordonnerMenu({ destinations: { organisation: ['budget', 'contexte'] } }).find(
      (f) => f.id === 'organisation',
    );
    expect(org?.destinations.map((d) => d.id).slice(0, 3)).toEqual(['budget', 'contexte', 'perimetres']);
  });
  it('place un identifiant avant ou après une cible', () => {
    expect(placer(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'a', 'c', 'd']);
    expect(placer(['a', 'b', 'c', 'd'], 'a', 'c', true)).toEqual(['b', 'c', 'a', 'd']);
    expect(placer(['a', 'b', 'c', 'd'], 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
    expect(placer(['a', 'b'], 'a', 'x')).toEqual(['a', 'b']);
  });
  it('déplace une famille ou une destination dans sa famille, sans toucher au reste', () => {
    const o1 = deplacerDansMenu(undefined, { id: 'documents' }, 'organisation');
    expect(ids(o1)[0]).toBe('documents');
    const o2 = deplacerDansMenu(o1, { famille: 'organisation', id: 'perimetres' }, 'contexte');
    expect(o2.familles).toEqual(o1.familles);
    expect(o2.destinations?.organisation?.slice(0, 2)).toEqual(['perimetres', 'contexte']);
    // Une destination ne passe pas dans une autre famille : la cible inconnue laisse l'ordre inchangé.
    const o3 = deplacerDansMenu(o2, { famille: 'organisation', id: 'perimetres' }, 'synthese');
    expect(o3.destinations?.organisation).toEqual(o2.destinations?.organisation);
  });
  it('le menu visible suit l’ordre choisi et reste filtré selon les droits', () => {
    const ordre = { familles: ['actions', 'organisation'], destinations: { actions: ['plan-actions'] } };
    expect(famillesVisibles(tout, ordre)[0]?.famille.id).toBe('actions');
    expect(famillesVisibles(() => false, ordre).map((f) => f.famille.id)).toEqual(['actions']);
    // L'ordre ne change ni les adresses ni la famille désignée par une adresse.
    expect(localiser('/pilotage/perimetres')?.famille.id).toBe('organisation');
  });
});
