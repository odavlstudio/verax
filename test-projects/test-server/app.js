// App.js - External JavaScript file that the extractor will scan

document.addEventListener('DOMContentLoaded', () => {
  const loadBtn = document.getElementById('loadBtn');
  const message = document.getElementById('message');
  const dataDiv = document.getElementById('data');
  
  // Auto-trigger a network request on page load
  fetch('/api/data')
    .then(response => response.json())
    .then(json => {
      console.log('Data auto-loaded:', json);
    })
    .catch(error => {
      console.error('Error:', error);
    });
  
  loadBtn.addEventListener('click', async () => {
    message.textContent = 'Loading...';
    try {
      const response = await fetch('/api/data');
      const json = await response.json();
      message.textContent = 'Data loaded!';
      dataDiv.innerHTML = '<pre>' + JSON.stringify(json, null, 2) + '</pre>';
    } catch (error) {
      message.textContent = 'Error: ' + error.message;
    }
  });
});
