const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.error?.message ?? `Request failed with status ${res.status}`;
    const code = data?.error?.code;
    throw new ApiError(res.status, message, code);
  }

  return data as T;
}

export interface AuthUser {
  id: string;
  email?: string;
  role: "AGENT" | "CUSTOMER" | "ADMIN";
  displayName: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Session {
  id: string;
  status: "WAITING" | "ACTIVE" | "ENDED";
  agentId: string;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  endReason?: string | null;
  participants?: Participant[];
  events?: SessionEvent[];
  chatMessages?: ChatMessage[];
  files?: unknown[];
  recordings?: unknown[];
}

export interface Participant {
  id: string;
  sessionId: string;
  role: "AGENT" | "CUSTOMER";
  displayName: string;
  status: "JOINED" | "CONNECTED" | "RECONNECTING" | "LEFT";
  joinedAt: string;
  lastSeenAt?: string | null;
  leftAt?: string | null;
}


export interface ChatMessage {
  id: string;
  sessionId: string;
  senderParticipantId: string;
  messageType: "TEXT" | "FILE";
  body: string;
  fileId?: string | null;
  createdAt: string;
  senderParticipant?: {
    id: string;
    displayName: string;
    role: "AGENT" | "CUSTOMER";
  };
}
export interface SessionEvent {
  id: string;
  sessionId: string;
  participantId?: string | null;
  type: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateSessionResponse {
  session: Session;
  inviteToken: string;
  inviteUrl: string;
}

export interface PublicInviteResponse {
  session: {
    id: string;
    status: "WAITING" | "ACTIVE" | "ENDED";
    createdAt: string;
    participantCount: number;
  };
}

export interface CustomerJoinResponse {
  token: string;
  participant: Participant;
  session: {
    id: string;
    status: "WAITING" | "ACTIVE" | "ENDED";
    startedAt?: string | null;
  };
}

export const api = {
  loginAgent(email: string, password: string) {
    return request<LoginResponse>("/api/auth/agent-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  me(token: string) {
    return request<{ user: AuthUser }>("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  listSessions(token: string) {
    return request<{ sessions: Session[] }>("/api/sessions", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  createSession(token: string) {
    return request<CreateSessionResponse>("/api/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
  },

  getSession(token: string, sessionId: string) {
    return request<{ session: Session }>(`/api/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getSessionHistory(token: string, sessionId: string) {
    return request<{ session: Session }>(`/api/sessions/${sessionId}/history`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  endSession(token: string, sessionId: string, reason: string) {
    return request<{ session: Session }>(`/api/sessions/${sessionId}/end`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
  },

  validateInvite(inviteToken: string) {
    return request<PublicInviteResponse>(`/api/invites/${inviteToken}`);
  },

  joinInvite(inviteToken: string, displayName: string) {
    return request<CustomerJoinResponse>(`/api/invites/${inviteToken}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
  },
};