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
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
  resolutionStatus?: "OPEN" | "RESOLVED" | "ESCALATED" | string;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  reviewedByAgentId?: string | null;
  participants?: Participant[];
  events?: SessionEvent[];
  chatMessages?: ChatMessage[];
  files?: unknown[];
  recordings?: Recording[];
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


export interface Recording {
  id: string;
  sessionId: string;
  startedByAgentId: string;
  status: "IN_PROGRESS" | "PROCESSING" | "READY" | "FAILED";
  storagePath?: string | null;
  startedAt: string;
  stoppedAt?: string | null;
  readyAt?: string | null;
}

export interface FileAsset {
  id: string;
  sessionId: string;
  uploadedByParticipantId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderParticipantId: string;
  messageType: "TEXT" | "FILE";
  body: string;
  fileId?: string | null;
  file?: FileAsset | null;
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

  updateSessionReview(
    token: string,
    sessionId: string,
    input: {
      resolutionStatus: "OPEN" | "RESOLVED" | "ESCALATED";
      reviewNotes: string;
    }
  ) {
    return request<{ session: Session }>(`/api/sessions/${sessionId}/review`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  },

  uploadSessionFile(token: string, sessionId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return request<{ file: FileAsset; message: ChatMessage }>(
      `/api/sessions/${sessionId}/files`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );
  },

  uploadSessionRecording(token: string, sessionId: string, recording: Blob) {
    const formData = new FormData();
    formData.append(
      "recording",
      recording,
      `atomassist-session-${sessionId}.webm`
    );

    return request<{ recording: Recording }>(
      `/api/sessions/${sessionId}/recordings/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );
  },

  async downloadRecording(token: string, recordingId: string, sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/api/recordings/${recordingId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        data?.error?.message ?? "Failed to download recording",
        data?.error?.code
      );
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `atomassist-recording-${sessionId}.webm`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  },

  async downloadFile(token: string, fileId: string, originalName: string) {
    const res = await fetch(`${API_BASE_URL}/api/files/${fileId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        data?.error?.message ?? "Failed to download file",
        data?.error?.code
      );
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = originalName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
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