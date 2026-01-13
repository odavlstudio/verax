export function submit() {
  return callSubmit();
}

function callSubmit() {
  return fetch('/api/submit');
}
