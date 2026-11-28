/* Rôles et responsabilités en style « Verre » (décisions du RSSI du 28/11/2026) : fenêtre d'un rôle (puces de
   désignation, ordre et disposition des champs du registre, lettres du rôle lues dans la matrice « Qui décide quoi », pied
   « registre — périmètre · modifié par … le … » limité aux données connues) et matrice de la page (lettres en puces,
   colonne « Contrôle » qualifiée), sans changement hors du style « Verre ». Données fictives, rendu statique sans réseau
   ni base. */
import { MantineProvider } from '@mantine/core';
import { PILOTAGE_FIELDS, type ColonneRoleRaci, type GrcObject, type MatriceDecisionsReponse } from '@suivi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatriceRaciDuRole } from '../src/pilotage/FicheRoleVerre';
import { Fields, ordonnerChamps } from '../src/pilotage/Fields';
import { GrilleRaci } from '../src/pilotage/MatriceRaci';
import { cleQuiDecideQuoi, MOTS_DECISIONS, urlQuiDecideQuoi } from '../src/pilotage/QuiDecideQuoi';
import { colonnesDecisions, contenuDecisions, controleSaisieDecisions } from '../src/pilotage/qui-decide-quoi';
import {
  ANCRE_QUI_DECIDE_QUOI,
  CHAMPS_ROLE_COURTS,
  CHAMPS_ROLE_PLEINE_LARGEUR,
  ligneRegistreRole,
  matriceDuRole,
  ORDRE_CHAMPS_ROLE,
  pucesRole,
  refRoleRaci,
} from '../src/pilotage/role-verre';

const P = '00000000-0000-4000-8000-000000000001';
const UUID = '33333333-3333-4333-8333-333333333333';
const RSSI = `object:${UUID}`;
const DG = 'legacy:roles:RL1';
const lire = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const decode = (h: string) =>
  h
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, '’')
    .replace(/&quot;/g, '"');
const texte = (h: string) =>
  decode(h)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function role(extra: Partial<GrcObject> = {}): GrcObject {
  return {
    id: UUID,
    smsiId: P,
    kind: 'governance',
    name: 'Responsable fictif de la sécurité',
    data: {},
    version: 2,
    createdAt: '2026-03-01T09:00:00.000Z',
    createdBy: 'compte-fictif',
    updatedAt: '2026-03-12T10:00:00.000Z',
    updatedBy: 'compte-fictif',
    legacyKey: null,
    legacyId: null,
    archived: false,
    ...extra,
  };
}
const ROLES: ColonneRoleRaci[] = [
  { ref: DG, libelle: 'Direction fictive', retire: false },
  { ref: RSSI, libelle: 'Responsable fictif de la sécurité', retire: false },
];
const REPONSE: MatriceDecisionsReponse = {
  matrice: {
    smsiId: P,
    decisions: [
      { id: 'risques', libelle: 'Appréciation des risques' },
      { id: 'revue', libelle: 'Revue de direction' },
      { id: 'budget', libelle: 'Budget fictif' },
      { id: 'incidents', libelle: 'Gestion des incidents' },
      { id: 'continuite', libelle: 'Plan de continuité' },
    ],
    cases: [
      { decision: 'risques', role: RSSI, lettre: 'R' },
      { decision: 'risques', role: DG, lettre: 'A' },
      { decision: 'revue', role: RSSI, lettre: 'C' },
      { decision: 'budget', role: DG, lettre: 'A' },
      { decision: 'incidents', role: RSSI, lettre: 'A' },
      { decision: 'continuite', role: RSSI, lettre: 'I' },
    ],
    version: 3,
    misAJourLe: '2026-03-12T10:00:00.000Z',
    misAJourPar: 'compte-fictif',
  },
  roles: ROLES,
  controle: [],
};

