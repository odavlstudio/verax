import { DiagnosisResult, ErrorSignature } from '../../types';
import { round } from '../helpers';

const pattern = /invalid hook call/i;

export const invalidHookCall: ErrorSignature = {
  match: (raw: string) => pattern.test(raw),
  diagnose: (): DiagnosisResult => {
    const rankedCauses = [
      {
        id: 'multiple-react-versions',
        title: 'Multiple React versions in bundle',
        whyLikely: 'Invalid hook call occurs when hooks resolve to different React copies',
        confidence: round(0.44),
        quickCheck: 'Run npm ls react react-dom to ensure single version'
      },
      {
        id: 'hooks-outside-component',
        title: 'Hook used outside function component or custom hook',
        whyLikely: 'Calling hooks in condition/loop/plain function triggers error',
        confidence: round(0.38),
        quickCheck: 'Inspect stack and ensure hooks only in top-level of function component'
      },
      {
        id: 'mismatched-react-renderer',
        title: 'react and react-dom/react-native versions mismatch',
        whyLikely: 'Renderer mismatch can invalidate hook identity',
        confidence: round(0.18),
        quickCheck: 'Compare versions of react and renderer packages for alignment'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Does npm ls show multiple React versions?',
        choices: [
          { id: 'multi-react', title: 'Yes, multiple', meaning: 'Hoist/dedupe to single version' },
          { id: 'single-react', title: 'No, single', meaning: 'Focus on hook placement rules' }
        ]
      }
    ];

    return {
      errorTitle: 'Invalid hook call in React',
      errorSignature: 'Invalid hook call. Hooks can only be called inside of the body of a function component',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'Ensure hooks are only called at top-level of React function components/custom hooks',
            'Remove hook calls from conditions, loops, or class components'
          ]
        },
        bestFix: {
          steps: [
            'Dedupe React to a single version via npm/yarn resolutions',
            'Align react and react-dom versions; lock in package.json',
            'Move shared logic into custom hooks that follow rules of hooks'
          ]
        },
        verify: {
          steps: [
            'Run npm ls react react-dom to confirm single aligned version',
            'Reload app and ensure hook error no longer appears'
          ]
        }
      },
      safetyNotes: []
    };
  }
};
