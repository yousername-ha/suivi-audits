/* Le service « init » (root) attribue les arborescences du frontal par descripteurs : un répertoire remplacé par un lien
   entre le listage et la descente n'est pas suivi, et un fichier hors de l'arborescence n'est pas touché. Données fictives. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attribuer } from '../src/init-secrets.js';

let racine: string;
beforeEach(() => {
  racine = fs.mkdtempSync(path.join(os.tmpdir(), 'init-attribution-'));
});
afterEach(() => fs.rmSync(racine, { recursive: true, force: true }));

const attendre = (ms: number) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin);
};
/** Arborescence « caddy/data » avec un sous-dossier `v`, et un dossier témoin hors de l'arborescence. */
function preparer() {
  const arbre = path.join(racine, 'data');
  fs.mkdirSync(path.join(arbre, 'v'), { recursive: true });
  fs.writeFileSync(path.join(arbre, 'v', 'a.txt'), 'a');
  fs.writeFileSync(path.join(arbre, 'b.txt'), 'b');
  const dehors = path.join(racine, 'dehors');
  fs.mkdirSync(dehors);
  const temoin = path.join(dehors, 'temoin.txt');
  fs.writeFileSync(temoin, 'secret fictif');
  return { arbre, dehors, temoin };
}
const substituer = (arbre: string, dehors: string) => (parent: string, nom: string) => {
  if (nom !== 'v') return;
  fs.rmSync(path.join(parent, 'v'), { recursive: true });
  fs.symlinkSync(dehors, path.join(parent, 'v'));
};
const uid = process.getuid!();

describe('attribution des arborescences du frontal', () => {
  it('attribue fichiers et dossiers de l’arborescence légitime', () => {
    const { arbre } = preparer();
    expect(attribuer(arbre, uid)).toBe(4); // data, v, v/a.txt, b.txt
    expect(fs.statSync(path.join(arbre, 'v', 'a.txt')).uid).toBe(uid);
  });

  it('témoin : un parcours par chemins suivrait le lien substitué et toucherait le fichier hors arborescence', () => {
    const { arbre, dehors, temoin } = preparer();
    const avant = fs.statSync(temoin).ctimeMs;
    attendre(20);
    // Ancien parcours : le type est lu au listage, la descente repasse par le chemin.
    const ancien = (dir: string, crochet: (p: string, n: string) => void) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        crochet(dir, e.name);
        const p = path.join(dir, e.name);
        if (e.isDirectory()) ancien(p, crochet);
        else fs.lchownSync(p, uid, uid);
      }
    };
    ancien(arbre, substituer(arbre, dehors));
    expect(fs.statSync(temoin).ctimeMs).toBeGreaterThan(avant);
  });

  it('un répertoire remplacé par un lien après le listage n’est pas suivi : le témoin hors arborescence reste intact', () => {
    const { arbre, dehors, temoin } = preparer();
    const avant = fs.statSync(temoin).ctimeMs;
    attendre(20);
    attribuer(arbre, uid, substituer(arbre, dehors));
    expect(fs.statSync(temoin).ctimeMs).toBe(avant);
    expect(fs.lstatSync(path.join(arbre, 'v')).isSymbolicLink()).toBe(true);
  });

  it('un lien dans l’arborescence n’est jamais suivi', () => {
    const { arbre, dehors, temoin } = preparer();
    fs.symlinkSync(dehors, path.join(arbre, 'lien'));
    const avant = fs.statSync(temoin).ctimeMs;
    attendre(20);
    attribuer(arbre, uid);
    expect(fs.statSync(temoin).ctimeMs).toBe(avant);
  });

  it('refuse une racine qui est un lien', () => {
    const { arbre } = preparer();
    const lien = path.join(racine, 'racine-lien');
    fs.symlinkSync(arbre, lien);
    expect(() => attribuer(lien, uid)).toThrow();
  });
});
