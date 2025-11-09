/**
 * LinkedIn reCAPTCHA Integration Utility
 * Handles reCAPTCHA detection, verification, and integration with LinkedIn automation
 */

class LinkedInRecaptchaUtil {
  constructor() {
    // reCAPTCHA site keys for different environments
    this.linkedinSiteKeys = [
      '6LcgI2cUAAAAAGjW0-O0ED_nmdJkUR7mhqz0zoEO', // Primary LinkedIn site key
      '6LfC6HAUAAAAAGokKQmEfbOHFMsWW3Xfg7wEL2V3'  // Alternative LinkedIn site key
    ];
    
    // Custom site keys
    this.customSiteKeys = [
      '6LdYOf8rAAAAAApVaGMGqJjkKI3GlI6_HI5uq8I5', // Your current custom site key
      '6LcIy_MqAAAAAMKiupFSbmzW3xjGSlIfRzNWYMjC'  // Previous custom site key (backup)
    ];
    
    // Google's test keys - work for localhost and testing
    this.testSiteKeys = [
      '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', // Google test site key
      '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'  // Google test secret key (same as site key for reference)
    ];
    
    this.recaptchaApiUrl = 'https://www.google.com/recaptcha/api/siteverify';
  }

  /**
   * Detect LinkedIn reCAPTCHA widgets across frames
   * @param {Object} page - Puppeteer page object
   * @returns {Object} Detection result with found status and frame URL
   */
  async detectLinkedInRecaptcha(page) {
    try {
      const frames = page.frames();
      console.log(`Checking ${frames.length} frames for LinkedIn reCAPTCHA`);

      for (const frame of frames) {
        try {
          const found = await frame.evaluate(() => {
            // Look for standard reCAPTCHA elements
            if (document.querySelector('.g-recaptcha') || document.querySelector('[data-sitekey]')) {
              return { type: 'widget', sitekey: document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') };
            }

            // Look for reCAPTCHA iframes
            const iframes = Array.from(document.querySelectorAll('iframe'));
            for (const iframe of iframes) {
              const src = iframe.src || '';
              if (src.includes('recaptcha') || src.includes('google.com/recaptcha') || src.includes('www.gstatic.com/recaptcha')) {
                // Extract site key from iframe src if possible
                const url = new URL(src);
                const sitekey = url.searchParams.get('k');
                return { type: 'iframe', sitekey, src };
              }
            }

            // Look for reCAPTCHA scripts
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
              if (script.src && script.src.includes('recaptcha')) {
                const url = new URL(script.src);
                const sitekey = url.searchParams.get('k');
                if (sitekey) return { type: 'script', sitekey, src: script.src };
              }
            }

            return null;
          }).catch(() => null);

          if (found) {
            console.log(`LinkedIn reCAPTCHA detected in frame: ${frame.url()}`);
            console.log('Detection details:', found);
            
            return {
              found: true,
              frameUrl: frame.url(),
              detectionType: found.type,
              siteKey: found.sitekey,
              isLinkedInSiteKey: this.isLinkedInSiteKey(found.sitekey)
            };
          }
        } catch (e) {
          // Cross-origin frame may throw; fallback to URL check
          console.log(`Frame evaluation failed for ${frame.url()}: ${e.message}`);
        }

        // Fallback: check frame URL for reCAPTCHA indicators
        const frameUrl = frame.url && frame.url();
        if (frameUrl && (frameUrl.includes('recaptcha') || frameUrl.includes('google.com/recaptcha') || frameUrl.includes('hcaptcha'))) {
          return {
            found: true,
            frameUrl,
            detectionType: 'url',
            siteKey: this.extractSiteKeyFromUrl(frameUrl),
            isLinkedInSiteKey: false
          };
        }
      }
    } catch (err) {
      console.error('detectLinkedInRecaptcha error:', err);
    }

    return { found: false };
  }

  /**
   * Check if a site key belongs to LinkedIn
   * @param {string} siteKey - The reCAPTCHA site key to check
   * @returns {boolean} True if the site key is known to be LinkedIn's
   */
  isLinkedInSiteKey(siteKey) {
    return this.linkedinSiteKeys.includes(siteKey);
  }

  /**
   * Check if a site key is a test key
   * @param {string} siteKey - The reCAPTCHA site key to check
   * @returns {boolean} True if the site key is a test key
   */
  isTestSiteKey(siteKey) {
    return this.testSiteKeys.includes(siteKey);
  }

  /**
   * Check if a site key is a custom key
   * @param {string} siteKey - The reCAPTCHA site key to check
   * @returns {boolean} True if the site key is a custom key
   */
  isCustomSiteKey(siteKey) {
    return this.customSiteKeys.includes(siteKey);
  }

