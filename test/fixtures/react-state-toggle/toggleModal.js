// toggleModal.js — React setter pattern
// This module contains a handler that calls setOpen (useState setter pattern)

export function toggleModal() {
  const modal = document.getElementById('modal');
  if (modal.hasAttribute('open')) {
    modal.removeAttribute('open');
  } else {
    modal.setAttribute('open', '');
  }
}

// noOp handler — early return, no state mutation
export function noOp() {
  return; // Early return - state never changes
}


