import { DiagnosisResult, ErrorSignature } from '../../types';
import { round } from '../helpers';

const pattern = /require is not defined/i;

export const requireNotDefined: ErrorSignature = {
  match: (raw: string) => pattern.test(raw),
  diagnose: (): DiagnosisResult => {
    const rankedCauses = [
      {
        id: 'esm-runtime',
        title: 'Running code as ESM where require is unavailable',
        whyLikely: 'ESM modules lack require by default',
        confidence: round(0.52),
        quickCheck: 'Check package.json type and file extension (.mjs)'
      },
      {
        id: 'browser-runtime',
        title: 'require used in browser without bundler shim',
        whyLikely: 'Browser does not have require unless bundled',
        confidence: round(0.3),
        quickCheck: 'Confirm code is bundled/transpiled for browser with proper module system'
      },
      {
        id: 'mixed-bundle',
        title: 'Bundler output configured for ESM but code expects CJS',
        whyLikely: 'Build emits ESM chunks removing require',
        confidence: round(0.18),
        quickCheck: 'Inspect bundle format (esm vs cjs) and adjust imports accordingly'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Should runtime support require or import?',
        choices: [
          { id: 'need-require', title: 'Need require', meaning: 'Use CJS build or create require via createRequire' },
          { id: 'use-import', title: 'Use import', meaning: 'Convert to import syntax and align module type' }
        ]
      }
    ];

    return {
      errorTitle: 'require is not defined (ESM/CJS mismatch)',
      errorSignature: 'ReferenceError: require is not defined',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'If in ESM, import { createRequire } from "module" and use createRequire(import.meta.url)',
            'If browser, bundle module with proper loader or switch to import statements'
          ]
        },
        bestFix: {
          steps: [
            'Align project to single module system and update build output format',
            'Replace require calls with import when targeting ESM; otherwise set type to commonjs',
            'Update tooling (Jest/Webpack/Rollup) to emit matching module format'
          ]
        },
        verify: {
          steps: [
            'Run entry without ReferenceError and confirm modules load',
            'Execute another require/import to ensure chosen module system is consistent'
          ]
        }
      },
      safetyNotes: []
    };
  }
};
