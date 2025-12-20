const { round } = require('../helpers');

const pattern = /(cannot read (?:property|properties) of (?:null|undefined))(?: \(reading '([^']+)'\))?/i;

const cannotReadNullUndefined = {
  match: (raw) => pattern.test(raw),
  diagnose: (raw) => {
    const match = raw.match(pattern);
    const prop = match && match[2] ? match[2] : 'value';
    const signatureText = match && match[1] ? match[1] : 'Cannot read properties of undefined';

    const rankedCauses = [
      {
        id: 'async-data-not-ready',
        title: 'Value undefined before async data resolves',
        whyLikely: 'Happens on first render or early lifecycle before data arrives',
        confidence: round(0.6),
        quickCheck: 'Log typeof value at the failing line before property access'
      },
      {
        id: 'null-from-api',
        title: 'API returns null for optional field',
        whyLikely: 'Nulls propagate when backend omits optional nodes',
        confidence: round(0.22),
        quickCheck: 'Inspect API response to confirm field nullability'
      },
      {
        id: 'unbound-this',
        title: 'this is undefined for method call',
        whyLikely: 'Method detached from instance loses this binding',
        confidence: round(0.18),
        quickCheck: 'Check invocation site to ensure method is bound or arrow-based'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Is the value loaded asynchronously before this access?',
        choices: [
          { id: 'yes-async', title: 'Yes, fetched later', meaning: 'Add default and guard before reading' },
          { id: 'no-sync', title: 'No, should exist', meaning: 'Focus on binding and API nullability' }
        ]
      }
    ];

    return {
      errorTitle: `Null/undefined property access: ${prop}`,
      errorSignature: signatureText,
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'Guard access: if (!value) return; before reading properties',
            'Provide default: const safe = value ?? {}; then access the property'
          ]
        },
        bestFix: {
          steps: [
            'Initialize async data to safe defaults at source (empty object/array)',
            'Add optional chaining or null checks on optional fields',
            'Bind class methods in constructor or use arrow functions to keep this'
          ]
        },
        verify: {
          steps: [
            'Re-run with slow network or null API response and confirm no TypeError',
            'Check UI shows fallback state and proceeds once data loads'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { cannotReadNullUndefined };
