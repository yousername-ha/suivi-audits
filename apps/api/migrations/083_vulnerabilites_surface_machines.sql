-- Module Vulnérabilités (ADR 0100, lot ALH3 ; décision du RSSI du 17/11/2026) : un actif exposé sur Internet vu par
-- AlgoLightHouse (hôte ou domaine, migration 080) relié à la ou aux machines internes lues dans Tenable (migration 075) vers
-- lesquelles va la connexion. AlgoLightHouse ne range pas les services comme des objets : le niveau le plus fin rangé est
-- l'actif, c'est lui qui est relié (un actif -> une ou plusieurs machines internes, vingt au plus, contrôlé par l'API).
-- Migration additive : une table nouvelle et une colonne ajoutée à vulnerabilites_alh_actifs, sans reprise de données
-- (consigne du 14/11/2026). Rien n'est relié d'office.
-- Cycle de vie, comme le rapprochement des failles (076) : proposée par la plateforme (même adresse, ou nom de la machine
-- qui correspond au domaine), confirmée ou rejetée par une personne, retirée quand le critère ne tient plus ; une liaison
-- faite à la main est confirmée d'emblée. Empreintes des données de l'actif et de la machine : un rejet (ou une déliaison)
-- n'est pas reproposé tant qu'elles n'ont pas changé. Une liaison confirmée ne change que par une personne.
-- Droits (API) : lire une liaison exige de lire l'actif et la machine ; la modifier exige en plus l'écriture sur le périmètre
-- de l'actif et sur le périmètre effectif de la machine.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : avec le travail, comme les actifs et les machines qu'elle relie.

-- Version des liaisons d'un actif (If-Match de toute décision, liaison ou déliaison). Une synchronisation ne la touche pas.
ALTER TABLE vulnerabilites_alh_actifs
  ADD COLUMN liaisons_version integer NOT NULL DEFAULT 1 CHECK (liaisons_version > 0);

CREATE TABLE vulnerabilites_alh_liaisons_machines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actif_id          uuid NOT NULL REFERENCES vulnerabilites_alh_actifs(id) ON DELETE CASCADE,
  machine_id        uuid NOT NULL REFERENCES vulnerabilites_machines(id) ON DELETE CASCADE,
  statut            text NOT NULL CHECK (statut IN ('proposee', 'confirmee', 'rejetee', 'retiree')),
  motif             text CHECK (motif IS NULL OR motif IN ('adresse', 'nom_complet', 'nom_court')),
  origine           text NOT NULL CHECK (origine IN ('proposition', 'manuelle')),
  empreinte_actif   text NOT NULL CHECK (empreinte_actif ~ '^[0-9a-f]{64}$'),
  empreinte_machine text NOT NULL CHECK (empreinte_machine ~ '^[0-9a-f]{64}$'),
  decide_par        text,
  decide_le         timestamptz,
  note              text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000 AND note !~ '[[:cntrl:]]'),
  calcule_le        timestamptz NOT NULL DEFAULT now(),
  cree_le           timestamptz NOT NULL DEFAULT now(),
  CHECK (statut <> 'proposee' OR (motif IS NOT NULL AND origine = 'proposition')),
  CHECK ((statut IN ('confirmee', 'rejetee')) = (decide_par IS NOT NULL)),
  CHECK ((decide_par IS NULL) = (decide_le IS NULL)),
  UNIQUE (actif_id, machine_id)
);
CREATE INDEX vulnerabilites_alh_liaisons_machines_machine ON vulnerabilites_alh_liaisons_machines (machine_id, statut);
CREATE INDEX vulnerabilites_alh_liaisons_machines_statut ON vulnerabilites_alh_liaisons_machines (actif_id, statut);
