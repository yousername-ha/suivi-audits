-- Reprise en tables des clés de l'outil de suivi composées de plusieurs listes (CRRC, cellule de crise, conformité IA)
-- et de la déclaration d'applicabilité (ADR 0040, lot H2c). Même principe que la migration 024 : colonnes NULL = champ
-- absent, `extra` = champs inconnus ou de type inattendu ; les clés restent dans app_state jusqu'au prochain
-- enregistrement, puis en sont retirées (module repris).
ALTER TABLE suivi_presence ADD COLUMN kind text NOT NULL DEFAULT 'liste' CHECK (kind IN ('liste','objet'));
ALTER TABLE suivi_presence ADD COLUMN champs text[] NOT NULL DEFAULT '{}';
ALTER TABLE suivi_presence ADD COLUMN reste jsonb NOT NULL DEFAULT '{}';

CREATE TABLE suivi_crrc_etablissements (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  finess text,
  status text,
  admin_contact text,
  admin_email text,
  tech_contact text,
  tech_email text,
  prestataire text,
  alerts text,
  signed text,
  service_date text,
  renewal text,
  capacity_gb double precision,
  retention_days double precision,
  offers jsonb,
  scopes jsonb,
  notes text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crrc_etablissements_position ON suivi_crrc_etablissements (position, seq);
CREATE INDEX suivi_crrc_etablissements_id ON suivi_crrc_etablissements (id);

CREATE TABLE suivi_crrc_ressources (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  est text,
  name text,
  tech text,
  freq text,
  retention double precision,
  notes text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crrc_ressources_position ON suivi_crrc_ressources (position, seq);
CREATE INDEX suivi_crrc_ressources_id ON suivi_crrc_ressources (id);

CREATE TABLE suivi_crrc_sauvegardes (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  res text,
  run_date text,
  type text,
  status text,
  volume_gb double precision,
  duration_min double precision,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crrc_sauvegardes_position ON suivi_crrc_sauvegardes (position, seq);
CREATE INDEX suivi_crrc_sauvegardes_id ON suivi_crrc_sauvegardes (id);

CREATE TABLE suivi_crrc_restaurations (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  restore_date text,
  est text,
  res text,
  scope text,
  type text,
  status text,
  owner text,
  duration text,
  dest text,
  path text,
  conflict text,
  point text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crrc_restaurations_position ON suivi_crrc_restaurations (position, seq);
CREATE INDEX suivi_crrc_restaurations_id ON suivi_crrc_restaurations (id);

CREATE TABLE suivi_crrc_alertes (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  alert_date text,
  severity text,
  est text,
  res text,
  message text,
  status text,
  incident text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crrc_alertes_position ON suivi_crrc_alertes (position, seq);
CREATE INDEX suivi_crrc_alertes_id ON suivi_crrc_alertes (id);

CREATE TABLE suivi_crrc_offres (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  status text,
  partner text,
  description text,
  perimeters jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crrc_offres_position ON suivi_crrc_offres (position, seq);
CREATE INDEX suivi_crrc_offres_id ON suivi_crrc_offres (id);

CREATE TABLE suivi_crise_contacts (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  created_iso text,
  name text,
  org text,
  role text,
  phone text,
  phone2 text,
  email text,
  avail text,
  notes text,
  is_key boolean,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crise_contacts_position ON suivi_crise_contacts (position, seq);

CREATE TABLE suivi_crise_scenarios (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  title text,
  ref text,
  description text,
  items jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crise_scenarios_position ON suivi_crise_scenarios (position, seq);
CREATE INDEX suivi_crise_scenarios_id ON suivi_crise_scenarios (id);

CREATE TABLE suivi_crise_cellules (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  title text,
  mode text,
  scenario text,
  plan text,
  date_start text,
  date_end text,
  status text,
  log jsonb,
  checks jsonb,
  deadlines jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_crise_cellules_position ON suivi_crise_cellules (position, seq);
CREATE INDEX suivi_crise_cellules_id ON suivi_crise_cellules (id);

CREATE TABLE suivi_ia_usages (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  ai_presence text,
  category text,
  provider text,
  usecase text,
  dscp text,
  training text,
  storage text,
  authz text,
  owner text,
  purpose text,
  remote text,
  aiact text,
  aipd text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_ia_usages_position ON suivi_ia_usages (position, seq);
CREATE INDEX suivi_ia_usages_id ON suivi_ia_usages (id);

CREATE TABLE suivi_ia_evaluations (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  domain text,
  scenario text,
  app text,
  iso text,
  hds text,
  measure text,
  scope text,
  prob double precision,
  maturity double precision,
  c double precision,
  i double precision,
  a double precision,
  audit double precision,
  patient double precision,
  effort double precision,
  dscp text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_ia_evaluations_position ON suivi_ia_evaluations (position, seq);
CREATE INDEX suivi_ia_evaluations_id ON suivi_ia_evaluations (id);

CREATE TABLE suivi_ia_etapes (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  step text,
  phase text,
  action text,
  result text,
  proof text,
  iso text,
  hds text,
  owner text,
  priority text,
  status text,
  progress double precision,
  j_start double precision,
  j_end double precision,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_ia_etapes_position ON suivi_ia_etapes (position, seq);
CREATE INDEX suivi_ia_etapes_id ON suivi_ia_etapes (id);

CREATE TABLE suivi_ia_politiques (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  policy text,
  impact text,
  change text,
  iso text,
  annex text,
  hds text,
  owner text,
  target text,
  status text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_ia_politiques_position ON suivi_ia_politiques (position, seq);
CREATE INDEX suivi_ia_politiques_id ON suivi_ia_politiques (id);

CREATE TABLE suivi_dda (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  cle      text NOT NULL UNIQUE,
  app text,
  level text,
  just text,
  risk text,
  actions text,
  docs text,
  url text,
  comment text,
  req text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_dda_position ON suivi_dda (position, seq);

INSERT INTO suivi_presence(cle,kind,champs,reste)
SELECT 'crrc', 'objet', array_remove(ARRAY[CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'establishments') = 'array' THEN 'establishments' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'resources') = 'array' THEN 'resources' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'runs') = 'array' THEN 'runs' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'restores') = 'array' THEN 'restores' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'alerts') = 'array' THEN 'alerts' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'offers') = 'array' THEN 'offers' END], NULL),
       (s.data -> 'crrc') - array_remove(ARRAY[CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'establishments') = 'array' THEN 'establishments' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'resources') = 'array' THEN 'resources' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'runs') = 'array' THEN 'runs' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'restores') = 'array' THEN 'restores' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'alerts') = 'array' THEN 'alerts' END,CASE WHEN jsonb_typeof(s.data -> 'crrc' -> 'offers') = 'array' THEN 'offers' END], NULL)
FROM app_state s WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crrc') = 'object';

INSERT INTO suivi_crrc_etablissements(position,id,name,finess,status,admin_contact,admin_email,tech_contact,tech_email,prestataire,alerts,signed,service_date,renewal,capacity_gb,retention_days,offers,scopes,notes,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'finess') = 'string' THEN x.l ->> 'finess' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'adminContact') = 'string' THEN x.l ->> 'adminContact' END,
       CASE WHEN jsonb_typeof(x.l -> 'adminEmail') = 'string' THEN x.l ->> 'adminEmail' END,
       CASE WHEN jsonb_typeof(x.l -> 'techContact') = 'string' THEN x.l ->> 'techContact' END,
       CASE WHEN jsonb_typeof(x.l -> 'techEmail') = 'string' THEN x.l ->> 'techEmail' END,
       CASE WHEN jsonb_typeof(x.l -> 'prestataire') = 'string' THEN x.l ->> 'prestataire' END,
       CASE WHEN jsonb_typeof(x.l -> 'alerts') = 'string' THEN x.l ->> 'alerts' END,
       CASE WHEN jsonb_typeof(x.l -> 'signed') = 'string' THEN x.l ->> 'signed' END,
       CASE WHEN jsonb_typeof(x.l -> 'serviceDate') = 'string' THEN x.l ->> 'serviceDate' END,
       CASE WHEN jsonb_typeof(x.l -> 'renewal') = 'string' THEN x.l ->> 'renewal' END,
       CASE WHEN jsonb_typeof(x.l -> 'capacityGb') = 'number' THEN (x.l ->> 'capacityGb')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'retentionDays') = 'number' THEN (x.l ->> 'retentionDays')::float8 END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'offers') NOT IN ('null') THEN x.l -> 'offers' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'scopes') NOT IN ('null') THEN x.l -> 'scopes' END,
       CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN x.l ->> 'notes' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'finess') = 'string' THEN 'finess' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'adminContact') = 'string' THEN 'adminContact' END, CASE WHEN jsonb_typeof(x.l -> 'adminEmail') = 'string' THEN 'adminEmail' END, CASE WHEN jsonb_typeof(x.l -> 'techContact') = 'string' THEN 'techContact' END, CASE WHEN jsonb_typeof(x.l -> 'techEmail') = 'string' THEN 'techEmail' END, CASE WHEN jsonb_typeof(x.l -> 'prestataire') = 'string' THEN 'prestataire' END, CASE WHEN jsonb_typeof(x.l -> 'alerts') = 'string' THEN 'alerts' END, CASE WHEN jsonb_typeof(x.l -> 'signed') = 'string' THEN 'signed' END, CASE WHEN jsonb_typeof(x.l -> 'serviceDate') = 'string' THEN 'serviceDate' END, CASE WHEN jsonb_typeof(x.l -> 'renewal') = 'string' THEN 'renewal' END, CASE WHEN jsonb_typeof(x.l -> 'capacityGb') = 'number' THEN 'capacityGb' END, CASE WHEN jsonb_typeof(x.l -> 'retentionDays') = 'number' THEN 'retentionDays' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'offers') NOT IN ('null') THEN 'offers' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'scopes') NOT IN ('null') THEN 'scopes' END, CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN 'notes' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crrc' -> 'establishments') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crrc' -> 'establishments') = 'array';

