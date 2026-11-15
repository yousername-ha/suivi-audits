# Refonte Neon — Maintenance, lot 1 : habillage de la page de mise à jour

15/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/refonte-neon`, partie de
`claude-suivi-smsi` (`8ff37b6`). Dossier source : `docs/transmission-opus-5.5/maintenance-neon` (branche
`codex/transmission-neon-opus-5-5`). Décision du RSSI du 15/11/2026, après revue des captures de la maquette isolée :
« Validé, intégrer l'habillage ». Le journal technique complet (lot 2) n'est pas autorisé à ce stade.

## Fichiers et contrats modifiés

| Fichier                              | Changement                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `docker/maintenance/index.html`      | Composition validée : en-tête, grande dalle, noyau vectoriel, décor réseau, frise des cinq étapes. |
| `docker/maintenance/maintenance.css` | Couches de la maquette regroupées, couleurs du thème, clair et sombre, pause, mouvement réduit.    |
| `docker/maintenance/maintenance.js`  | Suivi inchangé ; ajout de la présentation (illustration, rang, étiquettes) et du bouton de pause.  |
| `tests/e2e/specs/zy-updates-neon.spec.ts` | Nouveau : animations, pause, mouvement réduit, phase finale sans succès publié.               |
| `docs/INSTALLATION.md`, `CHANGELOG.md` | Description de la page et limites.                                                               |

Hors interface React : la page est un fichier statique servi par le frontal (`docker/web.Dockerfile`, `/maintenance`) ; aucun
autre service, aucune route, aucune migration, aucune dépendance.

Identifiants conservés : `#title`, `#message` (seule zone `role="status"`), `#elapsed`, `#delay`, `#connection`, `#versions`,
`#receipt`, `#return`, `#steps`, `#animation`, `li[data-phase]` et le texte exact de chaque étape, classes `done` et `current`,
classe `maintenance-card` (lue par `scripts/ci/update-integree.py`). Ajouts : `#pause` (`aria-pressed`), `aria-current="step"`
sur l'étape en cours, attributs `data-art`, `data-fin`, `data-suivi`, `data-paused` sur `<html>`.

## Comportements préservés

Relevé de `/update/status.json` toutes les 2,5 s (8 s au plus) ; attente du bon job (`?demande=`, deux minutes) ; aucun retour
pendant une préparation active, une maintenance ou une intervention ; adresse `next` limitée à l'origine et hors `/update` ;
`/healthz` exactement `ok` avant tout retour ; retour automatique seulement sur succès, lien « Consulter le résultat dans
l'application » après échec ; avis de lenteur après dix minutes ; avis de connexion interrompue avec dernier état conservé ;
frise horodatée, durée écoulée puis totale, reçu à la fin. La page ne simule ni pourcentage, ni débit, ni ligne de journal.

Changements visibles relevés par le portage :

1. Pendant l'attente de prise en charge, la version cible et l'avis de lenteur de l'opération précédente ne sont plus affichés.
2. En échec ou en intervention, `#animation` montre l'illustration d'alerte au lieu d'être masqué.
3. Pas de bouton de thème : la page suit le choix de l'application (`mantine-color-scheme-value`) ou le système.
4. Libellés de présentation (titres d'étape, étiquettes d'état, rappel du retour, pied) rédigés pendant le portage.

## Poids

| Fichier           | Avant (gzip)       | Après (gzip)         |
| ----------------- | ------------------ | -------------------- |
| `index.html`      | 2,1 Ko (1,0 Ko)    | 33,9 Ko (6,7 Ko)     |
| `maintenance.css` | 2,2 Ko (0,9 Ko)    | 49,5 Ko (10,1 Ko)    |
| `maintenance.js`  | 6,3 Ko (2,4 Ko)    | 11,8 Ko (4,1 Ko)     |
| Total             | 10,6 Ko (4,3 Ko)   | 95,2 Ko (20,9 Ko)    |

Aucune image ni police ajoutée (polices et thème déjà servis sous `/update/`). Le paquet de l'application n'est pas concerné.

## Animations

Images clés en `transform` et `opacity` seulement (36 propriétés relevées, vérifié par le nouveau test) ; aucune transition sur
une autre propriété ; aucune animation SMIL. Le bouton de pause fige les effets (`animation-play-state`) sans arrêter le suivi ;
le mouvement réduit retire toutes les animations et le bouton de pause ; l'impression donne un rendu statique.

## Contrôles exécutés

- Prettier, ESLint (`--max-warnings 0`) sur les fichiers modifiés, `tsc` de `tests/e2e`, vérification du CHANGELOG.
- Portage (agent `codeur`) : Vitest shared 611 et web 392, typecheck et lint du dépôt.
- Harnais local hors dépôt, avec la CSP exacte du frontal pour `/update/*` : 53 contrôles, dont le rejeu des assertions de
  `zy-updates.spec.ts` sur `/update/`, douze états en clair et en sombre sans erreur CSP ni JS, huit tailles (390 à 2560 px).
- Nouveau test `zy-updates-neon.spec.ts` : 3/3 sur le harnais local. Niveau de preuve : navigateur réel et CSP du frontal, mais
  hors pile Docker ; la preuve sur le frontal réel est la CI de la PR (`zy-updates`, `zy-updates-neon`, `update-integree.py`).
- Non testés : Firefox et Safari (`color-mix`, `:has`, `mask-image`).

## Limites

- Journal technique non raccordé (lot 2) : la zone affiche « Journal technique indisponible pendant cette opération. », sans
  ligne simulée. Le lot n'est donc pas terminé au sens du dossier.
- La page est servie par le frontal : elle n'apparaît en production qu'avec une image `GATEWAY_VERSION` qui la contient.

## Captures

Captures d'intégration (données fictives, version 3.0.0 vers 3.1.0) : douze états en clair et en sombre à 1440 × 900, mouvement
réduit, huit tailles. Elles ont été présentées au RSSI dans la conversation et ne sont pas versionnées : aucune capture de
référence n'est ajoutée ni remplacée.

## État d'intégration et prochaine action

Commit sur `claude/refonte-neon`, PR vers `claude-suivi-smsi` ; pas de fusion sans accord du RSSI. Prochaines actions : CI verte,
validation des quatre changements visibles ci-dessus par le RSSI, puis lot 2 (journal complet : collecte, expurgation des
secrets côté serveur, transport privé pendant l'arrêt de l'API) selon l'option A, B ou C de
`05-JOURNAL-COMPLET-ET-SECRETS.md`, à choisir par le RSSI.
