const { round } = require('../helpers');

const pattern = /unexpected token\s+([^\s]+)/i;

const unexpectedTokenRuntime = {
  match: (raw) => /unexpected token/i.test(raw),
  diagnose: (raw) => {
    const match = raw.match(pattern);
    const token = match && match[1] ? match[1].replace(/[^\w'"`<>]/g, '') : 'token';

    const rankedCauses = [
      {
        id: 'esm-in-cjs',
        title: 'ESM syntax executed in CommonJS runtime',
        whyLikely: 'export/import tokens throw when Node runs CJS entry',
        confidence: round(0.48),
        quickCheck: 'Check package.json type and file extension .mjs/.cjs'
      },
      {
        id: 'jsx-not-transpiled',
        title: 'JSX/TS syntax executed without transpile',
        whyLikely: 'Unexpected token < or : occurs when running source instead of build',
        confidence: round(0.32),
        quickCheck: 'Ensure build step (tsc/babel) runs before node executes file'
      },
      {
        id: 'malformed-json',
        title: 'Parsing JSON with trailing comma/comment',
        whyLikely: 'Unexpected token } or , when JSON contains trailing comma',
        confidence: round(0.2),
        quickCheck: 'Validate JSON input without comments or trailing commas'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Is the file meant to run as ESM or compiled output?',
        choices: [
          { id: 'esm-intent', title: 'ESM module', meaning: 'Ensure type=module or .mjs with loader' },
          { id: 'compiled-intent', title: 'Compiled output', meaning: 'Run transpiled JS, not raw TS/JSX' }
        ]
      }
    ];

    return {
      errorTitle: `Unexpected token: ${token}`,
      errorSignature: match && match[0] ? match[0] : 'Unexpected token',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'If token is export/import, run node with --input-type=module or rename to .mjs',
            'If JSX/TS, transpile with tsc/babel and run compiled output'
          ]
        },
        bestFix: {
          steps: [
            'Set package.json type consistently and align imports/exports',
            'Ensure build pipeline compiles JSX/TS before runtime',
            'Lint JSON inputs to block trailing commas/comments'
          ]
        },
        verify: {
          steps: [
            'Re-run entry; confirm it executes without syntax error',
            'Add a test that imports the file to ensure parser acceptance'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { unexpectedTokenRuntime };
