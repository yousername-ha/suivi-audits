-- Reprise en tables du cœur de l'outil de suivi (ADR 0040, lot H2d) : mesures et chapitres, écarts, processus, objectifs,
-- indicateurs, fournisseurs, référentiels complémentaires, revues, parties intéressées, SWOT, rôles, tâches récurrentes,
-- preuves ; réglages (années, dates d'audit, plan d'audit, périmètre…) dans suivi_reglages. Même principe que 024 :
-- colonnes NULL = champ absent, `extra` = champs inconnus ou de type inattendu. Les clés restent dans app_state jusqu'au
-- prochain enregistrement, puis en sont retirées.
CREATE TABLE suivi_reglages (
  cle     text PRIMARY KEY,
  valeur  jsonb NOT NULL,              -- peut valoir null (JSON) : la ligne existe, la valeur est nulle
  position integer NOT NULL DEFAULT 0
);
INSERT INTO suivi_reglages(cle, valeur, position)
SELECT k.cle, s.data -> k.cle, k.n::int
FROM app_state s
CROSS JOIN LATERAL unnest(ARRAY['years', 'yearLabels', 'nextYear', 'nextDate', 'internalDate', 'iso27001Certified', 'source', 'closeDeadline', 'findingsRev', 'activeFw', 'entityCategory', 'hdsChap', 'plan', 'scope', 'branding', 'v', 'updatedAt', 'schema']) WITH ORDINALITY AS k(cle, n)
WHERE s.id = 1 AND s.data ? k.cle;

