import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthUser } from "../types/auth.js";

export function generateInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return crypto
    .createHmac("sha256", env.INVITE_TOKEN_SECRET)
    .update(token)
    .digest("hex");
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, {
    expiresIn: user.role === "CUSTOMER" ? "6h" : "12h",
  });
}

export function verifyAuthToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token");
  }

  const payload = decoded as Partial<AuthUser>;

  if (!payload.id || !payload.role || !payload.displayName) {
    throw new Error("Invalid token payload");
  }

  return payload as AuthUser;
}