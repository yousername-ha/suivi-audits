-- Registres, périmètres hérités et droits par ressource (ADR 0043).
-- Un registre est un conteneur d'éléments (actions d'un plan, écarts, séries de tâches récurrentes). Il porte un ou plusieurs
-- périmètres que ses éléments héritent sans les copier ; le périmètre de référence (politique métier, fuseau) est fixé à la
-- création. Les droits fins s'attribuent à un utilisateur ou à un groupe sur un registre ou sur un élément.
-- Migration additive : rien n'est supprimé ni modifié sauf le rattachement des éléments existants à un registre par défaut.
CREATE TABLE registres (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              text NOT NULL CHECK (kind IN ('plan_actions', 'ecarts', 'recurrences')),
  name              text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  description       text NOT NULL DEFAULT '',
  reference_smsi_id uuid NOT NULL REFERENCES grc_smsis(id),
  restricted        boolean NOT NULL DEFAULT false,
  archived          boolean NOT NULL DEFAULT false,
  par_defaut        boolean NOT NULL DEFAULT false,
  version           integer NOT NULL DEFAULT 1,
  created_by        text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- Un seul registre par défaut par famille et par périmètre de référence : il accueille les éléments créés sans registre choisi.
CREATE UNIQUE INDEX registres_par_defaut ON registres (kind, reference_smsi_id) WHERE par_defaut;
CREATE INDEX registres_reference ON registres (reference_smsi_id, kind);

CREATE TABLE registre_perimetres (
  registre_id uuid NOT NULL REFERENCES registres(id),
  smsi_id     uuid NOT NULL REFERENCES grc_smsis(id),
  PRIMARY KEY (registre_id, smsi_id)
);
CREATE INDEX registre_perimetres_smsi ON registre_perimetres (smsi_id);

-- Le périmètre de référence d'un registre ne peut pas être retiré de ses périmètres.
CREATE FUNCTION registre_perimetre_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM registres r WHERE r.id = OLD.registre_id AND r.reference_smsi_id = OLD.smsi_id) THEN
    RAISE EXCEPTION 'Le périmètre de référence d''un registre ne peut pas être retiré.' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER registre_perimetre_reference BEFORE DELETE ON registre_perimetres
  FOR EACH ROW EXECUTE FUNCTION registre_perimetre_reference();

CREATE TABLE droits_ressources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('registre', 'objet')),
  resource_id   uuid NOT NULL,
  subject_type  text NOT NULL CHECK (subject_type IN ('utilisateur', 'groupe')),
  subject_id    uuid NOT NULL,
  role          text NOT NULL CHECK (role IN ('lecteur', 'contributeur', 'gestionnaire')),
  granted_by    text NOT NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_id, subject_type, subject_id)
);
CREATE INDEX droits_ressources_sujet ON droits_ressources (subject_type, subject_id);

-- Un droit n'a plus d'objet quand son titulaire disparaît.
CREATE FUNCTION droits_ressources_titulaire_supprime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM droits_ressources WHERE subject_id = OLD.id AND subject_type = TG_ARGV[0];
  RETURN OLD;
END $$;
CREATE TRIGGER droits_ressources_utilisateur AFTER DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION droits_ressources_titulaire_supprime('utilisateur');
CREATE TRIGGER droits_ressources_groupe AFTER DELETE ON groups
  FOR EACH ROW EXECUTE FUNCTION droits_ressources_titulaire_supprime('groupe');

ALTER TABLE grc_objects ADD COLUMN registre_id uuid REFERENCES registres(id);
CREATE INDEX grc_objects_registre ON grc_objects (registre_id, kind, archived, updated_at DESC, id);

-- Reprise : chaque famille d'éléments déjà présente dans un périmètre reçoit un registre par défaut, sans toucher aux éléments
-- eux-mêmes. Les occurrences (actions issues d'une série) vont dans le registre de tâches récurrentes.
CREATE TEMP TABLE _elements_registres ON COMMIT DROP AS
SELECT o.id AS object_id, o.smsi_id,
       CASE WHEN o.kind = 'nonconformity' THEN 'ecarts'
            WHEN o.kind = 'task_series' THEN 'recurrences'
            WHEN o.kind = 'action' AND coalesce(o.data ->> 'seriesId', '') <> '' THEN 'recurrences'
            ELSE 'plan_actions' END AS kind
  FROM grc_objects o
 WHERE o.kind IN ('action', 'nonconformity', 'task_series');

INSERT INTO registres (kind, name, reference_smsi_id, par_defaut, created_by, updated_by)
SELECT f.kind,
       CASE f.kind WHEN 'ecarts' THEN 'Registre d’écarts' WHEN 'recurrences' THEN 'Registre de tâches récurrentes' ELSE 'Plan d’actions' END
         || ' — ' || CASE WHEN s.id = '00000000-0000-4000-8000-000000000001' THEN 'Pilotage commun' ELSE s.name END,
       s.id, true, 'système', 'système'
  FROM (SELECT DISTINCT smsi_id, kind FROM _elements_registres) f
  JOIN grc_smsis s ON s.id = f.smsi_id;

INSERT INTO registre_perimetres (registre_id, smsi_id)
SELECT r.id, r.reference_smsi_id FROM registres r;

UPDATE grc_objects o
   SET registre_id = r.id
  FROM _elements_registres e
  JOIN registres r ON r.reference_smsi_id = e.smsi_id AND r.kind = e.kind AND r.par_defaut
 WHERE o.id = e.object_id;
