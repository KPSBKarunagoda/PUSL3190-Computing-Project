const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/analyze-url', async (req, res) => {
    const { url, useSafeBrowsing } = req.body;
    const safeBrowsingFlag = String(Boolean(useSafeBrowsing));
    console.log(`Analyzing URL: ${url}, Safe Browsing enabled: ${safeBrowsingFlag}`);
    
    try {
        const python = spawn('python', [
            'analyze_url.py', 
            url, 
            safeBrowsingFlag
        ]);
        
        let jsonData = '';
        let debugOutput = '';

        python.stdout.on('data', (data) => {
            jsonData += data.toString();
            console.log('Python stdout:', data.toString());
        });

        python.stderr.on('data', (data) => {
            debugOutput += data.toString();
            console.log('Python stderr:', data.toString());
        });

        python.on('close', (code) => {
            console.log('Python process exited with code', code);
            try {
                if (jsonData.trim()) {
                    const result = JSON.parse(jsonData.trim());
                    
                    // Ensure consistent response structure
                    const response = {
                        url: url,
                        risk_score: result.risk_score || 0,
                        is_phishing: result.is_phishing || false,
                        risk_explanation: result.risk_explanation || result.message || 'No detailed explanation available',
                        features: result.features || {},
                        ml_confidence: result.ml_confidence || result.ml_result?.confidence || 0,
                        timestamp: new Date().toISOString()
                    };

                    console.log('Sending analysis response:', response);
                    res.json(response);
                } else {
                    res.status(500).json({
                        error: 'Analysis failed',
                        debug: debugOutput
                    });
                }
            } catch (e) {
                console.error('JSON parse error:', e);
                res.status(500).json({
                    error: 'JSON parse error',
                    debug: debugOutput,
                    originalError: e.message
                });
            }
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            error: 'Server error',
            message: error.message
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));