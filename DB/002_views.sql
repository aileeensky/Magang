-- SIMONIK - 002_views.sql
-- Derived views only; safe to recreate.

CREATE OR REPLACE VIEW performance.v_iku_strategic_alignment AS
SELECT
  i.iku_id,
  i.organization_id,
  i.year,
  i.strategic_objective_id,
  so.code AS strategic_objective_code,
  COALESCE(so.name, i.strategic_objective_name) AS strategic_objective_name,
  i.strategic_objective_description,
  i.indicator_name,
  i.manual_iku_status,
  i.created_at,
  i.updated_at
FROM performance.iku_manual i
LEFT JOIN planning.strategic_objective so
  ON so.strategic_objective_id = i.strategic_objective_id;

CREATE OR REPLACE VIEW risk.v_risk_profile AS
SELECT
  rc.risk_context_id,
  rc.organization_id,
  o.organization_name,
  ra.risk_assessment_id,
  ra.risk_code,
  ra.risk_description,
  c.name AS risk_category,
  ra.inherent_risk,
  ra.current_risk,
  ra.risk_level,
  rt.target_residual_risk,
  rt.schedule_date,
  rt.status AS treatment_status
FROM risk.risk_context rc
JOIN master.organization o
  ON o.organization_id = rc.organization_id
JOIN risk.risk_assessment ra
  ON ra.risk_context_id = rc.risk_context_id
JOIN master.risk_category c
  ON c.risk_category_id = ra.risk_category_id
LEFT JOIN LATERAL (
  SELECT *
  FROM risk.risk_treatment x
  WHERE x.risk_assessment_id = ra.risk_assessment_id
  ORDER BY x.schedule_date DESC NULLS LAST
  LIMIT 1
) rt ON true;
