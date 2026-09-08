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
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw build-essential ffmpeg

echo "🟢 [2/7] Installing Node.js 20 LTS & PM2..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

echo "📂 [3/7] Setting up project directory..."
mkdir -p /var/www
id -u annime >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin annime

if [ -d "$APP_DIR/.git" ]; then
  echo "Updating existing repository..."
  chown -R annime:annime "$APP_DIR"
  runuser -u annime -- git -C "$APP_DIR" pull origin main
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
TRUST_PROXY=1
EOF
  echo "✅ Created fresh .env.local with secure secrets."
else
  echo "ℹ️  Existing .env.local kept intact."
  grep -q '^TRUST_PROXY=' "$APP_DIR/.env.local" || echo 'TRUST_PROXY=1' >> "$APP_DIR/.env.local"
fi

echo "🔨 [5/7] Installing dependencies & building application..."
cd "$APP_DIR"
chown -R annime:annime "$APP_DIR"
chmod 600 "$APP_DIR/.env.local"
runuser -u annime -- npm ci
runuser -u annime -- node scripts/apply_security_migration.mjs
runuser -u annime -- npm run build

echo "⚡ [6/7] Configuring PM2 process manager..."
if pm2 delete annime 2>/dev/null; then
  pm2 save --force
fi
runuser -u annime -- pm2 delete annime 2>/dev/null || true
runuser -u annime -- pm2 delete annime-transcoder 2>/dev/null || true
runuser -u annime -- env TRANSCODE_WORKER_MODE=external pm2 start npm --name "annime" -- start -- --hostname 127.0.0.1
runuser -u annime -- env TRANSCODE_THREADS=2 pm2 start scripts/transcode-worker.js --name "annime-transcoder"
env PATH="$PATH" pm2 startup systemd -u annime --hp /home/annime 2>/dev/null || true
runuser -u annime -- pm2 save

cat > /etc/cron.d/annime-backup << CRON_BACKUP
15 3 * * * annime cd $APP_DIR && /usr/bin/node scripts/backup-database.js >> data/backup.log 2>&1
CRON_BACKUP
chmod 644 /etc/cron.d/annime-backup

echo "🌐 [7/7] Configuring Nginx Reverse Proxy..."
mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/annime-upload.conf << 'NGINX_UPLOAD'
proxy_pass http://127.0.0.1:3000;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_request_buffering off;
proxy_buffering off;
NGINX_UPLOAD
cat > /etc/nginx/sites-available/annime << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 64k;
    client_body_buffer_size 1M;
    client_body_timeout 1800s;
    client_header_timeout 1800s;
    proxy_connect_timeout 600s;
    proxy_send_timeout 1800s;
    proxy_read_timeout 1800s;
    send_timeout 1800s;

    location = /api/upload {
        client_max_body_size 24m;
        include /etc/nginx/snippets/annime-upload.conf;
    }
    location = /api/admin/upload-chunk {
        client_max_body_size 6m;
        include /etc/nginx/snippets/annime-upload.conf;
    }
    location = /api/admin/brand-intro {
        client_max_body_size 260m;
        include /etc/nginx/snippets/annime-upload.conf;
    }
    location = /api/admin/upload-video {
        client_max_body_size 10G;
        include /etc/nginx/snippets/annime-upload.conf;
    }

    # Old partial uploads must never be served as public files.
    location ~ ^/uploads/temp(/|$) {
        return 404;
    }

    # Protected videos and HLS must pass through application authorization.
    location ~ ^/uploads/(videos|hls|downloads)/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_request_buffering off;
        proxy_buffering off;
    }

    # Public artwork and brand intro only.
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

        client_max_body_size 64k;
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
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/annime /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/conf.d/upload_tuning.conf 2>/dev/null || true
rm -f /etc/nginx/conf.d/video_streaming.conf 2>/dev/null || true
nginx -t
systemctl restart nginx
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

# Firewall settings
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

echo ""
echo "=========================================================="
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=========================================================="
echo "Website is running on: https://$DOMAIN"
if [ -f "$APP_DIR/data/admin-bootstrap.txt" ]; then
  echo "Initial admin credentials are stored privately in $APP_DIR/data/admin-bootstrap.txt."
  echo "Delete that file after changing the password."
else
  echo "Existing admin credentials were preserved."
fi
echo "=========================================================="