INSERT INTO suivi_crrc_ressources(position,id,est,name,tech,freq,retention,notes,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'est') = 'string' THEN x.l ->> 'est' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'tech') = 'string' THEN x.l ->> 'tech' END,
       CASE WHEN jsonb_typeof(x.l -> 'freq') = 'string' THEN x.l ->> 'freq' END,
       CASE WHEN jsonb_typeof(x.l -> 'retention') = 'number' THEN (x.l ->> 'retention')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN x.l ->> 'notes' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'est') = 'string' THEN 'est' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'tech') = 'string' THEN 'tech' END, CASE WHEN jsonb_typeof(x.l -> 'freq') = 'string' THEN 'freq' END, CASE WHEN jsonb_typeof(x.l -> 'retention') = 'number' THEN 'retention' END, CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN 'notes' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crrc' -> 'resources') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crrc' -> 'resources') = 'array';

INSERT INTO suivi_crrc_sauvegardes(position,id,res,run_date,type,status,volume_gb,duration_min,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'res') = 'string' THEN x.l ->> 'res' END,
       CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN x.l ->> 'date' END,
       CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN x.l ->> 'type' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'volumeGb') = 'number' THEN (x.l ->> 'volumeGb')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'durationMin') = 'number' THEN (x.l ->> 'durationMin')::float8 END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'res') = 'string' THEN 'res' END, CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN 'date' END, CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN 'type' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'volumeGb') = 'number' THEN 'volumeGb' END, CASE WHEN jsonb_typeof(x.l -> 'durationMin') = 'number' THEN 'durationMin' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crrc' -> 'runs') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crrc' -> 'runs') = 'array';

