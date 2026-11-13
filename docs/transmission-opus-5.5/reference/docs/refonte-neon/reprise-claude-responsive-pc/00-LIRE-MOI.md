# Reprise Claude — refonte Neon, priorité PC

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Ce dossier permet de reprendre le travail avec le code effectivement livré, les décisions du demandeur, les nouvelles maquettes et un plan d’intégration. **La priorité est le PC : portable, bureau, grand écran et fenêtre redimensionnée. Le téléphone n’est pas important pour le lot actuel.**

## À transmettre à Claude

1. Fournir le dossier complet et le texte de `01-PROMPT-CLAUDE.md`.
2. Si Claude n’a pas déjà les sources, extraire l’archive dans `source/`. Elle contient le projet complet de la dernière livraison Docker interfaces, pas seulement des images.
3. Si un dépôt existe déjà, comparer sa version avec la référence livrée ; préserver les modifications en cours. Ne pas remplacer aveuglément le dépôt.
4. Ouvrir les visuels PC et lire `02-DECISIONS-ET-ETAT.md`, puis `03-PLAN-INTEGRATION.md`.

## Contenu du dossier téléchargeable

| Élément | Utilité |
| --- | --- |
| `source/suivi-audits-neon-lignes-validation-docker-2026-11-11.zip` | Sources applicatives complètes et profil Docker interfaces, référence `23b33b5` |
| `01-PROMPT-CLAUDE.md` | Consigne prête à copier pour la reprise |
| `02-DECISIONS-ET-ETAT.md` | Acquis, fonctionnalités à conserver et nouvelle finition proposée |
| `03-PLAN-INTEGRATION.md` | Fichiers réels, points d’attention et ordre de travail |
| `04-RECETTE-PC.md` | Contrôles attendus après validation et intégration |
| `05-SOURCES-ET-VERSIONS.md` | Références, empreinte de l’archive source et limites |
| `06-VERIFICATIONS.md` | Vérifications réellement faites, séparées des tests historiques |
| `CHARTE-RESPONSIVE.md` | Exigence transversale de proportions et lisibilité |
| `visuels-pc/` | Captures natives portable, bureau, grand écran, liste et Kanban |
| `maquettes/` | HTML/CSS/JS autonomes, données fictives et police locale |
| `versions.json`, `MANIFESTE-SHA256.txt` | Inventaire vérifiable du dossier |

## Prévisualiser sans démarrer Docker

Depuis la racine du dossier, lancer un serveur statique :

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory maquettes
```

Sous Windows, `py` peut remplacer `python`. Ouvrir ensuite :

```text
http://127.0.0.1:8080/docs/refonte-neon/propositions/responsive-equilibre/
```

La maquette ne lit ni n’écrit dans l’application. Pour le projet réel, suivre le guide `docs/refonte-neon/DOCKER-INTERFACES.md` dans l’archive source.

**État exact : fonctionnalités précédentes intégrées dans le code livré ; nouvelle finition vues/filtres et proportions PC encore proposée.** Le demandeur a imposé la validation visuelle avant chaque nouvelle intégration, puis les tests et de nouvelles captures. La remise de ce dossier ne constitue pas une validation des nouvelles images. Cette règle ne remet pas en attente les intégrations déjà autorisées et terminées.