CREATE TABLE suivi_groupes (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  ref text,
  num text,
  title text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_groupes_position ON suivi_groupes (position, seq);
CREATE INDEX suivi_groupes_id ON suivi_groupes (id);

CREATE TABLE suivi_mesures (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  ref text,
  num text,
  title text,
  grp text,
  depth double precision,
  afnor jsonb,
  interne jsonb,
  prep text,
  owner text,
  notes text,
  rem_interne text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_mesures_position ON suivi_mesures (position, seq);
CREATE INDEX suivi_mesures_id ON suivi_mesures (id);

CREATE TABLE suivi_ecarts (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  source text,
  year double precision,
  type text,
  status text,
  text text,
  description text,
  action text,
  tasks jsonb,
  comment text,
  items jsonb,
  owner text,
  due text,
  proof text,
  created_iso text,
  tenacy_name text,
  tenacy_status text,
  tenacy_crit text,
  cause text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_ecarts_position ON suivi_ecarts (position, seq);
CREATE INDEX suivi_ecarts_id ON suivi_ecarts (id);

CREATE TABLE suivi_processus (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  owner text,
  indicators jsonb,
  family text,
  parent text,
  purpose text,
  inputs text,
  outputs text,
  sequence text,
  control_criteria text,
  resources text,
  evaluation text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_processus_position ON suivi_processus (position, seq);
CREATE INDEX suivi_processus_id ON suivi_processus (id);

CREATE TABLE suivi_objectifs (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  due text,
  owner text,
  processes jsonb,
  enjeux jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_objectifs_position ON suivi_objectifs (position, seq);
CREATE INDEX suivi_objectifs_id ON suivi_objectifs (id);

CREATE TABLE suivi_indicateurs (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  obj text,
  target jsonb,
  action text,
  last_review text,
  due text,
  owner text,
  valeurs jsonb,
  dir text,
  freq text,
  calc text,
  auto boolean,
  action_owner text,
  action_due text,
  category text,
  source text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_indicateurs_position ON suivi_indicateurs (position, seq);
CREATE INDEX suivi_indicateurs_id ON suivi_indicateurs (id);

CREATE TABLE suivi_fournisseurs (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  rattachement text,
  saas boolean,
  sso text,
  critical text,
  hds text,
  contact text,
  last_review text,
  notes text,
  controls jsonb,
  certs jsonb,
  created_iso text,
  mfa text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_fournisseurs_position ON suivi_fournisseurs (position, seq);
CREATE INDEX suivi_fournisseurs_id ON suivi_fournisseurs (id);

CREATE TABLE suivi_referentiels_suivi (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  version text,
  source text,
  scope_mode text,
  requirements jsonb,
  objectives jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_referentiels_suivi_position ON suivi_referentiels_suivi (position, seq);
CREATE INDEX suivi_referentiels_suivi_id ON suivi_referentiels_suivi (id);

CREATE TABLE suivi_revues (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  type text,
  created_iso text,
  date text,
  title text,
  period text,
  participants text,
  classification text,
  sections jsonb,
  inputs jsonb,
  decisions jsonb,
  cs jsonb,
  followup text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_revues_position ON suivi_revues (position, seq);
CREATE INDEX suivi_revues_id ON suivi_revues (id);

CREATE TABLE suivi_parties_interessees (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  type text,
  cat text,
  needs text,
  req text,
  addressed text,
  reviewed text,
  how text,
  owner text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_parties_interessees_position ON suivi_parties_interessees (position, seq);
CREATE INDEX suivi_parties_interessees_id ON suivi_parties_interessees (id);

CREATE TABLE suivi_swot (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  created_iso text,
  process text,
  date text,
  author text,
  version text,
  strengths jsonb,
  weaknesses jsonb,
  opportunities jsonb,
  threats jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_swot_position ON suivi_swot (position, seq);
CREATE INDEX suivi_swot_id ON suivi_swot (id);

CREATE TABLE suivi_roles (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  created_iso text,
  name text,
  holder text,
  deputy text,
  email text,
  phone text,
  resp text,
  refs text,
  role text,
  resources text,
  commitment text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_roles_position ON suivi_roles (position, seq);
CREATE INDEX suivi_roles_id ON suivi_roles (id);

CREATE TABLE suivi_taches_recurrentes (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  title text,
  active boolean,
  n double precision,
  u text,
  start text,
  last text,
  history jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_taches_recurrentes_position ON suivi_taches_recurrentes (position, seq);
CREATE INDEX suivi_taches_recurrentes_id ON suivi_taches_recurrentes (id);

CREATE TABLE suivi_preuves (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  title text,
  source text,
  review text,
  valid_until text,
  extra    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_preuves_position ON suivi_preuves (position, seq);
CREATE INDEX suivi_preuves_id ON suivi_preuves (id);

INSERT INTO suivi_presence(cle,kind) SELECT 'groups','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'groups') = 'array';
INSERT INTO suivi_groupes(position,id,ref,num,title,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'ref') = 'string' THEN x.l ->> 'ref' END,
       CASE WHEN jsonb_typeof(x.l -> 'num') = 'string' THEN x.l ->> 'num' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'ref') = 'string' THEN 'ref' END, CASE WHEN jsonb_typeof(x.l -> 'num') = 'string' THEN 'num' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'groups') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'groups') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'items','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'items') = 'array';
INSERT INTO suivi_mesures(position,id,ref,num,title,grp,depth,afnor,interne,prep,owner,notes,rem_interne,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'ref') = 'string' THEN x.l ->> 'ref' END,
       CASE WHEN jsonb_typeof(x.l -> 'num') = 'string' THEN x.l ->> 'num' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'group') = 'string' THEN x.l ->> 'group' END,
       CASE WHEN jsonb_typeof(x.l -> 'depth') = 'number' THEN (x.l ->> 'depth')::float8 END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'afnor') NOT IN ('null') THEN x.l -> 'afnor' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'interne') NOT IN ('null') THEN x.l -> 'interne' END,
       CASE WHEN jsonb_typeof(x.l -> 'prep') = 'string' THEN x.l ->> 'prep' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN x.l ->> 'notes' END,
       CASE WHEN jsonb_typeof(x.l -> 'remInterne') = 'string' THEN x.l ->> 'remInterne' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'ref') = 'string' THEN 'ref' END, CASE WHEN jsonb_typeof(x.l -> 'num') = 'string' THEN 'num' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'group') = 'string' THEN 'group' END, CASE WHEN jsonb_typeof(x.l -> 'depth') = 'number' THEN 'depth' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'afnor') NOT IN ('null') THEN 'afnor' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'interne') NOT IN ('null') THEN 'interne' END, CASE WHEN jsonb_typeof(x.l -> 'prep') = 'string' THEN 'prep' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN 'notes' END, CASE WHEN jsonb_typeof(x.l -> 'remInterne') = 'string' THEN 'remInterne' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'items') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'items') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'findings','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'findings') = 'array';
INSERT INTO suivi_ecarts(position,id,source,year,type,status,text,description,action,tasks,comment,items,owner,due,proof,created_iso,tenacy_name,tenacy_status,tenacy_crit,cause,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN x.l ->> 'source' END,
       CASE WHEN jsonb_typeof(x.l -> 'year') = 'number' THEN (x.l ->> 'year')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN x.l ->> 'type' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'text') = 'string' THEN x.l ->> 'text' END,
       CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN x.l ->> 'desc' END,
       CASE WHEN jsonb_typeof(x.l -> 'action') = 'string' THEN x.l ->> 'action' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'tasks') NOT IN ('null') THEN x.l -> 'tasks' END,
       CASE WHEN jsonb_typeof(x.l -> 'comment') = 'string' THEN x.l ->> 'comment' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'items') NOT IN ('null') THEN x.l -> 'items' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'due') = 'string' THEN x.l ->> 'due' END,
       CASE WHEN jsonb_typeof(x.l -> 'proof') = 'string' THEN x.l ->> 'proof' END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'tenacyName') = 'string' THEN x.l ->> 'tenacyName' END,
       CASE WHEN jsonb_typeof(x.l -> 'tenacyStatus') = 'string' THEN x.l ->> 'tenacyStatus' END,
       CASE WHEN jsonb_typeof(x.l -> 'tenacyCrit') = 'string' THEN x.l ->> 'tenacyCrit' END,
       CASE WHEN jsonb_typeof(x.l -> 'cause') = 'string' THEN x.l ->> 'cause' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN 'source' END, CASE WHEN jsonb_typeof(x.l -> 'year') = 'number' THEN 'year' END, CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN 'type' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'text') = 'string' THEN 'text' END, CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN 'desc' END, CASE WHEN jsonb_typeof(x.l -> 'action') = 'string' THEN 'action' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'tasks') NOT IN ('null') THEN 'tasks' END, CASE WHEN jsonb_typeof(x.l -> 'comment') = 'string' THEN 'comment' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'items') NOT IN ('null') THEN 'items' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'due') = 'string' THEN 'due' END, CASE WHEN jsonb_typeof(x.l -> 'proof') = 'string' THEN 'proof' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END, CASE WHEN jsonb_typeof(x.l -> 'tenacyName') = 'string' THEN 'tenacyName' END, CASE WHEN jsonb_typeof(x.l -> 'tenacyStatus') = 'string' THEN 'tenacyStatus' END, CASE WHEN jsonb_typeof(x.l -> 'tenacyCrit') = 'string' THEN 'tenacyCrit' END, CASE WHEN jsonb_typeof(x.l -> 'cause') = 'string' THEN 'cause' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'findings') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'findings') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'processes','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'processes') = 'array';
