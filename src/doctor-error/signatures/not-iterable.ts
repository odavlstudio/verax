import { DiagnosisResult, ErrorSignature } from '../types';

const pattern = /is not iterable/i;

function round(value: number): number {
  return Number(value.toFixed(2));
}

export const notIterableSignature: ErrorSignature = {
  match: (raw: string) => pattern.test(raw),
  diagnose: (raw: string): DiagnosisResult => {
    const tokenMatch = raw.match(/^(?:TypeError:)?\s*([^:]+):?\s*.*is not iterable/i);
    const subject = tokenMatch && tokenMatch[1] ? tokenMatch[1].trim() : 'value';
    const errorTitle = `Non-iterable used in for-of or spread: ${subject}`;
    const errorSignature = 'TypeError: value is not iterable';

    const rankedCauses = [
      {
        id: 'null-or-undefined',
        title: 'Value is null or undefined at iteration site',
        whyLikely: 'Most common root for not iterable when async data not ready',
        confidence: round(0.54),
        quickCheck: 'Log value before iteration to confirm null/undefined'
      },
      {
        id: 'object-instead-of-array',
        title: 'Plain object provided where array is expected',
        whyLikely: 'Spreading or for-of over object triggers not iterable',
        confidence: round(0.3),
        quickCheck: 'Check data shape from API and ensure arrays are returned'
      },
      {
        id: 'promise-not-awaited',
        title: 'Promise used without await before iteration',
        whyLikely: 'Iterating a pending promise yields not iterable',
        confidence: round(0.16),
        quickCheck: 'Verify awaits before using async function results in iteration'
      }
    ];

    const fixPaths = {
      quickFix: {
        steps: [
          'Guard iterable sources: use value ?? [] before for-of or spread',
          'If promise is returned, await it before iterating'
        ]
      },
      bestFix: {
        steps: [
          'Ensure APIs return arrays for iterable fields and validate with runtime checks',
          'Normalize incoming objects to arrays with Object.values when appropriate',
          'Add TypeScript types enforcing array shape on iteration inputs'
        ]
      },
      verify: {
        steps: [
          'Re-run the failing iteration path and confirm it executes without TypeError',
          'Add a test case with empty payload to ensure guards cover null/undefined'
        ]
      }
    };

    return {
      errorTitle,
      errorSignature,
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      fixPaths,
      safetyNotes: []
    };
  }
};
