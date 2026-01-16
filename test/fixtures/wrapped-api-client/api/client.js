// Wrapped API client - common pattern in real apps
const apiClient = {
  post: (url, data) => {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
};

export function submitData() {
  return apiClient.post('/api/submit', { action: 'submit' });
}

