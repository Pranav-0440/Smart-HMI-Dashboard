# 🚀 EV-HMI Platform — Deployment Guide

This guide covers all options for deploying the **Smart EV HMI Dashboard & Digital Twin Platform**.

---

## 📋 Architecture Overview

The system consists of two primary services:
1. **Frontend**: React + Vite + TypeScript (Single Page App)
2. **Digital Twin**: Python (FastAPI + Uvicorn + WebSockets on port 8000)

---

## 🐳 Option 1: Docker Compose (Recommended for Local / VPS / AWS EC2)

Deploy both services with a single command on any server or machine with Docker installed.

### 1. Build and Run:
```bash
docker compose up -d --build
```

### 2. Access the Application:
- **HMI Dashboard**: [http://localhost](http://localhost) (or `http://your-server-ip`)
- **Digital Twin API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Real-Time WebSocket Feed**: `ws://localhost/ws/vehicle` (Reverse-proxied via Nginx)

### 3. Stop:
```bash
docker compose down
```

---

## ☁️ Option 2: Cloud Deployment (Render / Railway / Fly.io)

### A. Deploying the Python Digital Twin (Backend)
1. Sign in to [Render](https://render.com) or [Railway](https://railway.app).
2. Create a **New Web Service** pointing to your repository.
3. Set the **Root Directory**: `digital-twin`
4. Set the **Runtime**: `Python 3` (or Docker)
5. Set the **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```
6. Set the **Start Command**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
7. Copy your deployed backend URL (e.g. `https://ev-digital-twin.onrender.com`).

### B. Deploying the React HMI Frontend (Vercel / Netlify / Cloudflare Pages)
1. Sign in to [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
2. Connect your Git repository.
3. Set the **Root Directory**: `frontend`
4. Set the **Build Command**: `npm run build`
5. Set the **Output Directory**: `dist`
6. Add **Environment Variables**:
   - `VITE_API_URL`: `https://ev-digital-twin.onrender.com/api`
   - `VITE_WS_URL`: `wss://ev-digital-twin.onrender.com/ws/vehicle`
7. Click **Deploy**.

---

## 🖥️ Option 3: Manual Production Setup on Linux VPS (Ubuntu / Debian)

### 1. Set Up Python Digital Twin with Systemd:
Create `/etc/systemd/system/digital-twin.service`:
```ini
[Unit]
Description=EV Digital Twin FastAPI Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/Smart-HMI-Dashboard/digital-twin
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now digital-twin
```

### 2. Build Frontend:
```bash
cd /var/www/Smart-HMI-Dashboard/frontend
npm install
npm run build
```

### 3. Configure Nginx (`/etc/nginx/sites-available/ev-hmi`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    location / {
        root /var/www/Smart-HMI-Dashboard/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # REST API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```
Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/ev-hmi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