INSERT INTO suivi_crrc_restaurations(position,id,restore_date,est,res,scope,type,status,owner,duration,dest,path,conflict,point,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN x.l ->> 'date' END,
       CASE WHEN jsonb_typeof(x.l -> 'est') = 'string' THEN x.l ->> 'est' END,
       CASE WHEN jsonb_typeof(x.l -> 'res') = 'string' THEN x.l ->> 'res' END,
       CASE WHEN jsonb_typeof(x.l -> 'scope') = 'string' THEN x.l ->> 'scope' END,
       CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN x.l ->> 'type' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'duration') = 'string' THEN x.l ->> 'duration' END,
       CASE WHEN jsonb_typeof(x.l -> 'dest') = 'string' THEN x.l ->> 'dest' END,
       CASE WHEN jsonb_typeof(x.l -> 'path') = 'string' THEN x.l ->> 'path' END,
       CASE WHEN jsonb_typeof(x.l -> 'conflict') = 'string' THEN x.l ->> 'conflict' END,
       CASE WHEN jsonb_typeof(x.l -> 'point') = 'string' THEN x.l ->> 'point' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN 'date' END, CASE WHEN jsonb_typeof(x.l -> 'est') = 'string' THEN 'est' END, CASE WHEN jsonb_typeof(x.l -> 'res') = 'string' THEN 'res' END, CASE WHEN jsonb_typeof(x.l -> 'scope') = 'string' THEN 'scope' END, CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN 'type' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'duration') = 'string' THEN 'duration' END, CASE WHEN jsonb_typeof(x.l -> 'dest') = 'string' THEN 'dest' END, CASE WHEN jsonb_typeof(x.l -> 'path') = 'string' THEN 'path' END, CASE WHEN jsonb_typeof(x.l -> 'conflict') = 'string' THEN 'conflict' END, CASE WHEN jsonb_typeof(x.l -> 'point') = 'string' THEN 'point' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crrc' -> 'restores') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crrc' -> 'restores') = 'array';