INSERT INTO suivi_processus(position,id,name,owner,indicators,family,parent,purpose,inputs,outputs,sequence,control_criteria,resources,evaluation,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'indicators') NOT IN ('null') THEN x.l -> 'indicators' END,
       CASE WHEN jsonb_typeof(x.l -> 'family') = 'string' THEN x.l ->> 'family' END,
       CASE WHEN jsonb_typeof(x.l -> 'parent') = 'string' THEN x.l ->> 'parent' END,
       CASE WHEN jsonb_typeof(x.l -> 'purpose') = 'string' THEN x.l ->> 'purpose' END,
       CASE WHEN jsonb_typeof(x.l -> 'inputs') = 'string' THEN x.l ->> 'inputs' END,
       CASE WHEN jsonb_typeof(x.l -> 'outputs') = 'string' THEN x.l ->> 'outputs' END,
       CASE WHEN jsonb_typeof(x.l -> 'sequence') = 'string' THEN x.l ->> 'sequence' END,
       CASE WHEN jsonb_typeof(x.l -> 'controlCriteria') = 'string' THEN x.l ->> 'controlCriteria' END,
       CASE WHEN jsonb_typeof(x.l -> 'resources') = 'string' THEN x.l ->> 'resources' END,
       CASE WHEN jsonb_typeof(x.l -> 'evaluation') = 'string' THEN x.l ->> 'evaluation' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'indicators') NOT IN ('null') THEN 'indicators' END, CASE WHEN jsonb_typeof(x.l -> 'family') = 'string' THEN 'family' END, CASE WHEN jsonb_typeof(x.l -> 'parent') = 'string' THEN 'parent' END, CASE WHEN jsonb_typeof(x.l -> 'purpose') = 'string' THEN 'purpose' END, CASE WHEN jsonb_typeof(x.l -> 'inputs') = 'string' THEN 'inputs' END, CASE WHEN jsonb_typeof(x.l -> 'outputs') = 'string' THEN 'outputs' END, CASE WHEN jsonb_typeof(x.l -> 'sequence') = 'string' THEN 'sequence' END, CASE WHEN jsonb_typeof(x.l -> 'controlCriteria') = 'string' THEN 'controlCriteria' END, CASE WHEN jsonb_typeof(x.l -> 'resources') = 'string' THEN 'resources' END, CASE WHEN jsonb_typeof(x.l -> 'evaluation') = 'string' THEN 'evaluation' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'processes') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'processes') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'objectives','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'objectives') = 'array';
