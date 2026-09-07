#!/bin/bash
# ==============================================================================
# Anime Zone (hindianimezone.fun) - 1-Click VPS Auto-Installer
# Supported OS: Ubuntu 20.04 / 22.04 / 24.04, Debian 11 / 12
# ==============================================================================

set -e

DOMAIN="hindianimezone.fun"
APP_DIR="/var/www/annime"
REPO_URL="https://github.com/anoopmauryadev/annime.git"

echo "=========================================================="
echo "🚀 Starting 1-Click Installation for $DOMAIN"
echo "=========================================================="

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root: sudo bash setup.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "📦 [1/7] Updating system & installing essential tools..."
apt-get update -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw build-essential

echo "🟢 [2/7] Installing Node.js 20 LTS & PM2..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

echo "📂 [3/7] Setting up project directory..."
mkdir -p /var/www

if [ -d "$APP_DIR/.git" ]; then
  echo "Updating existing repository..."
  cd "$APP_DIR"
  git pull origin main
else
  if [ -d "$APP_DIR" ] && [ ! -d "$APP_DIR/.git" ]; then
    echo "Directory exists without git. Backing up..."
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%s)"
  fi
  echo "Cloning repository from GitHub..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

mkdir -p "$APP_DIR/data"
mkdir -p "$APP_DIR/public/uploads"

echo "🔐 [4/7] Generating production environment (.env.local)..."
if [ ! -f "$APP_DIR/.env.local" ]; then
  ADMIN_SECRET=$(openssl rand -hex 32)
  USER_SECRET=$(openssl rand -hex 32)

  cat > "$APP_DIR/.env.local" << EOF
# Production Secrets (Generated automatically)
ADMIN_SECRET_KEY=$ADMIN_SECRET
USER_SECRET_KEY=$USER_SECRET

# Site Config
NEXT_PUBLIC_VIDEO_BASE_URL=https://$DOMAIN
NEXT_PUBLIC_SITE_NAME=Anime Zone India
NEXT_PUBLIC_SITE_URL=https://$DOMAIN

# Environment
NODE_ENV=production
EOF
  echo "✅ Created fresh .env.local with secure secrets."
else
  echo "ℹ️  Existing .env.local kept intact."
fi

echo "🔨 [5/7] Installing dependencies & building application..."
cd "$APP_DIR"
npm install
npm run build

echo "⚡ [6/7] Configuring PM2 process manager..."
pm2 delete annime 2>/dev/null || true
pm2 start npm --name "annime" -- start
pm2 startup systemd -u root --hp /root 2>/dev/null || true
pm2 save

echo "🌐 [7/7] Configuring Nginx Reverse Proxy..."
cat > /etc/nginx/sites-available/annime << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 10G;

    client_max_body_size 10G;
    client_body_buffer_size 1M;
    client_body_timeout 1800s;
    client_header_timeout 1800s;
    proxy_connect_timeout 600s;
    proxy_send_timeout 1800s;
    proxy_read_timeout 1800s;
    send_timeout 1800s;

    # Direct static streaming for uploads (Videos, HLS m3u8/ts, Images)
    location /uploads/ {
        alias $APP_DIR/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
        add_header Access-Control-Allow-Headers "*";
        sendfile on;
        sendfile_max_chunk 1m;
        tcp_nopush on;
        tcp_nodelay on;

        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
            video/mp4 mp4;
            video/webm webm;
            video/x-matroska mkv;
            image/jpeg jpg jpeg;
            image/png png;
            image/webp webp;
            image/gif gif;
        }
    }

    # Video & Media Upload endpoint with unbuffered streaming
    location /api/admin/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        client_max_body_size 10G;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_read_timeout 1800s;
        proxy_send_timeout 1800s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/annime /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/conf.d/upload_tuning.conf 2>/dev/null || true
rm -f /etc/nginx/conf.d/video_streaming.conf 2>/dev/null || true
nginx -t
systemctl restart nginx

# Firewall settings
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

echo ""
echo "=========================================================="
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=========================================================="
echo "Website is running on: http://$DOMAIN"
echo ""
echo "🔒 Next Step (SSL / HTTPS):"
echo "Make sure your domain DNS (A record) points to this VPS IP."
echo "Then simply run this command for free HTTPS SSL:"
echo "    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect"
echo ""
echo "🔑 Default Admin Login:"
echo "URL: http://$DOMAIN/admin/login"
echo "User: admin"
echo "Pass: admin123"
echo "=========================================================="
