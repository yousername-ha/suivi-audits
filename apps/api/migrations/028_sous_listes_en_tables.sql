-- Sous-listes de l'outil de suivi en tables liées (ADR 0040, lot H2f) : les tâches d'un écart et les valeurs d'un indicateur
-- quittent les colonnes jsonb de leur ligne. Même principe que 024 et 026 : colonnes NULL = champ absent, `extra` = champs
-- inconnus ou de type inattendu, entrée qui n'est pas un objet conservée telle quelle (`extra.brut`), ordre conservé
-- (`position`). Une liste vide, ou une valeur d'un autre type, reste dans la colonne du parent (la lecture donne la priorité
-- aux lignes liées). Migration non destructive : les colonnes du parent ne sont pas modifiées ; la suppression d'une ligne
-- parente (réécriture par une version antérieure) supprime ses lignes liées.
CREATE TABLE suivi_ecarts_taches (
  seq        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_seq bigint NOT NULL REFERENCES suivi_ecarts(seq) ON DELETE CASCADE,
  position   integer NOT NULL,
  id text,
  t text,
  done boolean,
  created_iso text,
  extra      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_ecarts_taches_parent ON suivi_ecarts_taches (parent_seq, position, seq);

CREATE TABLE suivi_indicateurs_valeurs (
  seq        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_seq bigint NOT NULL REFERENCES suivi_indicateurs(seq) ON DELETE CASCADE,
  position   integer NOT NULL,
  id text,
  date text,
  v double precision,
  note text,
  hist text,
  extra      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX suivi_indicateurs_valeurs_parent ON suivi_indicateurs_valeurs (parent_seq, position, seq);

INSERT INTO suivi_ecarts_taches(parent_seq, position, id, t, done, created_iso, extra)
SELECT p.seq, (x.n - 1)::int,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 't') = 'string' THEN x.l ->> 't' END,
       CASE WHEN jsonb_typeof(x.l -> 'done') = 'boolean' THEN (x.l ->> 'done')::boolean END,
       CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN x.l ->> 'createdAt' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 't') = 'string' THEN 't' END, CASE WHEN jsonb_typeof(x.l -> 'done') = 'boolean' THEN 'done' END, CASE WHEN jsonb_typeof(x.l -> 'createdAt') = 'string' THEN 'createdAt' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM suivi_ecarts p
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.tasks) = 'array' THEN p.tasks ELSE '[]'::jsonb END) WITH ORDINALITY AS x(l, n)
ORDER BY p.seq, x.n;

INSERT INTO suivi_indicateurs_valeurs(parent_seq, position, id, date, v, note, hist, extra)
SELECT p.seq, (x.n - 1)::int,
       CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN x.l ->> 'id' END,
       CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN x.l ->> 'date' END,
       CASE WHEN jsonb_typeof(x.l -> 'v') = 'number' THEN (x.l ->> 'v')::double precision END,
       CASE WHEN jsonb_typeof(x.l -> 'note') = 'string' THEN x.l ->> 'note' END,
       CASE WHEN jsonb_typeof(x.l -> 'hist') = 'string' THEN x.l ->> 'hist' END,
       CASE WHEN jsonb_typeof(x.l) = 'object' THEN x.l - array_remove(ARRAY[CASE WHEN jsonb_typeof(x.l -> 'id') = 'string' THEN 'id' END, CASE WHEN jsonb_typeof(x.l -> 'date') = 'string' THEN 'date' END, CASE WHEN jsonb_typeof(x.l -> 'v') = 'number' THEN 'v' END, CASE WHEN jsonb_typeof(x.l -> 'note') = 'string' THEN 'note' END, CASE WHEN jsonb_typeof(x.l -> 'hist') = 'string' THEN 'hist' END], NULL) ELSE jsonb_build_object('brut', x.l) END
FROM suivi_indicateurs p
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.valeurs) = 'array' THEN p.valeurs ELSE '[]'::jsonb END) WITH ORDINALITY AS x(l, n)
ORDER BY p.seq, x.n;
