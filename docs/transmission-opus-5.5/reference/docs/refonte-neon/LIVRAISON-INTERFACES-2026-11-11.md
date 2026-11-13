# Livraison du Docker interfaces Neon

11 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

- Sources applicatives et guide dans le ZIP : `5ed760b234627510afb7b13578c151b9b7abeae4`.
- Archive : `suivi-audits-neon-interfaces-2026-11-11.zip`, 1319 fichiers, 34931041 octets.
- SHA-256 : `fb9f20e0f97c2eca1a1b9e635c33e09aa720157a33183e0cafc1a0908337c446`.
- Export local : `/workspace/exports/suivi-audits-neon-interfaces-2026-11-11.zip`.
- Vidéo de l’application intégrée : `/workspace/exports/neon-animation-renforcee.mp4`, 1600 × 1050, 29,37 secondes, H.264, plage TV.
- Captures HD natives : [clair](captures/timeline-studio/recurrences-clair-hd.png), [sombre](captures/timeline-studio/recurrences-sombre-hd.png) ; les deux vues Actions sont dans le même dossier et le ZIP.

Archive relue par CRC, sans doublon ni traversée de chemin. Toutes les sources `apps/`, `packages/` et `scripts/` sont identiques au commit ; les fichiers critiques des profils Docker et de toutes les intégrations précédentes sont présents. Aucune dépendance installée, base locale ni identité générée. Recherche des valeurs privées réellement créées dans chaque fichier décompressé : aucune trouvée.

Lancer depuis le dossier extrait :

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml up -d --build
```

Ouvrir http://localhost:5174. Ce profil distinct initialise ses données fictives et sa session locale sans écran de connexion. Les données et le profil Docker précédents restent conservés.

La [recette](TIMELINE-STUDIO-INTEGREE.md) détaille les contrôles réussis et la limite du lancement complet Compose dans le cloud : disque insuffisant et nettoyage manuel interne refusé automatiquement pour risque sur les autres conteneurs. La même entrée applicative a été vérifiée nativement sur une base PostgreSQL Docker isolée ; le build de l’image a réussi. L’essai du demandeur sur Docker Desktop Windows reste la prochaine étape. Aucun push ni déploiement.
