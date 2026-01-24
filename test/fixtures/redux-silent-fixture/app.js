import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, increment } from './store.js';

function App() {
  const dispatch = useDispatch();
  const count = useSelector((state) => state.counter.value);

  const handleSilentIncrement = () => {
    dispatch(increment());
    // BUG: No UI update - count display never re-renders
  };

  const handleIncrementWithFeedback = () => {
    dispatch(increment());
    // UI will update via useSelector
  };

  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Redux State Test'),
    React.createElement(
      'button',
      { id: 'silent-increment', onClick: handleSilentIncrement },
      'Silent Increment (No Feedback)'
    ),
    React.createElement(
      'button',
      { id: 'increment-with-feedback', onClick: handleIncrementWithFeedback },
      'Increment (Shows Count)'
    ),
    React.createElement(
      'div',
      { id: 'count-display', style: { display: 'none' } },
      'Count: ',
      React.createElement('span', { id: 'count-value' }, count)
    ),
    React.createElement(
      'button',
      {
        id: 'show-count',
        onClick: () => {
          const el = document.getElementById('count-display');
          if (el) {
            el.style.display = 'block';
          }
        }
      },
      'Show Count'
    )
  );
}

// Only render if in browser environment
if (typeof document !== 'undefined') {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    React.createElement(Provider, { store }, React.createElement(App, null))
  );
}

// Export for testing
export { App };


