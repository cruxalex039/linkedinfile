# CAPTCHA Token Acknowledgment System

## Overview

This system provides a complete backend infrastructure for managing CAPTCHA token acknowledgment, allowing frontend applications to verify CAPTCHA responses and receive acknowledged tokens for subsequent use.

## Architecture

### Backend Structure

```
/routes/captcha.js          - CAPTCHA API endpoints
/server2.js                 - Main server with mounted routes
/utils/RecaptchaUtil.js     - Google reCAPTCHA utilities
/utils/LinkedInRecaptchaUtil.js - LinkedIn-specific reCAPTCHA handling
```

### Frontend Structure (Required - Not Provided)

```
/public/js/captcha.js       - Frontend CAPTCHA handler (to be provided)
/public/js/api.js          - API client utilities (to be provided)
/public/css/challenge.css   - CAPTCHA page styling (to be provided)
```

## Backend API Endpoints

### 1. Verify CAPTCHA and Get Acknowledged Token

**Endpoint:** `POST /api/captcha/verify`

**Request Body:**
```json
{
  "captchaResponse": "hcaptcha_token_here",
  "token": "recaptcha_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "redirect": "/login.html",
  "token": "ack_1731933123456_abc123def456",
  "message": "CAPTCHA verified successfully"
}
```

**Description:**
- Verifies CAPTCHA response
- Generates unique acknowledged token
- Stores token in memory with metadata
- Sets session flag for verification
- Returns token for frontend storage

### 2. Get Token Information

**Endpoint:** `GET /api/captcha/ack-token/:token`

**Response (Valid Token):**
```json
{
  "valid": true,
  "timestamp": 1731933123456,
  "age": 3600000,
  "sessionId": "sess_abc123"
}
```

**Response (Invalid/Expired Token):**
```json
{
  "error": "Token not found or expired",
  "valid": false
}
```

**Description:**
- Retrieves information about an acknowledged token
- Checks token validity and age
- Returns 404 for missing tokens
- Returns 410 for expired tokens

### 3. Validate Acknowledged Token

**Endpoint:** `POST /api/captcha/validate-token`

**Request Body:**
```json
{
  "token": "ack_1731933123456_abc123def456"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "age": 3600000,
  "expiresIn": 82800000
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Invalid token"
}
```

**Description:**
- Validates token existence and expiration
- Returns remaining time before expiration
- Used for checking token before API calls

## Frontend Integration Guide

### Required Frontend Implementation

The frontend needs to provide three files in the `/public` directory:

#### 1. `/public/js/captcha.js`

This file should implement:

```javascript
// CAPTCHA Handler Interface
window.CaptchaHandler = {
    // Initialize CAPTCHA handling
    init: function() { },
    
    // Submit CAPTCHA token for verification
    submitCaptcha: async function(token, captchaType) {
        // Call POST /api/captcha/verify
        // Store returned acknowledged token
        // Return success/failure
    },
    
    // Get stored acknowledged token
    getAcknowledgedToken: function() {
        // Retrieve from localStorage
        // Check expiration
        // Return token or null
    },
    
    // Store acknowledged token
    storeAcknowledgedToken: function(token, metadata) {
        // Store in localStorage with timestamp
        // Format: { token, timestamp, captchaType, metadata }
    },
    
    // Check if valid token exists
    hasValidToken: function() {
        // Check localStorage for non-expired token
        // Return boolean
    },
    
    // Reset CAPTCHA widget
    resetCaptcha: function() {
        // Reset hCaptcha or reCAPTCHA widget
    }
};
```

**Key Features:**
- Support both hCaptcha and Google reCAPTCHA
- Auto-detect CAPTCHA type
- Handle success/error/expiration callbacks
- Store tokens in localStorage
- Validate token age (24 hour expiration)
- Auto-submit capability via URL parameter
- Session management integration

#### 2. `/public/js/api.js` (Optional)

Utility functions for API communication:

```javascript
// API Client utilities
window.APIClient = {
    // Fetch with authenticated token
    fetchWithToken: async function(url, options) {
        const token = CaptchaHandler.getAcknowledgedToken();
        // Add token to headers or body
        // Make fetch request
        // Handle token expiration
    },
    
    // Validate token before API call
    validateToken: async function(token) {
        // Call POST /api/captcha/validate-token
        // Return validation result
    }
};
```

