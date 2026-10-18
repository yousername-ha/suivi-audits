-- Plan d'investissement en tables (ADR 0040, lot H2) : la clé `invest` d'app_state ({ baseYear, lines }) devient une
-- ligne de réglages et une ligne par ligne budgétaire. Les champs non modélisés restent dans `extra` (aller-retour
-- sans perte) ; la clé reste dans app_state jusqu'au prochain enregistrement, puis en est retirée (module repris).
CREATE TABLE invest_settings (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_year   integer NOT NULL CHECK (base_year BETWEEN 2000 AND 2200),
  extra       jsonb NOT NULL DEFAULT '{}',          -- autres clés de l'objet `invest`
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invest_lines (
  seq         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position    integer NOT NULL,                     -- ordre d'origine (la liste de l'outil de suivi est ordonnée)
  id          text,                                 -- INV-nnn ; NULL pour une entrée sans identifiant
  company     text NOT NULL DEFAULT '',
  priority    text NOT NULL DEFAULT '',
  type        text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  n0          double precision NOT NULL DEFAULT 0,
  n1          double precision NOT NULL DEFAULT 0,
  n2          double precision NOT NULL DEFAULT 0,
  comment     text NOT NULL DEFAULT '',
  alt         text NOT NULL DEFAULT '',
  account     text NOT NULL DEFAULT '',
  perimeter   text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'À qualifier',
  nature      text NOT NULL DEFAULT 'Abonnement',
  renewal     text NOT NULL DEFAULT '',
  notice      integer NOT NULL DEFAULT 60 CHECK (notice >= 0),
  supplier    text NOT NULL DEFAULT '',             -- identifiant du registre des fournisseurs
  extra       jsonb NOT NULL DEFAULT '{}'           -- createdAt, champs inconnus ; { "brut": … } pour une entrée non objet
);
CREATE INDEX invest_lines_id ON invest_lines (id);
CREATE INDEX invest_lines_position ON invest_lines (position, seq);

INSERT INTO invest_settings (base_year, extra)
SELECT CASE WHEN (s.data -> 'invest' ->> 'baseYear') ~ '^(20[0-9]{2}|21[0-9]{2}|2200)$'
            THEN (s.data -> 'invest' ->> 'baseYear')::int ELSE EXTRACT(YEAR FROM now())::int END,
       (s.data -> 'invest') - 'baseYear' - 'lines'
FROM app_state s
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'invest') = 'object';

INSERT INTO invest_lines (position, id, company, priority, type, description, n0, n1, n2, comment, alt, account,
                          perimeter, status, nature, renewal, notice, supplier, extra)
SELECT x.n - 1,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l ->> 'id' END,
       COALESCE(x.l ->> 'company', ''), COALESCE(x.l ->> 'priority', ''), COALESCE(x.l ->> 'type', ''),
       COALESCE(x.l ->> 'desc', ''),
       CASE WHEN x.l ->> 'n0' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (x.l ->> 'n0')::float8 ELSE 0 END,
       CASE WHEN x.l ->> 'n1' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (x.l ->> 'n1')::float8 ELSE 0 END,
       CASE WHEN x.l ->> 'n2' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (x.l ->> 'n2')::float8 ELSE 0 END,
       COALESCE(x.l ->> 'comment', ''), COALESCE(x.l ->> 'alt', ''), COALESCE(x.l ->> 'account', ''),
       COALESCE(x.l ->> 'perimeter', ''),
       COALESCE(NULLIF(x.l ->> 'status', ''), 'À qualifier'), COALESCE(NULLIF(x.l ->> 'nature', ''), 'Abonnement'),
       COALESCE(x.l ->> 'renewal', ''),
       CASE WHEN x.l ->> 'notice' ~ '^[0-9]+$' THEN (x.l ->> 'notice')::int ELSE 60 END,
       COALESCE(x.l ->> 'supplier', ''),
       CASE WHEN jsonb_typeof(x.l) = 'object'
            THEN x.l - ARRAY['id','company','priority','type','desc','n0','n1','n2','comment','alt','account',
                             'perimeter','status','nature','renewal','notice','supplier']
            ELSE jsonb_build_object('brut', x.l) END
FROM app_state s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.data -> 'invest' -> 'lines') = 'array' THEN s.data -> 'invest' -> 'lines' ELSE '[]'::jsonb END
) WITH ORDINALITY AS x(l, n)
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'invest') = 'object';