INSERT INTO suivi_crrc_alertes(position,id,alert_date,severity,est,res,message,status,incident,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN x.l ->> 'date' END,
       CASE WHEN jsonb_typeof(x.l -> 'severity') = 'string' THEN x.l ->> 'severity' END,
       CASE WHEN jsonb_typeof(x.l -> 'est') = 'string' THEN x.l ->> 'est' END,
       CASE WHEN jsonb_typeof(x.l -> 'res') = 'string' THEN x.l ->> 'res' END,
       CASE WHEN jsonb_typeof(x.l -> 'message') = 'string' THEN x.l ->> 'message' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'incident') = 'string' THEN x.l ->> 'incident' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN 'date' END, CASE WHEN jsonb_typeof(x.l -> 'severity') = 'string' THEN 'severity' END, CASE WHEN jsonb_typeof(x.l -> 'est') = 'string' THEN 'est' END, CASE WHEN jsonb_typeof(x.l -> 'res') = 'string' THEN 'res' END, CASE WHEN jsonb_typeof(x.l -> 'message') = 'string' THEN 'message' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'incident') = 'string' THEN 'incident' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crrc' -> 'alerts') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crrc' -> 'alerts') = 'array';

INSERT INTO suivi_crrc_offres(position,id,name,status,partner,description,perimeters,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'partner') = 'string' THEN x.l ->> 'partner' END,
       CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN x.l ->> 'desc' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'perimeters') NOT IN ('null') THEN x.l -> 'perimeters' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'partner') = 'string' THEN 'partner' END, CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN 'desc' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'perimeters') NOT IN ('null') THEN 'perimeters' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crrc' -> 'offers') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crrc' -> 'offers') = 'array';

INSERT INTO suivi_presence(cle,kind,champs,reste)
SELECT 'crisis', 'objet', array_remove(ARRAY[CASE WHEN jsonb_typeof(s.data -> 'crisis' -> 'contacts') = 'array' THEN 'contacts' END,CASE WHEN jsonb_typeof(s.data -> 'crisis' -> 'scenarios') = 'array' THEN 'scenarios' END,CASE WHEN jsonb_typeof(s.data -> 'crisis' -> 'cells') = 'array' THEN 'cells' END], NULL),
       (s.data -> 'crisis') - array_remove(ARRAY[CASE WHEN jsonb_typeof(s.data -> 'crisis' -> 'contacts') = 'array' THEN 'contacts' END,CASE WHEN jsonb_typeof(s.data -> 'crisis' -> 'scenarios') = 'array' THEN 'scenarios' END,CASE WHEN jsonb_typeof(s.data -> 'crisis' -> 'cells') = 'array' THEN 'cells' END], NULL)
