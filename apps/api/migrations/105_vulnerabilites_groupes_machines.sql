-- Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026) : groupes de machines faits à la
-- main. Un groupe porte un nom (unique à la casse près), une description facultative, au plus un fournisseur (référence
-- `legacy:suppliers:<id>` du registre de l'organisation, contrôlée par l'API à l'écriture ; le registre vit dans l'état
-- historique, d'où l'absence de clé étrangère : un fournisseur supprimé ensuite laisse le groupe valide) et des machines
-- choisies à la main ; une machine peut être dans plusieurs groupes.
-- Migration additive : deux tables nouvelles, vides ; aucune table existante modifiée, aucune donnée reprise (consigne du
-- 14/11/2026). Les bornes recopient GROUPES_MACHINES_BORNES (packages/shared/src/groupes-machines.ts).
-- Remise à vide : effacées avec le travail (les machines et les fournisseurs auxquels elles renvoient le sont aussi).

CREATE TABLE vulnerabilites_groupes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 120 AND nom = btrim(nom) AND nom !~ '[[:cntrl:]]'),
  description     text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000 AND description = btrim(description)),
  fournisseur_ref text CHECK (fournisseur_ref IS NULL
                    OR (char_length(fournisseur_ref) <= 77 AND fournisseur_ref ~ '^legacy:suppliers:[^[:space:][:cntrl:]]+$')),
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- Nom unique à la casse près : le menu « Groupe » et la mention « aussi dans « X » » ne confondent pas deux groupes.
CREATE UNIQUE INDEX vulnerabilites_groupes_nom ON vulnerabilites_groupes (lower(nom));
-- Groupes rattachés à un fournisseur (fiche du fournisseur).
CREATE INDEX vulnerabilites_groupes_fournisseur ON vulnerabilites_groupes (fournisseur_ref) WHERE fournisseur_ref IS NOT NULL;

-- Machines d'un groupe. Une machine supprimée (instance de connecteur supprimée, import retiré) sort de ses groupes : le
-- membre disparaît, jamais le groupe. Un groupe supprimé emporte ses membres.
CREATE TABLE vulnerabilites_groupe_machines (
  groupe_id  uuid NOT NULL REFERENCES vulnerabilites_groupes(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES vulnerabilites_machines(id) ON DELETE CASCADE,
  ajoute_par text NOT NULL,
  ajoute_le  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (groupe_id, machine_id)
);
-- Filtre « Groupe » et « Sans groupe » de la liste et du parc, autres groupes d'une machine.
CREATE INDEX vulnerabilites_groupe_machines_machine ON vulnerabilites_groupe_machines (machine_id);
