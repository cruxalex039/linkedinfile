const express = require('express');
const router = express.Router();

// Captcha verification endpoint
router.post('/verify', async (req, res) => {
    const { captchaResponse } = req.body;

    if (!captchaResponse) {
        return res.status(400).json({ error: 'No CAPTCHA response provided' });
    }

    try {
        // Set session flag for CAPTCHA verification
        req.session.captchaVerified = true;
        res.json({ success: true, redirect: '/login.html' });
    } catch (error) {
        console.error('CAPTCHA verification error:', error);
        res.status(500).json({ error: 'CAPTCHA verification failed' });
    }
});

module.exports = router;
