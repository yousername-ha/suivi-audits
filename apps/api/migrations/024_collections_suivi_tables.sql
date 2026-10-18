-- Reprise en tables des collections de l'outil de suivi (ADR 0040, lot H2b) : incidents, plans, revues des accès,
-- analyses GAP et évaluations clausier. Une ligne par entrée ; colonnes NULL = champ absent ; `extra` = champs inconnus
-- et valeurs de type inattendu (aller-retour sans perte). Les clés restent dans app_state jusqu'au prochain
-- enregistrement, puis en sont retirées (module repris).
CREATE TABLE suivi_presence (cle text PRIMARY KEY);

CREATE TABLE suivi_incidents (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  detected_at text,
  reporter text,
  title text,
  description text,
  kind text,
  category text,
  impact text,
  urgency text,
  status text,
  owner text,
  actions text,
  cause text,
  resolved_at text,
  retex text,
  answers jsonb,
  notified jsonb,
  finding_id text,
  created_iso text,
  extra    jsonb NOT NULL DEFAULT '{}'   -- champs inconnus ou de type inattendu ; { "brut": … } pour une entrée non objet
);
CREATE INDEX suivi_incidents_position ON suivi_incidents (position, seq);
CREATE INDEX suivi_incidents_id ON suivi_incidents (id);

CREATE TABLE suivi_plans (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  type text,
  title text,
  kind text,
  date_start text,
  date_end text,
  done text,
  status text,
  owner text,
  provider text,
  audience text,
  notes text,
  proof text,
  planned text,
  attended text,
  duration text,
  participation text,
  success text,
  indicator text,
  items jsonb,
  scope text,
  auditor text,
  scenario text,
  systems text,
  objectives text,
  result text,
  retex text,
  findings jsonb,
  pushed_at text,
  created_iso text,
  extra    jsonb NOT NULL DEFAULT '{}'   -- champs inconnus ou de type inattendu ; { "brut": … } pour une entrée non objet
);
CREATE INDEX suivi_plans_position ON suivi_plans (position, seq);
CREATE INDEX suivi_plans_id ON suivi_plans (id);

CREATE TABLE suivi_access_reviews (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  app text,
  supplier text,
  month text,
  freq double precision,
  source text,
  comment text,
  extra    jsonb NOT NULL DEFAULT '{}'   -- champs inconnus ou de type inattendu ; { "brut": … } pour une entrée non objet
);
CREATE INDEX suivi_access_reviews_position ON suivi_access_reviews (position, seq);
CREATE INDEX suivi_access_reviews_id ON suivi_access_reviews (id);

CREATE TABLE suivi_app_gaps (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  name text,
  supplier text,
  dscp text,
  cloud text,
  status text,
  owner text,
  target text,
  description text,
  lines jsonb,
  custom jsonb,
  plan_fd text,
  profile jsonb,
  profile_at text,
  extra    jsonb NOT NULL DEFAULT '{}'   -- champs inconnus ou de type inattendu ; { "brut": … } pour une entrée non objet
);
CREATE INDEX suivi_app_gaps_position ON suivi_app_gaps (position, seq);
CREATE INDEX suivi_app_gaps_id ON suivi_app_gaps (id);

CREATE TABLE suivi_clausier_evals (
  seq      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position integer NOT NULL,
  id text,
  supplier text,
  product text,
  eval_date text,
  evaluator text,
  source text,
  cases jsonb,
  answers jsonb,
  extra    jsonb NOT NULL DEFAULT '{}'   -- champs inconnus ou de type inattendu ; { "brut": … } pour une entrée non objet
);
CREATE INDEX suivi_clausier_evals_position ON suivi_clausier_evals (position, seq);
CREATE INDEX suivi_clausier_evals_id ON suivi_clausier_evals (id);

