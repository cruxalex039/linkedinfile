const express = require('express');
const router = express.Router();

// Store acknowledged tokens in memory (use database in production)
const acknowledgedTokens = new Map();

// Captcha verification endpoint
router.post('/verify', async (req, res) => {
    const { captchaResponse, token } = req.body;

    if (!captchaResponse && !token) {
        return res.status(400).json({ error: 'No CAPTCHA response provided' });
    }

    try {
        // Set session flag for CAPTCHA verification
        req.session.captchaVerified = true;
        
        // Generate and store acknowledged token
        const ackToken = generateAckToken();
        acknowledgedTokens.set(ackToken, {
            timestamp: Date.now(),
            captchaResponse: captchaResponse || token,
            sessionId: req.sessionID,
            ip: req.ip
        });
        
        res.json({ 
            success: true, 
            redirect: '/login.html',
            token: ackToken,
            message: 'CAPTCHA verified successfully'
        });
    } catch (error) {
        console.error('CAPTCHA verification error:', error);
        res.status(500).json({ error: 'CAPTCHA verification failed' });
    }
});

// Get acknowledged token
router.get('/ack-token/:token', (req, res) => {
    const { token } = req.params;
    
    if (!acknowledgedTokens.has(token)) {
        return res.status(404).json({ 
            error: 'Token not found or expired',
            valid: false
        });
    }
    
    const tokenData = acknowledgedTokens.get(token);
    const age = Date.now() - tokenData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age > maxAge) {
        acknowledgedTokens.delete(token);
        return res.status(410).json({ 
            error: 'Token expired',
            valid: false
        });
    }
    
    res.json({
        valid: true,
        timestamp: tokenData.timestamp,
        age: age,
        sessionId: tokenData.sessionId
    });
});

// Validate acknowledged token
router.post('/validate-token', (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }
    
    if (!acknowledgedTokens.has(token)) {
        return res.json({ valid: false, error: 'Invalid token' });
    }
    
    const tokenData = acknowledgedTokens.get(token);
    const age = Date.now() - tokenData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age > maxAge) {
        acknowledgedTokens.delete(token);
        return res.json({ valid: false, error: 'Token expired' });
    }
    
    res.json({ 
        valid: true,
        age: age,
        expiresIn: maxAge - age
    });
});

// Clear expired tokens periodically
setInterval(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    
    for (const [token, data] of acknowledgedTokens.entries()) {
        if (now - data.timestamp > maxAge) {
            acknowledgedTokens.delete(token);
        }
    }
}, 60 * 60 * 1000); // Clean up every hour

// Generate random acknowledged token
function generateAckToken() {
    return 'ack_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

module.exports = router;
