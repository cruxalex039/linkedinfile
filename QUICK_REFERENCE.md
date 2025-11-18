# Quick Reference: CAPTCHA Token System

## API Endpoints

### Verify CAPTCHA and Get Token
```bash
curl -X POST http://localhost:3000/api/captcha/verify \
  -H "Content-Type: application/json" \
  -d '{"captchaResponse":"your_captcha_token"}'
```
Returns: `{"success":true, "token":"ack_...", "redirect":"/login.html"}`

### Validate Token
```bash
curl -X POST http://localhost:3000/api/captcha/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"ack_1234567890_abc123"}'
```
Returns: `{"valid":true, "age":123, "expiresIn":86399877}`

### Get Token Info
```bash
curl http://localhost:3000/api/captcha/ack-token/ack_1234567890_abc123
```
Returns: `{"valid":true, "timestamp":1234567890, "age":123, "sessionId":"..."}`

## Frontend Integration

### JavaScript Interface (captcha.js)
```javascript
// Check if user has valid token
if (CaptchaHandler.hasValidToken()) {
  // Allow access
} else {
  // Redirect to CAPTCHA
}

// Get stored token
const token = CaptchaHandler.getAcknowledgedToken();

// Validate token with backend
const response = await fetch('/api/captcha/validate-token', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({token: token.token})
});
```

### Token Storage Format
```javascript
localStorage.setItem('captcha_ack_token', JSON.stringify({
  token: 'ack_1234567890_abc123',
  timestamp: Date.now(),
  sessionId: 'sess_abc123',
  captchaType: 'hcaptcha',
  metadata: {}
}));
```

## Token Format
```
ack_{timestamp}_{random_string}
Example: ack_1763467205230_hn4sgvgtljq
```

## Token Lifecycle
1. Generated: When CAPTCHA is verified
2. Valid for: 24 hours
3. Cleanup: Automatic hourly cleanup of expired tokens

## File Locations
- Backend API: `/routes/captcha.js`
- Frontend JS: `/public/js/captcha.js` (to be provided)
- Frontend CSS: `/public/css/challenge.css` (to be provided)
- Documentation: `/CAPTCHA_INTEGRATION.md`
- Summary: `/IMPLEMENTATION_SUMMARY.md`

## Quick Start

1. **Start Server:**
   ```bash
   npm start
   ```

2. **Test API:**
   ```bash
   curl -X POST http://localhost:3000/api/captcha/verify \
     -H "Content-Type: application/json" \
     -d '{"captchaResponse":"test"}'
   ```

3. **Use Token:**
   - Store the returned token
   - Include in subsequent API calls
   - Validate before important operations

## Common Issues

### Token Invalid
- Check token hasn't expired (24 hours)
- Verify token format is correct
- Ensure token exists in backend

### CAPTCHA Not Loading
- Check site key configuration
- Verify CAPTCHA script is loaded
- Check browser console for errors

## Security Notes
- Tokens expire after 24 hours
- Each token is tied to a session
- IP address is logged for security
- Use HTTPS in production

## Documentation
For complete details, see:
- `/CAPTCHA_INTEGRATION.md` - Full API documentation
- `/IMPLEMENTATION_SUMMARY.md` - Implementation details
- `/public/README.md` - Frontend file specifications
