import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// Root page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Remix-like Minimal Fixture</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        #test-button { padding: 8px 12px; margin: 5px; font-size: 16px; }
        #test-form { margin: 20px 0; }
        input { padding: 8px 12px; margin: 5px; font-size: 16px; }
      </style>
    </head>
    <body>
      <h1>Remix-like Minimal Fixture</h1>
      <button id="test-button">Count: 0</button>
      
      <form id="test-form" method="POST" action="/submit">
        <input type="text" name="message" placeholder="Enter message" />
        <button type="submit">Submit</button>
      </form>
      
      <nav>
        <a href="/">Home</a>
      </nav>
      
      <script>
        let count = 0;
        document.getElementById('test-button').addEventListener('click', () => {
          count++;
          document.getElementById('test-button').textContent = 'Count: ' + count;
        });
      </script>
    </body>
    </html>
  `);
});

// Form submission
app.post('/submit', (req, res) => {
  const message = req.body.message || '';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Submitted</title>
    </head>
    <body>
      <h1>Submitted</h1>
      <p>Message: ${escapeHtml(message)}</p>
      <nav>
        <a href="/">Back</a>
      </nav>
    </body>
    </html>
  `);
});

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


