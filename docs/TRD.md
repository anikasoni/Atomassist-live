# Technical Requirements Document: AtomAssist Live

Stack:

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS

Backend:
- Node.js
- Express
- TypeScript
- Socket.IO
- Prisma
- PostgreSQL

Media:
- mediasoup
- mediasoup-client
- Opus audio
- VP8 video

Architecture:

Browser frontend connects to:
1. Express REST API for auth, sessions, history, files, and recordings.
2. Socket.IO for signaling, presence, chat, and realtime events.
3. mediasoup SFU for server-routed WebRTC media.

Media flow must be:
Browser -> Node.js signaling -> mediasoup SFU -> Browser

Do not implement direct peer-to-peer WebRTC.

Database models:
1. Session
2. Participant
3. SessionEvent
4. ChatMessage
5. FileAsset
6. Recording

REST APIs:
1. POST /api/auth/agent-login
2. POST /api/sessions
3. GET /api/sessions
4. GET /api/sessions/:id
5. GET /api/sessions/:id/history
6. POST /api/sessions/:id/end
7. GET /api/invites/:token
8. POST /api/invites/:token/join

Socket events:
1. session:join
2. session:leave
3. session:end
4. chat:send
5. chat:message
6. participant:joined
7. participant:left
8. session:ended

Media events:
1. media:getRouterRtpCapabilities
2. media:createWebRtcTransport
3. media:connectTransport
4. media:produce
5. media:consume
6. media:resumeConsumer
7. media:newProducer

Security:
1. Store invite token hash, not raw token.
2. Customer JWT is scoped to one session.
3. Customer cannot create sessions.
4. Customer cannot access admin routes.
5. Customer cannot start recording.
6. Ended sessions reject new joins.
7. Every REST route validates role and membership.
8. Every socket event validates role and membership.
