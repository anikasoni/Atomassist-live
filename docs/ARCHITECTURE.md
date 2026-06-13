# Architecture

## High-Level System

```text
Agent Browser                        Customer Browser
React + mediasoup-client             React + mediasoup-client
Socket.IO Client                     Socket.IO Client
       |                                      |
       | REST + WebSocket signaling           |
       +------------------+-------------------+
                          |
                          v
                Node.js Express Backend
                          |
              +-----------+------------+
              |                        |
              v                        v
        PostgreSQL                 mediasoup SFU
        Prisma ORM                 Worker/Router
              |                        |
              v                        v
     Sessions, events, chat,       RTP media routing
     files, recordings
```

## Backend Responsibilities

- Authentication
- JWT validation
- Invite creation and validation
- Session lifecycle
- Participant lifecycle
- Socket.IO signaling
- mediasoup worker/router/transport management
- Chat persistence
- File upload/download
- Tab recording upload/download
- Metrics endpoint

## Frontend Responsibilities

- Agent dashboard
- Customer invite join
- Admin dashboard
- Call room UI
- Camera/microphone capture
- mediasoup-client send/receive transports
- Realtime chat
- File upload and download
- Tab recording capture
- Observability dashboard

## Session Lifecycle

```text
WAITING
  |
  | customer joins
  v
ACTIVE
  |
  | customer disconnects
  v
RECONNECTING participant state
  |
  | customer returns within 60 sec
  v
ACTIVE
  |
  | agent ends OR reconnect timeout expires
  v
ENDED
```

## Invite Lifecycle

```text
Agent creates session
  |
  v
Raw invite token returned once
  |
  v
Hash stored in DB
  |
  v
Customer uses invite
  |
  v
Customer JWT issued
  |
  v
Session ended
  |
  v
Invite returns 410 Gone
```

## Media Architecture

AtomAssist uses mediasoup as a self-hosted SFU.

```text
Agent camera/mic
  |
  v
mediasoup send transport
  |
  v
mediasoup router
  |
  v
mediasoup consumer
  |
  v
Customer browser

Customer camera/mic follows same path in reverse.
```

## Why SFU

- Avoids peer-to-peer mesh limitations
- Centralized routing
- Easier future recording/transcoding
- Better support for multi-party expansion
- Compliant with self-hosted requirement