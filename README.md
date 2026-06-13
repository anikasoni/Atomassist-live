
# AtomAssist Live

Self-hosted real-time video support platform for customer support teams.

## Current Phase

Phase 1: Monorepo scaffold.

Implemented:

* React + Vite + TypeScript frontend
* Express + TypeScript backend
* Shared TypeScript package
* PostgreSQL Docker Compose setup
* Health check endpoint

Not implemented yet:

* Prisma/database models
* Authentication
* Session APIs
* Socket.IO
* mediasoup SFU WebRTC
* Chat
* Recording
* Admin dashboard

## Tech Stack

Frontend:

* React
* Vite
* TypeScript
* Tailwind CSS

Backend:

* Node.js
* Express
* TypeScript

Monorepo:

* pnpm workspaces

Database:

* PostgreSQL through Docker Compose

Future media layer:

* mediasoup SFU for server-routed WebRTC

## Setup

```bash
pnpm install
```

## Run Development

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

Expected response:

```json
{
  "status": "ok",
  "service": "atomassist-server"
}
```

## Important Hackathon Constraint

This project must not use peer-to-peer WebRTC or hosted video APIs like Twilio, Agora, Daily, Vonage, Jitsi hosted, or LiveKit Cloud.

Media will be routed through our own server using mediasoup SFU in a later phase.
