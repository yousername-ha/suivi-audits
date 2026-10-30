-- Partage du tableau de bord de l'accueil et droit dédié (ADR 0078, lot 2b) : un tableau personnel est partagé, en
-- lecture, avec des comptes ou des groupes ; chaque personne choisit le tableau qu'elle affiche. Le partage ne transmet
-- que la disposition (aucune donnée métier). Migration additive et rejouable : aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS tableaux_de_bord_partages (
  tableau     uuid NOT NULL REFERENCES tableaux_de_bord (id) ON DELETE CASCADE,
  utilisateur uuid REFERENCES users (id) ON DELETE CASCADE,
  groupe      uuid REFERENCES groups (id) ON DELETE CASCADE,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((utilisateur IS NULL) <> (groupe IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS tableaux_de_bord_partages_utilisateur
  ON tableaux_de_bord_partages (tableau, utilisateur) WHERE utilisateur IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tableaux_de_bord_partages_groupe
  ON tableaux_de_bord_partages (tableau, groupe) WHERE groupe IS NOT NULL;
CREATE INDEX IF NOT EXISTS tableaux_de_bord_partages_destinataire_u ON tableaux_de_bord_partages (utilisateur);
CREATE INDEX IF NOT EXISTS tableaux_de_bord_partages_destinataire_g ON tableaux_de_bord_partages (groupe);

-- Tableau choisi à l'accueil (absent : le sien, sinon celui de l'organisation, sinon la disposition standard). La
-- visibilité est recontrôlée à chaque lecture : un partage retiré ramène au choix automatique.
CREATE TABLE IF NOT EXISTS tableaux_de_bord_choix (
  utilisateur uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  tableau     uuid NOT NULL REFERENCES tableaux_de_bord (id) ON DELETE CASCADE,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Nouveau module de droits « tableau_de_bord » (disposer et partager son tableau, droit tableau_de_bord:modifier) : il
-- peut être désactivé comme les autres modules non protégés. Les rôles prédéfinis sont définis dans le code ; les rôles
-- personnalisés ne reçoivent pas ce droit d'office.
ALTER TABLE module_activation DROP CONSTRAINT IF EXISTS module_activation_disabled_connus;
ALTER TABLE module_activation ADD CONSTRAINT module_activation_disabled_connus
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','crrc','investissements','incidents','cartographie','documents','import_export','tableau_de_bord']::text[]);
