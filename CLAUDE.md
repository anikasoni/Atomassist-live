# CLAUDE.md

You are a senior Full-Stack WebRTC Engineer, Media Infrastructure Architect, and Hackathon-winning product engineer.

We are building **AtomAssist Live** for a 15-hour hackathon.

AtomAssist Live is a browser-based real-time video support platform where:

* A support agent creates a video support session.
* A customer joins using a secure invite link.
* Both users join from the browser with no app installation.
* Audio/video is routed through our own server.
* Chat, session events, and history are persisted.
* Bonus features include admin dashboard, reconnect handling, file sharing, recording, and observability.

## Critical Hackathon Constraint

This is the most important rule:

* Media MUST route through our own server.
* Do NOT build peer-to-peer WebRTC.
* Do NOT use Twilio, Agora, Daily, Vonage, Jitsi hosted, LiveKit Cloud, or any third-party hosted video SDK.
* Use **mediasoup SFU** for server-routed WebRTC.
* The final architecture must clearly show:

Browser -> Node.js Signaling/API -> mediasoup SFU -> Browser

If implementing video, always use mediasoup and mediasoup-client.

## Always Read Before Coding

Before every implementation phase, read:

* docs/PRD.md
* docs/TRD.md
* docs/HACKATHON_REQUIREMENTS.md
* Current source code

Do not assume the codebase state. Inspect it first.

## Development Style

Work like a professional engineer under hackathon time pressure.

Rules:

1. Work phase by phase.
2. Implement only the requested phase.
3. Do not implement future phases unless explicitly asked.
4. Do not rewrite working code unnecessarily.
5. Before coding, give a short implementation plan.
6. After coding, list all changed/created files.
7. After coding, give exact commands to run.
8. After coding, give exact browser/API checks.
9. Mention anything incomplete, risky, or intentionally simplified.
10. Keep the app demo-ready at every phase.
11. Prefer working, clean, testable code over over-engineered code.
12. Avoid giant files. Split services, routes, components, and utilities clearly.
13. Use strict TypeScript.
14. Add useful logs for backend, Socket.IO, media lifecycle, and errors.
15. Keep frontend, backend, and shared types separated.

## Tech Stack

Use:

Frontend:

* React
* Vite
* TypeScript
* Tailwind CSS

Backend:

* Node.js
* Express
* TypeScript
* Socket.IO
* Prisma
* PostgreSQL

Media:

* mediasoup
* mediasoup-client
* Opus audio
* VP8 video

Package manager:

* pnpm workspaces

Storage:

* Local disk for hackathon uploads and recordings

Observability:

* prom-client
* /metrics endpoint

## Monorepo Structure

Use this structure:

atomassist-live/
apps/
web/
server/
packages/
shared/
docs/
PRD.md
TRD.md
HACKATHON_REQUIREMENTS.md
docker-compose.yml
package.json
pnpm-workspace.yaml
CLAUDE.md
README.md

## Build Order

Follow this exact order:

1. Project setup
2. Database + auth + session APIs
3. Frontend session creation and invite flow
4. Socket.IO presence and chat
5. mediasoup SFU audio/video
6. Mute, camera toggle, leave, and end-session cleanup
7. Session history page
8. Admin dashboard
9. File sharing in chat
10. Reconnect handling
11. Recording
12. Observability metrics
13. README, architecture diagram, and demo polish

Do not jump to recording, admin, or file sharing before the core SFU call works.

## Phase Completion Rule

After each phase, the app must still run.

For every phase, provide:

1. What was implemented.
2. Files changed.
3. Commands to run.
4. Expected output.
5. Manual test checklist.
6. Known issues or limitations.

## Security Rules

Enforce role-based access everywhere.

Agent can:

* Create sessions
* View own sessions
* Join calls
* End sessions
* Start/stop recording
* View history

Customer can:

* Join only through a valid invite
* Join only the assigned session
* Chat
* Upload allowed files
* Leave call

Customer must NOT:

* Create sessions
* List sessions
* End sessions
* Access admin dashboard
* Start/stop recording
* Access unrelated history
* Reuse invalid or ended invites

Other rules:

* Store invite token hash, not raw invite token.
* Customer JWT must be scoped to one session.
* Ended sessions must reject new joins.
* Validate every REST route.
* Validate every Socket.IO event.
* Validate file size and MIME type.
* Prevent path traversal.
* Do not expose raw filesystem paths.

## Required Backend Features

Implement modular backend services:

* Auth service
* Session service
* Invite service
* Participant service
* Chat service
* File service
* Recording service
* Media service
* Socket gateway
* Metrics service

Use centralized:

* Error handling
* Auth middleware
* Role middleware
* Zod validation
* Prisma client wrapper/config

## Required REST APIs

Auth:

* POST /api/auth/agent-login

Sessions:

* POST /api/sessions
* GET /api/sessions
* GET /api/sessions/:id
* GET /api/sessions/:id/history
* POST /api/sessions/:id/end

Invites:

* GET /api/invites/:token
* POST /api/invites/:token/join

Files:

* POST /api/sessions/:id/files
* GET /api/files/:fileId/download

Recordings:

* POST /api/sessions/:id/recordings/start
* POST /api/sessions/:id/recordings/stop
* POST /api/sessions/:id/recordings/upload
* GET /api/recordings/:recordingId/download

Metrics:

* GET /metrics

## Required Socket.IO Events

Session:

* session:join
* session:leave
* session:end

Broadcast:

* participant:joined
* participant:left
* participant:reconnecting
* participant:reconnected
* session:ended

