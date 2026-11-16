# ADR 0101 — Mandataire sortant (proxy) de l'établissement : un réglage unique pour les flux vers Internet

- Statut : **retenue pour réalisation, lot P1** (réglage et veille). Le RSSI a répondu le 16/11/2026 aux questions de cadrage
  (décisions M1 à M4) et demandé de prévoir l'authentification et l'inspection ; la session en déduit son accord pour ce
  premier lot (lecture de la session, à confirmer par lui). Numéro 0101 annoncé au RSSI le 16/11/2026.
- Date : 2026-11-16
- Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`)
- Contexte : en réalisant la veille des vulnérabilités ([ADR 0100](0100-module-vulnerabilites.md)), le RSSI indique que le
  serveur de production ne sort vers Internet que par le **mandataire de l'établissement**, utilisé par ses applications.
  Tenable Security Center, interne, est joint directement.
- S'appuie sur : [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (API sans accès sortant),
  [ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md), [ADR 0086](0086-assistant-rssi-integre.md) (relais du modèle),
  [ADR 0097](0097-flux-sortants-pilotes-par-les-modules.md) (registre des flux).

## Décisions du RSSI (16/11/2026)

| N°  | Question                       | Décision                                                                                              |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| M1  | Forme de l'adresse             | `http://hôte:port`, l'hôte pouvant être un **nom ou une adresse IP**                                   |
| M2  | Authentification               | **À prévoir** : identifiant et mot de passe possibles                                                  |
| M3  | Inspection du trafic chiffré   | **À prévoir** : le mandataire peut présenter son propre certificat ; autorité de l'établissement à fournir |
| M4  | Existant                       | La plateforme ne tourne pas aujourd'hui sur l'environnement de production derrière ce mandataire      |

## Faits relevés le 16/11/2026

- **Aucun réglage de mandataire n'existe dans la plateforme**, pour aucun flux (recherche dans le code, les scripts, le
  fichier Compose et la documentation).
- Flux vers Internet du registre de l'ADR 0097 et leur porteur :
  - veille des vulnérabilités : script Python de l'exécutant (`scripts/veille-vulnerabilites.py`), connexion HTTPS directe ;
  - assistant : conteneur `assistant-relais` (Node), connexion HTTPS directe vers le fournisseur du modèle ;
  - mises à jour : exécutant (`scripts/update-worker.py` : `urllib` vers GitHub, `cosign`, et le démon Docker pour les images) ;
  - antivirus : conteneur `freshclam` (signatures) et démon Docker (image) ;
  - certificat ACME : passerelle Caddy ;
  - courriel : SMTP, **non concerné** par un mandataire HTTP.
- Le flux `tenable` est interne : **jamais** par le mandataire.
- **Non vérifié** : le comportement de `cosign`, de `freshclam`, de Caddy (ACME) et du démon Docker derrière un mandataire ;
  le type d'authentification du mandataire de l'établissement (simple, NTLM, Kerberos) ; s'il inspecte réellement le trafic.

## Décision proposée

1. **Un réglage unique « Mandataire sortant »** dans la configuration système (`administration:administrer`) : adresse
   `http://hôte:port` (nom ou adresse IP, adresses privées admises), identifiant facultatif, mot de passe facultatif,
   autorité de certification de l'établissement facultative (PEM). Désactivé par défaut : sans réglage, les flux sortent
   directement, comme aujourd'hui.
2. **Mot de passe en écriture seule**, scellé par le coffre comme `secret:courriel` : jamais relu par l'interface, jamais
   renvoyé ni journalisé ; ajouté au masquage des journaux. Il n'est envoyé **qu'au mandataire**, jamais à la destination.
3. **Authentification simple seulement** (identifiant et mot de passe, en-tête `Proxy-Authorization: Basic`). NTLM et
   Kerberos ne sont pas pris en charge : la bibliothèque standard ne les offre pas, et une dépendance nouvelle demanderait une
   décision à part.
4. **Le chiffrement reste vérifié de bout en bout.** Le flux ouvre un tunnel (`CONNECT`) à travers le mandataire, puis
   vérifie le certificat de la destination. Si le mandataire inspecte le trafic, le certificat présenté est le sien :
   l'autorité de l'établissement, fournie par l'administrateur, est alors **ajoutée** aux autorités reconnues pour les seuls
   flux qui passent par le mandataire. Il n'existe aucune option « ne pas vérifier le certificat ».
5. **Le mandataire ne sert qu'aux flux vers Internet.** Les connecteurs internes (Tenable Security Center, et tout connecteur
   de portée interne) restent en accès direct, par construction et non par une liste d'exclusions.
6. **Registre des flux** (ADR 0097) : quand le mandataire est réglé, chaque flux concerné l'indique dans sa validation
   (destination finale inchangée, « par le mandataire réglé ») et dans sa ligne de pare-feu (sortie du serveur vers le
   mandataire). L'écran de configuration dit quels flux l'utilisent et lesquels ne le peuvent pas encore.
7. **Réalisation par lots**, un flux à la fois, chacun vérifié :
   - **P1** : réglage, coffre, remise à l'exécutant, **veille des vulnérabilités** ;
   - **P2** : assistant (conteneur `assistant-relais`) ;
   - **P3** : mises à jour, antivirus, ACME. Ces flux dépendent d'outils tiers et du démon Docker de l'hôte : chacun est
     étudié avant d'être promis ; ce qui relève de l'hôte (démon Docker) est décrit dans le guide d'installation et non
     réglé par la plateforme.
8. **Aucune dépendance nouvelle.**

## Conséquences

- La plateforme devient installable derrière le mandataire d'un établissement, flux par flux.
- **Avec inspection du trafic, le mandataire lit ce qui passe.** Pour la veille, ce sont des demandes de lecture de sources
  publiques. Pour l'assistant, ce sont les extraits du SMSI envoyés au fournisseur du modèle : ils deviennent lisibles par le
  mandataire de l'établissement, à inscrire dans l'appréciation des risques.
- Ajouter l'autorité de l'établissement élargit ce qui est reconnu pour ces flux : elle doit venir d'une source sûre.
- **Limites assumées** : pas de NTLM ni de Kerberos ; pas de fichier de configuration automatique (PAC) ; pas de mandataire
  SOCKS ; un seul mandataire pour tous les flux ; le démon Docker de l'hôte se règle hors de la plateforme.
- **Alternatives écartées** : variables d'environnement `HTTPS_PROXY` posées à la main sur le serveur (contraire à l'ADR 0077,
  installation sans ligne de commande, et mot de passe en clair dans un fichier) ; faire passer Tenable par le mandataire ;
  désactiver la vérification du certificat quand le mandataire inspecte.

## Points ouverts, à trancher par le RSSI

1. Type d'authentification réel du mandataire : simple (pris en charge), ou NTLM / Kerberos (non pris en charge) ?
2. Le mandataire inspecte-t-il réellement le trafic chiffré ? Si oui, d'où vient le certificat de l'autorité à fournir ?
3. Ordre des lots : veille d'abord (proposé), puis assistant, puis mises à jour, antivirus et ACME ?
4. Faut-il admettre une adresse de mandataire en `https://` (connexion chiffrée jusqu'au mandataire lui-même) ?
