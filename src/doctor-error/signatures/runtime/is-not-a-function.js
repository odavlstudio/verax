const { round } = require('../helpers');

const pattern = /(\w[^\s]*) is not a function/i;

const isNotAFunction = {
  match: (raw) => pattern.test(raw),
  diagnose: (raw) => {
    const match = raw.match(pattern);
    const token = match && match[1] ? match[1] : 'value';

    const rankedCauses = [
      {
        id: 'wrong-import-shape',
        title: 'Imported default vs named function incorrectly',
        whyLikely: 'Common when mixing CJS require and ESM named exports',
        confidence: round(0.55),
        quickCheck: 'Check import statement vs module export (default vs named)'
      },
      {
        id: 'mutated-reference',
        title: 'Variable reassigned to non-function before call',
        whyLikely: 'Reference overwritten by object or promise in flow',
        confidence: round(0.27),
        quickCheck: 'Log typeof target right before invocation'
      },
      {
        id: 'version-shift',
        title: 'Library upgrade changed API shape',
        whyLikely: 'Function replaced with object/class after update',
        confidence: round(0.18),
        quickCheck: 'Compare installed version API to docs for call site'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Was the symbol imported as named or default?',
        choices: [
          { id: 'named-import', title: 'Named import', meaning: 'Ensure module exports a matching named function' },
          { id: 'default-import', title: 'Default import', meaning: 'Switch to destructured import if function is named' }
        ]
      }
    ];

    return {
      errorTitle: `Called non-function value: ${token}`,
      errorSignature: match && match[0] ? match[0] : 'is not a function',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'Align import with module export (default vs named)',
            'Log typeof target before call to confirm function'
          ]
        },
        bestFix: {
          steps: [
            'Update all call sites to correct symbol from module',
            'Add runtime assertion: if (typeof fn !== "function") throw early',
            'Pin or upgrade library version consistent with expected API'
          ]
        },
        verify: {
          steps: [
            'Re-run failing path and confirm call executes without TypeError',
            'Exercise another call site to ensure symbol shape is consistent'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { isNotAFunction };
