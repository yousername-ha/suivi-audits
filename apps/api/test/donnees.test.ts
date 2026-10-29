/* Dossier des données du serveur (EXPL-01) : contrôles du service « init ». */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cheminRefuse, migrationPostgresqlRequise, typeMontage } from '../src/init-secrets.js';

describe('DATA_DIR : emplacements refusés', () => {
  it('accepte un dossier dédié', () => {
    expect(cheminRefuse('/srv/suivi-audits/donnees')).toBeNull();
    expect(cheminRefuse('/data/suivi/')).toBeNull();
  });
  it.each([
    ['', /vide/],
    ['donnees', /absolu/],
    ['/', /racine/],
    ['//', /racine/],
    ['/var/lib/docker/volumes/x', /Docker/],
    ['/tmp/donnees', /temporaire/],
    ['/etc', /système/],
    ['/srv/../var/lib/docker', /Docker/],
  ])('refuse « %s »', (p, motif) => {
    expect(cheminRefuse(p)).toMatch(motif);
  });
});

describe('système de fichiers de /donnees', () => {
  const MI = [
    '22 1 0:21 / / rw - overlay overlay rw',
    '35 22 8:1 /srv/suivi-audits/donnees /donnees rw,relatime - ext4 /dev/sda1 rw',
    '36 22 0:40 / /tmp rw - tmpfs tmpfs rw',
  ].join('\n');
  it('lit le type du montage exact', () => {
    expect(typeMontage('/donnees', MI)).toBe('ext4');
    expect(typeMontage('/tmp', MI)).toBe('tmpfs');
    expect(typeMontage('/absent', MI)).toBeNull();
  });
});

describe('migration PostgreSQL 17 → 18 (ADR 0035)', () => {
  const dossierDonnees = (...fichiers: string[]) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'donnees-pg-'));
    for (const f of fichiers) {
      fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
      fs.writeFileSync(path.join(d, f), '17\n');
    }
    return d;
  };
  it('exige la migration quand une base 17 existe sans base 18', () => {
    const d = dossierDonnees('postgres/PG_VERSION');
    try {
      expect(migrationPostgresqlRequise(d)).toBe(true);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
  it('n’exige rien pour une nouvelle installation, une base 18 existante ou une migration en cours', () => {
    const cas = [
      dossierDonnees(),
      dossierDonnees('postgres/PG_VERSION', 'postgres18/18/docker/PG_VERSION'),
      dossierDonnees('postgres/PG_VERSION', 'postgres18/.migration-en-cours'),
      dossierDonnees('postgres18/18/docker/PG_VERSION'),
    ];
    try {
      expect(cas.map(migrationPostgresqlRequise)).toEqual([false, false, false, false]);
    } finally {
      for (const d of cas) fs.rmSync(d, { recursive: true, force: true });
    }
  });
});
