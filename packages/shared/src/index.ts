export type Role = "AGENT" | "CUSTOMER" | "ADMIN";

export type SessionStatus = "WAITING" | "ACTIVE" | "ENDED";

export type ParticipantStatus =
| "JOINED"
| "CONNECTED"
| "RECONNECTING"
| "LEFT";

export interface HealthResponse {
status: "ok";
service: string;
}
