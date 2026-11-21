-- Tableaux de bord multiples de l'accueil et mode public (ADR 0109, décisions du RSSI du 20/11/2026). Migration de schéma
-- seulement, rejouable : aucune donnée existante n'est modifiée ni recopiée (pas de reprise de données, AGENTS.md). Les
-- tableaux déjà enregistrés restent ceux de leur auteur ; la disposition par défaut de l'organisation (ADR 0078, ligne
-- sans propriétaire ni modèle) et le tableau affiché (tableaux_de_bord_choix) ne sont plus lus.

-- Plusieurs tableaux par propriétaire, au plus 20 (contrôlé par l'API) : les index uniques du lot 2a disparaissent.
DROP INDEX IF EXISTS tableaux_de_bord_proprietaire;
DROP INDEX IF EXISTS tableaux_de_bord_defaut;

-- public : publié pour tout le monde par son propriétaire (droit tableau_de_bord:administrer) ; publie_le : date de la
-- publication en cours. modele : tableau proposé d'office (sans propriétaire), décrit dans le code (DEFS_MODELES) ;
-- surchargee : faux, sa disposition vient du code ; vrai, celle enregistrée par l'administrateur. chiffres_servis_le :
-- première lecture servie des chiffres ouverts de l'auteur ; remis à vide à la première lecture refusée (auteur inactif ou
-- privé du droit, module désactivé), qui est journalisée une seule fois comme suspension.
ALTER TABLE tableaux_de_bord
  ADD COLUMN IF NOT EXISTS public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publie_le timestamptz,
  ADD COLUMN IF NOT EXISTS modele text,
  ADD COLUMN IF NOT EXISTS surchargee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chiffres_servis_le timestamptz;

-- Seul un tableau qui a un propriétaire se publie ; un tableau proposé d'office n'a pas de propriétaire.
ALTER TABLE tableaux_de_bord DROP CONSTRAINT IF EXISTS tableaux_de_bord_public_proprietaire;
ALTER TABLE tableaux_de_bord ADD CONSTRAINT tableaux_de_bord_public_proprietaire
  CHECK (NOT public OR proprietaire IS NOT NULL);
ALTER TABLE tableaux_de_bord DROP CONSTRAINT IF EXISTS tableaux_de_bord_modele_sans_proprietaire;
ALTER TABLE tableaux_de_bord ADD CONSTRAINT tableaux_de_bord_modele_sans_proprietaire
  CHECK (modele IS NULL OR (proprietaire IS NULL AND modele ~ '^[a-z][a-z0-9-]{0,39}$'));

CREATE INDEX IF NOT EXISTS tableaux_de_bord_par_proprietaire ON tableaux_de_bord (proprietaire);
CREATE INDEX IF NOT EXISTS tableaux_de_bord_publics ON tableaux_de_bord (proprietaire) WHERE public;
-- Un seul tableau proposé par modèle ; un nom par propriétaire, sans tenir compte de la casse.
CREATE UNIQUE INDEX IF NOT EXISTS tableaux_de_bord_modele ON tableaux_de_bord (modele) WHERE proprietaire IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tableaux_de_bord_nom_par_proprietaire
  ON tableaux_de_bord (proprietaire, lower(nom)) WHERE proprietaire IS NOT NULL;

-- Destinataires par rôle (prédéfini ou personnalisé) : un rôle supprimé emporte ses partages.
ALTER TABLE tableaux_de_bord_partages ADD COLUMN IF NOT EXISTS role text REFERENCES roles (id) ON DELETE CASCADE;
ALTER TABLE tableaux_de_bord_partages DROP CONSTRAINT IF EXISTS tableaux_de_bord_partages_check;
ALTER TABLE tableaux_de_bord_partages DROP CONSTRAINT IF EXISTS tableaux_de_bord_partages_un_destinataire;
ALTER TABLE tableaux_de_bord_partages ADD CONSTRAINT tableaux_de_bord_partages_un_destinataire
  CHECK (num_nonnulls(utilisateur, groupe, role) = 1);
CREATE UNIQUE INDEX IF NOT EXISTS tableaux_de_bord_partages_role
  ON tableaux_de_bord_partages (tableau, role) WHERE role IS NOT NULL;
CREATE INDEX IF NOT EXISTS tableaux_de_bord_partages_destinataire_r ON tableaux_de_bord_partages (role);

-- Onglets de chaque personne, dans son ordre (au plus 30, contrôlé par l'API) ; réécrits en une transaction. Sans ligne,
-- l'accueil affiche le tableau proposé « Global ». La visibilité est recontrôlée à chaque lecture.
CREATE TABLE IF NOT EXISTS tableaux_de_bord_onglets (
  utilisateur uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tableau     uuid NOT NULL REFERENCES tableaux_de_bord (id) ON DELETE CASCADE,
  rang        integer NOT NULL CHECK (rang >= 0),
  PRIMARY KEY (utilisateur, tableau)
);
CREATE INDEX IF NOT EXISTS tableaux_de_bord_onglets_tableau ON tableaux_de_bord_onglets (tableau);
