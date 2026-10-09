/* Dossier des données du serveur (EXPL-01) : contrôles du service « init ». */
import { describe, expect, it } from 'vitest';
import { cheminRefuse, typeMontage } from '../src/init-secrets.js';

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
