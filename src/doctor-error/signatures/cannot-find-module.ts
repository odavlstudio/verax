import { DiagnosisResult, ErrorSignature } from '../types';

const pattern = /cannot find module '([^']+)'/i;

function round(value: number): number {
  return Number(value.toFixed(2));
}

export const cannotFindModuleSignature: ErrorSignature = {
  match: (raw: string) => pattern.test(raw) || /module not found/i.test(raw),
  diagnose: (raw: string): DiagnosisResult => {
    const match = raw.match(pattern);
    const moduleName = match && match[1] ? match[1] : 'module';
    const errorTitle = `Module not found: ${moduleName}`;
    const errorSignature = match && match[0] ? match[0] : 'Module not found';

    const rankedCauses = [
      {
        id: 'dependency-missing',
        title: 'Dependency not installed or listed',
        whyLikely: 'Error explicitly states module cannot be found in resolver',
        confidence: round(0.58),
        quickCheck: `Run npm ls ${moduleName} and check package.json dependencies`
      },
      {
        id: 'wrong-path-reference',
        title: 'Relative import path incorrect or missing extension',
        whyLikely: 'Common when moving files or using index resolution assumptions',
        confidence: round(0.27),
        quickCheck: 'Open import site and verify relative path matches file on disk with correct casing'
      },
      {
        id: 'tsconfig-paths-misconfigured',
        title: 'Path alias not configured in runtime resolver',
        whyLikely: 'Aliases work in TS build but not in Node without loader',
        confidence: round(0.15),
        quickCheck: 'Check tsconfig paths and ensure runtime loader (tsconfig-paths/register) is in use'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Is the missing module a published dependency or a local file?',
        choices: [
          { id: 'published-dep', title: 'Published dependency', meaning: 'Install or align package.json and lockfile' },
          { id: 'local-file', title: 'Local file/module', meaning: 'Fix relative path or path alias resolution' }
        ]
      }
    ];

    const fixPaths = {
      quickFix: {
        steps: [
          `Install dependency: npm install ${moduleName}`,
          'If local file, correct the relative import path including extension when needed'
        ]
      },
      bestFix: {
        steps: [
          'Ensure dependency is listed under dependencies (not only devDependencies) when needed at runtime',
          'Align tsconfig paths with runtime resolver or remove alias if Node cannot resolve it',
          'Add CI check to fail on missing modules (npm ls --all)'
        ]
      },
      verify: {
        steps: [
          'Rerun the command that failed and confirm the module resolves without error',
          'Run npm test or npm start to ensure no other missing modules are reported'
        ]
      }
    };

    return {
      errorTitle,
      errorSignature,
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths,
      safetyNotes: []
    };
  }
};
