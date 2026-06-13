# AtomAssist Live

<p align="center">
  <strong>Self-hosted real-time video support platform with SFU media routing, secure session invites, realtime chat, file sharing, recording artifacts, admin monitoring, and support-case review.</strong>
</p>

<p align="center">
  <em>Built for a 15-hour hackathon as a production-aware WebRTC support system.</em>
</p>

---

## Executive Summary

AtomAssist Live is a browser-based customer support platform where an agent can create a secure video support session, invite a customer through a link, communicate over realtime video/chat, share files, handle reconnects, record session artifacts, and review the completed case.

The core technical decision is that media is routed through a **self-hosted mediasoup SFU** running inside our own backend infrastructure. AtomAssist does **not** use hosted video APIs such as Twilio, Agora, Daily, Vonage, LiveKit Cloud, or hosted Jitsi.

The project focuses on the complete product layer around WebRTC, not only the call itself:

* session creation,
* secure invite flow,
* customer join experience,
* SFU-routed media,
* realtime signaling,
* chat and file artifacts,
* reconnect handling,
* session expiry,
* recordings,
* support-case history,
* admin monitoring,
* and observability.

---

## Demo Credentials

### Agent

```text
Email: agent@demo.com
Password: demo123
```

### Admin

```text
Email: admin@demo.com
Password: demo123
```

### Customer

Customers join through a generated invite link. No predefined customer account is required.

---

## Quick Demo Flow

Recommended 2–3 minute evaluation flow:

1. Open the agent dashboard.
2. Create a new support session.
3. Open the generated customer invite link in another browser.
4. Join as a customer.
5. Show both participants inside the live support room.
6. Send realtime chat messages.
7. Upload and download a file.
8. Show tab recording and server recording controls.
9. End the session.
10. Open session history and review the case record.
11. Open admin dashboard.
12. Open observability dashboard.

---

## Screenshots

> Place screenshots inside `docs/screenshots/` using the names below.

### 1. Agent Dashboard

![Agent Dashboard](docs/screenshots/01-agent-dashboard.png)

Agents can create support sessions, manage active sessions, and inspect previous session history.

### 2. Admin Dashboard

![Admin Dashboard](docs/screenshots/02-admin-dashboard.png)

Admins can monitor all sessions, session status distribution, participants, events, chat counts, and session history.

### 3. Live Video Support Room

![Live Video Support Room](docs/screenshots/03-live-call-agent.png)

The live room combines SFU video, realtime chat, file sharing, participant presence, recording controls, and session lifecycle actions.

### 4. Customer Call Experience

![Customer Call Experience](docs/screenshots/04-live-call-customer.png)

Customers join directly through a secure browser invite link without installing any app.

### 5. Session History and Case Review

![Session History Review](docs/screenshots/05-session-history-review.png)

Completed or active sessions are reviewable as support cases with duration, participants, timeline, chat, files, recordings, and review notes.

### 6. Observability Dashboard

![Observability Dashboard](docs/screenshots/06-observability.png)

Operational metrics are exposed through a human-friendly dashboard and a raw Prometheus-compatible endpoint.

### 7. Recording Architecture

![Recording Architecture](docs/screenshots/07-recording-plan.png)

Recording support includes a stable tab-recording MVP and an experimental server-side SFU recording path.

---

## What Was Built