INSERT INTO suivi_objectifs(position,id,name,due,owner,processes,enjeux,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'due') = 'string' THEN x.l ->> 'due' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'processes') NOT IN ('null') THEN x.l -> 'processes' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'enjeux') NOT IN ('null') THEN x.l -> 'enjeux' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'due') = 'string' THEN 'due' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'processes') NOT IN ('null') THEN 'processes' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'enjeux') NOT IN ('null') THEN 'enjeux' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'objectives') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'objectives') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'indicators','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'indicators') = 'array';
INSERT INTO suivi_indicateurs(position,id,name,obj,target,action,last_review,due,owner,valeurs,dir,freq,calc,auto,action_owner,action_due,category,source,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'obj') = 'string' THEN x.l ->> 'obj' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'target') NOT IN ('null') THEN x.l -> 'target' END,
       CASE WHEN jsonb_typeof(x.l -> 'action') = 'string' THEN x.l ->> 'action' END,
       CASE WHEN jsonb_typeof(x.l -> 'lastReview') = 'string' THEN x.l ->> 'lastReview' END,
       CASE WHEN jsonb_typeof(x.l -> 'due') = 'string' THEN x.l ->> 'due' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'values') NOT IN ('null') THEN x.l -> 'values' END,
       CASE WHEN jsonb_typeof(x.l -> 'dir') = 'string' THEN x.l ->> 'dir' END,
       CASE WHEN jsonb_typeof(x.l -> 'freq') = 'string' THEN x.l ->> 'freq' END,
       CASE WHEN jsonb_typeof(x.l -> 'calc') = 'string' THEN x.l ->> 'calc' END,
       CASE WHEN jsonb_typeof(x.l -> 'auto') = 'boolean' THEN (x.l ->> 'auto')::boolean END,
       CASE WHEN jsonb_typeof(x.l -> 'actionOwner') = 'string' THEN x.l ->> 'actionOwner' END,
       CASE WHEN jsonb_typeof(x.l -> 'actionDue') = 'string' THEN x.l ->> 'actionDue' END,
       CASE WHEN jsonb_typeof(x.l -> 'category') = 'string' THEN x.l ->> 'category' END,
       CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN x.l ->> 'source' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'obj') = 'string' THEN 'obj' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'target') NOT IN ('null') THEN 'target' END, CASE WHEN jsonb_typeof(x.l -> 'action') = 'string' THEN 'action' END, CASE WHEN jsonb_typeof(x.l -> 'lastReview') = 'string' THEN 'lastReview' END, CASE WHEN jsonb_typeof(x.l -> 'due') = 'string' THEN 'due' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'values') NOT IN ('null') THEN 'values' END, CASE WHEN jsonb_typeof(x.l -> 'dir') = 'string' THEN 'dir' END, CASE WHEN jsonb_typeof(x.l -> 'freq') = 'string' THEN 'freq' END, CASE WHEN jsonb_typeof(x.l -> 'calc') = 'string' THEN 'calc' END, CASE WHEN jsonb_typeof(x.l -> 'auto') = 'boolean' THEN 'auto' END, CASE WHEN jsonb_typeof(x.l -> 'actionOwner') = 'string' THEN 'actionOwner' END, CASE WHEN jsonb_typeof(x.l -> 'actionDue') = 'string' THEN 'actionDue' END, CASE WHEN jsonb_typeof(x.l -> 'category') = 'string' THEN 'category' END, CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN 'source' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'indicators') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'indicators') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'suppliers','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'suppliers') = 'array';
