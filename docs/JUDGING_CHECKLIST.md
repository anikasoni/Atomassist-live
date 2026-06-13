# Judging Checklist

## Must-Haves

- [x] Real-time video calling
- [x] Media routed through self-hosted SFU
- [x] No hosted video APIs
- [x] Agent creates support session
- [x] Customer joins through invite link
- [x] Role-based access control
- [x] Session end expires invite
- [x] Realtime signaling
- [x] Backend persistence

## Strong Good-to-Haves

- [x] Socket.IO realtime chat
- [x] Persistent chat history
- [x] File sharing
- [x] Download files from chat/history
- [x] 60-second reconnect handling
- [x] Agent/admin login
- [x] Admin dashboard
- [x] Human-friendly observability UI
- [x] Prometheus-compatible metrics
- [x] Browser tab recording MVP
- [x] Session event timeline
- [x] Clean TypeScript backend/frontend

## Production-Aware Notes

- [x] Honest recording limitation documented
- [x] Server-side SFU recording path documented
- [x] TURN server requirement documented for internet deployment
- [x] Role-aware route guards
- [x] File upload validation
- [x] Secure invite hashing