describe('en-tête et références du rôle', () => {
  it('puces « Titulaire désigné » et « Suppléant désigné », seulement si renseignés (blancs seuls : vide)', () => {
    expect(pucesRole({ holder: 'Personne fictive', deputy: 'Adjoint fictif' })).toEqual([
      'Titulaire désigné',
      'Suppléant désigné',
    ]);
    expect(pucesRole({ holder: 'Personne fictive', deputy: '   ' })).toEqual(['Titulaire désigné']);
    expect(pucesRole({ deputy: 'Adjoint fictif', holder: 3 })).toEqual(['Suppléant désigné']);
    expect(pucesRole({})).toEqual([]);
    expect(pucesRole(undefined)).toEqual([]);
  });
  it('référence du rôle dans la matrice : « object:<uuid> » ou l’identifiant du rôle repris ; rien sans fiche', () => {
    expect(refRoleRaci(role())).toBe(RSSI);
    expect(refRoleRaci({ id: DG })).toBe(DG);
    expect(refRoleRaci(null)).toBeNull();
  });
});

describe('champs du bloc « Le rôle »', () => {
  it('l’ordre du dessin reprend exactement les huit champs du registre, sans en ajouter ni en perdre', () => {
    const cles = (PILOTAGE_FIELDS.governance ?? []).map((f) => f.key);
    expect([...ORDRE_CHAMPS_ROLE].sort()).toEqual([...cles].sort());
    expect(ORDRE_CHAMPS_ROLE[0]).toBe('role');
    for (const c of [...CHAMPS_ROLE_PLEINE_LARGEUR, ...CHAMPS_ROLE_COURTS]) expect(cles).toContain(c);
  });
  it('ordonnerChamps : l’ordre demandé d’abord, puis les autres dans leur ordre ; sans ordre, la liste telle quelle', () => {
    const champs = ['a', 'b', 'c', 'd'].map((key) => ({ key }));
    expect(ordonnerChamps(champs, ['c', 'a']).map((c) => c.key)).toEqual(['c', 'a', 'b', 'd']);
    expect(ordonnerChamps(champs).map((c) => c.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(ordonnerChamps(champs, []).map((c) => c.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(ordonnerChamps(champs, ['z', 'd']).map((c) => c.key)).toEqual(['d', 'a', 'b', 'c']);
  });
  it('Fields rend les champs dans l’ordre demandé, chacun repéré par data-champ ; sans ordre, l’ordre du registre', () => {
    const rendu = (ordre?: readonly string[]) =>
      renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(
            MantineProvider,
            null,
            createElement(Fields, { kind: 'governance', data: {}, onChange: () => undefined, sources: [], ordre }),
          ),
        ),
      );
    const ordreRendu = (h: string) => [...h.matchAll(/data-champ="([^"]+)"/g)].map((m) => m[1]);
    expect(ordreRendu(rendu(ORDRE_CHAMPS_ROLE))).toEqual([...ORDRE_CHAMPS_ROLE]);
    expect(ordreRendu(rendu())).toEqual((PILOTAGE_FIELDS.governance ?? []).map((f) => f.key));
  });
});

describe('lettres du rôle dans la matrice « Qui décide quoi »', () => {
  it('une ligne par décision où le rôle a une lettre, dans l’ordre des décisions, avec le mot de la légende', () => {
    expect(matriceDuRole(REPONSE, RSSI)).toEqual({
      etat: 'lettres',
      lettres: [
        { decision: 'risques', libelle: 'Appréciation des risques', lettre: 'R', texte: 'R · réalise' },
        { decision: 'revue', libelle: 'Revue de direction', lettre: 'C', texte: 'C · consulté' },
        { decision: 'incidents', libelle: 'Gestion des incidents', lettre: 'A', texte: 'A · approuve' },
        { decision: 'continuite', libelle: 'Plan de continuité', lettre: 'I', texte: 'I · informé' },
      ],
    });
  });
  it('fiche pas encore enregistrée, aucune décision saisie, ou aucune lettre pour ce rôle', () => {
    expect(matriceDuRole(REPONSE, null)).toEqual({ etat: 'sans-fiche' });
    expect(matriceDuRole({ matrice: null }, RSSI)).toEqual({ etat: 'sans-decision' });
    expect(matriceDuRole(undefined, RSSI)).toEqual({ etat: 'sans-decision' });
    expect(matriceDuRole(REPONSE, 'legacy:roles:RL9')).toEqual({ etat: 'sans-lettre', decisions: 5 });
  });

  const bloc = (object: GrcObject | null, reponse?: MatriceDecisionsReponse) => {
    const client = new QueryClient();
    if (reponse) client.setQueryData(cleQuiDecideQuoi(P), reponse);
    return decode(
      renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            MantineProvider,
            null,
            createElement(MatriceRaciDuRole, { smsi: P, object, onVoirMatrice: () => undefined }),
          ),
        ),
      ),
    );
  };
  it('rendu : titre « Matrice RACI », une puce par lettre (data-lettre), lien vers la matrice complète', () => {
    const h = bloc(role(), REPONSE);
    expect(h).toMatch(/<h3[^>]*>Matrice RACI<\/h3>/);
    expect(h).toContain('<span class="rolev-lettre" data-lettre="R">R · réalise</span>');
    expect(h).toContain('<span class="rolev-lettre" data-lettre="A">A · approuve</span>');
    expect(h.match(/class="rolev-lettre"/g)).toHaveLength(4);
    expect(texte(h)).toContain('Appréciation des risques R · réalise');
    expect(h).not.toContain('Budget fictif');
    expect(h).toMatch(/<button[^>]*type="button"[^>]*>Voir la matrice complète<\/button>/);
  });
  it('rendu : textes courts quand rien n’est à montrer', () => {
    expect(texte(bloc(null))).toContain('une fois enregistré');
    expect(texte(bloc(role(), { matrice: null, roles: ROLES, controle: [] }))).toContain(
      'Aucune décision n’est encore saisie dans la matrice « Qui décide quoi ».',
    );
    expect(texte(bloc(role({ id: '44444444-4444-4444-8444-444444444444' }), REPONSE))).toContain(
      'Ce rôle ne porte aucune lettre dans les 5 décisions de la matrice « Qui décide quoi ».',
    );
    expect(bloc(role())).toContain('Chargement de la matrice…');
  });
  it('même requête et même cache que la matrice de la page', () => {
    expect(urlQuiDecideQuoi(P)).toBe(`/api/grc/${P}/pilotage/responsabilites/raci`);
    expect(cleQuiDecideQuoi(P)).toEqual(['grc', P, 'responsabilites-raci']);
  });
});

