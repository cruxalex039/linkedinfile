#!/bin/bash

# LinkedIn Automation - Linux Installation Script
# ================================================

echo "LinkedIn Automation - Linux Installation Script"
echo "==============================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons."
   print_status "Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y
if [ $? -eq 0 ]; then
    print_success "System updated successfully"
else
    print_error "Failed to update system"
    exit 1
fi

# Install Node.js 20 LTS
print_status "Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
if [ $? -eq 0 ]; then
    print_success "Node.js installed successfully"
    node --version
    npm --version
else
    print_error "Failed to install Node.js"
    exit 1
fi

# Install Git
print_status "Installing Git..."
sudo apt install git -y
if [ $? -eq 0 ]; then
    print_success "Git installed successfully"
else
    print_error "Failed to install Git"
    exit 1
fi

# Install Chrome dependencies
print_status "Installing Chrome dependencies..."
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
if [ $? -eq 0 ]; then
    print_success "Chrome dependencies installed successfully"
else
    print_error "Failed to install Chrome dependencies"
    exit 1
fi

# Install Google Chrome
print_status "Installing Google Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install google-chrome-stable -y
if [ $? -eq 0 ]; then
    print_success "Google Chrome installed successfully"
    google-chrome --version
else
    print_error "Failed to install Google Chrome"
    exit 1
fi

# Install PM2 globally
print_status "Installing PM2 process manager..."
sudo npm install pm2 -g
if [ $? -eq 0 ]; then
    print_success "PM2 installed successfully"
else
    print_error "Failed to install PM2"
    exit 1
fi

# Create project directory
PROJECT_DIR="/var/www/linkedin-automation"
print_status "Creating project directory at $PROJECT_DIR..."
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# Clone repository
print_status "Cloning LinkedIn automation repository..."
cd $PROJECT_DIR
git clone https://github.com/cruxalex039/linkedinfile.git .
if [ $? -eq 0 ]; then
    print_success "Repository cloned successfully"
else
    print_error "Failed to clone repository"
    exit 1
fi

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create environment file
print_status "Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_warning "Environment file created from template"
    print_warning "Please edit .env file with your actual API keys and configuration"
    print_status "You can edit it with: nano $PROJECT_DIR/.env"
fi

# Create logs directory
mkdir -p logs

# Set permissions
sudo chown -R $USER:$USER $PROJECT_DIR

print_success "Installation completed successfully!"
echo ""
echo "Next steps:"
echo "==========="
echo "1. Edit the environment file:"
echo "   nano $PROJECT_DIR/.env"
echo ""
echo "2. Configure your API keys in the .env file:"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - TELEGRAM_CHAT_ID" 
echo "   - TWOCAPTCHA_API_KEY"
echo ""
echo "3. Start the application:"
echo "   cd $PROJECT_DIR"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "4. Save PM2 configuration:"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. Access the application:"
echo "   http://your-server-ip:3000"
echo ""
print_warning "Remember to configure your firewall and reverse proxy if needed!"
echo ""
print_success "Happy automating! 🚀"