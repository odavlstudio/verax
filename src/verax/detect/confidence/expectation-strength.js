// Expectation strength evaluation

export function determineExpectationStrength(expectation = {}) {
  if (!expectation || Object.keys(expectation).length === 0) {
    return 'UNKNOWN';
  }

  if (expectation.expectationStrength === 'OBSERVED') {
    return 'OBSERVED';
  }

  if (expectation.proof === 'PROVEN_EXPECTATION') {
    return 'PROVEN';
  }

  if (expectation.explicit === true || expectation.sourceRef) {
    return 'PROVEN';
  }

  if (expectation.evidence && expectation.evidence.source) {
    return 'PROVEN';
  }

  return 'WEAK';
}

export function getBaseScoreFromExpectationStrength(expectationStrength) {
  if (expectationStrength === 'PROVEN') {
    return 70;
  }
  if (expectationStrength === 'OBSERVED') {
    return 55;
  }
  if (expectationStrength === 'WEAK') {
    return 50;
  }
  return 0;
}
