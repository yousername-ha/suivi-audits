# ADR 0109 — Tableaux de bord multiples de l'accueil et mode public

- Statut : acceptée (décisions du RSSI du 20/11/2026, maquettes validées le même jour)
- Date : 2026-11-20
- Rédaction : session « Ergonomie et refonte Neon », avis du conseiller du dépôt
- Contexte : l'[ADR 0078](0078-disposition-et-partage-du-tableau-de-bord.md) donne à chaque personne **un** tableau de
  bord, une disposition par défaut de l'organisation, le partage en lecture et le choix du tableau affiché ;
  l'[ADR 0108](0108-tableau-de-bord-unique.md) en fait un tableau unique au style de la vue analytique. Demande du RSSI du
  19/11/2026 : plusieurs tableaux de bord nommés (par exemple Global, Suivi SMSI, Vulnérabilités), chacun avec sa
  disposition de dalles, et un mode public.

## Décision

1. **Plusieurs tableaux par personne, en onglets.** Chacun crée autant de tableaux nommés qu'il veut, au plus 20, avec le
   droit `tableau_de_bord:modifier` ; le catalogue ne propose que les dalles des modules qu'il lit. Les tableaux
   s'affichent en **onglets** au-dessus du tableau, à la forme commune des onglets, au plus 30 ; on les réordonne en les
   **glissant comme les rubriques du menu** (et au clavier) ; l'ordre est retenu pour chaque personne. À l'ouverture de
   l'accueil, le **premier onglet** s'affiche.
2. **« + » : créer ou ajouter.** « Créer un nouveau tableau » : un nom, puis un point de départ — vide (le catalogue s'ouvre
   aussitôt), la disposition standard de la vue analytique, ou la **copie d'un tableau** choisi dans une liste de ses
   tableaux et des tableaux publics, ces derniers suivis de « (Public) ». C'est le seul chemin de copie : le bouton
   « Copier comme mon tableau » de l'ADR 0078 disparaît. Une copie ne prend que la disposition ; elle est à son auteur et
   suit ses droits. « Ajouter un tableau existant » : un tableau proposé d'office, partagé avec la personne ou public ;
   il reste celui de son auteur, tenu à jour, en **lecture seule**.
3. **Tableaux proposés d'office**, décrits dans le code (`DEFS_MODELES`, `packages/shared/src/tableaux-de-bord.ts`) pour
   rester à jour du catalogue de dalles ; l'administrateur (`administration:administrer`) peut modifier leur disposition
   et leur public, gardés en base : **Global** (disposition de la vue analytique, tout le monde ; une nouvelle personne
   démarre avec cet onglet), **Suivi SMSI** (objectifs, indicateurs, plans, tâches récurrentes, écarts, tout le monde),
   **Vulnérabilités** (rôle RSSI, quand les dalles du module existeront) et **Suivi réglementaire** (rôles RSSI et DPO,
   quand le module de veille réglementaire de la session Vulnérabilités existera, ADR 0110). Un tableau proposé dont les
   dalles n'existent pas encore figure « Bientôt ».
4. **Partage et public visé.** Un tableau se partage avec des **personnes, des groupes ou des rôles** ; un tableau
   proposé vise tout le monde ou des rôles, groupes, personnes (cadenas sur l'onglet quand il est restreint).
5. **Ouverture des chiffres** (choix « B » puis « A » du RSSI, exception volontaire à la règle des droits). Un tableau
   **publié** est visible par tout le monde ; un tableau **partagé par un détenteur du droit « Publier pour tous »** est
   visible par ses destinataires ; dans les deux cas, ses **chiffres et graphiques** sont ceux de son **auteur**, calculés
   avec **tous ses droits et tous ses périmètres, registres restreints compris** (choix « B »), visibles même sans droit
   sur les modules concernés. Restent selon les droits de chacun : les **listes nommées** (intitulés d'écarts, d'actions,
   d'incidents, journées du plan d'audit), l'accès aux **registres** et la carte **Journal d'audit technique** (jamais
   ouverte aux autres). Un partage par une personne sans ce droit ne montre le tableau qu'avec les droits de chaque
   destinataire. Lecture seule pour tous sauf l'auteur.
6. **Droit « Publier pour tous ».** C'est l'action `administrer` du module `tableau_de_bord` (libellé propre à ce module
   dans l'écran des rôles : « Publier pour tous » ; `modifier` : « Créer et partager »), que les rôles RSSI et
   Administrateur ont d'office ; un administrateur peut l'accorder à un rôle personnalisé. Seul le **propriétaire**
   publie son tableau ; un rôle personnalisé qui portait déjà ce droit, sans effet jusqu'ici, gagne la publication.
7. **Calcul côté serveur, en liste blanche.** `GET /api/tableaux-de-bord/:id/chiffres` répond seulement si les chiffres
   du tableau sont ouverts à la personne et si son **propriétaire** a encore un compte actif et le droit de publier
   (droits relus à chaque calcul ; sinon 404, et le tableau ne s'affiche plus qu'avec les droits de chacun). Le serveur
   calcule la synthèse avec les droits et la portée du propriétaire, puis construit `ChiffresPublics` champ par champ :
   des nombres et des libellés tirés de listes fermées (statut ou classification inconnus : « Autre »), aucune liste
   nommée, aucun journal. Pas de cache partagé ; limite de débit sur la route. Module `tableau_de_bord` désactivé : 404.
8. **Ouvert à tout compte connecté.** Les lectures du tableau de bord passent de la garde « métier » à la garde
   « connecté », pour qu'un compte sans droit métier voie les tableaux publics.
9. **Journal.** Publication, retrait, partage modifié ; suspension du mode public à la première lecture refusée. Les
   lectures ne sont pas journalisées.
10. **Stockage, sans reprise de données** (règle du 14/11/2026, AGENTS.md). Migration `096`, de schéma seulement et
    rejouable : plusieurs tableaux par propriétaire (index unique retiré), colonnes `public`, `publie_le`, `modele` ;
    destinataires par rôle ; table des onglets ordonnés. Les tableaux déjà enregistrés restent ceux de leur auteur ; le
    « tableau affiché » de l'ADR 0078 n'est plus lu ; les routes de l'ADR 0078 sont remplacées.

## Conséquences

- Les tests de l'API et la spec e2e des tableaux de bord sont réécrits sans être affaiblis (validation du RSSI avant
  commit), avec des cas nouveaux : compte sans droit métier, liste blanche des chiffres, auteur désactivé ou privé du
  droit, publication sans le droit, module désactivé, rôle destinataire supprimé.
- Risque accepté par le RSSI (choix « B ») : les chiffres d'un tableau publié par un administrateur comptent les registres
  restreints ; sur de petits nombres, une variation peut renseigner sur leur contenu.
