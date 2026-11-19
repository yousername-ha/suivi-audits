/* Lecteur XML minimal, pour les tests seulement (aucun DOMParser hors navigateur) : déclaration, commentaires, éléments,
   attributs entre guillemets, texte, CDATA, entités prédéfinies et numériques. Refuse ce qu'il ne connaît pas (DOCTYPE,
   balises mal fermées) : il ne sert qu'à lire les fichiers .nessus fictifs des tests, comme le ferait le DOMParser. */
import type { NoeudXml } from '../src/integrations/nessus';

interface Element {
  nom: string;
  attributs: Map<string, string>;
  enfants: (Element | string)[];
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decoder = (t: string) =>
  t.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)));
    const v = ENTITES[e];
    if (v === undefined) throw new Error(`entité inconnue ${m}`);
    return v;
  });

export function lireXmlFictif(texte: string): NoeudXml {
  let i = 0;
  const sauter = () => {
    for (;;) {
      while (i < texte.length && /\s/.test(texte[i]!)) i++;
      if (texte.startsWith('<?', i)) i = texte.indexOf('?>', i) + 2;
      else if (texte.startsWith('<!--', i)) i = texte.indexOf('-->', i) + 3;
      else return;
    }
  };
  const element = (): Element => {
    const m = /^<([A-Za-z_][\w:.-]*)/.exec(texte.slice(i, i + 200));
    if (!m) throw new Error(`élément attendu à ${i}`);
    i += m[0].length;
    const e: Element = { nom: m[1]!, attributs: new Map(), enfants: [] };
    for (;;) {
      const a = /^\s+([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/.exec(texte.slice(i, i + 10000));
      if (!a) break;
      e.attributs.set(a[1]!, decoder(a[3] ?? a[4] ?? ''));
      i += a[0].length;
    }
    while (/\s/.test(texte[i]!)) i++;
    if (texte.startsWith('/>', i)) {
      i += 2;
      return e;
    }
    if (texte[i] !== '>') throw new Error(`fin de balise attendue à ${i}`);
    i++;
    for (;;) {
      if (texte.startsWith(`</${e.nom}`, i)) {
        i = texte.indexOf('>', i) + 1;
        return e;
      }
      if (texte.startsWith('<!--', i)) i = texte.indexOf('-->', i) + 3;
      else if (texte.startsWith('<![CDATA[', i)) {
        const f = texte.indexOf(']]>', i);
        e.enfants.push(texte.slice(i + 9, f));
        i = f + 3;
      } else if (texte.startsWith('<!', i)) throw new Error('déclaration refusée');
      else if (texte[i] === '<') e.enfants.push(element());
      else {
        const f = texte.indexOf('<', i);
        if (f < 0) throw new Error('document tronqué');
        e.enfants.push(decoder(texte.slice(i, f)));
        i = f;
      }
    }
  };
  sauter();
  if (texte.startsWith('<!', i)) throw new Error('déclaration refusée');
  const racine = element();
  const noeud = (e: Element): NoeudXml => ({
    nom: e.nom.includes(':') ? e.nom.slice(e.nom.indexOf(':') + 1) : e.nom,
    attribut: (n) => e.attributs.get(n) ?? null,
    enfants: () => e.enfants.filter((x): x is Element => typeof x !== 'string').map(noeud),
    texte: () => {
      const t = (x: Element | string): string => (typeof x === 'string' ? x : x.enfants.map(t).join(''));
      return t(e);
    },
  });
  return noeud(racine);
}
