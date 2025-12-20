export interface RankedCause {
  id: string;
  title: string;
  whyLikely: string;
  confidence: number;
  quickCheck: string;
}

export interface DiagnosticChoice {
  id: string;
  title: string;
  meaning: string;
}

export interface DiagnosticQuestion {
  question: string;
  choices: DiagnosticChoice[];
}

export interface FixPathSteps {
  steps: string[];
}

export interface FixPaths {
  quickFix: FixPathSteps;
  bestFix: FixPathSteps;
  verify: FixPathSteps;
}

export interface DiagnosisResult {
  errorTitle: string;
  errorSignature: string;
  confidence: number;
  rankedCauses: RankedCause[];
  diagnosticQuestions?: DiagnosticQuestion[];
  fixPaths: FixPaths;
  safetyNotes?: string[];
}

export interface ErrorSignature {
  match: (raw: string) => boolean;
  diagnose: (raw: string) => DiagnosisResult;
}
