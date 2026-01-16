'use client';

import { useState } from 'react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  // PARTIAL/AMBIGUOUS CASE: Search results (confidence < 1)
  // Search may or may not return results (depends on query)
  const handleSearch = (e) => {
    e.preventDefault();
    setSearched(true);
    
    // Ambiguous case: search may or may not work
    // Some queries return results, others don't (but no clear indication)
    if (query.toLowerCase().includes('test') || query.toLowerCase().includes('example')) {
      // Sometimes works
      setResults([
        { id: 1, title: 'Test Result 1', snippet: 'This is a test result...' },
        { id: 2, title: 'Test Result 2', snippet: 'Another test result...' },
      ]);
    } else {
      // Sometimes fails silently - no error message, no feedback
      // This creates ambiguity - did it work or not?
      // Should be reported with MEDIUM confidence
      setResults([]);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Search</h1>
      
      <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            width: '70%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginRight: '1rem'
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Search
        </button>
      </form>
      
      {searched && (
        <div>
          {results.length > 0 ? (
            <div>
              <h2>Results</h2>
              {results.map(result => (
                <div key={result.id} style={{
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#f8f9fa',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}>
                  <h3>{result.title}</h3>
                  <p>{result.snippet}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>No results found. Try searching for "test" or "example".</p>
          )}
        </div>
      )}
      
      {/* INTENTIONAL: Ambiguous behavior - no clear indication if search worked */}
    </div>
  );
}

