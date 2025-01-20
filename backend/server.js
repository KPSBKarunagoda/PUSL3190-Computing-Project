const express = require('express');
const cors = require('cors'); 
const { getRiskScore } = require('./scoring'); 
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/check-url', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const { riskScore, explanation } = await getRiskScore(url);
    res.json({ url, riskScore, explanation });
  } catch (error) {
    console.error('Error checking URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Phishing detector backend running at http://localhost:${port}`);
});