INSERT INTO suivi_fournisseurs(position,id,name,rattachement,saas,sso,critical,hds,contact,last_review,notes,controls,certs,created_iso,mfa,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'rattachement') = 'string' THEN x.l ->> 'rattachement' END,
       CASE WHEN jsonb_typeof(x.l -> 'saas') = 'boolean' THEN (x.l ->> 'saas')::boolean END,
       CASE WHEN jsonb_typeof(x.l -> 'sso') = 'string' THEN x.l ->> 'sso' END,
       CASE WHEN jsonb_typeof(x.l -> 'critical') = 'string' THEN x.l ->> 'critical' END,
       CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN x.l ->> 'hds' END,
       CASE WHEN jsonb_typeof(x.l -> 'contact') = 'string' THEN x.l ->> 'contact' END,
       CASE WHEN jsonb_typeof(x.l -> 'lastReview') = 'string' THEN x.l ->> 'lastReview' END,
       CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN x.l ->> 'notes' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'controls') NOT IN ('null') THEN x.l -> 'controls' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'certs') NOT IN ('null') THEN x.l -> 'certs' END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'mfa') = 'string' THEN x.l ->> 'mfa' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'rattachement') = 'string' THEN 'rattachement' END, CASE WHEN jsonb_typeof(x.l -> 'saas') = 'boolean' THEN 'saas' END, CASE WHEN jsonb_typeof(x.l -> 'sso') = 'string' THEN 'sso' END, CASE WHEN jsonb_typeof(x.l -> 'critical') = 'string' THEN 'critical' END, CASE WHEN jsonb_typeof(x.l -> 'hds') = 'string' THEN 'hds' END, CASE WHEN jsonb_typeof(x.l -> 'contact') = 'string' THEN 'contact' END, CASE WHEN jsonb_typeof(x.l -> 'lastReview') = 'string' THEN 'lastReview' END, CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN 'notes' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'controls') NOT IN ('null') THEN 'controls' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'certs') NOT IN ('null') THEN 'certs' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END, CASE WHEN jsonb_typeof(x.l -> 'mfa') = 'string' THEN 'mfa' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'suppliers') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'suppliers') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'frameworks','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'frameworks') = 'array';
INSERT INTO suivi_referentiels_suivi(position,id,name,version,source,scope_mode,requirements,objectives,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'version') = 'string' THEN x.l ->> 'version' END,
       CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN x.l ->> 'source' END,
       CASE WHEN jsonb_typeof(x.l -> 'scopeMode') = 'string' THEN x.l ->> 'scopeMode' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'requirements') NOT IN ('null') THEN x.l -> 'requirements' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'objectives') NOT IN ('null') THEN x.l -> 'objectives' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'version') = 'string' THEN 'version' END, CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN 'source' END, CASE WHEN jsonb_typeof(x.l -> 'scopeMode') = 'string' THEN 'scopeMode' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'requirements') NOT IN ('null') THEN 'requirements' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'objectives') NOT IN ('null') THEN 'objectives' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'frameworks') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'frameworks') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'reviews','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'reviews') = 'array';
