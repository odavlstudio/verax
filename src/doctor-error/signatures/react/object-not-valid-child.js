const { round } = require('../helpers');

const objectNotValidChild = {
  match: (raw) => /objects are not valid as a react child/i.test(raw),
  diagnose: () => {
    const rankedCauses = [
      {
        id: 'rendering-object-directly',
        title: 'Object passed directly to JSX output',
        whyLikely: 'Rendering plain object triggers this error',
        confidence: round(0.52),
        quickCheck: 'Search render output for {object} without stringifying or mapping'
      },
      {
        id: 'api-shape-mismatch',
        title: 'API returns object where array or string expected',
        whyLikely: 'Unexpected shape leads to object render attempt',
        confidence: round(0.3),
        quickCheck: 'Log typeof and Array.isArray on data before render'
      },
      {
        id: 'missing-key-map',
        title: 'Map over object instead of array',
        whyLikely: 'Iterating object keys incorrectly can render object values',
        confidence: round(0.18),
        quickCheck: 'Check data transform before map to ensure array of elements'
      }
    ];

    return {
      errorTitle: 'React: Objects are not valid as a child',
      errorSignature: 'Objects are not valid as a React child',
      confidence: rankedCauses[0].confidence,
      rankedCauses,
      fixPaths: {
        quickFix: {
          steps: [
            'Convert object to string (JSON.stringify) or pick a display field before rendering',
            'Ensure render paths use arrays of elements or strings, not raw objects'
          ]
        },
        bestFix: {
          steps: [
            'Normalize API data to expected shapes before storing in state',
            'Map object values to components explicitly (Object.values + map)',
            'Add prop-types or zod schema to validate props passed to components'
          ]
        },
        verify: {
          steps: [
            'Render the component with same data and confirm no React child error',
            'Add test ensuring render output is string/element, not object'
          ]
        }
      },
      safetyNotes: []
    };
  }
};

module.exports = { objectNotValidChild };