INSERT INTO suivi_presence(cle) SELECT 'incidents' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'incidents') = 'array';
INSERT INTO suivi_incidents(position,id,detected_at,reporter,title,description,kind,category,impact,urgency,status,owner,actions,cause,resolved_at,retex,answers,notified,finding_id,created_iso,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'detectedAt') = 'string' THEN x.l ->> 'detectedAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'reporter') = 'string' THEN x.l ->> 'reporter' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN x.l ->> 'desc' END,
       CASE WHEN jsonb_typeof(x.l -> 'kind') = 'string' THEN x.l ->> 'kind' END,
       CASE WHEN jsonb_typeof(x.l -> 'cat') = 'string' THEN x.l ->> 'cat' END,
       CASE WHEN jsonb_typeof(x.l -> 'impact') = 'string' THEN x.l ->> 'impact' END,
       CASE WHEN jsonb_typeof(x.l -> 'urgency') = 'string' THEN x.l ->> 'urgency' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'actions') = 'string' THEN x.l ->> 'actions' END,
       CASE WHEN jsonb_typeof(x.l -> 'cause') = 'string' THEN x.l ->> 'cause' END,
       CASE WHEN jsonb_typeof(x.l -> 'resolvedAt') = 'string' THEN x.l ->> 'resolvedAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'retex') = 'string' THEN x.l ->> 'retex' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'answers') NOT IN ('null') THEN x.l -> 'answers' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'notified') NOT IN ('null') THEN x.l -> 'notified' END,
       CASE WHEN jsonb_typeof(x.l -> 'findingId') = 'string' THEN x.l ->> 'findingId' END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'detectedAt') = 'string' THEN 'detectedAt' END, CASE WHEN jsonb_typeof(x.l -> 'reporter') = 'string' THEN 'reporter' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN 'desc' END, CASE WHEN jsonb_typeof(x.l -> 'kind') = 'string' THEN 'kind' END, CASE WHEN jsonb_typeof(x.l -> 'cat') = 'string' THEN 'cat' END, CASE WHEN jsonb_typeof(x.l -> 'impact') = 'string' THEN 'impact' END, CASE WHEN jsonb_typeof(x.l -> 'urgency') = 'string' THEN 'urgency' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'actions') = 'string' THEN 'actions' END, CASE WHEN jsonb_typeof(x.l -> 'cause') = 'string' THEN 'cause' END, CASE WHEN jsonb_typeof(x.l -> 'resolvedAt') = 'string' THEN 'resolvedAt' END, CASE WHEN jsonb_typeof(x.l -> 'retex') = 'string' THEN 'retex' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'answers') NOT IN ('null') THEN 'answers' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'notified') NOT IN ('null') THEN 'notified' END, CASE WHEN jsonb_typeof(x.l -> 'findingId') = 'string' THEN 'findingId' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.data -> 'incidents') = 'array' THEN s.data -> 'incidents' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(l, n)
WHERE s.id = 1;