INSERT INTO suivi_revues(position,id,type,created_iso,date,title,period,participants,classification,sections,inputs,decisions,cs,followup,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN x.l ->> 'type' END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN x.l ->> 'date' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'period') = 'string' THEN x.l ->> 'period' END,
       CASE WHEN jsonb_typeof(x.l -> 'participants') = 'string' THEN x.l ->> 'participants' END,
       CASE WHEN jsonb_typeof(x.l -> 'classification') = 'string' THEN x.l ->> 'classification' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'sections') NOT IN ('null') THEN x.l -> 'sections' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'inputs') NOT IN ('null') THEN x.l -> 'inputs' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'decisions') NOT IN ('null') THEN x.l -> 'decisions' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'cs') NOT IN ('null') THEN x.l -> 'cs' END,
       CASE WHEN jsonb_typeof(x.l -> 'followup') = 'string' THEN x.l ->> 'followup' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN 'type' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END, CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN 'date' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'period') = 'string' THEN 'period' END, CASE WHEN jsonb_typeof(x.l -> 'participants') = 'string' THEN 'participants' END, CASE WHEN jsonb_typeof(x.l -> 'classification') = 'string' THEN 'classification' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'sections') NOT IN ('null') THEN 'sections' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'inputs') NOT IN ('null') THEN 'inputs' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'decisions') NOT IN ('null') THEN 'decisions' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'cs') NOT IN ('null') THEN 'cs' END, CASE WHEN jsonb_typeof(x.l -> 'followup') = 'string' THEN 'followup' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'reviews') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'reviews') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'interested','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'interested') = 'array';
INSERT INTO suivi_parties_interessees(position,id,name,type,cat,needs,req,addressed,reviewed,how,owner,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN x.l ->> 'type' END,
       CASE WHEN jsonb_typeof(x.l -> 'cat') = 'string' THEN x.l ->> 'cat' END,
       CASE WHEN jsonb_typeof(x.l -> 'needs') = 'string' THEN x.l ->> 'needs' END,
       CASE WHEN jsonb_typeof(x.l -> 'req') = 'string' THEN x.l ->> 'req' END,
       CASE WHEN jsonb_typeof(x.l -> 'addressed') = 'string' THEN x.l ->> 'addressed' END,
       CASE WHEN jsonb_typeof(x.l -> 'reviewed') = 'string' THEN x.l ->> 'reviewed' END,
       CASE WHEN jsonb_typeof(x.l -> 'how') = 'string' THEN x.l ->> 'how' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN 'type' END, CASE WHEN jsonb_typeof(x.l -> 'cat') = 'string' THEN 'cat' END, CASE WHEN jsonb_typeof(x.l -> 'needs') = 'string' THEN 'needs' END, CASE WHEN jsonb_typeof(x.l -> 'req') = 'string' THEN 'req' END, CASE WHEN jsonb_typeof(x.l -> 'addressed') = 'string' THEN 'addressed' END, CASE WHEN jsonb_typeof(x.l -> 'reviewed') = 'string' THEN 'reviewed' END, CASE WHEN jsonb_typeof(x.l -> 'how') = 'string' THEN 'how' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'interested') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'interested') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'swots','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'swots') = 'array';
INSERT INTO suivi_swot(position,id,created_iso,process,date,author,version,strengths,weaknesses,opportunities,threats,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'process') = 'string' THEN x.l ->> 'process' END,
       CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN x.l ->> 'date' END,
       CASE WHEN jsonb_typeof(x.l -> 'author') = 'string' THEN x.l ->> 'author' END,
       CASE WHEN jsonb_typeof(x.l -> 'version') = 'string' THEN x.l ->> 'version' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'S') NOT IN ('null') THEN x.l -> 'S' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'W') NOT IN ('null') THEN x.l -> 'W' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'O') NOT IN ('null') THEN x.l -> 'O' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'T') NOT IN ('null') THEN x.l -> 'T' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END, CASE WHEN jsonb_typeof(x.l -> 'process') = 'string' THEN 'process' END, CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN 'date' END, CASE WHEN jsonb_typeof(x.l -> 'author') = 'string' THEN 'author' END, CASE WHEN jsonb_typeof(x.l -> 'version') = 'string' THEN 'version' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'S') NOT IN ('null') THEN 'S' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'W') NOT IN ('null') THEN 'W' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'O') NOT IN ('null') THEN 'O' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'T') NOT IN ('null') THEN 'T' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'swots') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'swots') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'roles','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'roles') = 'array';