Chat:

* chat:send
* chat:message

Media:

* media:getRouterRtpCapabilities
* media:createWebRtcTransport
* media:connectTransport
* media:produce
* media:consume
* media:resumeConsumer
* media:closeProducer
* media:newProducer
* media:producerClosed

Recording:

* recording:start
* recording:stop
* recording:status

## mediasoup Rules

When implementing media:

1. Create a mediasoup worker on server startup.
2. Use one router per active session.
3. Use Opus for audio.
4. Use VP8 for video.
5. Each participant creates send and receive WebRTC transports.
6. Each participant produces audio/video to the SFU.
7. Each participant consumes remote audio/video from the SFU.
8. Notify other participants when a new producer is created.
9. Clean up transports, producers, and consumers on leave/disconnect/end.
10. Use env vars for announced IP and RTC port range.
11. Add clear logs for worker, router, transport, producer, consumer lifecycle.

Do not implement direct RTCPeerConnection browser-to-browser media.

## Database Models

Use Prisma models for:

Session:

* id
* status: WAITING, ACTIVE, ENDED
* agentId
* inviteTokenHash
* createdAt
* startedAt
* endedAt
* endReason

Participant:

* id
* sessionId
* role: AGENT, CUSTOMER
* displayName
* status: JOINED, CONNECTED, RECONNECTING, LEFT
* joinedAt
* lastSeenAt
* leftAt
* socketId

SessionEvent:

* id
* sessionId
* participantId
* type
* payload
* createdAt

ChatMessage:

* id
* sessionId
* senderParticipantId
* messageType: TEXT, FILE
* body
* fileId
* createdAt

FileAsset:

* id
* sessionId
* uploadedByParticipantId
* originalName
* mimeType
* sizeBytes
* storagePath
* createdAt

Recording:

* id
* sessionId
* startedByAgentId
* status: IN_PROGRESS, PROCESSING, READY, FAILED
* storagePath
* startedAt
* stoppedAt
* readyAt

## Demo UX Requirements

The UI should feel like a real support tool, not a toy project.

Required pages:

* /agent/login
* /agent/dashboard
* /agent/session/:id
* /join/:token
* /call/:sessionId
* /session/:id/history
* /admin

UI expectations:

* Clean dashboard
* Clear invite link copy button
* Clear waiting/active/ended status
* Friendly invalid invite page
* Friendly camera/mic permission error
* Clear mute/camera/end buttons
* Chat panel
* Participant status
* Recording indicator
* Reconnecting badge
* Session history timeline

## Hackathon Priorities

Must work perfectly:

1. Agent creates session.
2. Customer joins using invite.
3. Server-routed audio/video works.
4. Chat works and persists.
5. Session history works.
6. Agent can end session.
7. Invalid invites are rejected.
8. Role access is enforced.

Good-to-have priority:

1. Admin dashboard
2. File sharing
3. Reconnect handling
4. Recording
5. Metrics

## Recording Strategy

For hackathon recording, use browser-composited recording from the agent side:

1. Agent starts recording.
2. Backend creates Recording row with IN_PROGRESS.
3. Both users see recording status.
4. Agent browser composites remote video large + local video picture-in-picture onto canvas.
5. Web Audio API mixes local and remote audio.
6. MediaRecorder records WebM.
7. Agent stops recording.
8. Backend marks PROCESSING.
9. Browser uploads file.
10. Backend marks READY.
11. History page shows download link.

Be honest in README:

* This is hackathon browser-composited recording.
* Production version would record server-side via mediasoup PlainTransport + FFmpeg.

## Testing Discipline

After every phase, provide tests.

Minimum checks:

* pnpm install
* pnpm dev
* Backend /health
* Frontend opens
* API curl commands
* Browser manual test steps

For WebRTC:

* Test with two browser windows or two Chrome profiles.
* Verify local preview.
* Verify remote video.
* Verify audio.
* Test mute.
* Test camera off.
* Test leave.
* Test session end.
* Check chrome://webrtc-internals to confirm SFU/server routing.

## Git Discipline

After each working phase, recommend a git commit message.

Examples:

* phase 1 monorepo setup
* phase 2 auth session APIs
* phase 3 frontend session flow
* phase 4 realtime chat
* phase 5 mediasoup SFU call
* phase 6 call lifecycle cleanup
* phase 7 admin dashboard
* phase 8 file sharing
* phase 9 reconnect handling
* phase 10 recording
* phase 11 metrics
* phase 12 demo docs

## Do Not Do

Do not:

* Build everything in one huge change.
* Fake video with local preview only.
* Use peer-to-peer WebRTC.
* Use hosted video APIs.
* Ignore role access.
* Store raw invite tokens.
* Allow ended sessions to be rejoined.
* Leave sockets/transports open after session end.
* Build a beautiful UI with broken backend state.
* Claim server-side recording if using browser recording.
* Skip README or architecture documentation.

## Final Demo Flow

The final demo should show:

1. Agent logs in.
2. Agent creates session.
3. Agent copies invite link.
4. Customer opens link in another browser.
5. Customer joins.
6. Both users see/hear each other.
7. Both users exchange chat.
8. Agent mutes/unmutes and toggles camera.
9. File sharing works if implemented.
10. Recording works if implemented.
11. Customer refreshes/reconnects if implemented.
12. Agent ends session.
13. Invite cannot be reused after end.
14. Session history shows timeline and chat.
15. Admin dashboard shows sessions.
16. /metrics shows observability.
17. README explains architecture and limitations.

Build for this demo.
