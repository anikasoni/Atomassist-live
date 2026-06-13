# AtomAssist Live

AtomAssist Live is a self-hosted real-time video support platform for customer support teams.

It provides secure support sessions where agents can invite customers into a browser-based video call, chat in real time, share files, recover from short disconnects, record the session tab as an MVP, and monitor system metrics through an admin dashboard.

## Hackathon Compliance

AtomAssist does not use hosted video APIs such as Twilio, Agora, Daily, Vonage, LiveKit Cloud, or Jitsi hosted services.

Audio/video is routed through a self-hosted open-source SFU using mediasoup inside our own Node.js backend.

## Core Features

- Agent and admin login
- Role-aware protected routes
- Secure invite links
- Customer join flow
- Self-hosted mediasoup SFU video/audio calls
- Socket.IO realtime presence
- 60-second customer reconnect window
- Agent-controlled session ending
- Expiring invite links after session end
- Realtime chat
- File sharing in chat
- Session history
- Browser tab recording MVP
- Admin dashboard
- Human-friendly observability dashboard
- Prometheus-compatible `/metrics` endpoint
- PostgreSQL persistence with Prisma

## Tech Stack

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Socket.IO Client
- mediasoup-client

### Backend

- Node.js
- Express
- TypeScript
- Socket.IO
- mediasoup
- Prisma
- PostgreSQL
- JWT authentication
- multer file uploads
- prom-client metrics

### Infrastructure

- pnpm workspaces
- Docker Compose for PostgreSQL

## Architecture

```text
Customer Browser
  |
  | HTTPS / WebSocket / WebRTC
  v
React + Socket.IO Client + mediasoup-client
  |
  | REST APIs + Socket.IO signaling
  v
Node.js Express Backend
  |
  | Prisma
  v
PostgreSQL

Node.js Backend
  |
  | mediasoup worker/router/transports
  v
Self-hosted SFU media routing
```

## Demo Credentials

Agent:

```text
agent@demo.com
demo123
```

Admin:

```text
admin@demo.com
demo123
```

## Local Setup

Install dependencies:

```bash
pnpm install
```

Start PostgreSQL:

```bash
docker compose up -d
```

Run database migration:

```bash
pnpm --filter @atomassist/server prisma:migrate
```

Generate Prisma client:

```bash
pnpm --filter @atomassist/server prisma:generate
```

Run development servers:

```bash
pnpm dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:4000
```

Health check:

```bash
curl.exe http://localhost:4000/health
```

Metrics:

```text
http://localhost:4000/metrics
```

Admin observability UI:

```text
http://localhost:5173/admin/observability
```

## Environment

Backend environment file:

```text
apps/server/.env
```

Important media config for same-laptop testing:

```env
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100
```

For testing from another device on the same Wi-Fi, set `MEDIASOUP_ANNOUNCED_IP` to the host machine LAN IP, for example:

```env
MEDIASOUP_ANNOUNCED_IP=192.168.29.9
```

Then restart:

```bash
pnpm dev
```

## Recording Note

The current recording feature is a browser tab recording MVP. The agent selects the AtomAssist tab/window, records it using the browser MediaRecorder API, and uploads the final `.webm` recording to the backend.

Production-grade SFU-side recording would require server-side RTP consumption from mediasoup and muxing/composition through FFmpeg or GStreamer.

## What Makes This Project Strong

- Self-hosted SFU instead of peer-to-peer or hosted APIs
- Real session lifecycle management
- Secure role-based access
- Customer reconnect handling
- Persistent history for events, chat, files, and recordings
- Admin observability
- Clear production upgrade path