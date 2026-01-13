import { createSlice, configureStore } from '@reduxjs/toolkit';

// Redux slice with counter
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    }
  }
});

export const { increment, decrement } = counterSlice.actions;

export const store = configureStore({
  reducer: {
    counter: counterSlice.reducer
  }
});

// Expose store globally for VERAX state sensor
if (typeof window !== 'undefined') {
  window.__REDUX_STORE__ = store;
}
