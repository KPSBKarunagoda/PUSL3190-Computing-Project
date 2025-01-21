const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/analyze-url', async (req, res) => {
    const { url } = req.body;
    console.log(`Analyzing URL: ${url}`);
    
    const python = spawn('python', ['analyze_url.py', url]);
    let dataString = '';

    python.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    python.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });

    python.on('close', (code) => {
        try {
            const result = JSON.parse(dataString);
            console.log(`Analysis result:`, result);
            res.json(result);
        } catch (e) {
            console.error('Analysis failed:', e);
            res.status(500).json({ error: 'Analysis failed' });
        }
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});