describe('pied de la fenêtre', () => {
  it('registre — périmètre · modifié par … le … (jour civil de Paris)', () => {
    expect(ligneRegistreRole('Périmètre fictif', role())).toBe(
      'Rôles et responsabilités — Périmètre fictif · modifié par compte-fictif le 12/03/2026',
    );
  });
  it('chaque partie seulement si la donnée existe', () => {
    // Rôle repris de l'outil de suivi : signé « Historique », sans date connue.
    const repris = role({ id: DG, updatedBy: 'Historique', updatedAt: '1970-01-01T00:00:00.000Z' });
    expect(ligneRegistreRole('Périmètre fictif', repris)).toBe('Rôles et responsabilités — Périmètre fictif');
    expect(ligneRegistreRole('Périmètre fictif', { ...repris, updatedAt: '2026-03-12T10:00:00.000Z' })).toBe(
      'Rôles et responsabilités — Périmètre fictif · modifié le 12/03/2026',
    );
    expect(ligneRegistreRole(null, role())).toBe('Rôles et responsabilités · modifié par compte-fictif le 12/03/2026');
    expect(ligneRegistreRole('  ', null)).toBe('Rôles et responsabilités');
  });
});

describe('matrice « Qui décide quoi » de la page', () => {
  const grille = (modifiable: boolean, lettresEnPuces?: boolean) => {
    const c = contenuDecisions(REPONSE.matrice, ROLES);
    return renderToStaticMarkup(
      createElement(
        MantineProvider,
        null,
        createElement(GrilleRaci, {
          label: 'Qui décide quoi : décisions et rôles',
          contenu: c,
          colonnes: colonnesDecisions(ROLES, c),
          controles: controleSaisieDecisions(c),
          modifiable,
          onChange: () => undefined,
          mots: MOTS_DECISIONS,
          taille: 'sm' as const,
          className: 'qui-decide-quoi__grille',
          lettresEnPuces,
        }),
      ),
    );
  };
  it('style « Verre », lecture : lettres en puces (data-lettre), « — » sans teinte, contrôle qualifié', () => {
    const h = grille(false, true);
    expect(h).toMatch(/<td[^>]*data-lettre="R"><span class="raci-puce" data-lettre="R">R<\/span><\/td>/);
    expect(h).toContain('<span class="raci-puce">—</span>');
    expect(h.match(/class="raci-puce" data-lettre=/g)).toHaveLength(6);
    expect(h.match(/data-controle="conforme"/g)).toHaveLength(1);
    expect(h.match(/data-controle="a-revoir"/g)).toHaveLength(4);
    expect(h).not.toContain('<select');
  });
  it('style « Verre », saisie : chaque case remplie porte sa lettre ; mêmes listes, mêmes noms de cases', () => {
    const h = grille(true, true);
    expect(h.match(/<select/g)).toHaveLength(10);
    expect(h.match(/<td[^>]*data-lettre="A"/g)).toHaveLength(3);
    expect(h).toContain('aria-label="Appréciation des risques – Responsable fictif de la sécurité"');
  });
  it('hors du style « Verre » : ni puce, ni attribut ajouté', () => {
    for (const modifiable of [true, false]) {
      const h = grille(modifiable);
      expect(h).not.toContain('raci-puce');
      expect(h).not.toContain('data-lettre');
      expect(h).not.toContain('data-controle');
    }
  });
});

