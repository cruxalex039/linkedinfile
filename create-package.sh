#!/bin/bash

# CAPTCHA System Package Creator
# This script creates a downloadable archive of the CAPTCHA token system

set -e

PACKAGE_NAME="captcha-system-package"
PACKAGE_VERSION="1.0.0"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="${PACKAGE_NAME}_${TIMESTAMP}.tar.gz"

echo "=========================================="
echo "CAPTCHA System Package Creator"
echo "Version: ${PACKAGE_VERSION}"
echo "=========================================="
echo ""

# Create temporary package directory
TEMP_DIR="/tmp/${PACKAGE_NAME}"
rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"

echo "Creating package structure..."

# Create directory structure
mkdir -p "${TEMP_DIR}/public/js"
mkdir -p "${TEMP_DIR}/public/css"
mkdir -p "${TEMP_DIR}/public/images"
mkdir -p "${TEMP_DIR}/routes"
mkdir -p "${TEMP_DIR}/views"
mkdir -p "${TEMP_DIR}/docs"

# Copy frontend files
echo "Copying frontend files..."
cp public/js/captcha.js "${TEMP_DIR}/public/js/" 2>/dev/null || echo "Warning: captcha.js not found"
cp public/css/challenge.css "${TEMP_DIR}/public/css/" 2>/dev/null || echo "Warning: challenge.css not found"
cp public/README.md "${TEMP_DIR}/public/" 2>/dev/null || echo "Warning: public/README.md not found"

# Copy backend routes
echo "Copying backend routes..."
cp routes/captcha.js "${TEMP_DIR}/routes/" 2>/dev/null || echo "Warning: routes/captcha.js not found"

# Copy relevant views
echo "Copying view files..."
cp views/index.html "${TEMP_DIR}/views/" 2>/dev/null || echo "Warning: index.html not found"
cp views/recaptcha-challenge.html "${TEMP_DIR}/views/" 2>/dev/null || echo "Warning: recaptcha-challenge.html not found"

# Copy documentation
echo "Copying documentation..."
cp CAPTCHA_INTEGRATION.md "${TEMP_DIR}/docs/" 2>/dev/null || echo "Warning: CAPTCHA_INTEGRATION.md not found"
cp IMPLEMENTATION_SUMMARY.md "${TEMP_DIR}/docs/" 2>/dev/null || echo "Warning: IMPLEMENTATION_SUMMARY.md not found"
cp QUICK_REFERENCE.md "${TEMP_DIR}/docs/" 2>/dev/null || echo "Warning: QUICK_REFERENCE.md not found"
cp SECURITY_SUMMARY.md "${TEMP_DIR}/docs/" 2>/dev/null || echo "Warning: SECURITY_SUMMARY.md not found"

# Create package README
cat > "${TEMP_DIR}/README.md" << 'EOF'
# CAPTCHA Token System Package

## Overview
Complete CAPTCHA token acknowledgment system with frontend widget integration and backend API.

## Package Contents

```
captcha-system-package/
├── README.md                    # This file
├── INSTALLATION.md              # Installation guide
├── public/                      # Frontend assets
│   ├── js/
│   │   └── captcha.js          # CAPTCHA widget handler (17KB)
│   ├── css/
│   │   └── challenge.css       # LinkedIn-style responsive design (8KB)
│   └── README.md               # Frontend documentation
├── routes/
│   └── captcha.js              # Backend API routes
├── views/
│   ├── index.html              # Main CAPTCHA page
│   └── recaptcha-challenge.html # reCAPTCHA challenge page
└── docs/
    ├── CAPTCHA_INTEGRATION.md   # Complete API documentation
    ├── IMPLEMENTATION_SUMMARY.md # Implementation details
    ├── QUICK_REFERENCE.md       # Quick start guide
    └── SECURITY_SUMMARY.md      # Security validation

```

## Quick Start

1. **Extract the package:**
   ```bash
   tar -xzf captcha-system-package_*.tar.gz
   cd captcha-system-package
   ```

2. **Review installation guide:**
   ```bash
   cat INSTALLATION.md
   ```

3. **Copy files to your project:**
   ```bash
   # Frontend files
   cp -r public/* /path/to/your/project/public/
   
   # Backend routes
   cp routes/captcha.js /path/to/your/project/routes/
   
   # Views
   cp views/* /path/to/your/project/views/
   ```

