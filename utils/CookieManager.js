const fs = require('fs');
const path = require('path');

class CookieManager {
    constructor(cookiesDir) {
        this.cookiesDir = cookiesDir;
        this.ensureCookiesDirectory();
    }

    ensureCookiesDirectory() {
        if (!fs.existsSync(this.cookiesDir)) {
            fs.mkdirSync(this.cookiesDir, { recursive: true });
        }
    }

    processCookies(cookies, expirationYears = 5) {
        const fiveYearsInSeconds = expirationYears * 365 * 24 * 60 * 60;
        const importantCookies = [
            'lms_ads', '_guid', 'ccookie', 'bcookie', 'fid',
            '__cf_bm', 'g_state', 'li_alerts', 'lms_analytics',
            'fptctx2', 'li_at', 'lidc', 'bscookie', 'dfpfpt',
            'JSESSIONID', 'li_gc', 'li_rm', 'li_sugr',
            'UserMatchHistory', 'AnalyticsSyncHistory'
        ];

        return cookies
            .filter(cookie => importantCookies.includes(cookie.name))
            .map(cookie => {
                const extendedExpiration = Math.floor(Date.now() / 1000) + fiveYearsInSeconds;
                const baseCookie = {
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: '/',
                    secure: true,
                    httpOnly: false,
                    sameSite: 'no_restriction',
                    session: false,
                    firstPartyDomain: '',
                    partitionKey: null,
                    expirationDate: extendedExpiration,
                    storeId: null
                };

                // Special cookie configurations
                const cookieConfigs = {
                    'ccookie': { secure: false, hostOnly: true },
                    'fid': { secure: false, hostOnly: true },
                    'g_state': { secure: false, hostOnly: true },
                    'li_alerts': { hostOnly: true },
                    'fptctx2': { httpOnly: true, session: true, expirationDate: undefined },
                    'li_at': { httpOnly: true },
                    'bscookie': { httpOnly: true },
                    'dfpfpt': { httpOnly: true },
                    'li_rm': { httpOnly: true }
                };

                if (cookieConfigs[cookie.name]) {
                    return { ...baseCookie, ...cookieConfigs[cookie.name] };
                }

                return baseCookie;
            });
    }

    async saveCookies(sessionId, cookies) {
        const cookieFilePath = path.join(this.cookiesDir, `${sessionId}.json`);
        const processedCookies = this.processCookies(cookies);
        fs.writeFileSync(cookieFilePath, JSON.stringify(processedCookies, null, 2));
        console.log(`Cookies saved to ${cookieFilePath}`);
        return cookieFilePath;
    }
}

module.exports = CookieManager;
