# CSS Loading Realistic Fixture

This fixture demonstrates CSS-only loading indicators (spinners) without semantic attributes.

## Capabilities

- `ui-feedback-loading`: Detects CSS-only loading indicators using visual patterns
- `ui-feedback-css-spinner`: Sub-capability for CSS spinner detection

## Test Cases

1. **CONFIRMED SUCCESS**: Border spinner appears + button disabled + content update (2+ signals)
2. **CONFIRMED SUCCESS**: Rotation spinner + pointer-events disabled (2+ signals)
3. **AMBIGUOUS**: Pulse spinner only (no corroborating signals) - SUSPECTED or not counted
4. **MIXED**: Skeleton screen with opacity pulse (detected if rules allow)
5. **FALSE POSITIVE TRAP**: Decorative rotating icon always present (must NOT be detected)
6. **Disabled Button Only**: No spinner, should not count as spinner feedback

