-- Additive migration: existing users, research, grants and source IDs stay intact.
CREATE TABLE IF NOT EXISTS bpbd_op_records (
  module text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
  PRIMARY KEY(module,id), CHECK (data->>'id'=id)
);
CREATE TABLE IF NOT EXISTS bpbd_op_links (
  module text NOT NULL, record_id text NOT NULL, field text NOT NULL,
  target_module text NOT NULL, target_id text NOT NULL,
  PRIMARY KEY(module,record_id,field),
  FOREIGN KEY(module,record_id) REFERENCES bpbd_op_records(module,id),
  FOREIGN KEY(target_module,target_id) REFERENCES bpbd_op_records(module,id)
);
CREATE TABLE IF NOT EXISTS bpbd_op_files (
  id text PRIMARY KEY, module text NOT NULL, record_id text NOT NULL,
  data jsonb NOT NULL, content bytea NOT NULL, sha256 text NOT NULL,
  FOREIGN KEY(module,record_id) REFERENCES bpbd_op_records(module,id)
);
CREATE TABLE IF NOT EXISTS bpbd_op_imports (
  fingerprint text PRIMARY KEY, module text NOT NULL, count integer NOT NULL,
  actor text NOT NULL REFERENCES bpbd_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bpbd_source_records (
  source text NOT NULL, entity text NOT NULL, source_id text NOT NULL,
  data jsonb NOT NULL, sha256 text NOT NULL,
  PRIMARY KEY(source,entity,source_id)
);
CREATE TABLE IF NOT EXISTS bpbd_source_map (
  source text NOT NULL, entity text NOT NULL, source_id text NOT NULL,
  module text NOT NULL, record_id text NOT NULL,
  PRIMARY KEY(source,entity,source_id),
  FOREIGN KEY(source,entity,source_id) REFERENCES bpbd_source_records(source,entity,source_id),
  FOREIGN KEY(module,record_id) REFERENCES bpbd_op_records(module,id)
);
CREATE INDEX IF NOT EXISTS bpbd_op_files_record ON bpbd_op_files(module,record_id);
CREATE INDEX IF NOT EXISTS bpbd_op_links_target ON bpbd_op_links(target_module,target_id);
CREATE TABLE IF NOT EXISTS bpbd_source_files (
  id text PRIMARY KEY, source text NOT NULL, owner_role text NOT NULL,
  name text NOT NULL, mime text NOT NULL, content bytea NOT NULL, sha256 text NOT NULL
);
CREATE TABLE IF NOT EXISTS bpbd_source_links (
  source text NOT NULL, entity text NOT NULL, source_id text NOT NULL, field text NOT NULL,
  target_entity text NOT NULL, target_id text NOT NULL,
  PRIMARY KEY(source,entity,source_id,field),
  FOREIGN KEY(source,entity,source_id) REFERENCES bpbd_source_records(source,entity,source_id),
  FOREIGN KEY(source,target_entity,target_id) REFERENCES bpbd_source_records(source,entity,source_id)
);