#### 3. `/public/css/challenge.css`

Styling for CAPTCHA challenge pages:

- LinkedIn-style branding
- Responsive design
- Loading spinners
- Success/error states
- Button states (enabled/disabled)
- Message containers

### HTML Integration

The HTML pages already reference these files:

**`/views/index.html`:**
```html
<link href="/challenge.css" rel="stylesheet">
<script src="/captcha.js"></script>
```

**`/views/recaptcha-challenge.html`:**
Includes reCAPTCHA-specific implementation with callback functions.

## Usage Flow

### 1. User Visits Site
```
User → index.html → Load CAPTCHA widget
```

### 2. User Completes CAPTCHA
```
CAPTCHA completion → onCaptchaSuccess(token) → Enable verify button
```

### 3. User Submits Verification
```
Click Verify → submitCaptcha() → POST /api/captcha/verify
→ Receive ack token → Store in localStorage → Redirect to /login.html
```

### 4. Protected Pages Check Token
```
Login page load → Check hasValidToken()
→ If valid: Allow access
→ If invalid: Redirect to CAPTCHA
```

### 5. API Calls Use Token
```
API request → Get ack token → Include in request
Backend → Validate token → Process request
```

## Token Lifecycle

1. **Generation:** Created when CAPTCHA is verified
2. **Storage:** Stored in backend memory and frontend localStorage
3. **Validation:** Checked on each use
4. **Expiration:** 24 hours from creation
5. **Cleanup:** Automatic backend cleanup every hour

## Token Format

Acknowledged tokens follow this format:
```
ack_{timestamp}_{random_string}
```

Example:
```
ack_1731933123456_abc123def456
```

## Security Considerations

1. **Token Uniqueness:** Each token is unique and tied to a session
2. **Expiration:** Tokens expire after 24 hours
3. **Storage:** Backend stores tokens in memory (consider Redis for production)
4. **Validation:** All API endpoints should validate tokens
5. **HTTPS:** Use HTTPS in production to protect tokens
6. **CORS:** Configure CORS appropriately for your domain

## Production Recommendations

1. **Token Storage:**
   - Replace in-memory Map with Redis or database
   - Implement distributed token storage for multi-server deployments

2. **Rate Limiting:**
   - Add rate limiting to verification endpoints
   - Prevent CAPTCHA farming

3. **Monitoring:**
   - Log token generation and validation
   - Monitor for suspicious patterns
   - Track token usage metrics

4. **Configuration:**
   - Set appropriate CAPTCHA site keys
   - Configure secret keys securely
   - Use environment-specific settings

## Testing

### Test CAPTCHA Flow

1. Start server: `npm start`
2. Navigate to: `http://localhost:3000`
3. Complete CAPTCHA
4. Verify token storage in browser console:
   ```javascript
   localStorage.getItem('captcha_ack_token')
   ```
5. Test token validation:
   ```bash
   curl -X POST http://localhost:3000/api/captcha/validate-token \
     -H "Content-Type: application/json" \
     -d '{"token":"ack_1731933123456_abc123def456"}'
   ```

## Troubleshooting

### CAPTCHA Not Loading
- Check site key configuration in `/api/recaptcha-env`
- Verify CAPTCHA script is loading (check network tab)
- Check for JavaScript errors in console

### Token Not Stored
- Verify localStorage is enabled
- Check browser console for errors
- Verify `/api/captcha/verify` returns token

### Token Validation Fails
- Check token hasn't expired (24 hour limit)
- Verify token format is correct
- Check backend logs for errors

### Redirect Issues
- Ensure session middleware is configured
- Check `captchaVerified` session flag
- Verify redirect URLs are correct

## Additional Resources

- [hCaptcha Documentation](https://docs.hcaptcha.com/)
- [Google reCAPTCHA Documentation](https://developers.google.com/recaptcha)
- [Express Session Documentation](https://github.com/expressjs/session)

## Support

For issues related to:
- **Backend API:** Check server logs and `/api/debug/sessions`
- **Frontend Integration:** Ensure frontend files implement required interface
- **CAPTCHA Configuration:** Review environment variables and site keys