FROM app_state s WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crisis') = 'object';

INSERT INTO suivi_crise_contacts(position,created_iso,name,org,role,phone,phone2,email,avail,notes,is_key,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'org') = 'string' THEN x.l ->> 'org' END,
       CASE WHEN jsonb_typeof(x.l -> 'role') = 'string' THEN x.l ->> 'role' END,
       CASE WHEN jsonb_typeof(x.l -> 'phone') = 'string' THEN x.l ->> 'phone' END,
       CASE WHEN jsonb_typeof(x.l -> 'phone2') = 'string' THEN x.l ->> 'phone2' END,
       CASE WHEN jsonb_typeof(x.l -> 'email') = 'string' THEN x.l ->> 'email' END,
       CASE WHEN jsonb_typeof(x.l -> 'avail') = 'string' THEN x.l ->> 'avail' END,
       CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN x.l ->> 'notes' END,
       CASE WHEN jsonb_typeof(x.l -> 'key') = 'boolean' THEN (x.l ->> 'key')::boolean END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'org') = 'string' THEN 'org' END, CASE WHEN jsonb_typeof(x.l -> 'role') = 'string' THEN 'role' END, CASE WHEN jsonb_typeof(x.l -> 'phone') = 'string' THEN 'phone' END, CASE WHEN jsonb_typeof(x.l -> 'phone2') = 'string' THEN 'phone2' END, CASE WHEN jsonb_typeof(x.l -> 'email') = 'string' THEN 'email' END, CASE WHEN jsonb_typeof(x.l -> 'avail') = 'string' THEN 'avail' END, CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN 'notes' END, CASE WHEN jsonb_typeof(x.l -> 'key') = 'boolean' THEN 'key' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crisis' -> 'contacts') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crisis' -> 'contacts') = 'array';

INSERT INTO suivi_crise_scenarios(position,id,title,ref,description,items,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'ref') = 'string' THEN x.l ->> 'ref' END,
       CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN x.l ->> 'desc' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'items') NOT IN ('null') THEN x.l -> 'items' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'ref') = 'string' THEN 'ref' END, CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN 'desc' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'items') NOT IN ('null') THEN 'items' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crisis' -> 'scenarios') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crisis' -> 'scenarios') = 'array';

INSERT INTO suivi_crise_cellules(position,id,title,mode,scenario,plan,date_start,date_end,status,log,checks,deadlines,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'mode') = 'string' THEN x.l ->> 'mode' END,
       CASE WHEN jsonb_typeof(x.l -> 'scenario') = 'string' THEN x.l ->> 'scenario' END,
       CASE WHEN jsonb_typeof(x.l -> 'plan') = 'string' THEN x.l ->> 'plan' END,
       CASE WHEN jsonb_typeof(x.l -> 'start') = 'string' THEN x.l ->> 'start' END,
       CASE WHEN jsonb_typeof(x.l -> 'end') = 'string' THEN x.l ->> 'end' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'log') NOT IN ('null') THEN x.l -> 'log' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'checks') NOT IN ('null') THEN x.l -> 'checks' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'deadlines') NOT IN ('null') THEN x.l -> 'deadlines' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'mode') = 'string' THEN 'mode' END, CASE WHEN jsonb_typeof(x.l -> 'scenario') = 'string' THEN 'scenario' END, CASE WHEN jsonb_typeof(x.l -> 'plan') = 'string' THEN 'plan' END, CASE WHEN jsonb_typeof(x.l -> 'start') = 'string' THEN 'start' END, CASE WHEN jsonb_typeof(x.l -> 'end') = 'string' THEN 'end' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'log') NOT IN ('null') THEN 'log' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'checks') NOT IN ('null') THEN 'checks' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'deadlines') NOT IN ('null') THEN 'deadlines' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'crisis' -> 'cells') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'crisis' -> 'cells') = 'array';

