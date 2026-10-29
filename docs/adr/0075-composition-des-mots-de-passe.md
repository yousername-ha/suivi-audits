# ADR 0075 — Composition des mots de passe de compte

- Statut : acceptée par le RSSI le 29/10/2026 (numéro confirmé)
- Date : 2026-10-28
- Contexte : le dossier de correctifs du 27/10/2026 laissait deux points en « décision de politique interne » : la composition des mots de passe (OWASP ASVS 4.0, 2.1.9) et le refus des mots de passe compromis (2.1.7). Le RSSI décide, le 28/10/2026, de développer la composition en l'**alignant sur les règles du poivre** ([ADR 0072](0072-poivre-des-mots-de-passe.md)) et de **documenter** seulement le second point.

## Décision

1. **Une seule règle, partagée** (`packages/shared/src/mot-de-passe.ts`) entre le serveur (autorité) et l'interface (critères affichés en direct sous le champ). Elle s'applique à l'installation initiale et au changement de mot de passe (y compris le mot de passe temporaire).
2. **Règles conservées** : longueur minimale du réglage « Sécurité » (au moins 12), 256 au plus, au moins 3 types de caractères parmi minuscules, majuscules, chiffres et symboles, ne pas contenir l'identifiant, nouveau mot de passe différent de l'actuel (déjà vérifié par le serveur).
3. **Règles ajoutées**, les mêmes que pour le poivre : pas plus de 3 caractères identiques à la suite ; pas de suite de plus de 4 caractères consécutifs (abcde, 54321, azerty, qwerty…) ; ne contient ni le nom de l'application ni celui de l'organisation. La comparaison se fait sans tenir compte de la casse (après normalisation NFKC) et **ignore tout texte de moins de 3 caractères**, identifiants compris (`packages/shared/src/mot-de-passe.ts`) : un identifiant de 1 ou 2 caractères n'est donc pas refusé. Le nom d'organisation saisi dans l'assistant d'installation est lui aussi refusé comme mot de passe (PR #176).
4. **Un message par critère**, jamais le mot de passe lui-même (ni dans la réponse, ni dans le journal).
5. **Mots de passe temporaires générés** par l'application (création et réinitialisation de compte) : inchangés ; ils doivent être remplacés à la première connexion, par un mot de passe qui respecte la règle.

## Non retenu : refus des mots de passe compromis (ASVS 2.1.7), documenté

- **Pas de liste intégrée ni d'appel externe.** Une vérification par service tiers (liste publique interrogée par préfixe de hachage) exigerait une sortie réseau vers un tiers à chaque changement de mot de passe, alors que la sortie réseau est facultative et désactivée par défaut ([ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md)). Une liste locale (quelques milliers de mots de passe courants) apporterait un gain limité pour un poids de maintenance réel (mise à jour, licence, taille).
- **Atténuations en place** : longueur minimale de 12, trois types, refus des répétitions, des suites et des noms prévisibles, second facteur obligatoire, verrouillage et limitation des essais ([ADR 0066](0066-limitation-des-essais-du-second-facteur-et-verrouillage-partage.md)), poivre ([ADR 0072](0072-poivre-des-mots-de-passe.md)).
- **Si le RSSI le décide plus tard** : liste locale facultative déposée sur le serveur (un mot de passe par ligne, comparaison insensible à la casse), chargée au démarrage et appliquée par la même fonction partagée ; à prévoir dans une décision séparée (source de la liste, mise à jour, licence).

## Conséquences

- **Écart assumé avec la lettre d'ASVS 2.1.9** (« aucune règle de composition limitant les types de caractères ») et avec la recommandation NIST SP 800-63B : la règle des trois types existait déjà et reste, à la demande du RSSI ; les règles ajoutées n'interdisent aucun type de caractère.
- Un mot de passe valide avant cette version reste utilisable : la règle s'applique aux nouveaux mots de passe, pas aux existants.
- Les parcours automatisés (guide, tests de bout en bout) utilisent des mots de passe conformes.
