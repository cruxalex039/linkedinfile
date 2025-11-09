const { chromium } = require('playwright');
const Queue = require('better-queue');
const path = require('path');

class BrowserPool {
    constructor(poolSize = 50) {
        this.poolSize = poolSize;
        this.browsers = new Map(); // Keep track of browser instances
        this.pageQueue = new Queue(this.processPage.bind(this));
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            // Initialize the pool with browser instances
            for (let i = 0; i < this.poolSize; i++) {
                const browser = await this.createBrowser();
                this.browsers.set(i, {
                    browser,
                    inUse: false
                });
            }
            this.initialized = true;
            console.log(`Browser pool initialized with ${this.poolSize} instances`);
        } catch (error) {
            console.error('Error initializing browser pool:', error);
            throw error;
        }
    }

    async createBrowser() {
        return await chromium.launch({
            args: [
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-setuid-sandbox',
                '--window-size=1920,1080'
            ]
        });
    }

    async getAvailableBrowser() {
        for (const [id, data] of this.browsers) {
            if (!data.inUse) {
                data.inUse = true;
                return { id, browser: data.browser };
            }
        }
        return null;
    }

    releaseBrowser(id) {
        const data = this.browsers.get(id);
        if (data) {
            data.inUse = false;
        }
    }

    async processPage(task, callback) {
        let browserId = null;
        try {
            const { action, sessionId } = task;
            const browserData = await this.getAvailableBrowser();
            
            if (!browserData) {
                return callback(new Error('No available browsers'));
            }

            browserId = browserData.id;
            const browser = browserData.browser;
            const page = await browser.newPage();

            // Set default viewport and user agent
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            });

            try {
                // Execute the action with the page
                const result = await action(page);
                callback(null, result);
            } catch (error) {
                callback(error);
            } finally {
                await page.close();
                this.releaseBrowser(browserId);
            }
        } catch (error) {
            if (browserId !== null) {
                this.releaseBrowser(browserId);
            }
            callback(error);
        }
    }

    async addJob(action) {
        return new Promise((resolve, reject) => {
            this.pageQueue.push({ action }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    async cleanup() {
        for (const [id, data] of this.browsers) {
            try {
                await data.browser.close();
            } catch (error) {
                console.error(`Error closing browser ${id}:`, error);
            }
        }
        this.browsers.clear();
        this.initialized = false;
    }
}

module.exports = BrowserPool;
