/* Garde-fou d'architecture (ADR 0097, point 1) : tout service de docker-compose.yml qui peut sortir vers l'extérieur (réseau
   non « internal », ou réseau par défaut faute de réseau déclaré) ou qui publie un port est soit porté par un module du
   registre des flux (packages/shared/src/flux-externes.ts), soit dans la courte liste du cœur de plateforme ci-dessous, chaque
   entrée justifiée. Ajouter un service sortant sans l'inscrire fait échouer ce test ; une entrée devenue inutile aussi. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FLUX_EXTERNES, FLUX_MODULES } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

/** Cœur de plateforme : services exposés qui ne relèvent d'aucun module activable. Ajouter une entrée se discute en revue. */
const COEUR: Record<string, string> = {
  gateway: 'Passerelle HTTPS : publie les ports 80 et 443 du site (porte aussi le flux ACME du registre).',
  web: 'Frontal interne de l’interface : relié au réseau « public » partagé avec la passerelle, aucun port publié.',
  updater:
    'Exécutant d’exploitation et de mise à jour (socket Docker, sans port) : applique les flux, porte le courriel et les mises à jour du registre.',
};

interface Service {
  nom: string;
  reseaux: string[] | null;
  networkMode: string | null;
  ports: boolean;
}

/** Lecture volontairement étroite du compose (pas de dépendance YAML) : une forme non prise en charge est refusée plutôt
    qu'ignorée, pour qu'aucun service ne passe entre les mailles. */
