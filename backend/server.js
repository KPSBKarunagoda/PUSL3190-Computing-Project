const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/analyze-url', async (req, res) => {
    const { url } = req.body;
    const python = spawn('python', ['analyze_url.py', url]);
    let jsonData = '';
    let debugOutput = '';

    python.stdout.on('data', (data) => {
        jsonData += data.toString();
    });

    python.stderr.on('data', (data) => {
        debugOutput += data.toString();
        console.log('Debug:', data.toString());
    });

    python.on('close', (code) => {
        try {
            if (jsonData.trim()) {
                const result = JSON.parse(jsonData.trim());
                result.debug = debugOutput;
                res.json(result);
            } else {
                res.status(500).json({
                    error: 'Analysis failed',
                    debug: debugOutput
                });
            }
        } catch (e) {
            res.status(500).json({
                error: 'JSON parse error',
                details: e.message,
                debug: debugOutput
            });
        }
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));