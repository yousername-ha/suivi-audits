-- Registre des types de processus (Plateforme) : la liste des types (pilotage, réalisation, support, ou ceux que
-- l'organisation définit) remplace les trois familles figées. Le champ « famille » d'un processus (`suivi_processus.family`)
-- référence le `code` d'un type ; les trois types de départ reprennent les valeurs historiques, aucun processus n'est modifié.
-- Migration additive.
CREATE TABLE types_processus (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL CHECK (char_length(code) BETWEEN 1 AND 60),
  label       text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  tint        text NOT NULL DEFAULT 'gris' CHECK (tint IN ('vert', 'bleu', 'violet', 'orange', 'rouge', 'gris')),
  rank        integer NOT NULL DEFAULT 0,
  archived    boolean NOT NULL DEFAULT false,
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX types_processus_code ON types_processus (code);
CREATE UNIQUE INDEX types_processus_label ON types_processus (lower(label)) WHERE NOT archived;
INSERT INTO types_processus (code, label, description, tint, rank) VALUES
  ('Management', 'Pilotage', 'Diriger, piloter et améliorer le système de management', 'vert', 1),
  ('Réalisation', 'Réalisation', 'Concevoir, déployer et exploiter les services et usages', 'bleu', 2),
  ('Support', 'Support', 'Fournir les ressources et les moyens aux autres processus', 'violet', 3);
