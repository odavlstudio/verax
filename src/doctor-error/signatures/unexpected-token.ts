import { DiagnosisResult, ErrorSignature } from '../types';

const pattern = /unexpected token\s+([^\s]+)/i;

function round(value: number): number {
  return Number(value.toFixed(2));
}

export const unexpectedTokenSignature: ErrorSignature = {
  match: (raw: string) => /unexpected token/i.test(raw),
  diagnose: (raw: string): DiagnosisResult => {
    const match = raw.match(pattern);
    const token = match && match[1] ? match[1].replace(/[^\w'"`<>]/g, '') : 'token';
    const errorTitle = `Unexpected token encountered: ${token}`;
    const errorSignature = match && match[0] ? match[0] : 'Unexpected token';

    const rankedCauses = [
      {
        id: 'esm-in-cjs',
        title: 'ESM syntax executed in CommonJS runtime',
        whyLikely: 'Token often shows export/import in Node without ESM loader',
        confidence: round(0.48),
        quickCheck: 'Check package.json type field and entry extension (.mjs vs .cjs)'
      },
      {
        id: 'jsx-not-transpiled',
        title: 'JSX or TS syntax not transpiled before Node executes',
        whyLikely: 'Unexpected token < or : often from JSX or types',
        confidence: round(0.32),
        quickCheck: 'Inspect build step to ensure Babel/TS transpilation runs before node'
      },
      {
        id: 'malformed-json',
        title: 'Parsing JSON with trailing comma or comments',
        whyLikely: 'Unexpected token } or , appears when JSON includes trailing comma',
        confidence: round(0.2),
        quickCheck: 'Validate JSON input with a linter or online validator without comments'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Is the file meant for ESM or compiled output before Node runs it?',
        choices: [
          { id: 'esm-expected', title: 'ESM file', meaning: 'Ensure type=module or use .mjs with proper loader' },
          { id: 'compiled-expected', title: 'Transpiled output', meaning: 'Confirm build emits JS before runtime executes' }
        ]
      }
    ];

    const fixPaths = {
      quickFix: {
        steps: [
          'If token is export/import, run node with --input-type=module or change file to .mjs',
          'If JSX/TS, run build step (tsc/babel) and execute the compiled output instead of source'
        ]
      },
      bestFix: {
        steps: [
          'Set package.json type to module and align all imports/exports consistently',
          'Ensure bundler/transpiler handles JSX/TS before runtime execution',
          'Add lint rule to prevent JSON with trailing commas when parsed at runtime'
        ]
      },
      verify: {
        steps: [
          'Run the same entry file and confirm it executes without syntax errors',
          'Add a quick test that imports the file to ensure parser accepts it'
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
