# Issues And Discrepancies

## Purpose

This file is the active tracker for:

- logic gaps
- output mismatches
- business-rule ambiguities
- conservative fallback rules
- future investigation items

This is the place to reopen in a month and work issue-by-issue.

## Default Safety Policy

When business intent is not explicit:

- prefer `Needs Manual Review`
- avoid overstating certainty
- do not auto-classify borderline cases as resubmittable unless the rule is clear

## Recently Resolved

These issues were fixed in the latest backend pass:

- Date output now strips the time suffix
- Standardized `Research_Finding` text now matches expected workbook
- `Discrepancy_Details` is now populated and aligned for covered scenarios
- `Primary_Source_Checked` and `Secondary_Source_Checked` were corrected
- `Transition_Period_Flag` now matches the current expected workbook
- `Data_Validation_Result` now aligns for the resolved scenarios

## Still Open

### 1. Mixed-Outcomes Logic

Open columns:

- `Denial_Decision`
- `Agent_Status`
- `Recommended_Next_Action`

Current compare counts vs expected workbook:

- `Denial_Decision`: 64 diffs
- `Agent_Status`: 64 diffs
- `Recommended_Next_Action`: 51 diffs

Root issue:

- Several scenarios are not pure pass/fail scenarios
- A successful lookup or validation does not always mean the same business outcome
- The code still lacks a reliable per-scenario outcome model for mixed cases

Most affected scenarios:

- `PRICE_VARIANCE`
- `MAT_ATTR_MISMATCH`
- `CONTRACT_MISMATCH`
- `DIVEST_WRONG_MANUFACTURER`
- `DIVEST_TRANSITIONAL_PRICING`
- `DIVEST_CONTRACT_NOT_LOADED`

Recommended long-term fix:

- Add scenario-level metadata to the rules brain
- Suggested fields:
  `All_Pass_Outcome`, `Acceptable_Next_Action`, `Resubmission_Next_Action`
- Potentially add more granular split logic fields for scenarios that are not uniform

### 2. Scenario-Specific Split Rules Need Business Clarification

The current expected workbook implies hidden business rules not yet expressed in the rules brain.

Examples:

- some `PRICE_VARIANCE` rows are acceptable denials while others are resubmission candidates
- some `MAT_ATTR_MISMATCH` rows close out while others resubmit
- some `CONTRACT_MISMATCH` rows close out while others resubmit
- some divestiture rows remain acceptable even when the mismatch text exists

This means the rules brain still needs either:

- more scenario attributes
- or more explicit source columns to define the final business outcome

### 3. Frontend Output Is Still Mocked

The frontend output page does not yet render real processed rows.

Two viable future paths:

1. Add a JSON backend endpoint alongside the Excel response
2. Parse the returned Excel in the browser

Preferred path:

- add a structured JSON response endpoint because it is easier to debug and easier for future AI tooling

## Suggested Backlog Order

### Priority 1

- model the final business outcome per scenario in the rules brain
- reduce `Denial_Decision` and `Agent_Status` diffs

### Priority 2

- wire `Recommended_Next_Action` directly to the final business outcome
- remove action text that is still generic for mixed-outcome scenarios

### Priority 3

- add real structured output support to the frontend
- connect output table to actual processed results

## Candidate Rules Brain Enhancements

If the rules brain is being enriched later, these columns would help most:

- `All_Pass_Outcome`
- `Standard_Research_Finding`
- `Standard_Discrepancy_Details`
- `Resubmission_Next_Action`
- `Acceptable_Next_Action`
- `Secondary_Source`
- `Outcome_Driver_Field`
- `Outcome_Driver_Value`

The first six are already supported in code as optional scenario metadata, but the current workbook fixture does not provide them yet.

## Investigation Notes

### PRICE_VARIANCE

- mismatch amount alone does not explain acceptable vs resubmission
- zero variance rows can still be resubmission candidates in the expected workbook
- this strongly suggests an unstated business outcome rule

### MAT_ATTR_MISMATCH

- material status and material reason code do not cleanly separate acceptable vs resubmission rows
- likely needs explicit scenario-outcome instructions from the business side

### CONTRACT_MISMATCH

- current contract fields do not fully explain why some rows close and some resubmit
- another candidate for rules-brain outcome metadata

### DIVESTITURE

- current workbook implies scenario text and source labels are correct now
- remaining divestiture mismatches are mostly business-outcome semantics, not routing/formatting problems

## Conservative Rule For Future Coding

If you are unsure whether a scenario should become:

- `Closed - Research Complete`
- or `Ready for Resubmission Review`

then default to:

- `Needs Manual Review`

unless a clear business rule or rules-brain field says otherwise.
