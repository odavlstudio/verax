import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <div>
        <h1>React App - BROKEN</h1>
        <nav>
          <Link to="/broken-page" id="broken-link">Go to Broken (BROKEN - route missing)</Link>
          <button onClick={() => { fetch('/api/missing-endpoint').catch(e => console.log('error')) }} id="broken-button">
            Fetch (BROKEN - endpoint missing)
          </button>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function Home() {
  return <h2>Home</h2>;
}

ReactDOM.render(<App />, document.getElementById('root'));