export function lireCompose(texte: string): { services: Service[]; internes: Set<string>; reseaux: Set<string> } {
  const lignes = texte.split('\n');
  const debut = (cle: string) => lignes.findIndex((l) => l === `${cle}:`);
  const bloc = (i: number) => {
    const fin = lignes.findIndex((l, j) => j > i && /^\S/.test(l) && !l.startsWith('#'));
    return lignes.slice(i + 1, fin === -1 ? undefined : fin);
  };
  const services: Service[] = [];
  let cur: Service | null = null;
  for (const l of bloc(debut('services'))) {
    const nom = /^ {2}([a-z0-9][a-z0-9_-]*):\s*$/.exec(l);
    if (nom) {
      cur = { nom: nom[1]!, reseaux: null, networkMode: null, ports: false };
      services.push(cur);
      continue;
    }
    if (!cur) continue;
    const reseaux = /^ {4}networks:(.*)$/.exec(l);
    if (reseaux) {
      const liste = /^\s*\[([^\]]*)\]\s*$/.exec(reseaux[1]!);
      if (!liste) throw new Error(`service ${cur.nom} : réseaux à déclarer en liste sur une ligne ([a, b]).`);
      cur.reseaux = liste[1]!
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }
    const mode = /^ {4}network_mode:\s*(\S+)/.exec(l);
    if (mode) cur.networkMode = mode[1]!.replace(/['"]/g, '');
    if (/^ {4}ports:/.test(l)) cur.ports = true;
  }
  const internes = new Set<string>();
  const reseaux = new Set<string>();
  let reseau: string | null = null;
  for (const l of bloc(debut('networks'))) {
    const r = /^ {2}([a-z0-9_-]+):(.*)$/.exec(l);
    if (r) {
      reseau = r[1]!;
      reseaux.add(reseau);
      if (/internal:\s*true/.test(r[2]!)) internes.add(reseau);
      continue;
    }
    if (reseau && /^ {4}internal:\s*true/.test(l)) internes.add(reseau);
  }
  return { services, internes, reseaux };
}

/** Services qui peuvent joindre l'extérieur ou en recevoir des connexions. */
export function servicesExposes(texte: string): string[] {
  const { services, internes, reseaux } = lireCompose(texte);
  return services
    .filter((s) => {
      if (s.ports) return true;
      if (s.networkMode === 'none') return false;
      if (s.networkMode) return true; // host, service:… : hors des réseaux internes déclarés
      if (!s.reseaux) return true; // réseau par défaut de Compose, non interne
      for (const r of s.reseaux) if (!reseaux.has(r)) throw new Error(`service ${s.nom} : réseau ${r} non déclaré.`);
      return s.reseaux.some((r) => !internes.has(r));
    })
    .map((s) => s.nom);
}

const porteurs = new Set(FLUX_EXTERNES.flatMap((f) => f.porteur.services));
const nonInscrits = (texte: string) => servicesExposes(texte).filter((s) => !porteurs.has(s) && !(s in COEUR));

describe('architecture : flux vers l’extérieur', () => {
  const compose = readFileSync(path.join(REPO, 'docker-compose.yml'), 'utf8');
  // Bloc d'un service : de « ␠␠nom: » au service suivant (même indentation) ou à la clé de premier niveau suivante.
  const blocService = (nom: string) => {
    const reste = compose.slice(compose.indexOf(`\n  ${nom}:\n`) + 1);
    const fin = reste.slice(1).search(/\n {2}[a-z][^\n]*:\n|\n\S/);
    return fin === -1 ? reste : reste.slice(0, fin + 1);
  };

  it('tout service exposé est porté par un module du registre ou justifié dans le cœur de plateforme', () => {
    expect(nonInscrits(compose)).toEqual([]);
  });

  it('les services exposés connus sont bien vus comme tels (la lecture du compose n’est pas aveugle)', () => {
    const exposes = servicesExposes(compose);
    for (const s of ['gateway', 'updater', 'assistant-relais', 'freshclam']) expect(exposes, s).toContain(s);
    // Internes seulement, ou sans réseau : jamais exposés.
    for (const s of ['init', 'db', 'app', 'clamav', 'db-pg17']) expect(exposes, s).not.toContain(s);
  });

  it('chaque service porteur du registre existe dans le compose, et chaque entrée du cœur est un service exposé', () => {
    const noms = lireCompose(compose).services.map((s) => s.nom);
    for (const s of porteurs) expect(noms, s).toContain(s);
    const exposes = servicesExposes(compose);
    for (const s of Object.keys(COEUR)) expect(exposes, s).toContain(s);
  });

  it('les conteneurs de sortie démarrent par le profil Compose de leur module', () => {
    for (const f of FLUX_EXTERNES.filter((x) => x.porteur.type === 'conteneur'))
      for (const s of f.porteur.services) expect(blocService(s), s).toContain(`profiles: ['${f.porteur.profil}']`);
  });

  it('les listes fermées des exécutants concordent avec le registre (modules, profils et services des conteneurs)', () => {
    // Les exécutants Python ne lisent pas le registre TypeScript : leurs constantes sont recopiées, et ce test garantit
    // qu'elles restent identiques (ADR 0097, lot 2). Aucun nom reçu de l'application n'y est ajouté à l'exécution.
    const lire = (f: string) => readFileSync(path.join(REPO, f), 'utf8');
    for (const f of ['scripts/update-worker.py', 'scripts/exploitation-worker.py']) {
      const modules = /^FLUX_MODULES = \(([^)]*)\)$/m.exec(lire(f));
      expect(modules, f).not.toBeNull();
      expect(
        [...modules![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]),
        f,
      ).toEqual([...FLUX_MODULES]);
    }
    const ligne = /^FLUX_CONTENEURS = (\{.*\})$/m.exec(lire('scripts/update-worker.py'));
    expect(ligne).not.toBeNull();
    const conteneurs = JSON.parse(ligne![1]!) as Record<string, { profil: string; services: string[] }>;
    const attendus = FLUX_EXTERNES.filter((f) => f.porteur.type === 'conteneur');
    expect(Object.keys(conteneurs).sort()).toEqual(attendus.map((f) => f.id).sort());
    for (const f of attendus) {
      expect(conteneurs[f.id]!.profil, f.id).toBe(f.porteur.profil);
      expect([...conteneurs[f.id]!.services].sort(), f.id).toEqual([...f.porteur.services].sort());
    }
    // Ordre de démarrage de l'exécutant : un service ne dépend jamais (depends_on) d'un service lancé après lui.
    for (const { services } of Object.values(conteneurs))
      services.forEach((s, i) => {
        for (const apres of services.slice(i + 1))
          expect(blocService(s), `${s} dépend de ${apres}`).not.toMatch(new RegExp(`\\n {6}${apres}: \\{`));
      });
    expect(blocService('clamav')).toMatch(/\n {6}freshclam: \{ condition: service_healthy \}/);
  });

  it('ajouter un service sortant sans l’inscrire au registre fait échouer le contrôle', () => {
    const ajout = (bloc: string) => compose.replace(/\nnetworks:\n/, `\n${bloc}\nnetworks:\n`);
    expect(nonInscrits(ajout('  sortie-nouvelle:\n    image: exemple\n    networks: [public]\n'))).toEqual([
      'sortie-nouvelle',
    ]);
    expect(nonInscrits(ajout('  sans-reseau-declare:\n    image: exemple\n'))).toEqual(['sans-reseau-declare']);
    expect(
      nonInscrits(ajout("  port-publie:\n    image: exemple\n    networks: [backend]\n    ports: ['8443:443']\n")),
    ).toEqual(['port-publie']);
    // Un service relié aux seuls réseaux internes, ou sans réseau, reste admis.
    expect(nonInscrits(ajout('  interne:\n    image: exemple\n    networks: [backend]\n'))).toEqual([]);
    expect(nonInscrits(ajout('  isole:\n    image: exemple\n    network_mode: none\n'))).toEqual([]);
    // Une forme non lue est refusée plutôt qu'ignorée.
    expect(() => nonInscrits(ajout('  liste:\n    image: exemple\n    networks:\n      - public\n'))).toThrow(
      /liste sur une ligne/,
    );
  });
});
