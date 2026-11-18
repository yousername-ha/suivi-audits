/* Module Vulnérabilités (ADR 0100, décision V31) : écran « Mots à ne pas masquer » (contrôle de la saisie, effet de chaque mot
   en clair, noms des seules machines lisibles, liste vide), menu réservé au droit d'administrer le module, aide. Données
   entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type { Action, EffetMotNonMasque, Module } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { famillesVisibles, localiser } from '../src/navigation';
import { controleNouveauMot, EffetMot, ListeMots } from '../src/vulnerabilites/MotsNonMasques';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const effet = (e: Partial<EffetMotNonMasque> = {}): EffetMotNonMasque => ({
  mot: 'dpi',
  machines: 0,
  noms: [],
  nonLisibles: 0,
  ...e,
});

describe('saisie d’un mot', () => {
  it('forme admise, doublon sans tenir compte de la casse, liste pleine', () => {
    expect(controleNouveauMot('', [])).toBeNull();
    expect(controleNouveauMot('  dpi ', ['pacs'])).toBeNull();
    expect(controleNouveauMot('DPI', ['dpi'])).toBe('Ce mot figure déjà dans la liste.');
    expect(controleNouveauMot('dpi.exemple.invalid', [])).toMatch(/ni point/);
    expect(controleNouveauMot('192.0.2.1', [])).toMatch(/ni point/);
    expect(controleNouveauMot('M-001', [])).toMatch(/repère/);
    expect(controleNouveauMot('x', [])).toMatch(/de 2 à 60 caractères/);
    const pleine = Array.from({ length: 200 }, (_, i) => `mot${i}`);
    expect(controleNouveauMot('web', pleine)).toBe('La liste compte déjà 200 mots.');
  });
});

describe('effet d’un mot', () => {
  it('aucune machine : aucun effet aujourd’hui', () => {
    expect(rendu(createElement(EffetMot, { effet: effet() }))).toContain('aucun effet aujourd’hui');
  });

  it('machines lisibles nommées, les autres seulement comptées', () => {
    const html = rendu(
      createElement(EffetMot, {
        effet: effet({ machines: 3, noms: ['dpi.exemple.invalid', 'dpi.autre.invalid'], nonLisibles: 1 }),
      }),
    );
    expect(html).toContain(
      'Ce mot est aussi le nom court de 3 machines : il partira chez le fournisseur du modèle quand quelqu’un l’écrit.',
    );
    expect(html).toContain('Machines : dpi.exemple.invalid, dpi.autre.invalid.');
    expect(html).toContain('Dont une machine que vous ne pouvez pas lire : son nom n’est pas affiché.');
    const cache = rendu(createElement(EffetMot, { effet: effet({ machines: 2, nonLisibles: 2 }) }));
    expect(cache).not.toContain('Machines :');
    expect(cache).toContain('Dont 2 machines que vous ne pouvez pas lire');
  });

  it('au-delà des 20 noms rendus : « et N autres »', () => {
    const noms = Array.from({ length: 20 }, (_, i) => `web${i}.exemple.invalid`);
    const html = rendu(createElement(EffetMot, { effet: effet({ mot: 'web', machines: 23, noms }) }));
    expect(html).toContain('web19.exemple.invalid, et 3 autres.');
  });

  it('liste : chaque mot avec son effet et « Retirer » ; vide, le masque est strict', () => {
    const rien = () => undefined;
    expect(rendu(createElement(ListeMots, { effets: [], envoi: false, onRetirer: rien }))).toContain(
      'Aucun mot : le masque est strict.',
    );
    const html = rendu(
      createElement(ListeMots, {
        effets: [effet({ machines: 1, noms: ['dpi.exemple.invalid'] }), effet({ mot: 'pacs' })],
        envoi: false,
        onRetirer: rien,
      }),
    );
    expect(html).toContain('>dpi<');
    expect(html).toContain('>pacs<');
    expect(html).toContain('nom court d’une machine');
    expect(html.match(/Retirer/g)).toHaveLength(2);
  });
});

describe('menu et aide', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  const rubriques = (droits: string[]) =>
    famillesVisibles(seulement(droits))
      .find((f) => f.famille.id === 'risques')!
      .destinations.find((d) => d.id === 'vulnerabilites')!
      .rubriques.map((r) => r.id);

  it('« Mots à ne pas masquer » suit les seuils, avec le droit d’administrer le module seulement', () => {
    expect(rubriques(['vulnerabilites:lire'])).not.toContain('vulnerabilites-masque');
    expect(rubriques(['vulnerabilites:lire', 'vulnerabilites:administrer']).slice(-2)).toEqual([
      'vulnerabilites-priorite',
      'vulnerabilites-masque',
    ]);
    expect(localiser('/vulnerabilites/masque')?.rubrique.id).toBe('vulnerabilites-masque');
  });

  it('l’aide dit ce que fait le masque, sa limite et l’usage de la liste', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-masque')!;
    expect(a.permission).toBe('vulnerabilites:administrer');
    expect(a.link).toBe('/vulnerabilites/masque');
    const texte = a.steps.join(' ');
    for (const m of [
      'masque strict reste la règle',
      'dpi.exemple.invalid',
      'dpi:8443',
      'restent masqués',
      'partira chez le fournisseur du modèle',
      'que si vous pouvez les lire',
      'aucun effet aujourd’hui',
      'journal d’audit',
      'liste vide',
    ])
      expect(texte).toContain(m);
    expect(HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-assistant')!.steps.join(' ')).toContain(
      'Mots à ne pas masquer',
    );
  });
});
