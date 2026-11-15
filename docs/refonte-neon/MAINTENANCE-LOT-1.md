# Refonte Neon — Maintenance, lot 1 : habillage de la page de mise à jour

15/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/refonte-neon`, partie de
`claude-suivi-smsi` (`8ff37b6`). Dossier source : `docs/transmission-opus-5.5/maintenance-neon` (branche
`codex/transmission-neon-opus-5-5`). Décision du RSSI du 15/11/2026, après revue des captures de la maquette isolée :
« Validé, intégrer l'habillage ». Le journal technique complet (lot 2) n'est pas autorisé à ce stade.

## Décisions du RSSI (15/11/2026)

Prises après présentation des captures d'intégration, avant et après :

1. **Attente de prise en charge** : la version cible et l'avis de lenteur, qui peuvent appartenir à l'opération précédente, ne
   sont plus affichés tant que la demande n'est pas prise en charge. Validé.
2. **Échec ou intervention** : l'illustration d'alerte remplace l'indicateur, qui était masqué. Validé.
3. **Thème sombre seul** : la page ne suit plus le thème de l'application ni celui du poste ; pas de bouton de thème.
4. **Aucun bouton de pause, animations continues.** Écart assumé, signalé au RSSI avant décision : le dossier demande une pause
   (`02-EXIGENCES-FINALES.md`, ligne « Mouvement ») et le critère WCAG 2.2.2 (niveau A) demande de pouvoir arrêter une animation
   de plus de cinq secondes. Seule la préférence « réduire les animations » du poste les arrête. Une variante sans bouton, avec
   arrêt automatique après cinq secondes, a été proposée et écartée.

Reste à présenter : les libellés de présentation rédigés pendant le portage (titres d'étape, étiquettes d'état, rappel du
retour, pied de page).

## Fichiers et contrats modifiés

| Fichier                                   | Changement                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `docker/maintenance/index.html`           | Composition validée : en-tête, grande dalle, noyau vectoriel, décor réseau, frise.      |
| `docker/maintenance/maintenance.css`      | Couches de la maquette regroupées, couleurs du thème sombre, mouvement réduit.          |
| `docker/maintenance/maintenance.js`       | Suivi inchangé ; ajout de la présentation (illustration, rang, étiquettes).             |
| `tests/e2e/specs/zy-updates-neon.spec.ts` | Nouveau : thème sombre, animations, mouvement réduit, phase finale sans succès publié.  |
| `docs/INSTALLATION.md`, `CHANGELOG.md`    | Description de la page et limites.                                                      |

Hors interface React : la page est un fichier statique servi par le frontal (`docker/web.Dockerfile`, `/maintenance`) ; aucun
autre service, aucune route, aucune migration, aucune dépendance.

Identifiants conservés : `#title`, `#message` (seule zone `role="status"`), `#elapsed`, `#delay`, `#connection`, `#versions`,
`#receipt`, `#return`, `#steps`, `#animation`, `li[data-phase]` et le texte exact de chaque étape, classes `done` et `current`,
classe `maintenance-card` (lue par `scripts/ci/update-integree.py`). Ajouts : `aria-current="step"` sur l'étape en cours,
attributs `data-art`, `data-fin`, `data-suivi` sur `<html>`. `data-mantine-color-scheme="dark"` est fixé dans la page.

## Comportements préservés

Relevé de `/update/status.json` toutes les 2,5 s (8 s au plus) ; attente du bon job (`?demande=`, deux minutes) ; aucun retour
pendant une préparation active, une maintenance ou une intervention ; adresse `next` limitée à l'origine et hors `/update` ;
`/healthz` exactement `ok` avant tout retour ; retour automatique seulement sur succès, lien « Consulter le résultat dans
l'application » après échec ; avis de lenteur après dix minutes ; avis de connexion interrompue avec dernier état conservé ;
frise horodatée, durée écoulée puis totale, reçu à la fin. La page ne simule ni pourcentage, ni débit, ni ligne de journal.

## Poids

| Fichier           | Avant (gzip)     | Après (gzip)      |
| ----------------- | ---------------- | ----------------- |
| `index.html`      | 2,1 Ko (1,0 Ko)  | 33,3 Ko (6,6 Ko)  |
| `maintenance.css` | 2,2 Ko (0,9 Ko)  | 47,5 Ko (9,8 Ko)  |
| `maintenance.js`  | 6,3 Ko (2,4 Ko)  | 11,1 Ko (3,8 Ko)  |
| Total             | 10,6 Ko (4,3 Ko) | 92,0 Ko (20,2 Ko) |

Aucune image ni police ajoutée (polices et thème déjà servis sous `/update/`). Le paquet de l'application n'est pas concerné.

## Animations

Images clés en `transform` et `opacity` seulement (36 propriétés relevées, vérifié par le nouveau test) ; aucune transition sur
une autre propriété ; aucune animation SMIL. Animations continues, sans bouton de pause (décision 4) ; le mouvement réduit du
poste les retire toutes ; l'impression donne un rendu statique ; un suivi interrompu fige l'illustration du dernier état connu.

## Contrôles exécutés

- Prettier, ESLint (`--max-warnings 0`) sur les fichiers modifiés, `tsc` de `tests/e2e`, vérification du CHANGELOG.
- Portage (agent `codeur`) : Vitest shared 611 et web 392, typecheck et lint du dépôt.
- Harnais local hors dépôt, avec la CSP exacte du frontal pour `/update/*` : 53 contrôles sur la première version (douze états,
  huit tailles de 390 à 2560 px, sans erreur CSP ni JS) ; après les décisions 3 et 4, rejeu des six assertions de
  `zy-updates.spec.ts` portant sur `/update/` (6/6) et nouveau test (3/3).
- CI de la PR sur la première version : 9 contrôles sur 9, dont la suite complète de bout en bout sur le frontal réel
  (240 réussis, 1 ignoré déjà avant), `zy-updates` 10/10, `zy-updates-neon` 3/3 et la montée de version simulée.
- Non testés : Firefox et Safari (`color-mix`, `:has`, `mask-image`).

## Limites

- Journal technique non raccordé (lot 2) : la zone affiche « Journal technique indisponible pendant cette opération. », sans
  ligne simulée. Le lot n'est donc pas terminé au sens du dossier.
- Pause des animations absente (décision 4) : écart au dossier et au critère WCAG 2.2.2.
- La page est servie par le frontal : elle n'apparaît en production qu'avec une image `GATEWAY_VERSION` qui la contient.

## Captures

Captures d'intégration (données fictives, version 3.0.0 vers 3.1.0) présentées au RSSI dans la conversation : douze états en
clair et en sombre, huit tailles, comparaisons avant et après, puis la version sombre sans bouton. Elles ne sont pas
versionnées : aucune capture de référence n'est ajoutée ni remplacée.

## État d'intégration et prochaine action

PR vers `claude-suivi-smsi` ; pas de fusion sans accord du RSSI. Prochaines actions : présentation des libellés au RSSI, CI verte
sur la version sombre sans bouton, puis lot 2 (journal complet : collecte, expurgation des secrets côté serveur, transport privé
pendant l'arrêt de l'API) selon l'option A, B ou C de `05-JOURNAL-COMPLET-ET-SECRETS.md`, à choisir par le RSSI.
