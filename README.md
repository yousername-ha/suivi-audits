# Ancienne interface de la plateforme (« outil legacy ») — version autonome et testable

Cette branche conserve l'ancienne interface de suivi des audits SMSI, retirée de la plateforme, sous la forme d'une
archive prête à essayer. Elle ne contient aucun code de la plateforme et aucune donnée.

| Fichier | Rôle |
| --- | --- |
| `downloads/outil-legacy-autonome-v3.4.0.zip` | l'outil complet (un fichier `index.html` + bibliothèques d'export), tel qu'il était dans la plateforme 3.4.0 |
| `downloads/outil-legacy-autonome-v3.4.0.zip.sha256` | empreinte SHA-256 de l'archive |

## Essayer

1. Télécharger le zip, le décompresser (garder le dossier `lib` à côté de `index.html`).
2. Ouvrir `index.html` dans un navigateur récent, sans serveur ni connexion Internet.
3. Les données restent dans le navigateur ; « Exporter » / « Importer » enregistre et recharge une sauvegarde JSON.

Vérification de l'empreinte : `sha256sum -c outil-legacy-autonome-v3.4.0.zip.sha256` (dans `downloads/`).

## Vérifié

Ouverture depuis un dossier décompressé dans Chromium, hors ligne : la page se charge, les menus s'affichent, la
navigation entre pages fonctionne et l'état est conservé dans le navigateur. Les messages de console sur
`data/state.json` ou le réseau sont attendus (repli sur les données locales et sur `lib/`).

## Origine

Fichier `app/public/index.html` et `app/public/lib/` de la plateforme à la version 3.4.0 (dernier état avant retrait),
sans modification. L'état antérieur complet de la plateforme reste dans la branche `archive/ancienne-interface-v3.1.1`
et les étiquettes `v3.*`. Le retrait de l'ancienne interface est une décision du RSSI du 18/10/2026.
