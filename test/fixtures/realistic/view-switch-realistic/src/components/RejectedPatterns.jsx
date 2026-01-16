import React, { useState } from 'react';

// Test cases for truth boundary - these should NOT be detected
export default function RejectedPatterns() {
  const [obj] = useState({ prop: 'settings' });
  
  const handleRejected1 = () => {
    // REJECTED: Function call - setView(getNext())
    // setView(getNext()); // Not in fixture, but test will check AST
  };
  
  const handleRejected2 = () => {
    // REJECTED: Member expression - setView(obj.prop)
    // setView(obj.prop); // Not in fixture, but test will check AST
  };
  
  const handleRejected3 = () => {
    // REJECTED: Template literal with interpolation - setView(`settings-${x}`)
    const x = 'test';
    // setView(`settings-${x}`); // Not in fixture, but test will check AST
  };
  
  return (
    <div>
      <p>These patterns should be rejected by truth boundary rules</p>
    </div>
  );
}

