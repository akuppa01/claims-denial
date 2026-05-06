# Backend Context

## Role

The backend is the claims-processing engine.

It:

- receives 6 uploaded Excel files
- canonicalizes columns via the rules brain
- joins denial rows to supporting data
- runs scenario validation logic
- emits a styled Excel output workbook

## Key Files

- [main.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/app/main.py)
  FastAPI entrypoint and HTTP surface
- [processor.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/app/processor.py)
  Main orchestration and output-row assembly
- [rules_loader.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/app/rules_loader.py)
  Reads the rules brain workbook into config objects
- [schemas.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/app/schemas.py)
  Pydantic models for config structures
- [validation_engine.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/app/validation_engine.py)
  Rule evaluation engine
- [output_writer.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/app/output_writer.py)
  Final DataFrame and Excel emission

## Important Behavior

- Endpoint:
  `POST /process-claims`
- Response:
  binary Excel file
- Health:
  `GET /health`
- Rules brain is configuration, not just documentation

## Current Logic Posture

- Stronger output formatting and standardized scenario text are now in place
- Some scenario outcome semantics are still incomplete
- When business outcome is unclear, the preferred posture is manual review over false certainty

## Rules Brain Status

The code now supports optional scenario metadata for future enrichment:

- `all_pass_outcome`
- `standard_research_finding`
- `standard_discrepancy_details`
- `resubmission_next_action`
- `acceptable_next_action`
- `secondary_source_display`

The current uploaded workbook fixture does not yet fully populate those fields.

## Tests

Most relevant tests:

- [test_divestiture_scenarios.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/test_divestiture_scenarios.py)
- [test_processor_output_semantics.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/test_processor_output_semantics.py)
- [test_output_writer.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/test_output_writer.py)
- [test_rules_loader.py](/Users/adi/Desktop/Coding/Misc/Claims%20Denial/backend/tests/test_rules_loader.py)

## Best Next Backend Step

Add explicit scenario outcome metadata to the rules brain so the processor can stop inferring business outcomes from partial signals.
