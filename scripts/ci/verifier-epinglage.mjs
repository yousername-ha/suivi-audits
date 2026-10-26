// Contrôle CI (ADR 0063) : toute action GitHub est épinglée par l'empreinte complète d'un commit, avec la version en
// commentaire (« uses: owner/repo@<40 hexadécimaux> # vX.Y.Z »), et aucune image Docker d'outil n'est lancée par étiquette.
// Une étiquette Git ou Docker est mobile : elle peut être redirigée vers du code malveillant sans que le dépôt change.
//   node scripts/ci/verifier-epinglage.mjs [dossier]   (par défaut .github/workflows)
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dossier = process.argv[2] ?? '.github/workflows';
const USES = /^\s*-?\s*uses:\s*(\S+)(.*)$/;
const EPINGLE = /^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/;
const VERSION = /^\s*#\s*v\d+(\.\d+){0,2}\s*$/;
// Images d'outils de sécurité autrefois lancées par étiquette : elles passent désormais par scripts/ci/installer-outils.sh.
const IMAGE_OUTIL = /\bdocker run\b.*\b(aquasec\/trivy|gitleaks\/gitleaks)(:[\w.-]+)?(?!@sha256:)/;

export function verifier(texte, fichier = '') {
  const erreurs = [];
  texte.split('\n').forEach((ligne, i) => {
    const m = USES.exec(ligne);
    if (m) {
      const [, ref, reste] = m;
      if (ref.startsWith('./')) return; // action locale du dépôt
      if (ref.startsWith('docker://'))
        erreurs.push(`${fichier}:${i + 1} : action Docker « ${ref} » interdite (étiquette mobile)`);
      else if (!EPINGLE.test(ref))
        erreurs.push(`${fichier}:${i + 1} : « ${ref} » n'est pas épinglée par l'empreinte complète d'un commit`);
      else if (!VERSION.test(reste))
        erreurs.push(`${fichier}:${i + 1} : version manquante en commentaire (« # vX.Y.Z »)`);
    }
    if (IMAGE_OUTIL.test(ligne))
      erreurs.push(
        `${fichier}:${i + 1} : outil lancé par image Docker à étiquette ; utiliser scripts/ci/installer-outils.sh`,
      );
  });
  return erreurs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fichiers = readdirSync(dossier).filter((f) => /\.ya?ml$/.test(f));
  const erreurs = fichiers.flatMap((f) => verifier(readFileSync(path.join(dossier, f), 'utf8'), path.join(dossier, f)));
  if (erreurs.length) {
    for (const e of erreurs) console.error(`::error::${e}`);
    process.exit(1);
  }
  console.log(`${fichiers.length} workflow(s) : toutes les actions sont épinglées par empreinte de commit.`);
}