INSERT INTO suivi_roles(position,id,created_iso,name,holder,deputy,email,phone,resp,refs,role,resources,commitment,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'holder') = 'string' THEN x.l ->> 'holder' END,
       CASE WHEN jsonb_typeof(x.l -> 'deputy') = 'string' THEN x.l ->> 'deputy' END,
       CASE WHEN jsonb_typeof(x.l -> 'email') = 'string' THEN x.l ->> 'email' END,
       CASE WHEN jsonb_typeof(x.l -> 'phone') = 'string' THEN x.l ->> 'phone' END,
       CASE WHEN jsonb_typeof(x.l -> 'resp') = 'string' THEN x.l ->> 'resp' END,
       CASE WHEN jsonb_typeof(x.l -> 'refs') = 'string' THEN x.l ->> 'refs' END,
       CASE WHEN jsonb_typeof(x.l -> 'role') = 'string' THEN x.l ->> 'role' END,
       CASE WHEN jsonb_typeof(x.l -> 'resources') = 'string' THEN x.l ->> 'resources' END,
       CASE WHEN jsonb_typeof(x.l -> 'commitment') = 'string' THEN x.l ->> 'commitment' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'holder') = 'string' THEN 'holder' END, CASE WHEN jsonb_typeof(x.l -> 'deputy') = 'string' THEN 'deputy' END, CASE WHEN jsonb_typeof(x.l -> 'email') = 'string' THEN 'email' END, CASE WHEN jsonb_typeof(x.l -> 'phone') = 'string' THEN 'phone' END, CASE WHEN jsonb_typeof(x.l -> 'resp') = 'string' THEN 'resp' END, CASE WHEN jsonb_typeof(x.l -> 'refs') = 'string' THEN 'refs' END, CASE WHEN jsonb_typeof(x.l -> 'role') = 'string' THEN 'role' END, CASE WHEN jsonb_typeof(x.l -> 'resources') = 'string' THEN 'resources' END, CASE WHEN jsonb_typeof(x.l -> 'commitment') = 'string' THEN 'commitment' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'roles') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'roles') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'recurring','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'recurring') = 'array';
INSERT INTO suivi_taches_recurrentes(position,id,title,active,n,u,start,last,history,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'active') = 'boolean' THEN (x.l ->> 'active')::boolean END,
       CASE WHEN jsonb_typeof(x.l -> 'n') = 'number' THEN (x.l ->> 'n')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'u') = 'string' THEN x.l ->> 'u' END,
       CASE WHEN jsonb_typeof(x.l -> 'start') = 'string' THEN x.l ->> 'start' END,
       CASE WHEN jsonb_typeof(x.l -> 'last') = 'string' THEN x.l ->> 'last' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'history') NOT IN ('null') THEN x.l -> 'history' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'active') = 'boolean' THEN 'active' END, CASE WHEN jsonb_typeof(x.l -> 'n') = 'number' THEN 'n' END, CASE WHEN jsonb_typeof(x.l -> 'u') = 'string' THEN 'u' END, CASE WHEN jsonb_typeof(x.l -> 'start') = 'string' THEN 'start' END, CASE WHEN jsonb_typeof(x.l -> 'last') = 'string' THEN 'last' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'history') NOT IN ('null') THEN 'history' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'recurring') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'recurring') = 'array';

INSERT INTO suivi_presence(cle,kind) SELECT 'evidences','liste' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'evidences') = 'array';
INSERT INTO suivi_preuves(position,id,title,source,review,valid_until,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN x.l ->> 'source' END,
       CASE WHEN jsonb_typeof(x.l -> 'review') = 'string' THEN x.l ->> 'review' END,
       CASE WHEN jsonb_typeof(x.l -> 'validUntil') = 'string' THEN x.l ->> 'validUntil' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN 'source' END, CASE WHEN jsonb_typeof(x.l -> 'review') = 'string' THEN 'review' END, CASE WHEN jsonb_typeof(x.l -> 'validUntil') = 'string' THEN 'validUntil' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(s.data -> 'evidences') WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'evidences') = 'array';
