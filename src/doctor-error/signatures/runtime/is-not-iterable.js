const { round } = require('../helpers');

const pattern = /is not iterable/i;

const isNotIterable = {
  match: (raw) => pattern.test(raw),
  diagnose: (raw) => {
    const subjectMatch = raw.match(/^(?:TypeError:)?\s*([^:]+):?\s*.*is not iterable/i);
    const subject = subjectMatch && subjectMatch[1] ? subjectMatch[1].trim() : 'value';

    const rankedCauses = [
      {
        id: 'null-or-undefined',
        title: 'Value is null or undefined at iteration',
        whyLikely: 'Most frequent root when data not ready before for-of/spread',
        confidence: round(0.54),
        quickCheck: 'Log value before iteration to confirm null/undefined'
      },
      {
        id: 'object-instead-of-array',
        title: 'Plain object provided where array expected',
        whyLikely: 'Spreading or looping object triggers not iterable',
        confidence: round(0.3),
        quickCheck: 'Inspect API response to ensure arrays returned'
      },
      {
        id: 'promise-not-awaited',
        title: 'Promise used without await',
        whyLikely: 'Iterating a promise throws not iterable',
        confidence: round(0.16),
        quickCheck: 'Check call site awaits async function before iteration'
      }
    ];

    return {
      errorTitle: `Non-iterable used in iteration: ${subject}`,
      errorSignature: 'TypeError: value is not iterable',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      fixPaths: {
        quickFix: {
          steps: [
            'Guard iterable source: const safe = value ?? []; before for-of/spread',
            'Await promises before iteration if source is async'
          ]
        },
        bestFix: {
          steps: [
            'Ensure APIs return arrays and validate shape at boundaries',
            'Normalize objects to arrays via Object.values when intentional',
            'Add TypeScript types enforcing array shape for iterable inputs'
          ]
        },
        verify: {
          steps: [
            'Replay failing path and confirm iteration succeeds',
            'Add test with empty payload to confirm guards handle null/undefined'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { isNotIterable };
