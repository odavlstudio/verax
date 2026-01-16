# View Switch Realistic Fixture

This fixture demonstrates state-driven view switches without URL changes.

## Capabilities

- `state-driven-view-switch`: Detects view switch promises (setView, setTab, dispatch(NAVIGATE), etc.) and correlates them with UI changes

## Test Cases

1. **CONFIRMED SUCCESS**: setView('settings') with 2+ UI signals (DOM signature + landmark change)
2. **CONFIRMED FAILURE**: Promise exists but no meaningful UI change (0-1 signals)
3. **FALSE POSITIVE TRAP**: Minor change only (button text toggle) - guardrail blocks CONFIRMED
4. **AMBIGUOUS CASE**: One signal only (DOM signature change) - downgraded to SUSPECTED
5. **BLOCKED INTERACTION**: Disabled button - produces INFORMATIONAL
6. **ANALYTICS ONLY**: Only analytics fired - guardrail blocks CONFIRMED

