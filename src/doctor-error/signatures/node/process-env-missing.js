const { round } = require('../helpers');

const processEnvMissing = {
  match: (raw) => /process\.env(?:\.|\[)|process is not defined|process\.env is undefined/i.test(raw),
  diagnose: () => {
    const rankedCauses = [
      {
        id: 'missing-env-in-browser',
        title: 'process.env used in browser without define plugin',
        whyLikely: 'process is not defined in browsers unless bundled replacement present',
        confidence: round(0.46),
        quickCheck: 'Check bundler define/webpack DefinePlugin for process.env replacements'
      },
      {
        id: 'env-not-loaded',
        title: '.env not loaded into process.env',
        whyLikely: 'dotenv or config missing before reading env vars',
        confidence: round(0.32),
        quickCheck: 'Log process.env keys after config load to confirm presence'
      },
      {
        id: 'serverless-edge',
        title: 'Edge/runtime environment strips process',
        whyLikely: 'Edge runtimes (workers) do not expose Node process',
        confidence: round(0.22),
        quickCheck: 'Confirm runtime (e.g., Cloudflare Workers) supports process.env'
      }
    ];

    const diagnosticQuestions = [
      {
        question: 'Is the code running in Node or browser/edge?',
        choices: [
          { id: 'node-runtime', title: 'Node runtime', meaning: 'Load env before usage (dotenv/config)' },
          { id: 'browser-edge', title: 'Browser/edge', meaning: 'Use injected env via build-time defines' }
        ]
      }
    ];

    return {
      errorTitle: 'process.env unavailable or missing variable',
      errorSignature: 'process.env is undefined or variable missing',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      diagnosticQuestions,
      fixPaths: {
        quickFix: {
          steps: [
            'Load environment variables early: require("dotenv").config() before access',
            'In browser builds, configure bundler define to replace process.env.VAR with literals'
          ]
        },
        bestFix: {
          steps: [
            'Centralize env loading in app entry and validate required vars with schema',
            'Avoid process.env in client code; inject via build-time replacements or runtime config endpoint',
            'Document required env vars and enforce in CI'
          ]
        },
        verify: {
          steps: [
            'Run app after loading env and confirm variable reads correctly',
            'Deploy or run build to ensure client bundle contains substituted values'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { processEnvMissing };
