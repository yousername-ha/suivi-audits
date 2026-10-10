CREATE TABLE pilotage_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),smsi_id uuid NOT NULL REFERENCES grc_smsis(id),source_ref text NOT NULL,
 source_version integer NOT NULL,operation text NOT NULL,step text NOT NULL DEFAULT '',result text NOT NULL,
 performed_on date NOT NULL,note text NOT NULL,refs jsonb NOT NULL DEFAULT '[]',snapshot jsonb NOT NULL,
 generated_refs jsonb NOT NULL DEFAULT '[]',request_id uuid NOT NULL UNIQUE,intent_hash text NOT NULL,
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pilotage_decisions_source ON pilotage_decisions(smsi_id,source_ref,created_at DESC,id);
CREATE TRIGGER pilotage_decisions_immutable BEFORE UPDATE OR DELETE ON pilotage_decisions FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER pilotage_decisions_no_truncate BEFORE TRUNCATE ON pilotage_decisions FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
UPDATE grc_smsis SET name='Pilotage de l’organisation' WHERE id='00000000-0000-4000-8000-000000000001' AND name='SMSI partagé de l’instance';