| Area                 | Capability                                   | Status      |
| -------------------- | -------------------------------------------- | ----------- |
| Authentication       | Agent/admin login                            | Implemented |
| Authorization        | Role-aware frontend and backend access       | Implemented |
| Session Management   | Agent-created support sessions               | Implemented |
| Invite Flow          | Customer joins through generated secure link | Implemented |
| Video Infrastructure | Self-hosted mediasoup SFU                    | Implemented |
| Realtime Layer       | Socket.IO signaling and presence             | Implemented |
| Communication        | Realtime chat                                | Implemented |
| Artifacts            | File upload and download                     | Implemented |
| Resilience           | 60-second customer reconnect window          | Implemented |
| Lifecycle            | Agent-controlled session ending              | Implemented |
| Security             | Invite expiry after session end              | Implemented |
| History              | Session timeline and persisted records       | Implemented |
| Review               | Resolution status and review notes           | Implemented |
| Recording            | Browser tab recording MVP                    | Implemented |
| Recording Spike      | Experimental server-side SFU recording       | Implemented |
| Admin                | Global session monitoring dashboard          | Implemented |
| Observability        | Metrics dashboard and `/metrics` endpoint    | Implemented |

---

## Requirement Coverage

### Core Requirements

| Requirement                           | AtomAssist Implementation                                       |
| ------------------------------------- | --------------------------------------------------------------- |
| Browser-based support session         | Customer joins directly through invite link                     |
| Agent can create session              | Agent dashboard provides session creation                       |
| Customer can join without app install | Browser-only customer flow                                      |
| Working realtime video/audio          | mediasoup SFU-routed call room                                  |
| No hosted video APIs                  | No Twilio, Agora, Daily, Vonage, LiveKit Cloud, or hosted Jitsi |
| Self-hosted media infrastructure      | mediasoup worker/router runs in backend                         |
| Session lifecycle                     | Waiting, active, reconnecting, ended                            |
| Invite expiry                         | Ended sessions reject new joins                                 |
| Persistent records                    | Events, participants, chat, files, recordings, review notes     |
| Documentation                         | README, architecture notes, production notes, demo script       |

### Additional Product Features

| Feature             | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| Realtime chat       | Socket.IO-based chat persisted to session history             |
| File sharing        | Files can be uploaded, downloaded, and reviewed later         |
| Reconnect handling  | Customer disconnects do not immediately terminate the session |
| Case review         | Agents/admins can save resolution status and notes            |
| Call duration       | Session history shows call duration                           |
| Admin dashboard     | Admins can monitor sessions and inspect history               |
| Observability       | Human-friendly dashboard plus Prometheus-compatible metrics   |
| Recording artifacts | Stable tab recording and experimental SFU-side recording path |

---

## Technical Differentiators

### 1. Self-Hosted SFU Instead of Hosted Video SDK

AtomAssist uses mediasoup as the SFU layer. Media is routed through the project’s own backend infrastructure rather than a hosted video API.

```mermaid
flowchart LR
    Agent[Agent Browser] -->|Producer| SFU[Self-hosted mediasoup SFU]
    Customer[Customer Browser] -->|Producer| SFU

    SFU -->|Consumer| Agent
    SFU -->|Consumer| Customer
```

### 2. Complete Support Session Lifecycle

The project models a support call as a real session, not just a temporary browser connection.

```mermaid
stateDiagram-v2
    [*] --> WAITING
    WAITING --> ACTIVE: Customer joins
    ACTIVE --> RECONNECTING: Customer disconnects
    RECONNECTING --> ACTIVE: Customer rejoins within 60 seconds
    RECONNECTING --> ENDED: Reconnect timeout
    ACTIVE --> ENDED: Agent ends session
    ENDED --> [*]
```

### 3. Persisted Support Case Record

After a call, the session remains reviewable with:

* participants,
* event timeline,
* call duration,
* chat messages,
* shared files,
* recordings,
* resolution status,
* and review notes.

### 4. Production-Aware Recording Strategy

AtomAssist includes both a reliable MVP recording path and a deeper server-side recording spike.

Stable path:

```text
Browser tab capture -> WebM artifact -> backend upload -> session history
```

Experimental SFU-side path:

```text
mediasoup Producer
-> server-side Consumer
-> PlainTransport RTP
-> FFmpeg
-> WebM artifact
-> session history
```

The experimental server-side path demonstrates the intended production direction while keeping the stable tab recording flow available.

### 5. Observability Built Into the Product

AtomAssist exposes operational metrics through:

