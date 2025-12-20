import { DiagnosisResult, ErrorSignature } from '../../types';
import { round } from '../helpers';

const pattern = /react hook useeffect has a missing dependency|exhaustive-deps/i;

export const useEffectDepsIssue: ErrorSignature = {
  match: (raw: string) => pattern.test(raw) || /dependency array/i.test(raw),
  diagnose: (): DiagnosisResult => {
    const rankedCauses = [
      {
        id: 'missing-dependency',
        title: 'Dependency omitted from dependency array',
        whyLikely: 'Lint rule exhaustive-deps triggers when dependencies missing',
        confidence: round(0.5),
        quickCheck: 'Check ESLint output for missing variables in dependency array'
      },
      {
        id: 'stale-closure',
        title: 'Stale closure due to incorrect dependency list',
        whyLikely: 'Effect uses value that is not listed causing stale data',
        confidence: round(0.32),
        quickCheck: 'Log values inside effect to see if they lag behind current props/state'
      },
      {
        id: 'unstable-function-dep',
        title: 'Unmemoized function causes unnecessary reruns',
        whyLikely: 'Functions recreated each render trigger effect reruns',
        confidence: round(0.18),
        quickCheck: 'Check if functions in deps are memoized with useCallback'
      }
    ];

    return {
      errorTitle: 'React: useEffect dependency array issue',
      errorSignature: 'React Hook useEffect has a missing dependency',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions: [
        {
          question: 'Is the missing item stable or should it trigger re-run?',
          choices: [
            { id: 'should-trigger', title: 'Should trigger', meaning: 'Add it to deps and handle reruns safely' },
            { id: 'should-stay-stable', title: 'Should stay stable', meaning: 'Memoize value or suppress with comment and reason' }
          ]
        }
      ],
      fixPaths: {
        quickFix: {
          steps: [
            'Add the flagged dependency to the dependency array',
            'Memoize functions/objects used in effect with useCallback/useMemo'
          ]
        },
        bestFix: {
          steps: [
            'Refactor effect to minimize dependencies and side effects',
            'Introduce guards inside effect to avoid unnecessary runs after adding dependencies',
            'Document intentional omissions with eslint-disable-next-line only when justified'
          ]
        },
        verify: {
          steps: [
            'Run eslint with exhaustive-deps and confirm no warnings',
            'Exercise component interactions to ensure effect runs with fresh data'
          ]
        }
      },
      safetyNotes: []
    };
  }
};
