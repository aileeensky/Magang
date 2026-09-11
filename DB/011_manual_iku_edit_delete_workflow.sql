-- SIMONIK - 011_manual_iku_edit_delete_workflow.sql
-- Workflow perubahan/penghapusan Manual IKU yang sudah APPROVED.
BEGIN;

ALTER TABLE performance.iku_manual
  ADD COLUMN IF NOT EXISTS pending_action varchar(20) NOT NULL DEFAULT 'NONE';

ALTER TABLE performance.iku_manual
  DROP CONSTRAINT IF EXISTS iku_manual_pending_action_check;

ALTER TABLE performance.iku_manual
  ADD CONSTRAINT iku_manual_pending_action_check
  CHECK (pending_action IN ('NONE','EDIT','DELETE'));

CREATE INDEX IF NOT EXISTS idx_iku_manual_pending_action
  ON performance.iku_manual(pending_action)
  WHERE pending_action <> 'NONE';

COMMIT;
