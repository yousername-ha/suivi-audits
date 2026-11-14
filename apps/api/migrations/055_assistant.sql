-- Assistant RSSI intégré (ADR 0086, lot A1) : module de droits « assistant », réglages du modèle, profils, conversations et
-- consommation. Migration additive et rejouable : aucune donnée existante n'est modifiée. L'assistant reste inactif tant
-- qu'un administrateur ne l'a pas réglé (assistant_reglages.actif = false) ; la clé du modèle est scellée à part
-- (settings, clé « secret:assistant »), jamais dans ces tables.

-- Nouveau module de droits : il peut être désactivé comme les autres modules non protégés. Les rôles prédéfinis sont
-- définis dans le code ; les rôles personnalisés ne reçoivent pas ce droit d'office.
ALTER TABLE module_activation DROP CONSTRAINT IF EXISTS module_activation_disabled_connus;
ALTER TABLE module_activation ADD CONSTRAINT module_activation_disabled_connus
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','incidents','cartographie','documents','import_export','tableau_de_bord','assistant']::text[]);

CREATE TABLE IF NOT EXISTS assistant_reglages (
  id                 integer PRIMARY KEY CHECK (id = 1),
  actif              boolean NOT NULL DEFAULT false,
  adresse            text NOT NULL DEFAULT '' CHECK (length(adresse) <= 300),
  modele             text NOT NULL DEFAULT '' CHECK (length(modele) <= 120),
  budget_jetons_jour integer NOT NULL DEFAULT 500000 CHECK (budget_jetons_jour BETWEEN 1000 AND 50000000),
  version            integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at         timestamptz,
  updated_by         text NOT NULL DEFAULT ''
);
INSERT INTO assistant_reglages (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Un profil n'a aucun périmètre par défaut : l'administrateur les choisit. Les identifiants de périmètres sont gardés
-- sans clé étrangère (tableau) ; un périmètre disparu est simplement ignoré à la lecture.
CREATE TABLE IF NOT EXISTS assistant_profils (
  id         text PRIMARY KEY CHECK (id IN ('mise_en_oeuvre', 'audit_interne')),
  actif      boolean NOT NULL DEFAULT false,
  perimetres uuid[] NOT NULL DEFAULT '{}'
);
INSERT INTO assistant_profils (id) VALUES ('mise_en_oeuvre'), ('audit_interne') ON CONFLICT DO NOTHING;

-- Un fil appartient à une personne : il disparaît avec son compte.
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  profil     text NOT NULL REFERENCES assistant_profils (id),
  titre      text NOT NULL DEFAULT '' CHECK (length(titre) <= 120),
  etat       text NOT NULL DEFAULT 'pret' CHECK (etat IN ('pret', 'en_cours')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_conversations_personne ON assistant_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES assistant_conversations (id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('utilisateur', 'assistant')),
  contenu         text NOT NULL,
  sources         jsonb NOT NULL DEFAULT '[]',
  outils          jsonb NOT NULL DEFAULT '[]',
  erreur          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_messages_fil ON assistant_messages (conversation_id, created_at, id);

-- Consommation par jour (UTC) : borne la dépense chez le fournisseur du modèle.
CREATE TABLE IF NOT EXISTS assistant_consommation (
  jour          date PRIMARY KEY,
  jetons_entree bigint NOT NULL DEFAULT 0,
  jetons_sortie bigint NOT NULL DEFAULT 0,
  appels        integer NOT NULL DEFAULT 0
);
