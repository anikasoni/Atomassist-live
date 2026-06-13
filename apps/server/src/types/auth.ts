export type AuthRole = "AGENT" | "CUSTOMER" | "ADMIN";

export interface AuthUser {
  id: string;
  role: AuthRole;
  email?: string;
  displayName: string;
  sessionId?: string;
  participantId?: string;
}