  /**
   * Extract site key from reCAPTCHA URL
   * @param {string} url - The URL to extract site key from
   * @returns {string|null} The extracted site key or null
   */
  extractSiteKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('k') || urlObj.searchParams.get('sitekey');
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the appropriate site key for LinkedIn reCAPTCHA
   * @param {Object} options - Configuration options
   * @returns {string} The site key to use
   */
  getLinkedInSiteKey(options = {}) {
    const { 
      preferredSiteKey, 
      envSiteKey, 
      fallbackToDefault = true,
      useTestKey = false
    } = options;

    // Priority order: preferred -> environment -> custom -> test key for development
    if (preferredSiteKey && (this.isLinkedInSiteKey(preferredSiteKey) || this.isTestSiteKey(preferredSiteKey) || this.isCustomSiteKey(preferredSiteKey))) {
      return preferredSiteKey;
    }

    if (envSiteKey) {
      return envSiteKey;
    }

    // If test mode requested, use test key
    if (useTestKey) {
      return this.testSiteKeys[0]; // Google test site key
    }

    if (fallbackToDefault) {
      // Use custom key first, then test key for development/localhost, LinkedIn key for production
      if (this.customSiteKeys.length > 0) {
        return this.customSiteKeys[0]; // Your custom site key
      }
      return this.isLocalhost() ? this.testSiteKeys[0] : this.linkedinSiteKeys[0];
    }

    return null;
  }

  /**
   * Check if running on localhost or development environment
   * @returns {boolean} True if on localhost
   */
  isLocalhost() {
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.endsWith('.local');
    } catch (e) {
      // Fallback - assume localhost if in doubt for development
      return true;
    }
  }

  /**
   * Verify reCAPTCHA token with Google's API
   * @param {string} token - The reCAPTCHA response token
   * @param {string} secretKey - The reCAPTCHA secret key
   * @param {string} remoteIp - Optional remote IP address
   * @returns {Object} Verification result
   */
  async verifyRecaptchaToken(token, secretKey, remoteIp = null) {
    const axios = require('axios');
    
    try {
      const params = new URLSearchParams();
      params.append('secret', secretKey);
      params.append('response', token);
      
      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await axios.post(this.recaptchaApiUrl, params, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = response.data;
      
      return {
        success: data.success || false,
        challengeTs: data.challenge_ts,
        hostname: data.hostname,
        errorCodes: data['error-codes'] || [],
        score: data.score, // For v3
        action: data.action // For v3
      };
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      return {
        success: false,
        error: error.message,
        errorCodes: ['network-error']
      };
    }
  }

  /**
   * Generate reCAPTCHA challenge URL for a session
   * @param {string} sessionId - The session ID
   * @param {Object} options - Additional options
   * @returns {string} The challenge URL
   */
  generateChallengeUrl(sessionId, options = {}) {
    const { baseUrl = '', theme = 'light', size = 'normal' } = options;
    const params = new URLSearchParams({
      sessionId,
      theme,
      size
    });

    return `${baseUrl}/recaptcha-challenge?${params.toString()}`;
  }

  /**
   * Extract reCAPTCHA configuration from LinkedIn page
   * @param {Object} page - Puppeteer page object
   * @returns {Object} Extracted configuration
   */
  async extractLinkedInRecaptchaConfig(page) {
    try {
      const config = await page.evaluate(() => {
        const result = {
          siteKeys: [],
          themes: [],
          sizes: [],
          callbacks: []
        };

        // Look for data-sitekey attributes
        const recaptchaElements = document.querySelectorAll('[data-sitekey]');
        recaptchaElements.forEach(el => {
          const sitekey = el.getAttribute('data-sitekey');
          if (sitekey && !result.siteKeys.includes(sitekey)) {
            result.siteKeys.push(sitekey);
          }

          const theme = el.getAttribute('data-theme');
          if (theme && !result.themes.includes(theme)) {
            result.themes.push(theme);
          }

          const size = el.getAttribute('data-size');
          if (size && !result.sizes.includes(size)) {
            result.sizes.push(size);
          }

          const callback = el.getAttribute('data-callback');
          if (callback && !result.callbacks.includes(callback)) {
            result.callbacks.push(callback);
          }
        });

        // Look for reCAPTCHA in script tags
        const scripts = Array.from(document.querySelectorAll('script'));
        scripts.forEach(script => {
          const content = script.textContent || '';
          
          // Look for site key patterns
          const sitekeyMatches = content.match(/sitekey['"]\s*:\s*['"]([^'"]+)['"]/gi);
          if (sitekeyMatches) {
            sitekeyMatches.forEach(match => {
              const sitekey = match.match(/['"]([^'"]+)['"]/)[1];
              if (sitekey && !result.siteKeys.includes(sitekey)) {
                result.siteKeys.push(sitekey);
              }
            });
          }
        });

        return result;
      });

      console.log('Extracted LinkedIn reCAPTCHA config:', config);
      return config;
    } catch (error) {
      console.error('Error extracting LinkedIn reCAPTCHA config:', error);
      return {
        siteKeys: [],
        themes: ['light'],
        sizes: ['normal'],
        callbacks: []
      };
    }
  }
}

module.exports = LinkedInRecaptchaUtil;