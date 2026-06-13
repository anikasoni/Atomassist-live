# Production Notes

## Current MVP

AtomAssist is a hackathon MVP that demonstrates the complete product architecture locally.

## Required Production Upgrades

### Authentication

Current demo uses hardcoded demo users.

Production should add:

- User database table
- Password hashing with bcrypt/argon2
- Refresh tokens or secure cookie sessions
- Organization/team model
- Password reset
- Audit logs

### WebRTC Networking

Current local testing works with local IP configuration.

Production should add:

- Public HTTPS domain
- TURN server such as coturn
- Proper announced IP / public IP configuration
- Firewall opening for mediasoup RTC port range
- TLS termination

### Recording

Current recording is browser tab recording MVP.

Production SFU-side recording should use:

- mediasoup PlainTransport or direct consumer
- RTP forwarding to FFmpeg or GStreamer
- Server-side muxing/composition
- Recording worker queue
- Object storage upload

### Storage

Current uploads are stored on local disk.

Production should use:

- S3-compatible object storage
- Signed download URLs
- Virus scanning
- Retention policies

### Observability

Current metrics are Prometheus-compatible.

Production should add:

- Prometheus scraper
- Grafana dashboard
- Alerts
- Structured logs
- Error tracking

### Scaling

Current app runs as a single Node.js process.

Production should add:

- Redis adapter for Socket.IO
- Multiple mediasoup workers
- Horizontal scaling
- Room-to-worker routing
- Load balancer sticky sessions