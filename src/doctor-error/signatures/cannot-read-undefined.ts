import { DiagnosisResult, ErrorSignature } from '../types';

const pattern = /cannot read (?:property|properties) of undefined(?: \(reading '([^']+)'\))?/i;

function round(value: number): number {
  return Number(value.toFixed(2));
}

export const cannotReadUndefinedSignature: ErrorSignature = {
  match: (raw: string) => pattern.test(raw),
  diagnose: (raw: string): DiagnosisResult => {
    const match = raw.match(pattern);
    const prop = match && match[1] ? match[1] : 'value';
    const errorTitle = `Undefined property access: ${prop}`;
    const errorSignature = match && match[0] ? match[0] : 'Cannot read properties of undefined';

    const rankedCauses = [
      {
        id: 'missing-initial-guard',
        title: 'Value arrives undefined before async data resolves',
        whyLikely: 'Stack often shows failure on first render before data load',
        confidence: round(0.62),
        quickCheck: 'Log typeof target value before property access near the failing line'
      },
      {
        id: 'unbound-this-context',
        title: 'this is undefined when method is detached from instance',
        whyLikely: 'Calling class method without binding can set this to undefined',
        confidence: round(0.23),
        quickCheck: 'Verify method call is bound or uses arrow function in class'
      },
      {
        id: 'wrong-branch-for-optional-field',
        title: 'Code assumes optional field always present',
        whyLikely: 'Property read happens without optional chaining on nullable field',
        confidence: round(0.15),
        quickCheck: 'Check field definition and ensure optional chaining is used where nullable'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Is the value loaded asynchronously before the failing access?',
        choices: [
          { id: 'async-load', title: 'Yes, fetched later', meaning: 'Add default value and guard before access' },
          { id: 'ready-sync', title: 'No, should be ready', meaning: 'Focus on binding and optional chaining correctness' }
        ]
      }
    ];

    const fixPaths = {
      quickFix: {
        steps: [
          'Guard access: if (!targetValue) return; before using the property',
          'Provide default: const safeValue = targetValue ?? {}; then read the property'
        ]
      },
      bestFix: {
        steps: [
          'Initialize async data to a safe default at source (empty object or array)',
          'Add optional chaining or null checks on optional fields',
          'Bind class methods in constructor or use arrow functions to keep this defined'
        ]
      },
      verify: {
        steps: [
          'Reproduce with slow network or missing data and confirm no TypeError',
          'Observe component or function continues with expected fallback state'
        ]
      }
    };

    return {
      errorTitle,
      errorSignature,
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths,
      safetyNotes: []
    };
  }
};