describe('branchements', () => {
  it('la fenêtre d’un rôle suit le style « Verre » ; les autres fiches et les autres styles gardent leur fenêtre', () => {
    const editeur = lire('../src/pilotage/RecordEditor.tsx');
    expect(editeur).toContain("roleVerre = useMe().appearance.style === 'verre' && kind === 'governance';");
    expect(editeur).toMatch(/if \(roleVerre\)\s*return \(\s*<FicheRoleVerre/);
    expect(editeur).toContain('ordre={roleVerre ? ORDRE_CHAMPS_ROLE : undefined}');
    // Même enregistrement (If-Match), même archivage, mêmes droits : la fenêtre ne reçoit que des éléments déjà faits.
    expect(editeur).toContain('enregistrer={boutonEnregistrer}');
    expect(editeur).toContain('archiver={archivable && !archivage && boutonArchiver}');
    const fenetre = lire('../src/pilotage/FicheRoleVerre.tsx');
    expect(fenetre).toContain("classNames={{ content: 'rolev-fenetre fiche-defilement' }}");
    expect(fenetre).not.toMatch(/\bapi\(/);
  });
  it('la matrice de la page porte l’ancre du lien et ne prend les puces qu’en style « Verre »', () => {
    const page = lire('../src/pilotage/QuiDecideQuoi.tsx');
    expect(page).toContain('id={ANCRE_QUI_DECIDE_QUOI} tabIndex={-1}');
    expect(page).toContain("verre = useMe().appearance.style === 'verre'");
    expect(page).toContain('lettresEnPuces={verre}');
    expect(ANCRE_QUI_DECIDE_QUOI).toBe('qui-decide-quoi');
  });
});