INSERT INTO suivi_presence(cle) SELECT 'plans' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'plans') = 'array';
INSERT INTO suivi_plans(position,id,type,title,kind,date_start,date_end,done,status,owner,provider,audience,notes,proof,planned,attended,duration,participation,success,indicator,items,scope,auditor,scenario,systems,objectives,result,retex,findings,pushed_at,created_iso,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN x.l ->> 'type' END,
       CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN x.l ->> 'title' END,
       CASE WHEN jsonb_typeof(x.l -> 'kind') = 'string' THEN x.l ->> 'kind' END,
       CASE WHEN jsonb_typeof(x.l -> 'start') = 'string' THEN x.l ->> 'start' END,
       CASE WHEN jsonb_typeof(x.l -> 'end') = 'string' THEN x.l ->> 'end' END,
       CASE WHEN jsonb_typeof(x.l -> 'done') = 'string' THEN x.l ->> 'done' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'provider') = 'string' THEN x.l ->> 'provider' END,
       CASE WHEN jsonb_typeof(x.l -> 'audience') = 'string' THEN x.l ->> 'audience' END,
       CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN x.l ->> 'notes' END,
       CASE WHEN jsonb_typeof(x.l -> 'proof') = 'string' THEN x.l ->> 'proof' END,
       CASE WHEN jsonb_typeof(x.l -> 'planned') = 'string' THEN x.l ->> 'planned' END,
       CASE WHEN jsonb_typeof(x.l -> 'attended') = 'string' THEN x.l ->> 'attended' END,
       CASE WHEN jsonb_typeof(x.l -> 'duration') = 'string' THEN x.l ->> 'duration' END,
       CASE WHEN jsonb_typeof(x.l -> 'participation') = 'string' THEN x.l ->> 'participation' END,
       CASE WHEN jsonb_typeof(x.l -> 'success') = 'string' THEN x.l ->> 'success' END,
       CASE WHEN jsonb_typeof(x.l -> 'indicator') = 'string' THEN x.l ->> 'indicator' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'items') NOT IN ('null') THEN x.l -> 'items' END,
       CASE WHEN jsonb_typeof(x.l -> 'scope') = 'string' THEN x.l ->> 'scope' END,
       CASE WHEN jsonb_typeof(x.l -> 'auditor') = 'string' THEN x.l ->> 'auditor' END,
       CASE WHEN jsonb_typeof(x.l -> 'scenario') = 'string' THEN x.l ->> 'scenario' END,
       CASE WHEN jsonb_typeof(x.l -> 'systems') = 'string' THEN x.l ->> 'systems' END,
       CASE WHEN jsonb_typeof(x.l -> 'objectives') = 'string' THEN x.l ->> 'objectives' END,
       CASE WHEN jsonb_typeof(x.l -> 'result') = 'string' THEN x.l ->> 'result' END,
       CASE WHEN jsonb_typeof(x.l -> 'retex') = 'string' THEN x.l ->> 'retex' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'findings') NOT IN ('null') THEN x.l -> 'findings' END,
       CASE WHEN jsonb_typeof(x.l -> 'pushedAt') = 'string' THEN x.l ->> 'pushedAt' END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'type') = 'string' THEN 'type' END, CASE WHEN jsonb_typeof(x.l -> 'title') = 'string' THEN 'title' END, CASE WHEN jsonb_typeof(x.l -> 'kind') = 'string' THEN 'kind' END, CASE WHEN jsonb_typeof(x.l -> 'start') = 'string' THEN 'start' END, CASE WHEN jsonb_typeof(x.l -> 'end') = 'string' THEN 'end' END, CASE WHEN jsonb_typeof(x.l -> 'done') = 'string' THEN 'done' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'provider') = 'string' THEN 'provider' END, CASE WHEN jsonb_typeof(x.l -> 'audience') = 'string' THEN 'audience' END, CASE WHEN jsonb_typeof(x.l -> 'notes') = 'string' THEN 'notes' END, CASE WHEN jsonb_typeof(x.l -> 'proof') = 'string' THEN 'proof' END, CASE WHEN jsonb_typeof(x.l -> 'planned') = 'string' THEN 'planned' END, CASE WHEN jsonb_typeof(x.l -> 'attended') = 'string' THEN 'attended' END, CASE WHEN jsonb_typeof(x.l -> 'duration') = 'string' THEN 'duration' END, CASE WHEN jsonb_typeof(x.l -> 'participation') = 'string' THEN 'participation' END, CASE WHEN jsonb_typeof(x.l -> 'success') = 'string' THEN 'success' END, CASE WHEN jsonb_typeof(x.l -> 'indicator') = 'string' THEN 'indicator' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'items') NOT IN ('null') THEN 'items' END, CASE WHEN jsonb_typeof(x.l -> 'scope') = 'string' THEN 'scope' END, CASE WHEN jsonb_typeof(x.l -> 'auditor') = 'string' THEN 'auditor' END, CASE WHEN jsonb_typeof(x.l -> 'scenario') = 'string' THEN 'scenario' END, CASE WHEN jsonb_typeof(x.l -> 'systems') = 'string' THEN 'systems' END, CASE WHEN jsonb_typeof(x.l -> 'objectives') = 'string' THEN 'objectives' END, CASE WHEN jsonb_typeof(x.l -> 'result') = 'string' THEN 'result' END, CASE WHEN jsonb_typeof(x.l -> 'retex') = 'string' THEN 'retex' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'findings') NOT IN ('null') THEN 'findings' END, CASE WHEN jsonb_typeof(x.l -> 'pushedAt') = 'string' THEN 'pushedAt' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.data -> 'plans') = 'array' THEN s.data -> 'plans' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(l, n)
WHERE s.id = 1;

INSERT INTO suivi_presence(cle) SELECT 'accessReviews' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'accessReviews') = 'array';
INSERT INTO suivi_access_reviews(position,id,app,supplier,month,freq,source,comment,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'app') = 'string' THEN x.l ->> 'app' END,
       CASE WHEN jsonb_typeof(x.l -> 'supplier') = 'string' THEN x.l ->> 'supplier' END,
       CASE WHEN jsonb_typeof(x.l -> 'month') = 'string' THEN x.l ->> 'month' END,
       CASE WHEN jsonb_typeof(x.l -> 'freq') = 'number' THEN (x.l ->> 'freq')::float8 END,
       CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN x.l ->> 'source' END,
       CASE WHEN jsonb_typeof(x.l -> 'comment') = 'string' THEN x.l ->> 'comment' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'app') = 'string' THEN 'app' END, CASE WHEN jsonb_typeof(x.l -> 'supplier') = 'string' THEN 'supplier' END, CASE WHEN jsonb_typeof(x.l -> 'month') = 'string' THEN 'month' END, CASE WHEN jsonb_typeof(x.l -> 'freq') = 'number' THEN 'freq' END, CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN 'source' END, CASE WHEN jsonb_typeof(x.l -> 'comment') = 'string' THEN 'comment' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.data -> 'accessReviews') = 'array' THEN s.data -> 'accessReviews' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(l, n)
