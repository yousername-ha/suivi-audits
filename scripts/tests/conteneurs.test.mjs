import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const racine = new URL('../../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), 'utf8');
const compose = lire('docker-compose.yml');

// Bloc d'un service du compose : de « ␠␠nom: » à la ligne suivante au même niveau.
function service(nom) {
  const debut = compose.search(new RegExp(`^  ${nom}:\\n`, 'm'));
  assert.notEqual(debut, -1, `service ${nom} absent`);
  const reste = compose.slice(debut + 1);
  const fin = reste.search(/\n {2}[a-z#][^\n]*\n|\n\S/);
  return fin === -1 ? reste : reste.slice(0, fin);
}

test('les images du compose et des Dockerfiles sont épinglées par empreinte', () => {
  // Images tierces seulement : les images du projet (GHCR) sont versionnées, signées et attestées par la publication.
  const images = [...compose.matchAll(/^\s+image: (?![*$]|ghcr\.io\/)(\S+)/gm)].map((m) => m[1]);
  assert.ok(images.length >= 4);
  for (const image of images) assert.match(image, /@sha256:[0-9a-f]{64}$/, image);
  for (const fichier of ['api', 'web', 'updater']) {
    const args = [...lire(`docker/${fichier}.Dockerfile`).matchAll(/^ARG \w+_IMAGE=(\S+)/gm)].map((m) => m[1]);
    assert.ok(args.length >= 1, fichier);
    for (const image of args) assert.match(image, /@sha256:[0-9a-f]{64}$/, `${fichier}: ${image}`);
  }
  assert.match(lire('docker/updater.Dockerfile'), /^FROM alpine:\S+@sha256:[0-9a-f]{64}/m);
});

test("l'antivirus n'est relié qu'au réseau interne dédié, durci et sans privilège", () => {
  assert.match(compose, /^ {2}antivirus: \{ internal: true \}/m);
  const clamd = service('clamav');
  assert.match(clamd, /networks: \[antivirus\]/);
  assert.doesNotMatch(clamd, /backend|av_update|edge/);
  for (const bloc of [clamd, service('freshclam')]) {
    assert.match(bloc, /read_only: true/);
    assert.match(bloc, /cap_drop: \[ALL\]/);
    assert.match(bloc, /pids_limit: \d+/);
    assert.match(bloc, /user: '100:101'/);
    assert.doesNotMatch(bloc, /cap_add/);
  }
  assert.match(clamd, /clamav:\/var\/lib\/clamav:ro/);
  assert.match(service('freshclam'), /networks: \[av_update\]/);
  assert.match(service('freshclam'), /CLAMAV_NO_CLAMD: 'true'/);
  // La base et la sortie Internet ne rejoignent jamais le réseau de l'antivirus.
  for (const nom of ['db', 'web', 'gateway', 'updater']) assert.doesNotMatch(service(nom), /antivirus/, nom);
  assert.match(service('app'), /networks: \[backend, edge, antivirus\]/);
});
