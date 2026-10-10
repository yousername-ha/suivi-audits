/* Dossier des données du serveur (EXPL-01) : contrôles du service « init ». */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cheminRefuse, genererCleMiseAJour, typeMontage } from '../src/init-secrets.js';

describe('clé des mises à jour', () => {
  it('crée une clé privée et conserve sa valeur lors des démarrages suivants', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-key-'));
    try {
      const file = path.join(dir, 'backup-pass');
      genererCleMiseAJour(file, process.getuid!());
      const key = fs.readFileSync(file, 'utf8');
      expect(Buffer.from(key.trim(), 'base64')).toHaveLength(48);
      fs.chmodSync(file, 0o644);
      genererCleMiseAJour(file, process.getuid!());
      expect(fs.readFileSync(file, 'utf8')).toBe(key);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it('refuse un lien ou un fichier vide sans écraser sa cible', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-key-'));
    try {
      const target = path.join(dir, 'target');
      const file = path.join(dir, 'backup-pass');
      fs.writeFileSync(target, 'configuration existante');
      fs.symlinkSync(target, file);
      expect(() => genererCleMiseAJour(file, process.getuid!())).toThrow();
      expect(fs.readFileSync(target, 'utf8')).toBe('configuration existante');
      fs.unlinkSync(file);
      fs.writeFileSync(file, '');
      expect(() => genererCleMiseAJour(file, process.getuid!())).toThrow(/invalide/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

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
