const { round } = require('../helpers');

const importOutsideModule = {
  match: (raw) => /cannot use import statement outside a module/i.test(raw),
  diagnose: () => {
    const rankedCauses = [
      {
        id: 'cjs-entry-running-esm',
        title: 'CommonJS entry running ESM syntax',
        whyLikely: 'Default node execution of .js treats as CJS without type=module',
        confidence: round(0.55),
        quickCheck: 'Check package.json type and file extension (.mjs for ESM)'
      },
      {
        id: 'ts-node-no-esm-flag',
        title: 'ts-node/babel running ESM without loader flags',
        whyLikely: 'Needs loader or transpile to CJS',
        confidence: round(0.27),
        quickCheck: 'Ensure ts-node run with --esm or transpile target module=commonjs'
      },
      {
        id: 'mixed-build-output',
        title: 'Built output still contains import in CJS target',
        whyLikely: 'Build config did not transpile module syntax',
        confidence: round(0.18),
        quickCheck: 'Inspect dist file to verify module syntax matches runtime mode'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Should this project run as ESM?',
        choices: [
          { id: 'esm-yes', title: 'Yes, ESM', meaning: 'Set type=module or use .mjs and update imports' },
          { id: 'esm-no', title: 'No, CJS', meaning: 'Transpile to commonjs or switch imports to require' }
        ]
      }
    ];

    return {
      errorTitle: 'Cannot use import statement outside a module',
      errorSignature: 'SyntaxError: Cannot use import statement outside a module',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'If running CJS, change imports to require or transpile to commonjs',
            'If ESM intended, set package.json "type": "module" or rename entry to .mjs'
          ]
        },
        bestFix: {
          steps: [
            'Choose one module system and align package.json type, extensions, and build output',
            'Update tooling (ts-node, Jest) to use matching loader/config',
            'Add lint/check to prevent mixed module syntax in same entry'
          ]
        },
        verify: {
          steps: [
            'Run the same entry without SyntaxError',
            'Execute another import to confirm runtime resolves modules consistently'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { importOutsideModule };
