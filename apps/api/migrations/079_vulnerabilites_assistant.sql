-- Assistant RSSI et module Vulnérabilités (ADR 0100, décisions V14, V25, V28, V29 et V30 ; ADR 0086). Migration additive :
-- deux tables nouvelles, aucune table existante modifiée, aucune donnée reprise (consigne du 14/11/2026).
-- Remise à vide (apps/api/src/remise-a-vide.ts) : les deux tables avec le travail, comme les conversations dont elles
-- dépendent (elles disparaissent d'ailleurs avec elles).

-- Repères des machines, par conversation : la table de correspondance repère -> machine reste sur le serveur et n'est jamais
-- remise au modèle. Un repère est stable d'un tour à l'autre (même machine, même repère) et n'est jamais réattribué : une
-- machine effacée laisse son numéro réservé (machine_id à null), le texte qui la cite reste un repère sans nom. La
-- suppression de la conversation supprime ses repères (cascade). Mille repères au plus par conversation (M-001 à M-999).
CREATE TABLE vulnerabilites_assistant_reperes (
  conversation_id uuid NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  numero          integer NOT NULL CHECK (numero BETWEEN 1 AND 999),
  machine_id      uuid REFERENCES vulnerabilites_machines(id) ON DELETE SET NULL,
  cree_le         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, numero),
  UNIQUE (conversation_id, machine_id)
);
CREATE INDEX vulnerabilites_assistant_reperes_machine ON vulnerabilites_assistant_reperes (machine_id);

-- Propositions d'action déposées par l'assistant pendant une conversation, au sujet d'une faille (constat de Tenable ou faille
-- déclarée), puis décidées par la personne de la conversation. Rien n'entre dans un registre avant la confirmation ; celle-ci
-- crée l'action sous l'identité et avec les droits de la personne, remplace les repères par les noms (V29) et lie l'action à
-- la faille (lot V4b). Le texte est gardé tel que le modèle l'a écrit, avec ses repères ; `reperes` : numéros des machines
-- concernées, tous connus de la conversation au dépôt. `retiree` : remplacée par une proposition plus récente de la même
-- conversation sur la même faille. La décision n'est jamais remise au modèle.
CREATE TABLE vulnerabilites_assistant_propositions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  nature           text NOT NULL CHECK (nature IN ('constat', 'declaree')),
  constat_id       uuid REFERENCES vulnerabilites_constats(id) ON DELETE CASCADE,
  rapprochement_id uuid REFERENCES vulnerabilites_rapprochements(id) ON DELETE CASCADE,
  titre            text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 200),
  description      text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  echeance         date,
  reperes          integer[] NOT NULL DEFAULT '{}' CHECK (cardinality(reperes) <= 30),
  etat             text NOT NULL DEFAULT 'en_attente' CHECK (etat IN ('en_attente', 'confirmee', 'rejetee', 'retiree')),
  decided_by       text NOT NULL DEFAULT '',
  decided_at       timestamptz,
  decision_note    text NOT NULL DEFAULT '' CHECK (char_length(decision_note) <= 500),
  action_id        uuid REFERENCES grc_objects(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((nature = 'constat') = (constat_id IS NOT NULL) AND (nature = 'declaree') = (rapprochement_id IS NOT NULL)),
  CHECK ((etat = 'en_attente') = (decided_at IS NULL)),
  CHECK (etat = 'confirmee' OR action_id IS NULL)
);
CREATE INDEX vulnerabilites_assistant_propositions_conversation
  ON vulnerabilites_assistant_propositions (conversation_id, etat, created_at DESC);