4. **Mount routes in your Express app:**
   ```javascript
   const captchaRoutes = require('./routes/captcha');
   app.use('/api/captcha', captchaRoutes);
   ```

5. **Start using:**
   - Visit `/` to see the CAPTCHA widget
   - Complete CAPTCHA to get acknowledged token
   - Token stored in localStorage for 24 hours

## Features

### Frontend (`/public/`)
- ✅ hCaptcha and Google reCAPTCHA support
- ✅ Auto-detection of widget type
- ✅ Backend API integration
- ✅ localStorage token management (24hr expiration)
- ✅ Auto-validation on page load
- ✅ Error handling and retry logic
- ✅ Mobile-responsive design
- ✅ LinkedIn-style professional UI

### Backend (`/routes/captcha.js`)
- ✅ `POST /api/captcha/verify` - Verify CAPTCHA and generate token
- ✅ `GET /api/captcha/ack-token/:token` - Get token metadata
- ✅ `POST /api/captcha/validate-token` - Validate token
- ✅ 24-hour automatic expiration
- ✅ Automatic cleanup of expired tokens
- ✅ Session integration

## Token Flow

1. User completes CAPTCHA widget
2. Frontend calls `POST /api/captcha/verify`
3. Backend generates acknowledged token
4. Frontend stores token in localStorage
5. Protected pages validate token before access
6. Token valid for 24 hours

## API Example

```javascript
// Verify CAPTCHA and get token
POST /api/captcha/verify
Body: { "captchaResponse": "hcaptcha_token" }
Response: {
  "success": true,
  "token": "ack_1763467205230_hn4sgvgtljq",
  "redirect": "/login.html"
}

// Validate token
POST /api/captcha/validate-token
Body: { "token": "ack_1763467205230_hn4sgvgtljq" }
Response: { "valid": true, "expiresIn": 86399991 }
```

## Requirements

- Node.js 18+
- Express.js 4.x
- express-session middleware

## Documentation

Complete documentation available in `/docs/`:
- **CAPTCHA_INTEGRATION.md** - Complete API specifications
- **QUICK_REFERENCE.md** - Quick start and examples
- **SECURITY_SUMMARY.md** - Security best practices
- **IMPLEMENTATION_SUMMARY.md** - Technical details

## Security

- ✅ XSS Prevention
- ✅ Input Validation
- ✅ Token Expiration (24hr)
- ✅ Session Binding
- ✅ IP Logging
- ✅ CodeQL Verified (0 vulnerabilities)

## Support

For issues or questions, refer to the documentation in `/docs/` directory.

## License

ISC License - See main project for details.

---

**Version:** 1.0.0
**Package Date:** $(date +%Y-%m-%d)
EOF

# Create installation guide
cat > "${TEMP_DIR}/INSTALLATION.md" << 'EOF'
# CAPTCHA System Installation Guide

## Prerequisites

- Node.js 18 or higher
- Express.js 4.x application
- express-session middleware installed

## Installation Steps

### 1. Extract Package

```bash
tar -xzf captcha-system-package_*.tar.gz
cd captcha-system-package
```

### 2. Install Dependencies (if not already installed)

```bash
npm install express express-session
```

### 3. Copy Files to Your Project

#### Frontend Assets
```bash
# Copy to your project's public directory
cp -r public/js /path/to/your/project/public/
cp -r public/css /path/to/your/project/public/
```

#### Backend Routes
```bash
# Copy to your project's routes directory
cp routes/captcha.js /path/to/your/project/routes/
```

#### Views (Optional)
```bash
# Copy HTML templates
cp views/index.html /path/to/your/project/views/
cp views/recaptcha-challenge.html /path/to/your/project/views/
```

### 4. Configure Your Express Application

Add to your main server file (e.g., `server.js` or `app.js`):

```javascript
const express = require('express');
const session = require('express-session');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Session middleware (required)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Mount CAPTCHA routes
const captchaRoutes = require('./routes/captcha');
app.use('/api/captcha', captchaRoutes);

// Serve main page with CAPTCHA
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 5. Configure HTML Pages

Ensure your HTML files reference the correct paths:

```html
<!-- In your HTML head -->
<link href="/css/challenge.css" rel="stylesheet">
<script src="https://js.hcaptcha.com/1/api.js" async defer></script>
<script src="/js/captcha.js"></script>
```

### 6. Update hCaptcha/reCAPTCHA Site Key

Edit `views/index.html` and set your CAPTCHA site key:

```html
<!-- For hCaptcha -->
<div class="h-captcha" 
     data-sitekey="YOUR_HCAPTCHA_SITE_KEY"
     data-callback="onCaptchaSuccess"></div>

