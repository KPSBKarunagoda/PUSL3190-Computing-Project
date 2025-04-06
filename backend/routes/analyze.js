router.post('/analyze-url', async (req, res) => {
    try {
        const { url } = req.body;
        
        // Input validation
        if (!url) {
            return res.status(400).json({
                error: 'Missing URL parameter',
                message: 'Please provide a URL to analyze'
            });
        }
        
        // URL validation
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({
                error: 'Invalid URL format',
                message: 'The provided URL is not valid'
            });
        }
        
        // Check whitelist first
        const [whitelisted] = await db.execute(
            'SELECT * FROM Whitelist WHERE URL = ? OR Domain = ?',
            [url, new URL(url).hostname]
        );

        if (whitelisted.length > 0) {
            return res.json({
                url: url,
                risk_score: 0,
                is_phishing: false,
                ml_confidence: 100,
                message: 'URL is whitelisted and considered safe',
                features: {
                    whitelist_status: 'Approved',
                    whitelist_entry: whitelisted[0]
                }
            });
        }

        // If not whitelisted, continue with your existing analysis
        // ...existing analysis code...

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ 
            error: 'Analysis failed',
            message: error.message 
        });
    }
});