import { DiagnosisResult, ErrorSignature } from '../types';

const pattern = /(\w[^\s]*) is not a function/i;

function round(value: number): number {
  return Number(value.toFixed(2));
}

export const notAFunctionSignature: ErrorSignature = {
  match: (raw: string) => pattern.test(raw),
  diagnose: (raw: string): DiagnosisResult => {
    const match = raw.match(pattern);
    const token = match && match[1] ? match[1] : 'value';
    const errorTitle = `Called non-function value: ${token}`;
    const errorSignature = match && match[0] ? match[0] : 'is not a function';

    const rankedCauses = [
      {
        id: 'wrong-import-shape',
        title: 'Imported default vs named function incorrectly',
        whyLikely: 'Common when swapping between require and ESM or using named exports',
        confidence: round(0.55),
        quickCheck: 'Inspect import statement and module exports to confirm function shape'
      },
      {
        id: 'mutated-reference',
        title: 'Variable reassigned to object or promise before call',
        whyLikely: 'Call target was overwritten by non-function value earlier in flow',
        confidence: round(0.27),
        quickCheck: 'Log typeof target immediately before invocation'
      },
      {
        id: 'version-mismatch',
        title: 'Library version changed exported API surface',
        whyLikely: 'Upgrades sometimes replace functions with objects or classes',
        confidence: round(0.18),
        quickCheck: 'Check installed package version against expected API in docs'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Was the function imported as a named or default export?',
        choices: [
          { id: 'named-export', title: 'Named import', meaning: 'Ensure module exports a named function with same identifier' },
          { id: 'default-export', title: 'Default import', meaning: 'Switch to destructured named import or adjust module default' }
        ]
      }
    ];

    const fixPaths = {
      quickFix: {
        steps: [
          'Align import with module shape: adjust to default import or destructured named import as documented',
          'Log typeof target before call to confirm it is a function'
        ]
      },
      bestFix: {
        steps: [
          'Review module exports and update all call sites to the correct symbol',
          'Add runtime assertion (e.g., if (typeof fn !== "function") throw) near entry',
          'Pin library version that matches expected API if upgrades changed behavior'
        ]
      },
      verify: {
        steps: [
          'Rerun the failing code path and confirm invocation proceeds without TypeError',
          'Exercise another call site to ensure consistent function shape'
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
