// zustandStore.js — Zustand store.set() pattern

// Mock Zustand store
export const store = {
  state: { isOn: false },
  set: function(updates) {
    this.state = { ...this.state, ...updates };
  }
};

// Handler that calls store.set() — GOOD case
export function handleSetGood() {
  store.set({ isOn: !store.state.isOn });
}

// Handler that does NOT call store.set() — BAD case
export function handleSetBad() {
  // Intentionally missing store.set() call
  return;
}

