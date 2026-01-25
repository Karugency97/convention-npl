#!/bin/bash

# Convention NPL - Initial VPS Setup Script for Hostinger
# Run this once on a fresh Ubuntu VPS
# Usage: curl -sSL https://raw.githubusercontent.com/.../setup-vps.sh | bash

set -e

echo "=== Convention NPL - VPS Initial Setup ==="

# Update system
echo "Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
echo "Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Install Certbot for SSL
echo "Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Install PostgreSQL
echo "Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Install Puppeteer dependencies
echo "Installing Puppeteer dependencies..."
sudo apt install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# Create app directory
echo "Creating app directory..."
sudo mkdir -p /var/www/convention-npl
sudo chown -R $USER:$USER /var/www/convention-npl

# Setup PostgreSQL
echo "Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE USER npl_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE npl_convention OWNER npl_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE npl_convention TO npl_user;"

# Configure firewall
echo "Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

# Setup PM2 to start on boot
pm2 startup systemd -u $USER --hp /home/$USER

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Clone your repository: git clone https://github.com/Karugency97/convention-npl.git /var/www/convention-npl"
echo "2. Copy .env.production.example to .env and configure"
echo "3. Configure Nginx: sudo cp nginx/convention-npl.conf /etc/nginx/sites-available/"
echo "4. Enable site: sudo ln -s /etc/nginx/sites-available/convention-npl.conf /etc/nginx/sites-enabled/"
echo "5. Get SSL certificate: sudo certbot --nginx -d votre-domaine.com -d api.votre-domaine.com"
echo "6. Run deployment: ./scripts/deploy.sh"
echo ""
echo "PostgreSQL credentials:"
echo "  Database: npl_convention"
echo "  User: npl_user"
echo "  Password: CHANGE_THIS_PASSWORD (change this!)"
