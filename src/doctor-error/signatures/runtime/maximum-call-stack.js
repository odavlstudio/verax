const { round } = require('../helpers');

const pattern = /maximum call stack size exceeded/i;

const maximumCallStack = {
  match: (raw) => pattern.test(raw),
  diagnose: () => {
    const rankedCauses = [
      {
        id: 'recursive-call-no-exit',
        title: 'Recursive function without base case',
        whyLikely: 'Deep recursion is the primary trigger for call stack overflow',
        confidence: round(0.56),
        quickCheck: 'Inspect recursion path for missing return when depth high'
      },
      {
        id: 'circular-render',
        title: 'State update triggers render loop',
        whyLikely: 'Calling setState or useState setter during render recurses',
        confidence: round(0.28),
        quickCheck: 'Check if render/constructor triggers state updates synchronously'
      },
      {
        id: 'circular-json',
        title: 'JSON.stringify on circular structure',
        whyLikely: 'stringify recurses infinitely on self-referential object',
        confidence: round(0.16),
        quickCheck: 'Test with util.inspect to see circular references before stringify'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Does the stack trace show repeated function names?',
        choices: [
          { id: 'same-frame-loop', title: 'Yes, same frame repeats', meaning: 'Focus on recursion exit or render loop' },
          { id: 'mixed-frames', title: 'No, mixed frames', meaning: 'Check for circular data serialization' }
        ]
      }
    ];

    return {
      errorTitle: 'Maximum call stack size exceeded',
      errorSignature: 'RangeError: Maximum call stack size exceeded',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'Add immediate guard/base case to recursive path to stop deep calls',
            'Move state updates out of render/constructor to useEffect/useLayoutEffect'
          ]
        },
        bestFix: {
          steps: [
            'Design explicit recursion depth limit or iterative approach',
            'Break render loops by ensuring setters run in effects and guard equality before updating',
            'Handle circular data before stringify by removing or replacing references'
          ]
        },
        verify: {
          steps: [
            'Run the same operation and confirm stack does not grow unbounded',
            'Add test for recursion base case and render guard to prevent regression'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { maximumCallStack };