```text
/admin/observability
/metrics
```

Tracked metrics include HTTP requests, active sockets, sessions by status, participants by status, chat count, file count, recording count, and Node.js runtime metrics.

---

## Architecture

```mermaid
flowchart TB
    subgraph Clients
        A[Agent Browser]
        C[Customer Browser]
        AD[Admin Browser]
    end

    subgraph Web_App
        R[React + Vite + TypeScript]
        MC[mediasoup-client]
        SOC[Socket.IO Client]
    end

    subgraph Backend
        API[Express REST API]
        WS[Socket.IO Server]
        SFU[mediasoup Worker/Router]
        REC[Recording Services]
        OBS[Metrics Service]
    end

    subgraph Persistence
        DB[(PostgreSQL)]
        FS[Uploads and Recordings]
    end

    A --> R
    C --> R
    AD --> R

    R --> API
    SOC --> WS
    MC --> SFU

    API --> DB
    WS --> DB
    API --> FS
    REC --> FS
    OBS --> API
```

---

## System Components

### Frontend

The frontend handles:

* agent login,
* admin login,
* customer invite join,
* live call UI,
* media send/receive through `mediasoup-client`,
* realtime chat,
* file upload/download,
* recording controls,
* session history,
* case review,
* admin dashboard,
* and observability pages.

### Backend

The backend handles:

* authentication,
* JWT validation,
* session creation,
* invite validation,
* participant lifecycle,
* Socket.IO signaling,
* mediasoup worker/router/transports,
* chat persistence,
* file persistence,
* recording metadata,
* session review updates,
* metrics collection,
* and admin operations.

### Database

PostgreSQL stores:

* sessions,
* participants,
* session events,
* chat messages,
* file metadata,
* recording metadata,
* review notes,
* and lifecycle timestamps.

---

## Recording Design

### Browser Tab Recording MVP

This is the stable recording mode used for reliable demos.

```text
Agent clicks Start Tab Recording
Browser captures selected AtomAssist tab/window
MediaRecorder creates WebM chunks
Recording uploads to backend
Backend marks recording READY
Recording appears in session history
```

Lifecycle:

```text
IN_PROGRESS -> PROCESSING -> READY
```

### Experimental Server-Side SFU Recording

This spike records selected SFU producer streams server-side.

```text
Active mediasoup Producer
-> server-side Consumer
-> PlainTransport
-> RTP forwarded to FFmpeg
-> WebM output
-> persisted recording artifact
```

This is separated from tab recording to keep the core product reliable while demonstrating the production path for SFU-side recording.

---

## Security and Access Control

| Role     | Access Scope                                |
| -------- | ------------------------------------------- |
| Agent    | Create and manage assigned support sessions |
| Customer | Join and access one invited session         |
| Admin    | Monitor all sessions and force-end sessions |

Implemented controls:

* JWT-based authentication
* role-aware route protection
* session-scoped customer tokens
* invite token validation
* ended sessions reject joins
* file downloads require session access
* recording downloads require session access
* admin-only monitoring routes

For hackathon speed, demo users are included. A production system should move user identity to database-backed accounts with hashed passwords.

---

## Observability

AtomAssist includes production-oriented observability features.

### Human-Readable Dashboard

```text
/admin/observability
```

### Prometheus-Compatible Metrics

```text
/metrics
```

Metrics include:

* HTTP request count
* HTTP request duration
* active Socket.IO connections
* sessions grouped by status
* participants grouped by status
* total chat messages
* total uploaded files
* total recordings
* Node.js process metrics

---

## Tech Stack

