# LinkedIn Automation Tool

A comprehensive LinkedIn automation system with advanced anti-detection measures, reCAPTCHA solving capabilities, and robust session management. Built for production deployment on Linux servers.

![LinkedIn Automation](https://img.shields.io/badge/LinkedIn-Automation-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-ISC-yellow)

## 🚀 Features

- **LinkedIn Login Automation**: Automated login with human-like behavior simulation
- **reCAPTCHA Handling**: Multiple solving methods (manual, hybrid, automated via 2captcha)
- **Anti-Detection**: Advanced fingerprinting and browser stealth techniques
- **Proxy Support**: Built-in proxy authentication and rotation
- **Session Management**: Persistent sessions with automatic cleanup
- **Debug Capabilities**: Comprehensive logging and artifact capture
- **Real-time Monitoring**: Server-Sent Events for live automation feedback
- **Security Verification**: Handles LinkedIn 2FA, SMS, and email verification
- **Headless Operation**: Production-ready headless browser automation

## 📋 Prerequisites

- **Node.js 18+** (recommended: Node.js 20 LTS)
- **Linux Server** (Ubuntu 20.04+ recommended)
- **Chrome/Chromium** dependencies
- **2captcha API Key** (for automated reCAPTCHA solving)

## 🛠 Linux Server Installation

### Step 1: Update System and Install Dependencies

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
sudo apt install git -y

# Install Chrome dependencies
sudo apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    libatspi2.0-0 \
    libgtk-3-0
```

### Step 2: Install Google Chrome

```bash
# Download and install Google Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install google-chrome-stable -y

# Verify installation
google-chrome --version
```

### Step 3: Clone and Setup Project

```bash
# Create project directory
sudo mkdir -p /var/www/linkedin-automation
sudo chown $USER:$USER /var/www/linkedin-automation
cd /var/www/linkedin-automation

# Clone the repository
git clone https://github.com/cruxalex039/linkedinfile.git .

# Install Node.js dependencies
npm install

# Install additional production dependencies
npm install pm2 -g
```

### Step 4: Configure Environment Variables

```bash
# Copy and edit environment configuration
cp .env .env.backup
nano .env
```

Configure the following environment variables in `.env`:

```properties
# Server Configuration
PORT=3000
NODE_ENV=production

# Telegram Configuration (for notifications)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# 2captcha Configuration (for automated reCAPTCHA solving)
TWOCAPTCHA_API_KEY=your_2captcha_api_key

# reCAPTCHA Configuration
LINKEDIN_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
LINKEDIN_RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# Enable automated reCAPTCHA solving (optional)
ENABLE_AUTO_RECAPTCHA=true

# Puppeteer Configuration
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

### Step 5: Setup PM2 Process Manager

```bash
# Create PM2 ecosystem configuration
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'linkedin-automation',
    script: 'server2.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start the application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by the startup command
```

### Step 6: Configure Nginx (Optional)

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo cat > /etc/nginx/sites-available/linkedin-automation << EOF
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/linkedin-automation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Setup SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d your_domain.com

# Test SSL renewal
sudo certbot renew --dry-run
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (production/development) | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for notifications | Yes |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for notifications | Yes |
| `TWOCAPTCHA_API_KEY` | 2captcha API key for automated solving | Yes |
| `LINKEDIN_RECAPTCHA_SITE_KEY` | reCAPTCHA site key | No |
| `LINKEDIN_RECAPTCHA_SECRET_KEY` | reCAPTCHA secret key | No |
| `ENABLE_AUTO_RECAPTCHA` | Enable automated reCAPTCHA solving | No |

### Required API Keys

1. **2captcha API Key**: Sign up at [2captcha.com](https://2captcha.com) for automated reCAPTCHA solving
2. **Telegram Bot**: Create a bot via [@BotFather](https://t.me/botfather) for notifications

## 📱 Usage

### Web Interface

1. Access the application: `http://your_server_ip:3000`
2. Complete reCAPTCHA verification
3. Navigate to `/login.html` for LinkedIn automation

### API Endpoints

- **POST** `/api/linkedin/login` - Start LinkedIn login automation
- **POST** `/api/linkedin/check-login-status` - Check automation status
- **POST** `/api/linkedin/verify-code` - Submit verification codes
- **GET** `/api/recaptcha-info/:sessionId` - Get reCAPTCHA information
- **GET** `/events?sessionId=xxx` - Server-Sent Events for real-time updates

### Session Management

```bash
# Check running sessions
pm2 status

# View logs
pm2 logs linkedin-automation

# Restart application
pm2 restart linkedin-automation

# Stop application
pm2 stop linkedin-automation
```

## 🔍 Debugging

### Debug Endpoints

- **GET** `/debug/sessions` - View active sessions
- **GET** `/debug/list?sessionId=xxx` - List debug artifacts
- **GET** `/debug/download?file=xxx` - Download debug files

### Log Files

```bash
# PM2 logs
pm2 logs linkedin-automation

# System logs
sudo journalctl -u nginx -f

# Application logs
tail -f /var/www/linkedin-automation/logs/app.log
```

## 🛡️ Security Considerations

1. **Firewall Configuration**:
```bash
# Configure UFW firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Regular Updates**:
```bash
# Update dependencies
npm audit fix

# Update system
sudo apt update && sudo apt upgrade -y
```

3. **Monitoring**:
```bash
# Setup log rotation
sudo logrotate -d /etc/logrotate.conf

# Monitor resources
htop
```

## 📂 Project Structure

```
linkedin-automation/
├── server2.js              # Main application server
├── package.json             # Node.js dependencies
├── .env                     # Environment configuration
├── utils/                   # Utility modules
│   ├── LinkedInRecaptchaUtil.js
│   └── FingerprintCookieManager.js
├── views/                   # HTML templates
├── public/                  # Static files
├── cookies/                 # Session cookies storage
├── debug/                   # Debug artifacts
├── fingerprint-profiles/    # Browser fingerprint profiles
└── routes/                  # API routes
```

## 🔧 Troubleshooting

### Common Issues

1. **Chrome Binary Not Found**:
```bash
# Set correct Chrome path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

2. **Permission Issues**:
```bash
# Fix directory permissions
sudo chown -R $USER:$USER /var/www/linkedin-automation
```

3. **Memory Issues**:
```bash
# Increase system memory or add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

4. **2captcha API Issues**:
```bash
# Test API key
curl -X POST https://2captcha.com/in.php \
  -d "method=userrecaptcha" \
  -d "googlekey=test" \
  -d "pageurl=http://test.com" \
  -d "key=YOUR_API_KEY"
```

## 📄 License

ISC License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review debug logs and artifacts

---

**⚠️ Disclaimer**: This tool is for educational and legitimate automation purposes only. Ensure compliance with LinkedIn's Terms of Service and applicable laws.

## 🔗 Links

- [2captcha.com](https://2captcha.com) - Automated reCAPTCHA solving service
- [Telegram Bot API](https://core.telegram.org/bots/api) - Bot creation and management
- [PM2 Documentation](https://pm2.keymetrics.io/docs/) - Process manager documentation 
