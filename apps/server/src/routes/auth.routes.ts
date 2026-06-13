import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { signAuthToken } from "../utils/tokens.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const demoAgents = [
  {
    id: "demo-agent-1",
    email: "agent@demo.com",
    password: "demo123",
    displayName: "Demo Support Agent",
    role: "AGENT" as const,
  },
  {
    id: "demo-admin-1",
    email: "admin@demo.com",
    password: "demo123",
    displayName: "Demo Admin",
    role: "ADMIN" as const,
  },
];

authRouter.post(
  "/agent-login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = demoAgents.find(
      (agent) => agent.email === body.email && agent.password === body.password
    );

    if (!user) {
      throw new AppError(401, "Invalid demo credentials", "INVALID_CREDENTIALS");
    }

    const token = signAuthToken({
      id: user.id,
      role: user.role,
      email: user.email,
      displayName: user.displayName,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "Authentication required", "AUTH_REQUIRED");
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        displayName: req.user.displayName,
        sessionId: req.user.sessionId,
        participantId: req.user.participantId,
      },
    });
  })
);