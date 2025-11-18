# Public Assets Directory

This directory contains static assets for the LinkedIn automation application.

## Required Files

### JavaScript Files (`/js/`)

1. **`captcha.js`** (Required)
   - Frontend CAPTCHA handling logic
   - Token storage and management
   - Integration with hCaptcha and Google reCAPTCHA
   - See `/CAPTCHA_INTEGRATION.md` for implementation details

2. **`api.js`** (Optional)
   - API client utilities
   - Authenticated request handling
   - Token validation helpers

### Stylesheets (`/css/`)

1. **`challenge.css`** (Required)
   - CAPTCHA page styling
   - LinkedIn-inspired design
   - Responsive layouts
   - Loading states and animations

### Images (`/images/`)

- `/images/puzzle/` - Dynamic puzzle CAPTCHA images (gitignored)
- Other static images as needed

## File Integration

These files are referenced by:
- `/views/index.html` - Main CAPTCHA page
- `/views/recaptcha-challenge.html` - reCAPTCHA challenge page
- Other view templates as needed

## Development

When developing frontend files, ensure they:
1. Implement the interfaces defined in `CAPTCHA_INTEGRATION.md`
2. Handle both hCaptcha and reCAPTCHA
3. Store tokens in localStorage
4. Validate token expiration (24 hours)
5. Integrate with backend API endpoints at `/api/captcha/*`

## Production

In production:
- Minify JavaScript and CSS files
- Use CDN for static assets if possible
- Enable caching with appropriate headers
- Ensure HTTPS is used

## Note

The `captcha.js`, `api.js`, and `challenge.css` files are not included in this repository and should be provided separately per project requirements.
