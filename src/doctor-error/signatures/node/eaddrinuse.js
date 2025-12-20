const { round } = require('../helpers');

const eaddrinuse = {
  match: (raw) => /EADDRINUSE|address already in use/i.test(raw),
  diagnose: () => {
    const rankedCauses = [
      {
        id: 'port-in-use-existing-process',
        title: 'Port already used by running process',
        whyLikely: 'EADDRINUSE commonly means another server bound the port',
        confidence: round(0.64),
        quickCheck: 'Run netstat or lsof to identify process on the port'
      },
      {
        id: 'stale-dev-server',
        title: 'Previous dev server instance not stopped',
        whyLikely: 'Hot reload left process running on same port',
        confidence: round(0.22),
        quickCheck: 'List node processes and kill stale dev server'
      },
      {
        id: 'fast-restart-race',
        title: 'Port not released yet after crash',
        whyLikely: 'OS keeps TIME_WAIT causing immediate rebind failure',
        confidence: round(0.14),
        quickCheck: 'Wait few seconds or use different port to confirm'
      }
    ];

    return {
      errorTitle: 'EADDRINUSE: Port already in use',
      errorSignature: 'EADDRINUSE: address already in use',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      fixPaths: {
        quickFix: {
          steps: [
            'Kill process using the port (netstat/lsof to find PID, then terminate)',
            'Retry server on an open port via PORT env var'
          ]
        },
        bestFix: {
          steps: [
            'Configure dev server to auto-pick free port or fail fast with clear message',
            'Ensure graceful shutdown handlers close server on exit signals',
            'Document default port and allow override via env'
          ]
        },
        verify: {
          steps: [
            'Start server and confirm it binds without EADDRINUSE',
            'Hit health endpoint to ensure server responds on chosen port'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { eaddrinuse };
