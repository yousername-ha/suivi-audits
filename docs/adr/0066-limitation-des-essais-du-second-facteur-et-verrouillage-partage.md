# ADR 0066 — Limitation des essais du second facteur et verrouillage partagé

- Statut : acceptée
- Date : 2026-10-28
- Contexte : revue de sécurité de l'authentification (OWASP ASVS 4.0 niveau 2 ; ISO 27001:2022 A.5.17 et A.8.5). Le second facteur (code TOTP) n'était limité que par session ; le compteur d'échecs persistant et le verrouillage progressif ne concernaient que le mot de passe.

## Décision

1. **Limite par compte.** Les essais du second facteur sont limités à 10 par quart d'heure et par compte (en plus de la limite existante par session). Au-delà : réponse 429.
2. **Un seul compteur d'échecs.** Les colonnes `failed_logins` et `locked_until` servent aux deux facteurs. Une méthode unique, `enregistrerEchec`, incrémente le compteur **de façon atomique** (une seule instruction SQL) puis applique le verrouillage progressif existant (seuil et durées des réglages de sécurité, multiplicateur plafonné à 8). Un verrou en cours n'est jamais raccourci.
3. **Remise à zéro.** Pour un compte dont le second facteur est actif, le compteur n'est plus effacé par un mot de passe correct mais par le **succès du second facteur**. Pour un compte sans second facteur actif (enrôlement en cours, ou second facteur non exigé), il reste effacé par le mot de passe correct.
4. **Compte verrouillé.** Une session à l'étape du second facteur dont le compte est verrouillé est refusée (423, même message que la connexion) et **détruite**.
5. **Sessions incomplètes.** Un compte garde au plus **trois** sessions à l'étape du second facteur, les plus récentes. Les plus anciennes sont supprimées à la création d'une nouvelle.
6. **Vérifications du mot de passe actuel.** Le changement de mot de passe, le début d'enrôlement et la désactivation du second facteur sont limités à 5 vérifications par quart d'heure et par compte (429). Chaque échec est compté dans le verrouillage et journalisé (`account.password_failed`).

## Conséquences

- Aucune migration : les colonnes existent déjà.
- **Compromis accepté** : une personne qui connaît le mot de passe d'un compte peut le verrouiller en échouant au second facteur. C'est le même compromis que le verrouillage par mot de passe, déjà accepté ; le déverrouillage par un administrateur reste disponible.
- Les limites par compte sont en mémoire du processus (comme les limites existantes) : elles sont remises à zéro au redémarrage ; le compteur persistant, lui, ne l'est pas.
- Deux onglets ouverts par un même utilisateur légitime ne sont pas gênés (trois sessions incomplètes autorisées).
