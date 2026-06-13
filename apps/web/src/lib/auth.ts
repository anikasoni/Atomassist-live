import type { AuthUser } from "./api";

const AGENT_TOKEN_KEY = "atomassist_agent_token";
const AGENT_USER_KEY = "atomassist_agent_user";
const CUSTOMER_TOKEN_KEY = "atomassist_customer_token";
const CUSTOMER_SESSION_KEY = "atomassist_customer_session";

export function saveAgentAuth(token: string, user: AuthUser) {
  localStorage.setItem(AGENT_TOKEN_KEY, token);
  localStorage.setItem(AGENT_USER_KEY, JSON.stringify(user));
}

export function getAgentToken() {
  return localStorage.getItem(AGENT_TOKEN_KEY);
}

export function getAgentUser(): AuthUser | null {
  const raw = localStorage.getItem(AGENT_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAgentAuth() {
  localStorage.removeItem(AGENT_TOKEN_KEY);
  localStorage.removeItem(AGENT_USER_KEY);
}

export function saveCustomerAuth(token: string, sessionId: string) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_SESSION_KEY, sessionId);
}

export function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function getCustomerSessionId() {
  return localStorage.getItem(CUSTOMER_SESSION_KEY);
}