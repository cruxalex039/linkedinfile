/**
 * Enhanced Fingerprint and Cookie Manager
 * Combines ISP, port, MAC address fingerprinting with cookie management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class FingerprintCookieManager {
  constructor(configDir = './fingerprint-profiles') {
    this.configDir = configDir;
    this.ensureConfigDir();
    
    this.ispDatabase = [
      { name: 'Comcast Cable Communications', country: 'US', asn: 7922, region: 'North America' },
      { name: 'Verizon Communications', country: 'US', asn: 701, region: 'North America' },
      { name: 'AT&T Internet Services', country: 'US', asn: 7018, region: 'North America' },
      { name: 'Charter Communications', country: 'US', asn: 20115, region: 'North America' },
      { name: 'Deutsche Telekom', country: 'DE', asn: 3320, region: 'Europe' },
      { name: 'Orange', country: 'FR', asn: 3215, region: 'Europe' },
      { name: 'Vodafone', country: 'GB', asn: 15224, region: 'Europe' },
      { name: 'BT Group', country: 'GB', asn: 2856, region: 'Europe' }
    ];

    this.macVendors = [
      { prefix: '00:1B:44', vendor: 'Apple Inc.', type: 'laptop' },
      { prefix: '00:21:5A', vendor: 'Apple Inc.', type: 'desktop' },
      { prefix: '00:13:20', vendor: 'Dell Inc.', type: 'desktop' },
      { prefix: '00:21:70', vendor: 'Dell Inc.', type: 'laptop' },
      { prefix: '00:0F:FE', vendor: 'HP Inc.', type: 'desktop' },
      { prefix: '70:10:6F', vendor: 'HP Inc.', type: 'laptop' }
    ];
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  generateProfile(options = {}) {
    const {
      sessionType = 'fresh',
      region = 'North America',
      deviceType = 'laptop',
      connectionType = 'cable'
    } = options;

    const profileId = this.generateUUID();
    const timestamp = new Date().toISOString();

    const networkFingerprint = this.generateNetworkFingerprint({ region, connectionType });
    const deviceFingerprint = this.generateDeviceFingerprint({ deviceType });
    const browserFingerprint = this.generateBrowserFingerprint({ deviceType, region });
    const cookies = this.generateCookies({ sessionType });

    const profile = {
      profileId,
      timestamp,
      sessionType,
      network: networkFingerprint,
      device: deviceFingerprint,
      browser: browserFingerprint,
      cookies,
      metadata: {
        createdAt: timestamp,
        lastUsed: null,
        useCount: 0,
        region,
        deviceType,
        connectionType
      }
    };

    this.saveProfile(profile);
    return profile;
  }

  generateNetworkFingerprint(options) {
    const { region, connectionType } = options;
    const regionISPs = this.ispDatabase.filter(i => i.region === region);
    const isp = regionISPs[Math.floor(Math.random() * regionISPs.length)];

    const publicIP = this.generatePublicIP(isp.asn);
    const localIP = this.generateLocalIP();
    const sourcePort = this.generatePort();
    const proxyPort = this.generatePort();

    return {
      isp: isp.name,
      asn: isp.asn,
      country: isp.country,
      region,
      publicIP,
      localIP,
      sourcePort,
      proxyPort,
      // Add IP:Port combinations for easy proxy usage
      publicProxy: `${publicIP}:${sourcePort}`,
      localProxy: `${localIP}:${sourcePort}`,
      alternateProxy: `${publicIP}:${proxyPort}`,
      connectionType,
      bandwidth: this.generateBandwidth(connectionType),
      latency: this.generateLatency(connectionType)
    };
  }

  generateDeviceFingerprint(options) {
    const { deviceType } = options;
    const deviceVendors = this.macVendors.filter(v => v.type === deviceType);
    const vendor = deviceVendors[Math.floor(Math.random() * deviceVendors.length)];

    return {
      macAddress: this.generateMACAddress(vendor.prefix),
      vendor: vendor.vendor,
      deviceType,
      hostname: this.generateHostname(vendor.vendor)
    };
  }

  generateBrowserFingerprint(options) {
    const { deviceType, region } = options;
    
    const userAgents = {
      laptop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    };

    return {
      userAgent: userAgents[deviceType] || userAgents.laptop,
      viewport: { width: 1920, height: 1080 },
      timezone: 'America/New_York',
      language: 'en-US,en;q=0.9',
      platform: 'Win32'
    };
  }

  generateCookies(options) {
    const { sessionType } = options;
    const now = Date.now();
    const fiveYears = 5 * 365 * 24 * 60 * 60 * 1000;

    return [
      {
        name: 'li_at',
        value: `AQEDAQEBAAAAAAGQxTqGAQAAAYUagFiTRKZ3gIQ${this.generateBase64String(32)}`,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        httpOnly: true,
        session: false,
        expirationDate: Math.floor((now + fiveYears) / 1000)
      },
      {
        name: 'lidc',
        value: `"b=VB48:s=V:r=V:a=V:p=V:g=${Math.floor(now/1000)}:u=1:x=1:i=${now}";`,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        httpOnly: false,
        session: false,
        expirationDate: Math.floor((now + fiveYears) / 1000)
      }
    ];
  }

  async applyProfileToPage(page, profile) {
    try {
      if (profile.browser.userAgent) {
        await page.setUserAgent(profile.browser.userAgent);
      }

      if (profile.browser.viewport) {
        await page.setViewport(profile.browser.viewport);
      }

      await page.setExtraHTTPHeaders({
        'Accept-Language': profile.browser.language,
        'X-Forwarded-For': profile.network.localIP
      });

      await page.evaluateOnNewDocument((profileData) => {
        window.appliedProfile = profileData;
      }, profile);

      profile.metadata.lastUsed = new Date().toISOString();
      profile.metadata.useCount = (profile.metadata.useCount || 0) + 1;
      this.saveProfile(profile);

      console.log(`Applied fingerprint profile ${profile.profileId} to page`);
      return true;
    } catch (error) {
      console.error('Error applying profile to page:', error);
      return false;
    }
  }

  saveProfile(profile) {
    const filename = `profile-${profile.profileId}.json`;
    const filepath = path.join(this.configDir, filename);
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(profile, null, 2));
      console.log(`Fingerprint profile saved: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('Error saving profile:', error);
      return null;
    }
  }

  loadProfile(profileId) {
    const filename = `profile-${profileId}.json`;
    const filepath = path.join(this.configDir, filename);
    
    try {
      if (fs.existsSync(filepath)) {
        const data = fs.readFileSync(filepath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error loading profile:', error);
      return null;
    }
  }

  listProfiles() {
    try {
      const files = fs.readdirSync(this.configDir);
      return files
        .filter(file => file.startsWith('profile-') && file.endsWith('.json'))
        .map(file => {
          const profileId = file.replace('profile-', '').replace('.json', '');
          const filepath = path.join(this.configDir, file);
          const stats = fs.statSync(filepath);
          
          try {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            return {
              profileId,
              sessionType: data.sessionType,
              region: data.metadata.region,
              deviceType: data.metadata.deviceType,
              isp: data.network.isp,
              createdAt: data.metadata.createdAt,
              lastUsed: data.metadata.lastUsed,
              useCount: data.metadata.useCount,
              fileSize: stats.size
            };
          } catch (e) {
            return {
              profileId,
              error: 'Invalid JSON',
              createdAt: stats.ctime,
              fileSize: stats.size
            };
          }
        });
    } catch (error) {
      console.error('Error listing profiles:', error);
      return [];
    }
  }

  // Helper methods
  generatePublicIP(asn) {
    const ranges = {
      7922: [73, 74, 75, 76],
      701: [4, 5, 6, 7],
      7018: [12, 13, 14, 15]
    };
    
    const range = ranges[asn] || [203, 204, 205, 206];
    const first = range[Math.floor(Math.random() * range.length)];
    const second = Math.floor(Math.random() * 255);
    const third = Math.floor(Math.random() * 255);
    const fourth = Math.floor(Math.random() * 254) + 1;
    
    return `${first}.${second}.${third}.${fourth}`;
  }

  generateLocalIP() {
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
  }

  generatePort() {
    return Math.floor(Math.random() * (65535 - 49152)) + 49152;
  }

  generateMACAddress(prefix) {
    const suffix = Array.from({ length: 3 }, () => {
      return Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    }).join(':');
    
    return `${prefix}:${suffix}`;
  }

  generateHostname(vendor) {
    const prefixes = {
      'Apple Inc.': 'MacBook',
      'Dell Inc.': 'DESKTOP',
      'HP Inc.': 'HP-PC'
    };
    
    const prefix = prefixes[vendor] || 'DESKTOP';
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return `${prefix}-${suffix}`;
  }

  generateBandwidth(connectionType) {
    const ranges = {
      fiber: { download: 500, upload: 100 },
      cable: { download: 150, upload: 25 },
      dsl: { download: 25, upload: 5 }
    };
    
    return ranges[connectionType] || ranges.cable;
  }

  generateLatency(connectionType) {
    const latencies = { fiber: 5, cable: 20, dsl: 40 };
    return latencies[connectionType] || 20;
  }

  generateUUID() {
    return crypto.randomUUID();
  }

  generateBase64String(length) {
    return crypto.randomBytes(length).toString('base64').replace(/[+/=]/g, '').substring(0, length);
  }
}

module.exports = FingerprintCookieManager;