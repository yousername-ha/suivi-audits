-- Module Vulnérabilités (ADR 0100, lot ALH2) : recommandations de l'éditeur d'AlgoLightHouse et repères des actifs exposés
-- pour l'assistant. Migration additive : une colonne nouvelle avec sa valeur par défaut, une table nouvelle ; aucune
-- migration publiée n'est réécrite, aucune donnée reprise (consigne du 14/11/2026).

-- Défauts d'une alerte et leurs résolutions (`defects` du détail, décision A du RSSI du 17/11/2026), en liste blanche de
-- champs (nom, description, résolutions avec nom, description, facilité et gain), balises retirées par le script de
-- l'exécutant : du texte simple, jamais du HTML ; relus par l'API avec leur schéma (packages/shared/src/surface-externe.ts).
-- Remplacés à chaque lecture du détail, comme la cible et les CVE ; vides tant que le détail n'a pas été lu.
ALTER TABLE vulnerabilites_alh_alertes
  ADD COLUMN defauts jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(defauts) = 'array' AND jsonb_array_length(defauts) <= 20 AND octet_length(defauts::text) <= 1000000);

-- Repères des actifs exposés (domaines et adresses vus par AlgoLightHouse) dans une conversation de l'assistant (décision C) :
-- même règle que les repères des machines (079). « E-001 » à « E-999 » ; la table de correspondance reste sur le serveur et
-- n'est jamais remise au modèle ; un repère n'est jamais réattribué (actif effacé : actif_id à null) ; supprimée avec la
-- conversation. Remise à vide : avec le travail, comme les conversations.
CREATE TABLE vulnerabilites_assistant_reperes_externes (
  conversation_id uuid NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  numero          integer NOT NULL CHECK (numero BETWEEN 1 AND 999),
  actif_id        uuid REFERENCES vulnerabilites_alh_actifs(id) ON DELETE SET NULL,
  cree_le         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, numero),
  UNIQUE (conversation_id, actif_id)
);
CREATE INDEX vulnerabilites_assistant_reperes_externes_actif ON vulnerabilites_assistant_reperes_externes (actif_id);
