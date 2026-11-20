/* Fenêtres : style B (barre d'accent) par défaut et style A (liseré) à l'essai, taille automatique ; fenêtre « Mises à jour et
   versions » : trois reçus au plus, instantanés de l'état de suivi rangés dans « Sauvegardes et restauration » (décisions
   du RSSI du 19/11/2026, addendum à l'ADR 0093). Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import type { UpdateReceiptSummary, UpdateState } from '@suivi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  etatMiseAJour,
  RECUS_AFFICHES,
  derniersRecus,
  RecusInstallations,
  UpdatesPanel,
} from '../src/components/Updates';
import { appliquerStyleFenetres, styleFenetres } from '../src/fenetres';
import { InstantanesEtat } from '../src/pages/Admin';
import { cartesDuCote } from '../src/pages/Administration';

const ici = path.dirname(fileURLToPath(import.meta.url));
const fenetresCss = readFileSync(path.resolve(ici, '../../../packages/ui/src/neon-fenetres.css'), 'utf8');

const recu = (n: number): UpdateReceiptSummary => ({
  id: `00000000-0000-4000-8000-0000000000${String(10 + n)}`,
  depuis: `3.${n}.0`,
  vers: `3.${n + 1}.0`,
  statut: n % 2 ? 'success' : 'rolled_back',
  fin: `2026-10-${String(20 - n).padStart(2, '0')}T10:00:00Z`,
  dureeSecondes: 60 + n,
  sbom: ['api', 'web', 'updater'],
});

const rendu = (element: ReactElement, donnees?: (qc: QueryClient) => void) => {
  const qc = new QueryClient();
  donnees?.(qc);
  return renderToStaticMarkup(
    createElement(MantineProvider, null, createElement(QueryClientProvider, { client: qc }, element)),
  );
};

/** Éléments React d'un détail de carte, sans les rendre. */
function elements(n: ReactNode): ReactElement[] {
  if (Array.isArray(n)) return n.flatMap(elements);
  if (!isValidElement(n)) return [];
  const { children } = n.props as { children?: ReactNode };
  return [n, ...elements(children)];
}
const tout = () => true;
const detail = (id: string) => {
  const carte = cartesDuCote(tout, 'systeme').find((c) => c.id === id);
  expect(carte?.detail, id).toBeDefined();
  return elements(carte!.detail!(() => {}, tout));
};