WHERE s.id = 1;

INSERT INTO suivi_presence(cle) SELECT 'appGaps' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'appGaps') = 'array';
INSERT INTO suivi_app_gaps(position,id,name,supplier,dscp,cloud,status,owner,target,description,lines,custom,plan_fd,profile,profile_at,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN x.l ->> 'name' END,
       CASE WHEN jsonb_typeof(x.l -> 'supplier') = 'string' THEN x.l ->> 'supplier' END,
       CASE WHEN jsonb_typeof(x.l -> 'dscp') = 'string' THEN x.l ->> 'dscp' END,
       CASE WHEN jsonb_typeof(x.l -> 'cloud') = 'string' THEN x.l ->> 'cloud' END,
       CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN x.l ->> 'status' END,
       CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN x.l ->> 'owner' END,
       CASE WHEN jsonb_typeof(x.l -> 'target') = 'string' THEN x.l ->> 'target' END,
       CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN x.l ->> 'desc' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'lines') NOT IN ('null') THEN x.l -> 'lines' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'custom') NOT IN ('null') THEN x.l -> 'custom' END,
       CASE WHEN jsonb_typeof(x.l -> 'planFd') = 'string' THEN x.l ->> 'planFd' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'profile') NOT IN ('null') THEN x.l -> 'profile' END,
       CASE WHEN jsonb_typeof(x.l -> 'profileAt') = 'string' THEN x.l ->> 'profileAt' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'name') = 'string' THEN 'name' END, CASE WHEN jsonb_typeof(x.l -> 'supplier') = 'string' THEN 'supplier' END, CASE WHEN jsonb_typeof(x.l -> 'dscp') = 'string' THEN 'dscp' END, CASE WHEN jsonb_typeof(x.l -> 'cloud') = 'string' THEN 'cloud' END, CASE WHEN jsonb_typeof(x.l -> 'status') = 'string' THEN 'status' END, CASE WHEN jsonb_typeof(x.l -> 'owner') = 'string' THEN 'owner' END, CASE WHEN jsonb_typeof(x.l -> 'target') = 'string' THEN 'target' END, CASE WHEN jsonb_typeof(x.l -> 'desc') = 'string' THEN 'desc' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'lines') NOT IN ('null') THEN 'lines' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'custom') NOT IN ('null') THEN 'custom' END, CASE WHEN jsonb_typeof(x.l -> 'planFd') = 'string' THEN 'planFd' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'profile') NOT IN ('null') THEN 'profile' END, CASE WHEN jsonb_typeof(x.l -> 'profileAt') = 'string' THEN 'profileAt' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.data -> 'appGaps') = 'array' THEN s.data -> 'appGaps' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(l, n)
WHERE s.id = 1;

INSERT INTO suivi_presence(cle) SELECT 'supEvals' FROM app_state s WHERE s.id=1 AND jsonb_typeof(s.data -> 'supEvals') = 'array';
INSERT INTO suivi_clausier_evals(position,id,supplier,product,eval_date,evaluator,source,cases,answers,extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'supplier') = 'string' THEN x.l ->> 'supplier' END,
       CASE WHEN jsonb_typeof(x.l -> 'product') = 'string' THEN x.l ->> 'product' END,
       CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN x.l ->> 'date' END,
       CASE WHEN jsonb_typeof(x.l -> 'evaluator') = 'string' THEN x.l ->> 'evaluator' END,
       CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN x.l ->> 'source' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'cases') NOT IN ('null') THEN x.l -> 'cases' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'ans') NOT IN ('null') THEN x.l -> 'ans' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'supplier') = 'string' THEN 'supplier' END, CASE WHEN jsonb_typeof(x.l -> 'product') = 'string' THEN 'product' END, CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN 'date' END, CASE WHEN jsonb_typeof(x.l -> 'evaluator') = 'string' THEN 'evaluator' END, CASE WHEN jsonb_typeof(x.l -> 'source') = 'string' THEN 'source' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'cases') NOT IN ('null') THEN 'cases' END, CASE WHEN jsonb_typeof(x.l) = 'object' AND jsonb_typeof(x.l -> 'ans') NOT IN ('null') THEN 'ans' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.data -> 'supEvals') = 'array' THEN s.data -> 'supEvals' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(l, n)
WHERE s.id = 1;
