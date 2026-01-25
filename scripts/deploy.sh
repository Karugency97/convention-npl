#!/bin/bash

# Convention NPL - Deployment Script for Hostinger VPS
# Usage: ./scripts/deploy.sh

set -e

echo "=== Convention NPL Deployment ==="

# Variables
APP_DIR="/var/www/convention-npl"
BACKEND_DIR="$APP_DIR"
FRONTEND_DIR="$APP_DIR/frontend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}1. Pulling latest code...${NC}"
cd $APP_DIR
git pull origin main

echo -e "${YELLOW}2. Installing backend dependencies...${NC}"
npm ci --production=false

echo -e "${YELLOW}3. Building backend...${NC}"
npm run build

echo -e "${YELLOW}4. Running database migrations...${NC}"
npx prisma migrate deploy

echo -e "${YELLOW}5. Installing frontend dependencies...${NC}"
cd $FRONTEND_DIR
npm ci

echo -e "${YELLOW}6. Building frontend...${NC}"
npm run build

echo -e "${YELLOW}7. Restarting backend with PM2...${NC}"
cd $APP_DIR
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Status:"
pm2 status
