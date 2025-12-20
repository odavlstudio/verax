import { signatures } from './signatures';
import {
  DiagnosisResult,
  DiagnosticChoice,
  DiagnosticQuestion,
  ErrorSignature,
  FixPathSteps,
  RankedCause
} from './types';

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

function normalize(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function cap(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function clampConfidence(value: number): number {
  const bounded = Math.min(1, Math.max(0, value));
  return Number(bounded.toFixed(2));
}

function sanitizeCauses(causes: RankedCause[]): RankedCause[] {
  return causes.slice(0, 5).map((cause) => ({
    id: cause.id,
    title: cap(cause.title, LIMITS.errorTitle),
    whyLikely: cap(cause.whyLikely, LIMITS.whyLikely),
    confidence: clampConfidence(cause.confidence),
    quickCheck: cap(cause.quickCheck, LIMITS.quickCheck)
  }));
}

function sanitizeChoices(choices: DiagnosticChoice[]): DiagnosticChoice[] {
  return choices.slice(0, 4).map((choice) => ({
    id: choice.id,
    title: cap(choice.title, LIMITS.choiceTitle),
    meaning: cap(choice.meaning, LIMITS.choiceMeaning)
  }));
}

function sanitizeQuestions(questions?: DiagnosticQuestion[]): DiagnosticQuestion[] | undefined {
  if (!questions || questions.length === 0) return undefined;
  const trimmed = questions.slice(0, 2).map((q) => ({
    question: cap(q.question, LIMITS.question),
    choices: sanitizeChoices(q.choices)
  }));
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeSteps(path: FixPathSteps, maxSteps: number): FixPathSteps {
  return { steps: path.steps.slice(0, maxSteps).map((step) => cap(step, LIMITS.step)) };
}

function sanitizeDiagnosis(result: DiagnosisResult): DiagnosisResult {
  const rankedCauses = sanitizeCauses(result.rankedCauses);
  const topConfidence = rankedCauses.length > 0 ? rankedCauses[0].confidence : clampConfidence(result.confidence);

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
    confidence: topConfidence,
    rankedCauses,
    diagnosticQuestions,
    fixPaths,
    safetyNotes
  };
}

export function diagnose(rawErrorText: string): DiagnosisResult | null {
  const normalized = normalize(rawErrorText || '');
  if (!normalized) return null;

  for (const signature of signatures as ErrorSignature[]) {
    if (signature.match(normalized)) {
      const result = signature.diagnose(normalized);
      return sanitizeDiagnosis(result);
    }
  }

  return null;
}
