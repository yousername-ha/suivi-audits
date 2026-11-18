/* Lot PC4 (ADR 0100, point 19) : décodage du vecteur CVSS (v3.0, v3.1, v3 sans préfixe, v4.0), traduction en clair avec
   une icône par métrique, phrase composée, règle des sources pour le vecteur retenu, schéma, marques et présence. Données
   fictives seulement. */
import { describe, expect, it } from 'vitest';
import {
  conditionsTraduites,
  decoderVecteurCvss,
  impactsTraduits,
  libellePresence,
  libelleSourceVecteur,
  libelleVersionsNvd,
  marquesFaille,
  ParamsFicheFaille,
  phraseVecteur,
  schemaVecteur,
  vecteurRetenu,
  type VecteurPublieDto,
} from '../src/fiche-faille-vulnerabilites.js';

const V31_RESEAU = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
const V31_LOCAL = 'CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:C/C:L/I:N/A:L';
const V40 = 'CVSS:4.0/AV:A/AC:L/AT:P/PR:L/UI:P/VC:H/VI:L/VA:N/SC:L/SI:N/SA:N';

describe('décodage du vecteur CVSS', () => {
  it.each([
    [V31_RESEAU, { version: '3.1', acces: 'N', complexite: 'L', privileges: 'N', interaction: 'N', portee: 'U' }],
    [V31_LOCAL, { version: '3.1', acces: 'L', complexite: 'H', privileges: 'H', interaction: 'R', portee: 'C' }],
    ['CVSS:3.0/AV:P/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H', { version: '3.0', acces: 'P', privileges: 'L' }],
    // Forme de Tenable : sans préfixe ; métriques de la v3, version mineure non précisée.
    ['AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H', { version: '3', acces: 'N', privileges: 'H', portee: 'C' }],
    // Métriques temporelles et environnementales admises, sans effet sur la traduction (base seulement).
    [`${V31_RESEAU}/E:F/RL:O/RC:C/CR:H/MAV:L/MC:N`, { version: '3.1', acces: 'N' }],
    [V40, { version: '4.0', acces: 'A', conditions: 'P', privileges: 'L', interaction: 'P', portee: null }],
    [`${V40}/E:A/MSI:S/U:Amber/AU:Y`, { version: '4.0', acces: 'A' }],
  ])('%s', (brut, attendu) => {
    const v = decoderVecteurCvss(brut);
    expect(v).not.toBeNull();
    expect(v).toMatchObject({ brut, ...attendu });
  });

  it('impacts : C, I, A en v3 ; système vulnérable et systèmes en aval en v4.0', () => {
    expect(decoderVecteurCvss(V31_LOCAL)).toMatchObject({ impacts: { c: 'L', i: 'N', a: 'L' }, impactsAval: null });
    expect(decoderVecteurCvss(V40)).toMatchObject({
      impacts: { c: 'H', i: 'L', a: 'N' },
      impactsAval: { c: 'L', i: 'N', a: 'N' },
      portee: null,
    });
  });

  it.each([
    ['vide', ''],
    ['null', null],
    ['indéfini', undefined],
    ['préfixe seul', 'CVSS:3.1/'],
    ['version inconnue', 'CVSS:2.0/AV:N/AC:L/Au:N/C:P/I:P/A:P'],
    ['version 5.0', 'CVSS:5.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N'],
    ['CVSS v2 sans préfixe', 'AV:N/AC:L/Au:N/C:P/I:P/A:P'],
    ['métrique de base absente (S)', 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/C:H/I:H/A:H'],
    ['métrique en double', 'CVSS:3.1/AV:N/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'],
    ['valeur inconnue', 'CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'],
    ['métrique inconnue', `${V31_RESEAU}/ZZ:H`],
    ['métrique de la v4.0 dans une v3.1', `${V31_RESEAU}/AT:N`],
    ['v4.0 avec la portée de la v3', 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/S:U/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N'],
    ['v4.0 incomplète', 'CVSS:4.0/AV:N/AC:L/PR:N/UI:N/VC:H/VI:H/VA:H'],
    ['UI:P dans une v3.1', 'CVSS:3.1/AV:N/AC:L/PR:N/UI:P/S:U/C:H/I:H/A:H'],
    ['minuscules', 'cvss:3.1/av:n/ac:l/pr:n/ui:n/s:u/c:h/i:h/a:h'],
    ['barre finale', `${V31_RESEAU}/`],
    ['espaces', ` ${V31_RESEAU}`],
    ['séparateur inattendu', 'CVSS:3.1/AV:N,AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'],
    ['balisage', 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:<script>'],
    ['trop long', `${V31_RESEAU}${'/E:X'.repeat(100)}`],
    ['prototype', 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/__proto__:H'],
  ])('illisible (%s) : null, jamais une traduction devinée', (_nom, brut) => {
    expect(decoderVecteurCvss(brut as string | null | undefined)).toBeNull();
  });
});

describe('traduction en clair', () => {
  it('termes techniques exacts et traduction, une icône par métrique (v3.1, réseau sans privilège)', () => {
    const v = decoderVecteurCvss(V31_RESEAU)!;
    expect(conditionsTraduites(v).map((m) => [m.code, m.terme, m.clair, m.icone, m.force])).toEqual([
      [
        'AV',
        'Vecteur d’accès : réseau',
        'Attaque possible à distance, par le réseau (Internet compris)',
        'reseau',
        'fort',
      ],
      ['AC', 'Complexité de l’attaque : faible', 'Simple à réaliser', 'simple', 'fort'],
      ['PR', 'Privilèges requis : aucun', 'Aucun compte nécessaire', 'sans-compte', 'fort'],
      ['UI', 'Interaction de l’utilisateur : aucune', 'Sans action de la victime', 'sans-victime', 'fort'],
      ['S', 'Portée : inchangée', 'L’effet reste dans le composant vulnérable', 'portee', 'faible'],
    ]);
    expect(impactsTraduits(v).cible.map((m) => [m.code, m.terme, m.clair, m.icone])).toEqual([
      ['C', 'Impact sur la confidentialité : élevé', 'Lecture de toutes les données', 'confidentialite'],
      ['I', 'Impact sur l’intégrité : élevé', 'Modification de toutes les données', 'integrite'],
      ['A', 'Impact sur la disponibilité : élevé', 'Arrêt complet du service', 'disponibilite'],
    ]);
    expect(impactsTraduits(v).aval).toEqual([]);
    expect(phraseVecteur(v)).toBe(
      'Un attaquant peut agir à distance, par le réseau (Internet compris), sans compte et sans action d’un utilisateur, par une attaque simple. Sur le composant vulnérable, il peut lire toutes les données, modifier toutes les données et arrêter le service.',
    );
  });

  it('vecteur local avec privilèges élevés, portée modifiée', () => {
    const v = decoderVecteurCvss(V31_LOCAL)!;
    expect(conditionsTraduites(v).map((m) => m.terme)).toEqual([
      'Vecteur d’accès : local',
      'Complexité de l’attaque : élevée',
      'Privilèges requis : élevés',
      'Interaction de l’utilisateur : requise',
      'Portée : modifiée',
    ]);
    expect(conditionsTraduites(v).find((m) => m.code === 'PR')?.clair).toBe(
      'Compte à privilèges élevés nécessaire (administrateur)',
    );
    expect(phraseVecteur(v)).toBe(
      'Un attaquant peut agir avec un accès local à la machine, avec un compte à privilèges élevés et si un utilisateur agit, par une attaque difficile à réaliser. Sur le composant vulnérable, il peut lire une partie des données et ralentir ou interrompre en partie le service, et l’effet déborde sur d’autres composants.',
    );
  });

  it('v4.0 : conditions préalables, interaction passive, systèmes en aval', () => {
    const v = decoderVecteurCvss(V40)!;
    expect(conditionsTraduites(v).map((m) => m.terme)).toEqual([
      'Vecteur d’accès : réseau adjacent',
      'Complexité de l’attaque : faible',
      'Conditions préalables de l’attaque : présentes',
      'Privilèges requis : faibles',
      'Interaction de l’utilisateur : passive',
    ]);
    const i = impactsTraduits(v);
    expect(i.cible.map((m) => `${m.code}:${m.valeur} ${m.terme}`)).toEqual([
      'VC:H Impact sur la confidentialité du système vulnérable : élevé',
      'VI:L Impact sur l’intégrité du système vulnérable : faible',
      'VA:N Impact sur la disponibilité du système vulnérable : aucun',
    ]);
    expect(i.aval.map((m) => `${m.code}:${m.valeur}`)).toEqual(['SC:L', 'SI:N', 'SA:N']);
    expect(phraseVecteur(v)).toBe(
      'Un attaquant peut agir depuis un réseau adjacent, avec un compte ordinaire et si un utilisateur agit, même sans le vouloir, par une attaque simple, sous des conditions préalables propres à la cible. Sur le système vulnérable, il peut lire toutes les données et modifier une partie des données. Sur les systèmes en aval, il peut lire une partie des données.',
    );
  });

  it('aucun effet publié : dit tel quel', () => {
    const v = decoderVecteurCvss('CVSS:3.1/AV:P/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N')!;
    expect(phraseVecteur(v)).toContain(
      'Aucun effet publié sur la confidentialité, l’intégrité ni la disponibilité du composant vulnérable.',
    );
  });
});

describe('règle des sources pour le vecteur', () => {
  const nvd31: VecteurPublieDto = { source: 'nvd', cve: 'CVE-2026-90001', brut: V31_LOCAL, score: 5.2 };
  const nvd40: VecteurPublieDto = { source: 'nvd', cve: 'CVE-2026-90001', brut: V40, score: 5.2 };
  const tenable: VecteurPublieDto = {
    source: 'tenable',
    cve: null,
    brut: 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    score: 9.8,
  };
  it('le score le plus sévère parle ; les autres vecteurs lisibles sont gardés à part', () => {
    const r = vecteurRetenu([nvd31, tenable]);
    expect(r.retenu?.publie).toEqual(tenable);
    expect(r.autres.map((x) => x.publie)).toEqual([nvd31]);
    expect(libelleSourceVecteur(r.retenu!, 2)).toBe(
      'Vecteur retenu : Tenable, CVSS v3 (version mineure non précisée par la source), score 9,8 : le plus sévère des vecteurs publiés (règle des sources).',
    );
  });
  it('à score égal : NVD avant Tenable, la v4.0 avant la v3.1', () => {
    expect(vecteurRetenu([{ ...tenable, score: 5.2 }, nvd31, nvd40]).retenu?.publie).toEqual(nvd40);
    expect(
      vecteurRetenu([
        { ...tenable, score: null },
        { ...nvd31, score: null },
      ]).retenu?.publie.source,
    ).toBe('nvd');
    expect(libelleSourceVecteur(vecteurRetenu([nvd31]).retenu!, 1)).toBe(
      'Vecteur retenu : NVD (CVE-2026-90001), CVSS v3.1, score 5,2 : seul vecteur publié.',
    );
  });
  it('vecteur illisible : jamais retenu, seulement compté ; aucun vecteur : non communiqué', () => {
    const r = vecteurRetenu([{ ...tenable, brut: 'AV:N/AC:L/Au:N/C:P/I:P/A:P', score: 10 }, nvd31]);
    expect(r.retenu?.publie).toEqual(nvd31);
    expect(r.illisibles).toBe(1);
    expect(vecteurRetenu([])).toEqual({ retenu: null, autres: [], illisibles: 0 });
    expect(vecteurRetenu([{ ...nvd31, brut: 'n/a' }])).toEqual({ retenu: null, autres: [], illisibles: 1 });
  });
});

describe('schéma, présence et marques', () => {
  it('présence : nombres lus seulement, drapeau sans nombre pour le reste', () => {
    expect(libellePresence({ machines: 3, actifs: 1, horsLecture: false })).toBe(
      '3 machines et 1 actif exposé que vous lisez',
    );
    expect(libellePresence({ machines: 0, actifs: 0, horsLecture: true })).toBe(
      'Aucune machine ni aucun actif exposé que vous lisez ; touche aussi des éléments que vous ne lisez pas',
    );
    expect(libellePresence({ machines: null, actifs: 2, horsLecture: false })).toBe('2 actifs exposés que vous lisez');
  });
  it('schéma : quatre étapes libellées, nom accessible en une phrase', () => {
    const s = schemaVecteur(decoderVecteurCvss(V31_RESEAU)!, 'PHP 8.3', { machines: 1, actifs: 0, horsLecture: true });
    expect(s.origine).toMatchObject({ libelle: 'Internet ou tout réseau', detail: 'AV:N', force: 'fort' });
    expect([s.origine, ...s.prerequis, s.composant, ...s.effets].map((x) => x.icone)).toEqual([
      'reseau',
      'sans-compte',
      'sans-victime',
      'simple',
      'composant',
      'confidentialite',
      'integrite',
      'disponibilite',
    ]);
    expect(s.prerequis.map((x) => [x.libelle, x.detail])).toEqual([
      ['Aucun compte', 'PR:N'],
      ['Sans action d’une personne', 'UI:N'],
      ['Attaque simple', 'AC:L'],
    ]);
    expect(s.composant).toMatchObject({
      libelle: 'PHP 8.3',
      detail: '1 machine que vous lisez ; touche aussi des éléments que vous ne lisez pas',
    });
    expect(s.effets.map((e) => `${e.titre} ${e.libelle}`)).toEqual([
      'Confidentialité élevé',
      'Intégrité élevé',
      'Disponibilité élevé',
    ]);
    expect(s.nom).toBe(
      'Schéma du vecteur d’attaque : attaque depuis internet ou tout réseau ; il faut à l’attaquant : aucun compte, sans action d’une personne, attaque simple ; composant touché : PHP 8.3 (1 machine que vous lisez ; touche aussi des éléments que vous ne lisez pas) ; effet : confidentialité élevé, intégrité élevé, disponibilité élevé.',
    );
    const v4 = schemaVecteur(decoderVecteurCvss(V40)!, null, { machines: 0, actifs: 0, horsLecture: false });
    expect(v4.origine.libelle).toBe('Réseau adjacent');
    expect(v4.prerequis.map((x) => x.detail)).toEqual(['PR:L', 'UI:P', 'AC:L', 'AT:P']);
    expect(v4.composant.libelle).toBe('Composant touché');
    expect(v4.effets.map((e) => e.detail)).toEqual(['VC:H', 'VI:L', 'VA:N']);
  });
  it('marques : zero-day si présente et exploitée ; exploitable sans exploitation avérée', () => {
    const exploitee = { exploitation: [{ source: 'kev' as const, le: null }], exploitable: [] };
    const preuve = { exploitation: [], exploitable: [{ source: 'tenable' as const, le: null }] };
    expect(marquesFaille(exploitee, true)).toEqual({ zeroDay: true, exploitable: false });
    expect(marquesFaille({ ...exploitee, exploitable: preuve.exploitable }, true)).toEqual({
      zeroDay: true,
      exploitable: false,
    });
    expect(marquesFaille(preuve, true)).toEqual({ zeroDay: false, exploitable: true });
    expect(marquesFaille(exploitee, false)).toEqual({ zeroDay: false, exploitable: false });
    expect(marquesFaille(preuve, false)).toEqual({ zeroDay: false, exploitable: false });
  });
  it('versions touchées selon NVD : bornes telles que publiées', () => {
    const base = {
      cve: 'CVE-2026-90001',
      editeur: 'php',
      produit: 'php',
      version: null,
      debutInclus: '8.3.0',
      debutExclus: null,
      finInclus: null,
      finExclus: '8.3.29',
    };
    expect(libelleVersionsNvd(base)).toBe(
      'php php : versions touchées à partir de 8.3.0, avant 8.3.29 (8.3.29 n’est plus citée comme touchée)',
    );
    expect(libelleVersionsNvd({ ...base, debutInclus: null, finExclus: null, finInclus: '2.4' })).toBe(
      'php php : versions touchées jusqu’à 2.4 incluse',
    );
  });
  it('paramètres de la route : CVE pour la veille, identifiant interne sinon', () => {
    const u = '00000000-0000-4000-8000-000000000001';
    expect(ParamsFicheFaille.safeParse({ nature: 'cve', id: 'CVE-2026-90001' }).success).toBe(true);
    expect(ParamsFicheFaille.safeParse({ nature: 'cve', id: u }).success).toBe(false);
    expect(ParamsFicheFaille.safeParse({ nature: 'constat', id: u }).success).toBe(true);
    expect(ParamsFicheFaille.safeParse({ nature: 'constat', id: 'CVE-2026-90001' }).success).toBe(false);
    expect(ParamsFicheFaille.safeParse({ nature: 'machine', id: u }).success).toBe(false);
  });
});
