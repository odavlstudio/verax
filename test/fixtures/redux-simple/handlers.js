// This file contains Redux dispatch calls for AST extraction
// Standalone handlers that reference global store and actions

export function handleIncrementClick() {
  // This dispatch call should be detected by AST extraction
  dispatch(increment());
}

export function handleDecrementClick() {
  dispatch(decrement());
}