INSERT INTO suivi_presence(cle,kind,champs,reste)
SELECT 'ai', 'objet', array_remove(ARRAY[CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'register') = 'array' THEN 'register' END,CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'evals') = 'array' THEN 'evals' END,CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'plan') = 'array' THEN 'plan' END,CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'policies') = 'array' THEN 'policies' END], NULL),
       (s.data -> 'ai') - array_remove(ARRAY[CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'register') = 'array' THEN 'register' END,CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'evals') = 'array' THEN 'evals' END,CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'plan') = 'array' THEN 'plan' END,CASE WHEN jsonb_typeof(s.data -> 'ai' -> 'policies') = 'array' THEN 'policies' END], NULL)
FROM app_state s WHERE s.id = 1 AND jsonb_typeof(s.data -> 'ai') = 'object';

INSERT INTO suivi_ia_usages(position,id,ai_presence,category,provider,usecase,dscp,training,storage,authz,owner,purpose,remote,aiact,aipd,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'aiPresence') = 'string' THEN x.l ->> 'aiPresence' END,
       CASE WHEN jsonb_typeof(x.l -> 'category') = 'string' THEN x.l ->> 'category' END,
       CASE WHEN jsonb_typeof(x.l -> 'provider') = 'string' THEN x.l ->> 'provider' END,
       CASE WHEN jsonb_typeof(x.l -> 'usecase') = 'string' THEN x.l ->> 'usecase' END,
       CASE WHEN jsonb_typeof(x.l -> 'dscp') = 'string' THEN x.l ->> 'dscp' END,
       CASE WHEN jsonb_typeof(x.l -> 'training') = 'string' THEN x.l ->> 'training' END,
       CASE WHEN jsonb_typeof(x.l -> 'storage') = 'string' THEN x.l ->> 'storage' END,
       CASE WHEN jsonb_typeof(x.l -> 'authz') = 'string' THEN x.l ->> 'authz' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'purpose') = 'string' THEN x.l ->> 'purpose' END,
       CASE WHEN jsonb_typeof(x.l -> 'remote') = 'string' THEN x.l ->> 'remote' END,
       CASE WHEN jsonb_typeof(x.l -> 'aiact') = 'string' THEN x.l ->> 'aiact' END,
       CASE WHEN jsonb_typeof(x.l -> 'aipd') = 'string' THEN x.l ->> 'aipd' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'aiPresence') = 'string' THEN 'aiPresence' END, CASE WHEN jsonb_typeof(x.l -> 'category') = 'string' THEN 'category' END, CASE WHEN jsonb_typeof(x.l -> 'provider') = 'string' THEN 'provider' END, CASE WHEN jsonb_typeof(x.l -> 'usecase') = 'string' THEN 'usecase' END, CASE WHEN jsonb_typeof(x.l -> 'dscp') = 'string' THEN 'dscp' END, CASE WHEN jsonb_typeof(x.l -> 'training') = 'string' THEN 'training' END, CASE WHEN jsonb_typeof(x.l -> 'storage') = 'string' THEN 'storage' END, CASE WHEN jsonb_typeof(x.l -> 'authz') = 'string' THEN 'authz' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'purpose') = 'string' THEN 'purpose' END, CASE WHEN jsonb_typeof(x.l -> 'remote') = 'string' THEN 'remote' END, CASE WHEN jsonb_typeof(x.l -> 'aiact') = 'string' THEN 'aiact' END, CASE WHEN jsonb_typeof(x.l -> 'aipd') = 'string' THEN 'aipd' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'ai' -> 'register') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'ai' -> 'register') = 'array';