describe('reçus des dernières installations', () => {
  it('trois reçus au plus, les plus récents (ordre de l’API)', () => {
    const cinq = [0, 1, 2, 3, 4].map(recu);
    expect(RECUS_AFFICHES).toBe(3);
    expect(derniersRecus(cinq).map((r) => r.id)).toEqual(cinq.slice(0, 3).map((r) => r.id));
    expect(derniersRecus(cinq.slice(0, 2))).toHaveLength(2);
    const html = rendu(createElement(RecusInstallations), (qc) => qc.setQueryData(['updates', 'receipts'], cinq));
    expect(html.match(/aria-label="Télécharger le reçu /g)).toHaveLength(3);
    for (const r of cinq.slice(0, 3)) {
      expect(html).toContain(`aria-label="Télécharger le reçu ${r.depuis} vers ${r.vers}"`);
      expect(html).toContain(`aria-label="Télécharger le SBOM updater de la version ${r.vers}"`);
    }
    expect(html).not.toContain('Télécharger le reçu 3.3.0 vers 3.4.0');
    expect(html).not.toContain('Télécharger le reçu 3.4.0 vers 3.5.0');
    // Fin, versions, résultat et durée de chacun.
    expect(html).toContain('Annulée, version précédente restaurée');
    expect(html).toContain('Installée');
    expect(html).toContain('1 min 1 s');
    expect(html).toMatch(/class="horodatage"/);
  });
  it('un reçu sans SBOM vérifié s’affiche sans bouton de SBOM', () => {
    const ancien = { ...recu(1), sbom: [] };
    const html = rendu(createElement(RecusInstallations), (qc) => qc.setQueryData(['updates', 'receipts'], [ancien]));
    expect(html).toContain('Télécharger le reçu 3.1.0 vers 3.2.0');
    expect(html).not.toContain('Télécharger le SBOM');
  });
});

describe('instantanés de l’état de suivi', () => {
  it('présents dans « Sauvegardes et restauration », absents de « Mises à jour et versions »', () => {
    expect(detail('sauvegardes').some((e) => e.type === InstantanesEtat)).toBe(true);
    const majs = detail('mises-a-jour');
    expect(majs.some((e) => e.type === UpdatesPanel)).toBe(true);
    expect(majs.some((e) => e.type === InstantanesEtat)).toBe(false);
    const titres = cartesDuCote(tout, 'systeme').map((c) => c.titre);
    expect(titres).toContain('Sauvegardes et restauration');
    expect(titres).toContain('Mises à jour et versions');
  });
  it('le cadre porte son titre, son aide, sa région nommée ; Télécharger et Restaurer inchangés', () => {
    const html = rendu(createElement(InstantanesEtat), (qc) =>
      qc.setQueryData(
        ['admin', 'versions'],
        [
          {
            version: 4,
            updated_at: '2026-10-01T08:00:00Z',
            updated_by: 'compte-fictif',
            note: 'Note fictive',
            bytes: 10,
            items: 2,
            import_batch_id: null,
          },
        ],
      ),
    );
    expect(html).toMatch(/<h2[^>]*>Instantanés de l’état de suivi<\/h2>/);
    expect(html).toContain('Instantanés complets de l’état de suivi, enregistrés par l’application.');
    expect(html).toContain('Une restauration crée une nouvelle version.');
    expect(html).toContain('aria-label="Instantanés de l’état de suivi"');
    expect(html).not.toContain('ancienne interface');
    expect(html).toMatch(/>Télécharger</);
    expect(html).toMatch(/>Restaurer</);
  });
});

describe('pastille d’état des versions', () => {
  const base: UpdateState = {
    installed: '3.0.0',
    available: null,
    checkedAt: null,
    notes: null,
    checking: false,
    checkError: false,
    ready: true,
    maintenance: false,
    id: null,
    target: null,
    status: 'idle',
    phase: 'idle',
    message: '',
    startedAt: null,
    updatedAt: '2026-10-01T08:00:00.000Z',
    etapes: [],
    finishedAt: null,
  };
  const o = { verification: false, fluxFerme: false };
  it('suit l’état publié, sans succès fictif', () => {
    expect(etatMiseAJour(undefined, o).etat).toBe('neutre');
    expect(etatMiseAJour(base, o)).toEqual({ etat: 'neutre', libelle: 'Disponibilité à vérifier' });
    expect(etatMiseAJour({ ...base, checkedAt: '2026-10-01T08:00:00.000Z' }, o)).toEqual({
      etat: 'succes',
      libelle: 'À jour',
    });
    expect(etatMiseAJour({ ...base, available: '3.1.0' }, o).libelle).toBe('Nouvelle version disponible');
    expect(etatMiseAJour({ ...base, checkError: true, checkedAt: base.updatedAt }, o).etat).toBe('attention');
    expect(etatMiseAJour({ ...base, ready: false }, o).libelle).toBe('Service indisponible');
    expect(etatMiseAJour(base, { ...o, fluxFerme: true }).libelle).toBe('Flux fermé');
    expect(etatMiseAJour(base, { ...o, verification: true }).libelle).toBe('Vérification en cours');
    expect(etatMiseAJour({ ...base, status: 'running' }, o).libelle).toBe('Installation en cours');
  });
});

describe('fenêtres : style à l’essai et taille automatique', () => {
  it('barre d’accent par défaut ; une valeur absente ou inconnue vaut la barre ; l’attribut est posé sur <html>', () => {
    expect(styleFenetres(undefined)).toBe('barre');
    expect(styleFenetres('hexagone')).toBe('barre');
    expect(styleFenetres('lisere')).toBe('lisere');
    const html = { dataset: {} as DOMStringMap };
    appliquerStyleFenetres(html, undefined);
    expect(html.dataset.fenetres).toBe('barre');
    appliquerStyleFenetres(html, 'lisere');
    expect(html.dataset.fenetres).toBe('lisere');
  });
  it('plus de coins coupés : arrondi, barre dégradée par défaut, liseré sur [data-fenetres=lisere]', () => {
    expect(fenetresCss).not.toMatch(/clip-path/);
    expect(fenetresCss).not.toMatch(/neon-cadre-biseau|contexte-cadre|data-cadre/);
    expect(fenetresCss).toMatch(/border-radius: var\(--fenetre-rayon\);/);
    expect(fenetresCss).toMatch(
      /height: var\(--fenetre-accent\);[\s\S]*?linear-gradient\(90deg, var\(--neon-violet\), var\(--neon-cyan\)\)/,
    );
    expect(fenetresCss).toMatch(/html\[data-fenetres='lisere'\][\s\S]*?padding: var\(--fenetre-lisere\);/);
    expect(fenetresCss).toMatch(/@media \(forced-colors: active\)[\s\S]*?CanvasText/);
  });
  it('92 % de la largeur et 90 % de la hauteur au plus ; seul le corps défile, verticalement ; tableau élargi', () => {
    expect(fenetresCss).toMatch(/--modal-x-offset: 4vw;\s*--modal-y-offset: 5dvh;/);
    expect(fenetresCss).toMatch(/max-height: calc\(100dvh - 2 \* var\(--modal-y-offset\)\);/);
    expect(fenetresCss).toMatch(/:has\(\.mantine-Modal-body :is\(table, \.table-wrap\)\) \{\s*width: fit-content;/);
    expect(fenetresCss).toMatch(/> :is\(\.mantine-Modal-body, \.mantine-Drawer-body\) \{[^}]*overflow: hidden auto;/);
    // Le voile extérieur ne défile plus.
    expect(fenetresCss).not.toMatch(/Modal-inner[^{]*\{[^}]*overflow-y: auto/);
    // Les règles du cadre n'ont aucune longueur en px ou rem (jetons de la charte).
    const cadre = fenetresCss.slice(
      fenetresCss.indexOf('/* Accent du cadre'),
      fenetresCss.indexOf('/* ---------------------------------------------------------------- Lecture distincte'),
    );
    expect(cadre.length).toBeGreaterThan(200);
    expect(cadre).not.toMatch(/(?<![\w-])\d*\.?\d+(px|rem)\b/);
  });
});
