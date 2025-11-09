/**
 * Fingerprint Utility for ISP, Port, and MAC Address Configuration
 * Helps make browser sessions appear more realistic and avoid detection
 */

const os = require('os');
const crypto = require('crypto');

class FingerprintUtil {
  constructor() {
    // Common ISP providers for realistic fingerprinting
    this.commonISPs = [
      'Comcast Cable Communications',
      'Verizon Communications',
      'AT&T Internet Services',
      'Charter Communications',
      'Cox Communications',
      'CenturyLink',
      'Frontier Communications',
      'Optimum',
      'Xfinity',
      'Time Warner Cable',
      'Deutsche Telekom',
      'Orange',
      'Vodafone',
      'BT Group',
      'Virgin Media',
      'TalkTalk',
      'Sky Broadband',
      'Plusnet'
    ];

    // Common residential port ranges
    this.commonPorts = {
      ephemeral: [49152, 65535], // Ephemeral port range
      high: [32768, 65535],      // High port range
      dynamic: [1024, 65535]     // Dynamic port range
    };

    // MAC address vendor prefixes (OUI - Organizationally Unique Identifier)
    this.macVendorPrefixes = [
      '00:1B:44', // Apple
      '00:50:56', // VMware
      '00:0C:29', // VMware
      '08:00:27', // VirtualBox
      '52:54:00', // QEMU/KVM
      'B8:27:EB', // Raspberry Pi
      '00:16:3E', // Xen
      '00:21:5A', // Apple
      '00:26:B0', // Apple
      '3C:15:C2', // Apple
      'A4:5E:60', // Apple
      'B8:C7:5D', // Apple
      'DC:A6:32', // Raspberry Pi
      'E4:5F:01', // Raspberry Pi
      '00:15:5D', // Hyper-V
      '00:17:FA', // Hyper-V
      '00:1C:42', // Parallels
      '00:03:FF', // Microsoft
      '00:12:3F', // Microsoft
      '00:13:20', // Dell
      '00:14:22', // Dell
      '00:1A:A0', // Dell
      '00:21:70', // Dell
      '00:23:AE', // Dell
      '00:24:E8', // Dell
      '00:26:B9', // Dell
      '84:2B:2B', // Dell
      'B0:83:FE', // Dell
      'D0:67:E5', // Dell
      'F0:4D:A2', // Dell
      'F8:BC:12', // Dell
      '00:0F:FE', // HP
      '00:11:85', // HP
      '00:13:21', // HP
      '00:14:C2', // HP
      '00:15:60', // HP
      '00:16:35', // HP
      '00:17:08', // HP
      '00:18:71', // HP
      '00:19:BB', // HP
      '00:1A:4B', // HP
      '00:1B:78', // HP
      '00:1C:C4', // HP
      '00:1D:09', // HP
      '00:1E:0B', // HP
      '00:1F:29', // HP
      '00:21:5A', // HP
      '00:22:64', // HP
      '00:23:47', // HP
      '00:24:81', // HP
      '00:25:B3', // HP
      '00:26:55', // HP
      '3C:4A:92', // HP
      '70:10:6F', // HP
      '9C:8E:99', // HP
      'C8:CB:B8', // HP
      'D4:85:64', // HP
      'E8:39:35'  // HP
    ];

    this.regions = [
      { name: 'North America', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'] },
      { name: 'Europe', timezones: ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome'] },
      { name: 'Asia Pacific', timezones: ['Asia/Tokyo', 'Asia/Shanghai', 'Asia/Seoul', 'Asia/Mumbai', 'Asia/Singapore'] },
      { name: 'Australia', timezones: ['Australia/Sydney', 'Australia/Melbourne'] }
    ];
  }

  /**
   * Generate a realistic ISP fingerprint
   * @param {Object} options - Configuration options
   * @returns {Object} ISP fingerprint data
   */
  generateISPFingerprint(options = {}) {
    const { region = 'North America', customISP } = options;
    
    const isp = customISP || this.getRandomElement(this.commonISPs);
    const asn = this.generateASN();
    const organization = isp;
    
    // Generate realistic IP ranges based on ISP
    const ipRange = this.generateIPRange(isp);
    
    return {
      isp,
      asn,
      organization,
      ipRange,
      region,
      country: this.getCountryFromRegion(region),
      timezone: this.getRandomTimezone(region)
    };
  }

  /**
   * Generate a random MAC address with realistic vendor prefix
   * @param {Object} options - Configuration options
   * @returns {string} MAC address
   */
  generateMACAddress(options = {}) {
    const { vendor, format = 'colon' } = options;
    
    let prefix;
    if (vendor) {
      // Find prefix for specific vendor
      prefix = this.macVendorPrefixes.find(p => p.toLowerCase().includes(vendor.toLowerCase()));
    }
    
    if (!prefix) {
      prefix = this.getRandomElement(this.macVendorPrefixes);
    }
    
    // Generate random last 3 octets
    const suffix = Array.from({ length: 3 }, () => {
      return Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    }).join(':');
    
    const macAddress = `${prefix}:${suffix}`;
    
    // Format MAC address based on preference
    switch (format) {
      case 'dash':
        return macAddress.replace(/:/g, '-');
      case 'none':
        return macAddress.replace(/:/g, '');
      case 'colon':
      default:
        return macAddress;
    }
  }

  /**
   * Generate a realistic port number
   * @param {Object} options - Configuration options
   * @returns {number} Port number
   */
  generatePort(options = {}) {
    const { type = 'ephemeral', exclude = [] } = options;
    
    const range = this.commonPorts[type] || this.commonPorts.ephemeral;
    const [min, max] = range;
    
    let port;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      port = Math.floor(Math.random() * (max - min + 1)) + min;
      attempts++;
    } while (exclude.includes(port) && attempts < maxAttempts);
    
    return port;
  }

  /**
   * Generate network fingerprint for browser session
   * @param {Object} options - Configuration options
   * @returns {Object} Complete network fingerprint
   */
  generateNetworkFingerprint(options = {}) {
    const { region, customISP, vendor } = options;
    
    const ispInfo = this.generateISPFingerprint({ region, customISP });
    const macAddress = this.generateMACAddress({ vendor });
    const sourcePort = this.generatePort({ type: 'ephemeral' });
    const localIP = this.generateLocalIP();
    
    // Generate realistic connection characteristics
    const connectionType = this.getRandomElement(['cable', 'fiber', 'dsl', 'wireless']);
    const bandwidth = this.generateBandwidth(connectionType);
    const latency = this.generateLatency(connectionType, region);
    
    return {
      ...ispInfo,
      macAddress,
      sourcePort,
      localIP,
      connectionType,
      bandwidth,
      latency,
      fingerprint: this.generateFingerprintHash({
        isp: ispInfo.isp,
        mac: macAddress,
        port: sourcePort,
        ip: localIP
      })
    };
  }

  /**
   * Apply network fingerprint to Puppeteer page
   * @param {Object} page - Puppeteer page instance
   * @param {Object} fingerprint - Network fingerprint data
   */
  async applyFingerprintToPage(page, fingerprint) {
    try {
      // Override WebRTC to show consistent local IP
      await page.evaluateOnNewDocument((fp) => {
        // Override getUserMedia
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        navigator.mediaDevices.getUserMedia = function(constraints) {
          return Promise.reject(new Error('Permission denied'));
        };

        // Override RTCPeerConnection for IP spoofing
        const originalRTCPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = function(configuration) {
          const pc = new originalRTCPeerConnection(configuration);
          
          // Override createOffer to inject custom IP
          const originalCreateOffer = pc.createOffer;
          pc.createOffer = function(options) {
            return originalCreateOffer.call(this, options).then(offer => {
              // Modify SDP to include our fake local IP
              offer.sdp = offer.sdp.replace(
                /c=IN IP4 \d+\.\d+\.\d+\.\d+/g, 
                `c=IN IP4 ${fp.localIP}`
              );
              return offer;
            });
          };
          
          return pc;
        };

        // Override network information
        Object.defineProperty(navigator, 'connection', {
          value: {
            effectiveType: fp.connectionType === 'fiber' ? '4g' : '3g',
            downlink: fp.bandwidth.download / 1000, // Convert to Mbps
            rtt: fp.latency,
            saveData: false
          },
          writable: false
        });

        // Add ISP information to window object for debugging
        window.networkFingerprint = fp;
        
      }, fingerprint);

      // Set additional headers to simulate ISP characteristics
      await page.setExtraHTTPHeaders({
        'X-Forwarded-For': fingerprint.localIP,
        'X-Real-IP': fingerprint.localIP,
        'X-ISP': fingerprint.isp,
        'X-ASN': fingerprint.asn.toString()
      });

      console.log(`Applied network fingerprint: ISP=${fingerprint.isp}, MAC=${fingerprint.macAddress}, Port=${fingerprint.sourcePort}`);
      
    } catch (error) {
      console.error('Error applying network fingerprint:', error);
    }
  }

  /**
   * Get system's real network information for comparison
   * @returns {Object} Real network information
   */
  getRealNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const realInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      interfaces: {}
    };

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (addresses) {
        realInfo.interfaces[name] = addresses.map(addr => ({
          address: addr.address,
          netmask: addr.netmask,
          family: addr.family,
          mac: addr.mac,
          internal: addr.internal
        }));
      }
    }

    return realInfo;
  }

  // Helper methods
  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  generateASN() {
    // Generate realistic ASN (Autonomous System Number)
    return Math.floor(Math.random() * 65535) + 1;
  }

  generateIPRange(isp) {
    // Generate realistic IP range based on ISP
    const baseIP = Math.floor(Math.random() * 255);
    const subnet = Math.floor(Math.random() * 255);
    return `${baseIP}.${subnet}.0.0/16`;
  }

  generateLocalIP() {
    // Generate realistic local IP address
    const ranges = [
      [192, 168], // Most common home range
      [10, 0],    // Corporate range
      [172, 16]   // Less common private range
    ];
    
    const [first, second] = this.getRandomElement(ranges);
    const third = Math.floor(Math.random() * 255);
    const fourth = Math.floor(Math.random() * 254) + 1; // Avoid .0 and .255
    
    return `${first}.${second}.${third}.${fourth}`;
  }

  getCountryFromRegion(region) {
    const countryMap = {
      'North America': 'United States',
      'Europe': 'United Kingdom',
      'Asia Pacific': 'Japan',
      'Australia': 'Australia'
    };
    return countryMap[region] || 'United States';
  }

  getRandomTimezone(region) {
    const regionData = this.regions.find(r => r.name === region);
    return regionData ? this.getRandomElement(regionData.timezones) : 'America/New_York';
  }

  generateBandwidth(connectionType) {
    const bandwidthRanges = {
      fiber: { download: [100, 1000], upload: [50, 500] },
      cable: { download: [25, 300], upload: [5, 50] },
      dsl: { download: [5, 50], upload: [1, 10] },
      wireless: { download: [10, 100], upload: [2, 20] }
    };
    
    const range = bandwidthRanges[connectionType] || bandwidthRanges.cable;
    return {
      download: Math.floor(Math.random() * (range.download[1] - range.download[0]) + range.download[0]),
      upload: Math.floor(Math.random() * (range.upload[1] - range.upload[0]) + range.upload[0])
    };
  }

  generateLatency(connectionType, region) {
    const baseLatency = {
      fiber: [1, 10],
      cable: [10, 30],
      dsl: [20, 50],
      wireless: [30, 100]
    };
    
    const regionMultiplier = {
      'North America': 1,
      'Europe': 1.2,
      'Asia Pacific': 1.5,
      'Australia': 1.3
    };
    
    const range = baseLatency[connectionType] || baseLatency.cable;
    const multiplier = regionMultiplier[region] || 1;
    
    return Math.floor((Math.random() * (range[1] - range[0]) + range[0]) * multiplier);
  }

  generateFingerprintHash(data) {
    const combined = `${data.isp}-${data.mac}-${data.port}-${data.ip}`;
    return crypto.createHash('md5').update(combined).digest('hex');
  }
}

module.exports = FingerprintUtil;