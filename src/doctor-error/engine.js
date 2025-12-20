const { signatures } = require('./signatures/index.js');

const LIMITS = {
  errorTitle: 80,
  errorSignature: 140,
  whyLikely: 160,
  quickCheck: 140,
  question: 120,
  choiceTitle: 60,
  choiceMeaning: 120,
  step: 140,
  safetyNote: 120
};

function normalize(raw) {
  return raw.replace(/\s+/g, ' ').trim();
}

function cap(value, max) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function clampConfidence(value) {
  const bounded = Math.min(1, Math.max(0, value));
  return Number(bounded.toFixed(2));
}

function sanitizeCauses(causes) {
  return causes.slice(0, 5).map((cause) => ({
    id: cause.id,
    title: cap(cause.title, LIMITS.errorTitle),
    whyLikely: cap(cause.whyLikely, LIMITS.whyLikely),
    confidence: clampConfidence(cause.confidence),
    quickCheck: cap(cause.quickCheck, LIMITS.quickCheck)
  }));
}

function sanitizeChoices(choices) {
  return choices.slice(0, 4).map((choice) => ({
    id: choice.id,
    title: cap(choice.title, LIMITS.choiceTitle),
    meaning: cap(choice.meaning, LIMITS.choiceMeaning)
  }));
}

function sanitizeQuestions(questions) {
  if (!questions || questions.length === 0) return undefined;
  const trimmed = questions.slice(0, 2).map((q) => ({
    question: cap(q.question, LIMITS.question),
    choices: sanitizeChoices(q.choices)
  }));
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeSteps(path, maxSteps) {
  return { steps: path.steps.slice(0, maxSteps).map((step) => cap(step, LIMITS.step)) };
}

function sanitizeDiagnosis(result) {
  const rankedCauses = sanitizeCauses(result.rankedCauses);
  const diagnosticQuestions = sanitizeQuestions(result.diagnosticQuestions);
  const fixPaths = {
    quickFix: sanitizeSteps(result.fixPaths.quickFix, 6),
    bestFix: sanitizeSteps(result.fixPaths.bestFix, 6),
    verify: sanitizeSteps(result.fixPaths.verify, 4)
  };
  const safetyNotes = result.safetyNotes && result.safetyNotes.length > 0
    ? result.safetyNotes.slice(0, 4).map((note) => cap(note, LIMITS.safetyNote))
    : undefined;

  return {
    errorTitle: cap(result.errorTitle, LIMITS.errorTitle),
    errorSignature: cap(result.errorSignature, LIMITS.errorSignature),
    confidence: rankedCauses.length > 0 ? clampConfidence(rankedCauses[0].confidence) : clampConfidence(result.confidence),
    rankedCauses,
    diagnosticQuestions,
    fixPaths,
    safetyNotes
  };
}

function diagnose(rawErrorText) {
  const normalized = normalize(rawErrorText || '');
  if (!normalized) return null;
  for (const signature of signatures) {
    if (signature.match(normalized)) {
      const result = signature.diagnose(normalized);
      return sanitizeDiagnosis(result);
    }
  }
  return null;
}

module.exports = { diagnose };
