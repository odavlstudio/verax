import { DiagnosisResult, ErrorSignature } from '../../types';
import { round } from '../helpers';

const pattern = /cannot update a component .* while rendering a different component/i;

export const cannotUpdateDuringRender: ErrorSignature = {
  match: (raw: string) => pattern.test(raw),
  diagnose: (): DiagnosisResult => {
    const rankedCauses = [
      {
        id: 'state-update-during-render',
        title: 'setState/useState setter called during render of another component',
        whyLikely: 'Updating state in render triggers React warning',
        confidence: round(0.52),
        quickCheck: 'Search render body for setState/useState calls'
      },
      {
        id: 'effect-ordering',
        title: 'Effect in parent updates child state synchronously in render',
        whyLikely: 'Calling setter passed as prop during render causes warning',
        confidence: round(0.29),
        quickCheck: 'Check props passed setters executed before useEffect'
      },
      {
        id: 'context-update-in-render',
        title: 'Context provider updated while consumer rendering',
        whyLikely: 'Context updates in render cycle cause cross-component update warning',
        confidence: round(0.19),
        quickCheck: 'Inspect context setters triggered during render'
      }
    ];

    return {
      errorTitle: 'React: Cannot update during another render',
      errorSignature: 'Cannot update a component while rendering a different component',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      fixPaths: {
        quickFix: {
          steps: [
            'Move state updates into useEffect/useLayoutEffect instead of render',
            'Wrap setter calls in event handlers or effects, not during render pass'
          ]
        },
        bestFix: {
          steps: [
            'Refactor data flow so props are derived before render without triggering setters',
            'Use useMemo/useCallback to avoid recreating values that cause child state updates',
            'Ensure context provider updates occur in effects or event handlers'
          ]
        },
        verify: {
          steps: [
            'Reload component tree and confirm warning disappears',
            'Add test rendering parent/child to ensure no cross-render updates'
          ]
        }
      },
      safetyNotes: []
    };
  }
};
