# Manual IKU → Strategic Objective

Manual IKU now treats `planning.strategic_objective` as the canonical master.

## Save behavior
- User types/selects Sasaran Strategis in Manual IKU.
- On Save, backend resolves an existing strategic objective by code or exact name + period.
- If none exists, it creates one inside a transaction.
- The resulting `strategic_objective_id` is stored on `performance.iku_manual`.
- `strategic_objective_name` remains only as a compatibility/snapshot field.

This avoids inserting a strategic objective on every keystroke and prevents duplicate rows caused by editing text.
