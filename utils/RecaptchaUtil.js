const axios = require('axios');

class RecaptchaUtil {
    constructor(secretKey) {
        this.secretKey = secretKey;
        this.verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    }

    async verifyToken(token, remoteip = null) {
        try {
            const params = new URLSearchParams();
            params.append('secret', this.secretKey);
            params.append('response', token);
            if (remoteip) params.append('remoteip', remoteip);

            const response = await axios.post(this.verifyUrl, params);
            const { success, score, action, challenge_ts, hostname, 'error-codes': errorCodes } = response.data;

            return {
                success,
                score,
                action,
                timestamp: challenge_ts,
                hostname,
                errorCodes,
                raw: response.data
            };
        } catch (error) {
            console.error('reCAPTCHA verification error:', error);
            return {
                success: false,
                errorCodes: ['verification-request-failed'],
                error: error.message
            };
        }
    }

    createMiddleware(options = {}) {
        const {
            scoreThreshold = 0.5,
            requireAction = false,
            expectedAction = null,
            failureRedirect = null,
            tokenField = 'recaptcha_token'
        } = options;

        return async (req, res, next) => {
            const token = req.body[tokenField] || req.query[tokenField] || req.headers['x-recaptcha-token'];
            
            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'reCAPTCHA token is required'
                });
            }

            try {
                const result = await this.verifyToken(token, req.ip);

                if (!result.success) {
                    if (failureRedirect) {
                        return res.redirect(failureRedirect);
                    }
                    return res.status(400).json({
                        success: false,
                        error: 'reCAPTCHA verification failed',
                        errorCodes: result.errorCodes
                    });
                }

                if (result.score < scoreThreshold) {
                    if (failureRedirect) {
                        return res.redirect(failureRedirect);
                    }
                    return res.status(400).json({
                        success: false,
                        error: 'Score too low',
                        score: result.score
                    });
                }

                if (requireAction && expectedAction && result.action !== expectedAction) {
                    if (failureRedirect) {
                        return res.redirect(failureRedirect);
                    }
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid action',
                        expectedAction,
                        actualAction: result.action
                    });
                }

                // Store verification result in request for later use
                req.recaptcha = result;
                next();
            } catch (error) {
                console.error('Middleware error:', error);
                if (failureRedirect) {
                    return res.redirect(failureRedirect);
                }
                return res.status(500).json({
                    success: false,
                    error: 'Internal verification error'
                });
            }
        };
    }
}

module.exports = RecaptchaUtil;