<!-- For reCAPTCHA -->
<div class="g-recaptcha" 
     data-sitekey="YOUR_RECAPTCHA_SITE_KEY"
     data-callback="onRecaptchaSuccess"></div>
```

### 7. Test Installation

```bash
# Start your server
node server.js

# Visit in browser
open http://localhost:3000
```

You should see the CAPTCHA widget. Complete it to test the full flow.

## Verification

Test the following:

1. ✅ Page loads with CAPTCHA widget
2. ✅ Complete CAPTCHA successfully
3. ✅ Check browser console for "[CAPTCHA] Token stored"
4. ✅ Check localStorage for token: `localStorage.getItem('captcha_ack_token')`
5. ✅ Verify auto-redirect after success

## API Testing

Test the API endpoints:

```bash
# Test token generation
curl -X POST http://localhost:3000/api/captcha/verify \
  -H "Content-Type: application/json" \
  -d '{"captchaResponse":"test_token"}'

# Test token validation
curl -X POST http://localhost:3000/api/captcha/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"ack_1234567890_abc123"}'
```

## Environment Variables

Recommended environment variables:

```bash
# .env file
NODE_ENV=production
SESSION_SECRET=your-random-secret-key-here
PORT=3000
```

## Protected Routes Example

Add CAPTCHA verification to protected routes:

```javascript
// Middleware to check CAPTCHA
const requireCaptcha = (req, res, next) => {
  if (!req.session.captchaVerified) {
    return res.redirect('/');
  }
  next();
};

// Protected route
app.get('/login.html', requireCaptcha, (req, res) => {
  res.sendFile(__dirname + '/views/login.html');
});
```

## Troubleshooting

### CAPTCHA Widget Not Loading
- Check console for JavaScript errors
- Verify site key is correct
- Ensure CAPTCHA script is loading (check network tab)

### Token Not Storing
- Check browser localStorage is enabled
- Verify `/api/captcha/verify` returns token
- Check browser console for errors

### API Endpoints Not Working
- Verify routes are mounted: `app.use('/api/captcha', captchaRoutes)`
- Check express.json() middleware is configured
- Verify session middleware is configured

## Production Deployment

For production:

1. **Use HTTPS** - CAPTCHA requires secure connection
2. **Set secure cookies** - `cookie: { secure: true }`
3. **Add rate limiting** - Prevent abuse
4. **Use Redis** - For multi-server token storage
5. **Enable logging** - Monitor token usage

## Next Steps

1. Read `docs/CAPTCHA_INTEGRATION.md` for complete API documentation
2. Review `docs/SECURITY_SUMMARY.md` for security best practices
3. Check `docs/QUICK_REFERENCE.md` for common usage patterns

## Support

For issues:
1. Check documentation in `/docs/` directory
2. Review troubleshooting section above
3. Verify all prerequisites are met

---

**Need Help?** Refer to the comprehensive documentation in the `/docs/` directory.
EOF

echo "Creating archive..."
cd /tmp
tar -czf "${ARCHIVE_NAME}" "${PACKAGE_NAME}"

# Move to current directory
CURRENT_DIR=$(pwd)
mv "/tmp/${ARCHIVE_NAME}" "./CAPTCHA_SYSTEM_PACKAGE.tar.gz"

echo ""
echo "=========================================="
echo "Package created successfully!"
echo "=========================================="
echo ""
echo "Archive: CAPTCHA_SYSTEM_PACKAGE.tar.gz"
echo "Location: $(pwd)/CAPTCHA_SYSTEM_PACKAGE.tar.gz"
echo "Size: $(du -h CAPTCHA_SYSTEM_PACKAGE.tar.gz | cut -f1)"
echo ""
echo "To extract:"
echo "  tar -xzf CAPTCHA_SYSTEM_PACKAGE.tar.gz"
echo ""
echo "Contents:"
tar -tzf CAPTCHA_SYSTEM_PACKAGE.tar.gz | head -20
echo "  ... (see full contents after extraction)"
echo ""
echo "=========================================="

# Cleanup
rm -rf "${TEMP_DIR}"

exit 0
