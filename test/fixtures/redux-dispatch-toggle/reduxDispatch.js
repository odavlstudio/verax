// reduxDispatch.js — Redux dispatch pattern
// Contains handlers that call dispatch()

// Global mock store for testing
export const mockStore = {
  state: { panelOpen: false },
  dispatch: function(action) {
    if (action.type === 'TOGGLE_PANEL') {
      this.state.panelOpen = !this.state.panelOpen;
    }
  }
};

// Handler that dispatches with valid reducer
export function handleDispatchGood() {
  mockStore.dispatch({ type: 'TOGGLE_PANEL' });
}

// Handler that dispatches but reducer doesn't exist
export function handleDispatchBad() {
  mockStore.dispatch({ type: 'UNKNOWN' });
}


