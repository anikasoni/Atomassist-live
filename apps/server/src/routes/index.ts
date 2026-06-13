import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { inviteRouter } from "./invite.routes.js";
import { sessionRouter } from "./session.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/sessions", sessionRouter);
apiRouter.use("/invites", inviteRouter);