| Layer                | Technology                            |
| -------------------- | ------------------------------------- |
| Frontend             | React, Vite, TypeScript, Tailwind CSS |
| Realtime client      | Socket.IO Client                      |
| WebRTC client        | mediasoup-client                      |
| Backend              | Node.js, Express, TypeScript          |
| Realtime server      | Socket.IO                             |
| SFU                  | mediasoup                             |
| Database             | PostgreSQL                            |
| ORM                  | Prisma                                |
| File uploads         | multer                                |
| Recording            | MediaRecorder API, FFmpeg spike       |
| Metrics              | prom-client                           |
| Package management   | pnpm workspaces                       |
| Local infrastructure | Docker Compose                        |

---

## Local Setup

### Prerequisites

* Node.js 24+
* pnpm 9+
* Docker Desktop
* FFmpeg installed and available in PATH

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Run Migrations

```bash
pnpm --filter @atomassist/server prisma:migrate
pnpm --filter @atomassist/server prisma:generate
```

### 4. Start Development Servers

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
curl http://localhost:4000/health
```

Metrics:

```text
http://localhost:4000/metrics
```

---

## Environment Configuration

### Backend

Create:

```text
apps/server/.env
```

Example:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://atomassist:atomassist@localhost:5432/atomassist?schema=public"

JWT_SECRET="replace-with-local-secret"
INVITE_TOKEN_SECRET="replace-with-local-invite-secret"

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100
```

### Frontend

Create:

```text
apps/web/.env.local
```

Example:

```env
VITE_API_BASE_URL=http://localhost:4000
```

For testing across devices on the same Wi-Fi, set `MEDIASOUP_ANNOUNCED_IP` to the host machine’s LAN IP.

---

## Important Routes

| Route                         | Purpose                           |
| ----------------------------- | --------------------------------- |
| `/agent/login`                | Agent/admin login                 |
| `/agent/dashboard`            | Agent session dashboard           |
| `/join/:inviteToken`          | Customer invite join              |
| `/call/:sessionId`            | Live support room                 |
| `/session/:sessionId/history` | Support case review               |
| `/admin`                      | Admin dashboard                   |
| `/admin/observability`        | Metrics dashboard                 |
| `/admin/recording`            | Recording architecture page       |
| `/metrics`                    | Prometheus-compatible raw metrics |

---

## Project Structure

```text
AtomAssist/
  apps/
    server/
      prisma/
      src/
        db/
        media/
        middleware/
        metrics/
        realtime/
        recording/
        routes/
        services/
        system/
    web/
      src/
        components/
        lib/
        pages/
        routes/
  packages/
    shared/
  docs/
    screenshots/
    ARCHITECTURE.md
    DEMO_SCRIPT.md
    PRODUCTION_NOTES.md
```

---

## Known Limitations

* Demo users are included for hackathon evaluation.
* Uploads and recordings are stored on local filesystem.
* Browser tab recording is the stable recording MVP.
* Server-side SFU recording is experimental.
* Public deployment requires a VM-style host with open RTC media ports.
* TURN server is required for robust NAT traversal in production.
* Object storage, production identity, organization management, audit logs, and background workers are not included in this hackathon build.

---

## Production Roadmap

Recommended production upgrades:

1. Database-backed user accounts.
2. Password hashing with Argon2 or bcrypt.
3. Refresh tokens or secure cookie sessions.
4. Organization and team access model.
5. S3-compatible object storage for files and recordings.
6. coturn deployment for NAT traversal.
7. Dedicated mediasoup worker orchestration.
8. Redis adapter for Socket.IO horizontal scaling.
9. Hardened server-side recording workers.
10. FFmpeg/GStreamer audio-video composition.
11. Background queues for recording processing.
12. Audit logs for support/session actions.
13. Grafana dashboards and alerting.
14. CI pipeline for typecheck, build, migrations, and tests.

---

## Evaluation Notes

AtomAssist is intended to be evaluated as a locally runnable self-hosted WebRTC system.

A frontend-only/serverless deployment is intentionally not used because mediasoup requires:

* a long-running backend process,
* RTC UDP/TCP media ports,
* server-side media workers,
* and environment-specific announced IP configuration.

The repository includes production configuration examples and a VM-oriented production path.
