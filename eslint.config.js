// ESLint v9 flat config for odavlguardian
// Migrated from .eslintrc.json on 2026-01-02

const globals = require('globals');

module.exports = [
  {
    // Global ignores (applies to all configs)
    ignores: [
      '**/node_modules/**',
      '**/artifacts/**',
      '**/.odavl-guardian/**',
      '**/logs/**',
      '**/reports/**',
      '**/extension/**',
      '**/website/**',
      '**/*.log',
      'test/phase5-evidence.test.js',
      '.tmp*/**',
      '.odavlguardian/**'
    ]
  },
  {
    // Main config for bin/ and src/
    files: ['bin/**/*.js', 'src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2022,
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'always'],
      'consistent-return': 'error',
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'curly': ['error', 'multi-line']
    }
  },
  {
    // Specific config for bin/guardian.js
    files: ['bin/guardian.js'],
    rules: {
      'no-unused-vars': [
        'error',
        {
          args: 'none',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^(get|is|check|print|set|log|record|validate|run|list|cleanup|generate|export|import|add|remove|compute|resolve|require|map)'
        }
      ]
    }
  },
  {
    // Test files configuration
    files: ['test/**/*', 'tests/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'off',
      'curly': 'off',
      'consistent-return': 'off'
    }
  },
  {
    // Relaxed rules for docs, examples, scripts
    files: ['docs/**/*', 'examples/**/*', 'scripts/**/*'],
    rules: {
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'consistent-return': 'warn'
    }
  }
];