INSERT INTO suivi_ia_evaluations(position,id,domain,scenario,app,iso,hds,measure,scope,prob,maturity,c,i,a,audit,patient,effort,dscp,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'domain') = 'string' THEN x.l ->> 'domain' END,
       CASE WHEN jsonb_typeof(x.l -> 'scenario') = 'string' THEN x.l ->> 'scenario' END,
       CASE WHEN jsonb_typeof(x.l -> 'app') = 'string' THEN x.l ->> 'app' END,
       CASE WHEN jsonb_typeof(x.l -> 'iso') = 'string' THEN x.l ->> 'iso' END,
       CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN x.l ->> 'hds' END,
       CASE WHEN jsonb_typeof(x.l -> 'measure') = 'string' THEN x.l ->> 'measure' END,
       CASE WHEN jsonb_typeof(x.l -> 'scope') = 'string' THEN x.l ->> 'scope' END,
       CASE WHEN jsonb_typeof(x.l -> 'prob') = 'number' THEN (x.l ->> 'prob')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'maturity') = 'number' THEN (x.l ->> 'maturity')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'c') = 'number' THEN (x.l ->> 'c')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'i') = 'number' THEN (x.l ->> 'i')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'a') = 'number' THEN (x.l ->> 'a')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'audit') = 'number' THEN (x.l ->> 'audit')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'patient') = 'number' THEN (x.l ->> 'patient')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'effort') = 'number' THEN (x.l ->> 'effort')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'dscp') = 'string' THEN x.l ->> 'dscp' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'domain') = 'string' THEN 'domain' END, CASE WHEN jsonb_typeof(x.l -> 'scenario') = 'string' THEN 'scenario' END, CASE WHEN jsonb_typeof(x.l -> 'app') = 'string' THEN 'app' END, CASE WHEN jsonb_typeof(x.l -> 'iso') = 'string' THEN 'iso' END, CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN 'hds' END, CASE WHEN jsonb_typeof(x.l -> 'measure') = 'string' THEN 'measure' END, CASE WHEN jsonb_typeof(x.l -> 'scope') = 'string' THEN 'scope' END, CASE WHEN jsonb_typeof(x.l -> 'prob') = 'number' THEN 'prob' END, CASE WHEN jsonb_typeof(x.l -> 'maturity') = 'number' THEN 'maturity' END, CASE WHEN jsonb_typeof(x.l -> 'c') = 'number' THEN 'c' END, CASE WHEN jsonb_typeof(x.l -> 'i') = 'number' THEN 'i' END, CASE WHEN jsonb_typeof(x.l -> 'a') = 'number' THEN 'a' END, CASE WHEN jsonb_typeof(x.l -> 'audit') = 'number' THEN 'audit' END, CASE WHEN jsonb_typeof(x.l -> 'patient') = 'number' THEN 'patient' END, CASE WHEN jsonb_typeof(x.l -> 'effort') = 'number' THEN 'effort' END, CASE WHEN jsonb_typeof(x.l -> 'dscp') = 'string' THEN 'dscp' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'ai' -> 'evals') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'ai' -> 'evals') = 'array';

INSERT INTO suivi_ia_etapes(position,id,step,phase,action,result,proof,iso,hds,owner,priority,status,progress,j_start,j_end,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'step') = 'string' THEN x.l ->> 'step' END,
       CASE WHEN jsonb_typeof(x.l -> 'phase') = 'string' THEN x.l ->> 'phase' END,
       CASE WHEN jsonb_typeof(x.l -> 'action') = 'string' THEN x.l ->> 'action' END,
       CASE WHEN jsonb_typeof(x.l -> 'result') = 'string' THEN x.l ->> 'result' END,
       CASE WHEN jsonb_typeof(x.l -> 'proof') = 'string' THEN x.l ->> 'proof' END,
       CASE WHEN jsonb_typeof(x.l -> 'iso') = 'string' THEN x.l ->> 'iso' END,
       CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN x.l ->> 'hds' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'priority') = 'string' THEN x.l ->> 'priority' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'progress') = 'number' THEN (x.l ->> 'progress')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'jStart') = 'number' THEN (x.l ->> 'jStart')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'jEnd') = 'number' THEN (x.l ->> 'jEnd')::float8 END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'step') = 'string' THEN 'step' END, CASE WHEN jsonb_typeof(x.l -> 'phase') = 'string' THEN 'phase' END, CASE WHEN jsonb_typeof(x.l -> 'action') = 'string' THEN 'action' END, CASE WHEN jsonb_typeof(x.l -> 'result') = 'string' THEN 'result' END, CASE WHEN jsonb_typeof(x.l -> 'proof') = 'string' THEN 'proof' END, CASE WHEN jsonb_typeof(x.l -> 'iso') = 'string' THEN 'iso' END, CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN 'hds' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'priority') = 'string' THEN 'priority' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'progress') = 'number' THEN 'progress' END, CASE WHEN jsonb_typeof(x.l -> 'jStart') = 'number' THEN 'jStart' END, CASE WHEN jsonb_typeof(x.l -> 'jEnd') = 'number' THEN 'jEnd' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'ai' -> 'plan') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'ai' -> 'plan') = 'array';

