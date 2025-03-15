router.post('/analyze-url', async (req, res) => {
    try {
        const { url } = req.body;
        
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
                message: 'URL is whitelisted',
                features: {
                    whitelist_status: 'Approved'
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