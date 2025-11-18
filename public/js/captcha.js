/**
 * CAPTCHA Handler - Frontend JavaScript for CAPTCHA token management
 * Handles hCaptcha and Google reCAPTCHA verification flows with backend integration
 */

(function() {
    'use strict';

    // Configuration
    const config = {
        verifyEndpoint: '/api/captcha/verify',
        validateEndpoint: '/api/captcha/validate-token',
        redirectDelay: 2000,
        maxRetries: 3,
        tokenStorageKey: 'captcha_ack_token',
        sessionStorageKey: 'captcha_verified'
    };

    // State management
    const state = {
        captchaToken: null,
        captchaType: null, // 'hcaptcha' or 'recaptcha'
        isVerifying: false,
        sessionId: null,
        retryCount: 0,
        acknowledgedToken: null
    };

    /**
     * Initialize CAPTCHA functionality on page load
     */
    function init() {
        console.log('[CAPTCHA] Initializing handler...');
        
        // Get session ID from URL if available
        const urlParams = new URLSearchParams(window.location.search);
        state.sessionId = urlParams.get('sessionId');
        
        if (state.sessionId) {
            console.log('[CAPTCHA] Session ID:', state.sessionId);
        }

        // Setup form listener
        const form = document.getElementById('captcha-form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
            console.log('[CAPTCHA] Form listener attached');
        }

        // Auto-detect CAPTCHA type
        detectCaptchaType();
        
        // Check for existing valid token
        checkExistingToken();
        
        console.log('[CAPTCHA] Initialization complete');
    }

    /**
     * Detect which CAPTCHA provider is being used
     */
    function detectCaptchaType() {
        if (window.hcaptcha) {
            state.captchaType = 'hcaptcha';
            console.log('[CAPTCHA] Detected hCaptcha');
        } else if (window.grecaptcha) {
            state.captchaType = 'recaptcha';
            console.log('[CAPTCHA] Detected Google reCAPTCHA');
        } else {
            console.log('[CAPTCHA] No CAPTCHA library detected yet, will retry...');
            // Retry detection after 1 second
            setTimeout(detectCaptchaType, 1000);
        }
    }

    /**
     * Check if user has existing valid token
     */
    async function checkExistingToken() {
        const tokenData = getAcknowledgedToken();
        if (!tokenData) return;

        console.log('[CAPTCHA] Found stored token, validating...');
        
        try {
            const response = await fetch(config.validateEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: tokenData.token })
            });

            const data = await response.json();
            
            if (data.valid) {
                console.log('[CAPTCHA] Stored token is valid, redirecting...');
                sessionStorage.setItem(config.sessionStorageKey, 'true');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 500);
            } else {
                console.log('[CAPTCHA] Stored token is invalid, clearing...');
                localStorage.removeItem(config.tokenStorageKey);
            }
        } catch (error) {
            console.error('[CAPTCHA] Token validation error:', error);
        }
    }

    /**
     * Callback when hCaptcha is successfully completed
     * @param {string} token - The hCaptcha response token
     */
    window.onCaptchaSuccess = function(token) {
        console.log('[CAPTCHA] hCaptcha success, token received');
        state.captchaToken = token;
        state.captchaType = 'hcaptcha';
        
        // Enable verify button
        enableVerifyButton();
        
        // Auto-submit if configured
        if (shouldAutoSubmit()) {
            setTimeout(() => submitCaptcha(), 500);
        }
    };

    /**
     * Callback when Google reCAPTCHA is successfully completed
     * @param {string} token - The reCAPTCHA response token
     */
    window.onRecaptchaSuccess = function(token) {
        console.log('[CAPTCHA] reCAPTCHA success, token received');
        state.captchaToken = token;
        state.captchaType = 'recaptcha';
        
        // Enable verify button
        enableVerifyButton();
        
        // Auto-submit if configured
        if (shouldAutoSubmit()) {
            setTimeout(() => submitCaptcha(), 500);
        }
    };

    /**
     * Callback when CAPTCHA expires
     */
    window.onCaptchaExpired = function() {
        console.log('[CAPTCHA] CAPTCHA expired');
        state.captchaToken = null;
        disableVerifyButton();
        showMessage('CAPTCHA expired. Please try again.', 'error');
    };

    /**
     * Callback when CAPTCHA encounters an error
     */
    window.onCaptchaError = function() {
        console.error('[CAPTCHA] CAPTCHA error occurred');
        state.captchaToken = null;
        showMessage('CAPTCHA error. Please refresh and try again.', 'error');
    };

    /**
     * Enable verify button
     */
    function enableVerifyButton() {
        const verifyButton = document.getElementById('verify-button');
        if (verifyButton) {
            verifyButton.disabled = false;
            verifyButton.textContent = 'Verify';
        }
    }

    /**
     * Disable verify button
     */
    function disableVerifyButton() {
        const verifyButton = document.getElementById('verify-button');
        if (verifyButton) {
            verifyButton.disabled = true;
            verifyButton.textContent = 'Verify';
        }
    }

    /**
     * Handle form submission
     * @param {Event} event - The form submit event
     */
    function handleFormSubmit(event) {
        event.preventDefault();
        submitCaptcha();
    }

    /**
     * Submit CAPTCHA token for verification
     */
    async function submitCaptcha() {
        if (state.isVerifying) {
            console.log('[CAPTCHA] Already verifying, skipping...');
            return;
        }

        if (!state.captchaToken) {
            showMessage('Please complete the CAPTCHA first.', 'error');
            return;
        }

        state.isVerifying = true;
        showSpinner(true);
        
        try {
            console.log('[CAPTCHA] Submitting token for verification...');
            
            const payload = {
                captchaResponse: state.captchaToken,
                token: state.captchaToken,
                captchaType: state.captchaType,
                source: 'frontend-widget'
            };
            
            // Add session ID if available
            if (state.sessionId) {
                payload.sessionId = state.sessionId;
            }
            
            const response = await fetch(config.verifyEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('[CAPTCHA] Verification successful');
                handleVerificationSuccess(data);
            } else {
                console.error('[CAPTCHA] Verification failed:', data);
                handleVerificationFailure(data);
            }
        } catch (error) {
            console.error('[CAPTCHA] Verification error:', error);
            handleVerificationError(error);
        } finally {
            state.isVerifying = false;
            showSpinner(false);
        }
    }

    /**
     * Handle successful verification
     * @param {Object} data - Response data from server
     */
    function handleVerificationSuccess(data) {
        console.log('[CAPTCHA] Success data:', data);
        
        // Store acknowledged token
        if (data.token) {
            storeAcknowledgedToken(data.token, data);
            state.acknowledgedToken = data.token;
        }
        
        // Hide challenge stage
        const challengeStage = document.getElementById('challenge-stage');
        if (challengeStage) {
            challengeStage.style.display = 'none';
        }
        
        // Hide running message
        const challengeRunning = document.getElementById('challenge-running');
        if (challengeRunning) {
            challengeRunning.style.display = 'none';
        }
        
        // Hide body text
        const bodyText = document.getElementById('challenge-body-text');
        if (bodyText) {
            bodyText.style.display = 'none';
        }
        
        // Show success message
        const successDiv = document.getElementById('challenge-success');
        if (successDiv) {
            successDiv.style.display = 'block';
        }
        
        // Set session storage
        sessionStorage.setItem(config.sessionStorageKey, 'true');
        sessionStorage.setItem('captcha_timestamp', Date.now().toString());
        
        // Redirect after delay
        const redirectUrl = data.redirect || '/login.html';
        console.log(`[CAPTCHA] Redirecting to ${redirectUrl} in ${config.redirectDelay}ms...`);
        
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, config.redirectDelay);
    }

    /**
     * Handle failed verification
     * @param {Object} data - Error data from server
     */
    function handleVerificationFailure(data) {
        state.retryCount++;
        
        let errorMessage = 'Verification failed. ';
        
        if (data.error === 'verification-failed') {
            errorMessage += 'The CAPTCHA response was invalid.';
        } else if (data.error === 'server-missing-secret') {
            errorMessage += 'Server configuration error.';
        } else {
            errorMessage += data.message || 'Please try again.';
        }
        
        if (state.retryCount < config.maxRetries) {
            errorMessage += ` (Attempt ${state.retryCount}/${config.maxRetries})`;
        }
        
        showMessage(errorMessage, 'error');
        
        // Reset CAPTCHA
        resetCaptcha();
        
        // If max retries reached, suggest refresh
        if (state.retryCount >= config.maxRetries) {
            showMessage('Maximum retry attempts reached. Please refresh the page.', 'error');
        }
    }

    /**
     * Handle verification error
     * @param {Error} error - The error object
     */
    function handleVerificationError(error) {
        showMessage('Network error. Please check your connection and try again.', 'error');
        resetCaptcha();
    }

    /**
     * Reset CAPTCHA widget
     */
    function resetCaptcha() {
        state.captchaToken = null;
        
        if (state.captchaType === 'hcaptcha' && window.hcaptcha) {
            try {
                window.hcaptcha.reset();
                console.log('[CAPTCHA] hCaptcha reset');
            } catch (e) {
                console.error('[CAPTCHA] Error resetting hCaptcha:', e);
            }
        } else if (state.captchaType === 'recaptcha' && window.grecaptcha) {
            try {
                window.grecaptcha.reset();
                console.log('[CAPTCHA] reCAPTCHA reset');
            } catch (e) {
                console.error('[CAPTCHA] Error resetting reCAPTCHA:', e);
            }
        }
        
        disableVerifyButton();
    }

    /**
     * Show/hide loading spinner
     * @param {boolean} show - Whether to show the spinner
     */
    function showSpinner(show) {
        const spinner = document.getElementById('challenge-spinner');
        const stage = document.getElementById('challenge-stage');
        
        if (spinner && stage) {
            if (show) {
                stage.style.display = 'none';
                spinner.style.display = 'flex';
                spinner.style.visibility = 'visible';
            } else {
                spinner.style.display = 'none';
                spinner.style.visibility = 'hidden';
                stage.style.display = 'flex';
            }
        }
    }

    /**
     * Display a message to the user
     * @param {string} message - The message to display
     * @param {string} type - The message type ('success', 'error', 'info')
     */
    function showMessage(message, type = 'info') {
        console.log(`[CAPTCHA] ${type.toUpperCase()}: ${message}`);
        
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message, .info-message');
        existingMessages.forEach(el => el.remove());
        
        // Create new message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message spacer`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            margin: 15px 0;
            padding: 12px 16px;
            border-radius: 4px;
            font-size: 14px;
            text-align: center;
        `;
        
        if (type === 'error') {
            messageDiv.style.backgroundColor = '#fff3f3';
            messageDiv.style.border = '1px solid #ffcccb';
            messageDiv.style.color = '#cc1016';
        } else if (type === 'success') {
            messageDiv.style.backgroundColor = '#d4edda';
            messageDiv.style.border = '1px solid #c3e6cb';
            messageDiv.style.color = '#057642';
        } else {
            messageDiv.style.backgroundColor = '#d1ecf1';
            messageDiv.style.border = '1px solid #bee5eb';
            messageDiv.style.color = '#0c5460';
        }
        
        // Insert after challenge stage
        const challengeStage = document.getElementById('challenge-stage');
        if (challengeStage && challengeStage.parentNode) {
            challengeStage.parentNode.insertBefore(messageDiv, challengeStage.nextSibling);
        }
    }

    /**
     * Check if auto-submit is enabled
     * @returns {boolean} Whether auto-submit should happen
     */
    function shouldAutoSubmit() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('autoSubmit') === 'true';
    }

    /**
     * Store acknowledged token in localStorage
     * @param {string} token - The acknowledged token
     * @param {Object} metadata - Additional token metadata
     */
    function storeAcknowledgedToken(token, metadata = {}) {
        try {
            const tokenData = {
                token: token,
                timestamp: Date.now(),
                sessionId: state.sessionId,
                captchaType: state.captchaType,
                metadata: metadata
            };
            
            // Store in localStorage
            localStorage.setItem(config.tokenStorageKey, JSON.stringify(tokenData));
            
            console.log('[CAPTCHA] Acknowledged token stored:', token);
        } catch (error) {
            console.error('[CAPTCHA] Error storing token:', error);
        }
    }

    /**
     * Get acknowledged token from storage
     * @returns {Object|null} The stored token data or null
     */
    function getAcknowledgedToken() {
        try {
            const tokenDataStr = localStorage.getItem(config.tokenStorageKey);
            if (!tokenDataStr) return null;
            
            const tokenData = JSON.parse(tokenDataStr);
            
            // Check if token is still valid (24 hours)
            const age = Date.now() - tokenData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (age > maxAge) {
                console.log('[CAPTCHA] Stored token expired');
                localStorage.removeItem(config.tokenStorageKey);
                return null;
            }
            
            return tokenData;
        } catch (error) {
            console.error('[CAPTCHA] Error retrieving token:', error);
            return null;
        }
    }

    /**
     * Check if user has a valid acknowledged token
     * @returns {boolean} Whether a valid token exists
     */
    function hasValidToken() {
        const tokenData = getAcknowledgedToken();
        return tokenData !== null;
    }

    /**
     * Clear stored token
     */
    function clearToken() {
        localStorage.removeItem(config.tokenStorageKey);
        sessionStorage.removeItem(config.sessionStorageKey);
        console.log('[CAPTCHA] Token cleared');
    }

    // Expose public API
    window.CaptchaHandler = {
        init: init,
        submitCaptcha: submitCaptcha,
        resetCaptcha: resetCaptcha,
        getAcknowledgedToken: getAcknowledgedToken,
        hasValidToken: hasValidToken,
        storeAcknowledgedToken: storeAcknowledgedToken,
        clearToken: clearToken,
        getState: () => ({ ...state })
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