INSERT INTO suivi_ia_politiques(position,id,policy,impact,change,iso,annex,hds,owner,target,status,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'policy') = 'string' THEN x.l ->> 'policy' END,
       CASE WHEN jsonb_typeof(x.l -> 'impact') = 'string' THEN x.l ->> 'impact' END,
       CASE WHEN jsonb_typeof(x.l -> 'change') = 'string' THEN x.l ->> 'change' END,
       CASE WHEN jsonb_typeof(x.l -> 'iso') = 'string' THEN x.l ->> 'iso' END,
       CASE WHEN jsonb_typeof(x.l -> 'annex') = 'string' THEN x.l ->> 'annex' END,
       CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN x.l ->> 'hds' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'target') = 'string' THEN x.l ->> 'target' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'policy') = 'string' THEN 'policy' END, CASE WHEN jsonb_typeof(x.l -> 'impact') = 'string' THEN 'impact' END, CASE WHEN jsonb_typeof(x.l -> 'change') = 'string' THEN 'change' END, CASE WHEN jsonb_typeof(x.l -> 'iso') = 'string' THEN 'iso' END, CASE WHEN jsonb_typeof(x.l -> 'annex') = 'string' THEN 'annex' END, CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN 'hds' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'target') = 'string' THEN 'target' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'ai' -> 'policies') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'ai' -> 'policies') = 'array';

INSERT INTO suivi_dda(position,cle,app,level,just,risk,actions,docs,url,comment,req,extra)
SELECT x.n - 1,
       x.k,
       CASE WHEN jsonb_typeof(x.l -> 'app') = 'string' THEN x.l ->> 'app' END,
       CASE WHEN jsonb_typeof(x.l -> 'level') = 'string' THEN x.l ->> 'level' END,
       CASE WHEN jsonb_typeof(x.l -> 'just') = 'string' THEN x.l ->> 'just' END,
       CASE WHEN jsonb_typeof(x.l -> 'risk') = 'string' THEN x.l ->> 'risk' END,
       CASE WHEN jsonb_typeof(x.l -> 'actions') = 'string' THEN x.l ->> 'actions' END,
       CASE WHEN jsonb_typeof(x.l -> 'docs') = 'string' THEN x.l ->> 'docs' END,
       CASE WHEN jsonb_typeof(x.l -> 'url') = 'string' THEN x.l ->> 'url' END,
       CASE WHEN jsonb_typeof(x.l -> 'comment') = 'string' THEN x.l ->> 'comment' END,
       CASE WHEN jsonb_typeof(x.l -> 'req') = 'string' THEN x.l ->> 'req' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'app') = 'string' THEN 'app' END, CASE WHEN jsonb_typeof(x.l -> 'level') = 'string' THEN 'level' END, CASE WHEN jsonb_typeof(x.l -> 'just') = 'string' THEN 'just' END, CASE WHEN jsonb_typeof(x.l -> 'risk') = 'string' THEN 'risk' END, CASE WHEN jsonb_typeof(x.l -> 'actions') = 'string' THEN 'actions' END, CASE WHEN jsonb_typeof(x.l -> 'docs') = 'string' THEN 'docs' END, CASE WHEN jsonb_typeof(x.l -> 'url') = 'string' THEN 'url' END, CASE WHEN jsonb_typeof(x.l -> 'comment') = 'string' THEN 'comment' END, CASE WHEN jsonb_typeof(x.l -> 'req') = 'string' THEN 'req' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL (SELECT e.key AS k, e.value AS l, e.n FROM jsonb_each(s.data -> 'dda') WITH ORDINALITY AS e(key, value, n)) AS x
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'dda') = 'object';
