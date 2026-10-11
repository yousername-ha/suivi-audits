# Risques du projet

Référence applicative analysée : `f9545c3ce1a1338f13bb39bdaa4468bcc907da2d`. Mise à jour : 2026-10-11T22:10:00+02:00 (Europe/Paris).

Les risques de sécurité distincts sont les 7 entrées SEC de
[SECURITE](../03_ARCHITECTURE/SECURITE.md), source [registre de référence](../08_PILOTAGE/REGISTRES.json).

| ID       | Risque transversal                                       | Preuve / incertitude                                                 | Mesure et prochaine action                                                  |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| RISQ-001 | Perte de données lors d’une reprise/migration mal cadrée | Sources v2 et champs extras existent ; données client inconnues      | Mapper/adaptateur unique, simulation, archive et aller-retour ; MIG-001.    |
| RISQ-002 | Recette CI assimilée à acceptation utilisateur           | Aucun compte rendu serveur/PV explicite                              | TEST-041/042 ; conserver PV en attente.                                     |
| RISQ-003 | Fausse conformité ISO/HDS                                | Textes sous licence et grilles inaccessibles ; modèles configurables | Sources officielles, portée/licence/version ; aucun certificat automatique. |
| RISQ-004 | Dépassement du quota Actions                             | Durée CI complète observée, coût mensuel non mesuré                  | OPT-006/007 ; garder privé et éviter relances sans raison.                  |
| RISQ-005 | Extension involontaire D/J/I/F                           | Fonctionnalités v2 recoupent des lots exclus                         | DOC-002 ; clarification de périmètre avant développement.                   |
| RISQ-006 | Erreurs sur cartes à grands volumes                      | Bornes et pagination présentes, SLO inconnus                         | TEST-043 et OPT-008.                                                        |
| RISQ-007 | Dépendance à l’historique inaccessible                   | Refs anciennes/retours serveurs/documents manquants                  | Signaler INCONNU ; conserver preuves disponibles, pas d’invention.          |

Ni criticité globale chiffrée ni probabilité ne sont inventées ; ces entrées
priorisent des contrôles. Les seuils des risques métier restent ceux des
méthodes et politiques versionnées de l’application, distincts de cet audit.
