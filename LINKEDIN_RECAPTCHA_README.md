# LinkedIn reCAPTCHA Integration

This implementation adds Google reCAPTCHA v2 widget integration specifically designed to work with LinkedIn's site key and automation flow.

## Features

- **Original Google reCAPTCHA Widget**: Uses the standard Google reCAPTCHA v2 widget
- **LinkedIn Site Key Integration**: Pre-configured with LinkedIn's actual reCAPTCHA site key
- **Automatic Detection**: Detects LinkedIn reCAPTCHA challenges across frames
- **Session Management**: Links reCAPTCHA verification to LinkedIn automation sessions
- **Debug Artifacts**: Saves screenshots and HTML for troubleshooting
- **Responsive Design**: Mobile-friendly reCAPTCHA challenge page with LinkedIn styling

## Files Modified/Added

### Core Files
- `views/recaptcha-challenge.html` - Updated with LinkedIn-styled reCAPTCHA challenge page
- `server2.js` - Enhanced with LinkedIn reCAPTCHA integration
- `utils/LinkedInRecaptchaUtil.js` - New utility class for LinkedIn reCAPTCHA handling
- `.env` - Added reCAPTCHA configuration variables

### Test Files
- `views/test-recaptcha.html` - Test page for reCAPTCHA integration

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# reCAPTCHA Configuration (LinkedIn Integration)
# For development/testing - Google's test keys (always pass)
LINKEDIN_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
LINKEDIN_RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe

# Fallback reCAPTCHA keys (same test keys)
RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

**For Development**: The configuration above uses Google's official test keys that work for localhost and always pass validation.

**For Production**: You need to:
1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/)
2. Create a new site with your domain
3. Replace the test keys with your production keys
4. Set `NODE_ENV=production` in your environment

## How It Works

### 1. reCAPTCHA Detection
When LinkedIn presents a reCAPTCHA challenge, the system:
- Detects reCAPTCHA widgets across all page frames
- Extracts LinkedIn's site key automatically
- Saves debug artifacts (screenshots, HTML)
- Marks the session as requiring reCAPTCHA

### 2. Challenge Presentation
The reCAPTCHA challenge page (`/recaptcha-challenge`):
- Uses LinkedIn's actual site key or environment-configured key
- Provides a LinkedIn-styled interface
- Includes proper callback handling
- Supports both manual and automated solving

### 3. Verification Process
When a user completes the reCAPTCHA:
- Token is verified with Google's API
- Session is marked as verified
- LinkedIn automation resumes automatically
- SSE events notify connected clients

## Usage

### For Automation
When your LinkedIn automation encounters a reCAPTCHA:

1. The system returns `'recaptcha'` status
2. Open `/recaptcha-challenge?sessionId={sessionId}` in a browser
3. Complete the reCAPTCHA verification
4. The system automatically resumes LinkedIn automation

### Manual Testing
Visit `/test-recaptcha` to access the test interface:
- Test the reCAPTCHA challenge page
- Check session information
- Verify token validation
- Check environment configuration

## API Endpoints

### reCAPTCHA Challenge
```
GET /recaptcha-challenge?sessionId={sessionId}
```
Serves the LinkedIn-styled reCAPTCHA challenge page.

### Token Verification
```
POST /verify-recaptcha
Content-Type: application/json

{
  "token": "recaptcha_response_token",
  "sessionId": "session_id",
  "source": "linkedin-integration"
}
```

### Session Information
```
GET /api/recaptcha-info/{sessionId}
```
Returns detailed information about a session's reCAPTCHA status.

### Test Interface
```
GET /test-recaptcha
```
Access the reCAPTCHA integration test page.

## LinkedIn Site Keys

The system includes LinkedIn's known reCAPTCHA site keys:
- Primary: `6LcgI2cUAAAAAGjW0-O0ED_nmdJkUR7mhqz0zoEO`
- Alternative: `6LfC6HAUAAAAAGokKQmEfbOHFMsWW3Xfg7wEL2V3`

## Integration with LinkedIn Automation

### Check Login Status Enhancement
The `/api/linkedin/check-login-status` endpoint now returns:
- `'recaptcha'` when reCAPTCHA is detected
- Session is automatically marked for reCAPTCHA requirement
- SSE events notify about reCAPTCHA requirements

### Automatic Resume
After successful reCAPTCHA verification:
- Session flag `recaptchaPassed` is set to `true`
- LinkedIn automation attempts to resume automatically
- Debug artifacts are saved for troubleshooting

## Debugging

### Debug Artifacts
The system saves debug information in `/debug/`:
- Screenshots: `{sessionId}-recaptcha-{timestamp}.png`
- HTML: `{sessionId}-recaptcha-{timestamp}.html`
- Resume attempts: `{sessionId}-resume-{attempt}-{timestamp}.*`

### Debug Endpoints
- `GET /debug/list?sessionId={sessionId}` - List debug files
- `GET /debug/download?file={filename}` - Download debug files

## Security Notes

1. **Secret Key**: Never expose your reCAPTCHA secret key in client-side code
2. **HTTPS**: Use HTTPS in production for secure token transmission
3. **Rate Limiting**: Consider implementing rate limiting for verification endpoints
4. **IP Validation**: Remote IP is included in verification for additional security

## Troubleshooting

### Common Issues

1. **"Invalid site key" Error**: 
   - For localhost/development: Ensure you're using the test keys provided in the configuration
   - For production: Make sure your domain is registered with the reCAPTCHA site key
   - Check that the `.env` file is loaded properly

2. **Missing Secret Key**: Verify the secret key is correctly set in environment variables

3. **Cross-Origin Issues**: Ensure proper CORS configuration for frame integration

4. **Token Expiration**: reCAPTCHA tokens expire; implement proper error handling

5. **Test Keys Not Working**: The Google test keys should work on localhost. If they don't:
   - Restart your server after updating `.env`
   - Clear browser cache
   - Check browser console for JavaScript errors

### Test Configuration
Use the test page at `/test-recaptcha` to verify:
- Site key is properly configured
- reCAPTCHA script loads correctly
- Verification endpoint works
- Session management functions

## Support

For issues or questions:
1. Check the debug artifacts in `/debug/`
2. Use the test interface at `/test-recaptcha`
3. Review server logs for detailed error information
4. Verify environment configuration

## License

This integration maintains the same license as the parent project.