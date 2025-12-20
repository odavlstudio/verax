const { round } = require('../helpers');

const tooManyReRenders = {
  match: (raw) => /too many re-renders/i.test(raw),
  diagnose: () => {
    const rankedCauses = [
      {
        id: 'state-update-during-render',
        title: 'State setter called during render',
        whyLikely: 'Calling setState/useState setter directly in render triggers loop',
        confidence: round(0.57),
        quickCheck: 'Search render body for state setters and move to effects'
      },
      {
        id: 'effect-missing-deps',
        title: 'Effect runs each render and sets state',
        whyLikely: 'useEffect without deps sets state causing render loop',
        confidence: round(0.28),
        quickCheck: 'Check useEffect dependency array for missing stable deps'
      },
      {
        id: 'derived-state-from-props-loop',
        title: 'Derived state from props updates parent/child recursively',
        whyLikely: 'Setter in effect triggers prop change feeding back',
        confidence: round(0.15),
        quickCheck: 'Trace if prop update originates from same component state change'
      }
    ];

    return {
      errorTitle: 'React: Too many re-renders',
      errorSignature: 'Too many re-renders. React limits the number of renders to prevent an infinite loop.',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      fixPaths: {
        quickFix: {
          steps: [
            'Remove state setter calls from render body; move to event handlers or effects',
            'Add dependency array to effects that set state to control frequency'
          ]
        },
        bestFix: {
          steps: [
            'Ensure effects that set state list stable dependencies or use memoized callbacks',
            'Use functional updates to avoid capturing stale closures',
            'Refactor derived state to avoid circular prop/state updates'
          ]
        },
        verify: {
          steps: [
            'Reload component and confirm render loop stops',
            'Add test rendering component to ensure no infinite rerender occurs'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { tooManyReRenders };
