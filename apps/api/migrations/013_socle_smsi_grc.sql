CREATE TABLE grc_smsis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,scope text NOT NULL DEFAULT '',visibility text NOT NULL DEFAULT 'restricted' CHECK(visibility IN ('instance','restricted')),
 risk_method_id uuid,risk_method_version integer,
 timezone text NOT NULL DEFAULT 'Europe/Paris',business_version integer NOT NULL REFERENCES business_policy_versions(version),version integer NOT NULL DEFAULT 1,
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE grc_members (smsi_id uuid NOT NULL REFERENCES grc_smsis(id),user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,can_write boolean NOT NULL DEFAULT false,PRIMARY KEY(smsi_id,user_id));
CREATE TABLE grc_objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),smsi_id uuid NOT NULL REFERENCES grc_smsis(id),kind text NOT NULL,module text NOT NULL,name text NOT NULL,data jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,archived boolean NOT NULL DEFAULT false,legacy_key text,legacy_id text,import_batch_id bigint,extra jsonb NOT NULL DEFAULT '{}',
 created_by text NOT NULL,updated_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(smsi_id,legacy_key,legacy_id)
);
CREATE INDEX grc_objects_page ON grc_objects(smsi_id,kind,archived,updated_at DESC,id);
CREATE INDEX grc_objects_status ON grc_objects(smsi_id,kind,(data->>'status'));
CREATE INDEX grc_objects_due ON grc_objects(smsi_id,kind,(data->>'dueAt'));
CREATE INDEX grc_objects_method ON grc_objects(smsi_id,kind,(data->>'methodId'),(data->>'methodVersion'));
CREATE INDEX grc_objects_data ON grc_objects USING gin(data jsonb_path_ops);
CREATE TABLE grc_object_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),object_id uuid NOT NULL REFERENCES grc_objects(id),smsi_id uuid NOT NULL REFERENCES grc_smsis(id),version integer NOT NULL,snapshot jsonb NOT NULL,reason text NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(object_id,version));
CREATE INDEX grc_object_versions_time ON grc_object_versions(object_id,created_at DESC,version DESC);
CREATE TABLE grc_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),smsi_id uuid NOT NULL REFERENCES grc_smsis(id),source_id uuid REFERENCES grc_objects(id),source_ref text NOT NULL,target_ref text NOT NULL,type text NOT NULL,note text NOT NULL DEFAULT '',created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(smsi_id,source_ref,target_ref,type));
CREATE INDEX grc_links_reverse ON grc_links(smsi_id,target_ref);
CREATE TABLE grc_framework_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),framework_id uuid NOT NULL REFERENCES grc_objects(id),smsi_id uuid NOT NULL REFERENCES grc_smsis(id),version integer NOT NULL,definition jsonb NOT NULL,reason text NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(framework_id,version));
CREATE TABLE grc_method_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),method_id uuid NOT NULL,smsi_id uuid NOT NULL REFERENCES grc_smsis(id),version integer NOT NULL,definition jsonb NOT NULL,reason text NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(method_id,version));
CREATE TABLE grc_risk_evaluations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),risk_id uuid NOT NULL REFERENCES grc_objects(id),smsi_id uuid NOT NULL REFERENCES grc_smsis(id),method_version_id uuid NOT NULL REFERENCES grc_method_versions(id),
 revision integer NOT NULL,risk_snapshot jsonb NOT NULL,ratings jsonb NOT NULL,result jsonb NOT NULL,rationale text NOT NULL,decision text NOT NULL,request_id uuid NOT NULL UNIQUE,user_id uuid NOT NULL,
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(risk_id,revision)
);
CREATE INDEX grc_risk_evaluations_time ON grc_risk_evaluations(smsi_id,risk_id,created_at DESC,revision DESC);
CREATE TABLE grc_series (object_id uuid PRIMARY KEY REFERENCES grc_objects(id),next_index integer NOT NULL DEFAULT 0);
CREATE TABLE grc_occurrences (series_id uuid NOT NULL REFERENCES grc_objects(id),slot text NOT NULL,action_id uuid NOT NULL UNIQUE REFERENCES grc_objects(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(series_id,slot));
CREATE TABLE grc_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),smsi_id uuid NOT NULL REFERENCES grc_smsis(id),object_id uuid NOT NULL REFERENCES grc_objects(id),user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind text NOT NULL,due_key text NOT NULL,title text NOT NULL,message text NOT NULL,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(object_id,user_id,kind,due_key));
CREATE INDEX grc_notifications_user ON grc_notifications(user_id,created_at DESC);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['grc_object_versions','grc_framework_versions','grc_method_versions','grc_risk_evaluations','grc_occurrences'] LOOP
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_immutable()',t||'_immutable',t);
 EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable()',t||'_no_truncate',t);
END LOOP; END $$;
