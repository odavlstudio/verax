import React, { useState } from 'react';

// FALSE POSITIVE TRAP: Minor change only (button text toggles)
export default function ViewSwitchMinorChange() {
  const [buttonText, setButtonText] = useState('Click Me');
  
  const handleClick = () => {
    // Not a view switch - just button text change
    setButtonText(buttonText === 'Click Me' ? 'Clicked!' : 'Click Me');
  };
  
  return (
    <div>
      <button onClick={handleClick} id="minor-change-button">
        {buttonText}
      </button>
      <p>This only changes button text, not a real view switch</p>
    </div>
  );
}

