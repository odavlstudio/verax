// This is an API server, not a web app
const express = require('express');
const app = express();

app.get('/api/data', (req, res) => {
  res.json({ data: 'test' });
});

app.listen(3001);





