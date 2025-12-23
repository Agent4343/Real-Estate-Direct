# Deployment Guide

This guide covers deploying Real Estate Direct to production environments.

## Prerequisites

- Node.js 18.0.0 or higher
- MongoDB 5.0 or higher
- npm or yarn
- SSL certificate (for production)

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/real-estate-direct

# Authentication
JWT_SECRET=your-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d

# Stripe (Payment Processing)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email (Optional - for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
EMAIL_FROM=noreply@realestatedirect.ca

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start MongoDB:
```bash
mongod
```

3. Run development server:
```bash
npm run dev
```

4. Access at http://localhost:3000

## Production Deployment

### Option 1: Traditional Server (VPS/Cloud VM)

1. **Prepare the server**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
# Follow MongoDB installation guide for your OS

# Install PM2 (process manager)
sudo npm install -g pm2
```

2. **Clone and setup**:
```bash
git clone https://github.com/your-repo/real-estate-direct.git
cd real-estate-direct
npm install --production
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with production values
nano .env
```

4. **Start with PM2**:
```bash
pm2 start app.js --name "real-estate-direct"
pm2 save
pm2 startup
```

5. **Setup Nginx reverse proxy**:
```nginx
server {
    listen 80;
    server_name realestatedirect.ca www.realestatedirect.ca;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name realestatedirect.ca www.realestatedirect.ca;

    ssl_certificate /etc/letsencrypt/live/realestatedirect.ca/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/realestatedirect.ca/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Option 2: Docker Deployment

1. **Build Docker image**:
```bash
docker build -t real-estate-direct .
```

2. **Run with Docker Compose**:
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/real-estate-direct
    depends_on:
      - mongo
    restart: always

  mongo:
    image: mongo:5
    volumes:
      - mongodb_data:/data/db
    restart: always

volumes:
  mongodb_data:
```

```bash
docker-compose up -d
```

### Option 3: Platform-as-a-Service

#### Heroku

1. Install Heroku CLI and login
2. Create app:
```bash
heroku create real-estate-direct
```

3. Add MongoDB:
```bash
heroku addons:create mongolab:sandbox
```

4. Set environment variables:
```bash
heroku config:set JWT_SECRET=your-secret
heroku config:set STRIPE_SECRET_KEY=sk_live_xxx
```

5. Deploy:
```bash
git push heroku main
```

#### Railway

1. Connect GitHub repository
2. Add MongoDB service
3. Set environment variables in dashboard
4. Deploy automatically on push

#### Render

1. Create new Web Service
2. Connect repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add MongoDB (or use MongoDB Atlas)

## Database Setup

### MongoDB Atlas (Recommended for Production)

1. Create account at mongodb.com/atlas
2. Create new cluster (M10 or higher for production)
3. Add database user
4. Whitelist IP addresses
5. Get connection string and update `MONGODB_URI`

### Database Indexes

Run these in MongoDB shell for optimal performance:

```javascript
// User indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ resetPasswordToken: 1 });

// Property indexes
db.properties.createIndex({ "address.province": 1, status: 1 });
db.properties.createIndex({ askingPrice: 1 });
db.properties.createIndex({ createdAt: -1 });
db.properties.createIndex({ seller: 1 });

// Transaction indexes
db.transactions.createIndex({ buyer: 1 });
db.transactions.createIndex({ seller: 1 });
db.transactions.createIndex({ status: 1 });

// Message indexes
db.messages.createIndex({ conversation: 1, createdAt: -1 });
db.conversations.createIndex({ participants: 1 });

// Document indexes
db.documents.createIndex({ createdBy: 1 });
db.documents.createIndex({ transaction: 1 });
```

## Stripe Webhook Setup

1. In Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

## SSL/TLS Certificate

### Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d realestatedirect.ca -d www.realestatedirect.ca

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

## Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs real-estate-direct

# Monitor resources
pm2 monit

# View status
pm2 status
```

### Health Check Endpoint

The app exposes a health check at `GET /api/health`:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "version": "2.0.0",
  "service": "Real Estate Direct"
}
```

## Backup Strategy

### Database Backup

```bash
# Manual backup
mongodump --uri="$MONGODB_URI" --out=/backups/$(date +%Y%m%d)

# Automated backup (cron)
0 2 * * * mongodump --uri="$MONGODB_URI" --out=/backups/$(date +\%Y\%m\%d) --gzip
```

### File Backup

Backup the `uploads` and `generated-documents` directories:

```bash
tar -czf /backups/files_$(date +%Y%m%d).tar.gz uploads/ generated-documents/
```

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure JWT secret (32+ characters)
- [ ] Enable rate limiting (already configured)
- [ ] Configure CORS for your domain
- [ ] Use environment variables for secrets
- [ ] Enable Helmet security headers (already configured)
- [ ] Regular security updates (`npm audit fix`)
- [ ] Database authentication enabled
- [ ] Firewall configured (only ports 80, 443, 22)

## Scaling

### Horizontal Scaling

1. Add load balancer (Nginx, HAProxy, or cloud LB)
2. Run multiple app instances
3. Use MongoDB replica set
4. Session storage with Redis (if needed)

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Use faster storage (SSD/NVMe)
- Optimize MongoDB queries

## Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Check MongoDB is running
- Verify connection string
- Check firewall rules

**Stripe Webhooks Not Working**
- Verify webhook secret
- Check endpoint URL
- Review Stripe dashboard logs

**File Uploads Failing**
- Check `UPLOAD_DIR` exists and writable
- Verify `MAX_FILE_SIZE` setting
- Check disk space

### Logs

```bash
# Application logs (PM2)
pm2 logs real-estate-direct --lines 100

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-repo/real-estate-direct/issues
- Email: support@realestatedirect.ca
