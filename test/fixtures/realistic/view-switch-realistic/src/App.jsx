import React, { useState } from 'react';
import ViewSwitchSuccess from './components/ViewSwitchSuccess.jsx';
import ViewSwitchFailure from './components/ViewSwitchFailure.jsx';
import ViewSwitchMinorChange from './components/ViewSwitchMinorChange.jsx';
import ViewSwitchAmbiguous from './components/ViewSwitchAmbiguous.jsx';
import ViewSwitchBlocked from './components/ViewSwitchBlocked.jsx';
import ViewSwitchAnalyticsOnly from './components/ViewSwitchAnalyticsOnly.jsx';

function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>View Switch Test Cases</h1>
      
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>1. CONFIRMED SUCCESS</h2>
        <p>Clicking triggers setView('settings') with DOM signature change + landmark change</p>
        <ViewSwitchSuccess />
      </section>
      
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>2. CONFIRMED FAILURE</h2>
        <p>Promise exists but no meaningful UI change (0-1 signals only)</p>
        <ViewSwitchFailure />
      </section>
      
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>3. FALSE POSITIVE TRAP (Minor Change)</h2>
        <p>Button text toggles but no real view switch</p>
        <ViewSwitchMinorChange />
      </section>
      
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>4. AMBIGUOUS CASE (One Signal)</h2>
        <p>DOM signature changes but no landmark/focus/aria-live</p>
        <ViewSwitchAmbiguous />
      </section>
      
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>5. BLOCKED INTERACTION</h2>
        <p>Disabled button - should be INFORMATIONAL</p>
        <ViewSwitchBlocked />
      </section>
      
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>6. ANALYTICS ONLY</h2>
        <p>Only analytics fired, no UI change</p>
        <ViewSwitchAnalyticsOnly />
      </section>
    </div>
  );
}

export default App;

