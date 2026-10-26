# ADR 0059 — Relance automatique des courriels de notification

- Statut : acceptée
- Date : 2026-10-26
- Contexte : décision de l'utilisateur du 26/10/2026 (« Relance automatique des courriels : implémente »), qui lève la limite « aucune relance automatique » de l'[ADR 0058](0058-notifications-metier.md) (point 7). S'appuie sur l'[ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md) : l'API n'envoie rien, l'exécutant d'exploitation du serveur envoie. Règle du projet : tout se configure dans l'interface.

## Décision

1. **Quand relancer.** Une notification dont l'envoi échoue de façon passagère (serveur SMTP injoignable, connexion refusée, délai dépassé, authentification ou certificat refusés le temps que l'exploitant corrige la configuration) est **remise en file** au lieu d'être close en échec. Il en va de même quand l'exécutant a été interrompu pendant l'envoi (demande « en cours » depuis plus de trois minutes).
2. **Quand ne pas relancer.** (a) Le serveur refuse le destinataire de façon **définitive** (tous les codes en 5xx pour `SMTPRecipientsRefused`) : `scripts/courriel-envoi.py` le signale par `permanent: true` et la demande est close. (b) Le **message de test** n'est jamais relancé : il est lancé à la main et son résultat s'affiche tout de suite. (c) Un destinataire devenu inutilisable (désactivé, expiré, sans adresse) ou une configuration devenue incomplète clôt la demande, comme avant.
3. **Combien et à quel rythme.** Deux réglages dans Administration > Configuration système > Courriel : « Essais par notification » (1 à 10, 5 par défaut, premier envoi compris ; 1 = aucune relance) et « Délai avant la première relance » (1 à 1 440 minutes, 10 par défaut). Le délai est **doublé à chaque échec** et plafonné à 24 heures (5 essais à 10 minutes : 10, 20, 40, 80 minutes). Une notification en attente depuis plus de 3 jours reste abandonnée comme avant (ADR 0058).
4. **Mécanique.** Migration `045_courriel_relances.sql` : `courriel_jobs.attempts` (compté à la réclamation) et `courriel_jobs.next_attempt_at` (une demande n'est réclamée qu'une fois l'échéance atteinte). `Courriel.terminer` remet la demande « en attente » avec l'explication de la dernière erreur tant qu'il reste des essais ; sinon elle est close en échec et l'adresse est effacée. Tout se fait sous verrou (`FOR UPDATE`) : une demande ne peut être ni relancée deux fois ni terminée deux fois. Pas de nouvelle file ni de planificateur : l'exécutant, qui passe déjà régulièrement, réclame ce qui est échu.
5. **Visibilité.** La carte « Destinataires des notifications » indique, dans la synthèse des sept derniers jours, combien de demandes en attente sont des relances (« dont N à relancer »), toujours sans adresse.

## Ce qui n'est pas fait

- Pas de purge automatique de `courriel_jobs` : les demandes terminées gardent leur état et leur trace sans adresse ni contenu métier ; la conservation n'est pas étendue à cette table (aucune suppression automatique, ADR 0048).
- Pas de regroupement (digest) : un courriel par notification et par personne.
- Un refus définitif n'est reconnu que pour le destinataire ; les autres échecs 5xx du serveur sont relancés dans la limite des essais.
- Jamais éprouvé contre un vrai serveur SMTP (faux serveur et tests de la file seulement).
