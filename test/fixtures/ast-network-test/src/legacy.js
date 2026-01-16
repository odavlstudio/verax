
export function legacyRequest(url) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.example.com/legacy');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({ data: 'test' }));
}
