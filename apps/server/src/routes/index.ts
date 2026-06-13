import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { fileRouter } from "./file.routes.js";
import { inviteRouter } from "./invite.routes.js";
import { metricsRouter } from "./metrics.routes.js";
import { recordingRouter } from "./recording.routes.js";
import { sessionRouter } from "./session.routes.js";
import { sessionReviewRouter } from "./session-review.routes.js";
import { systemRouter } from "./system.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/system", systemRouter);
apiRouter.use("/sessions", sessionRouter);
apiRouter.use("/sessions", sessionReviewRouter);
apiRouter.use("/invites", inviteRouter);
apiRouter.use(fileRouter);
apiRouter.use(recordingRouter);
apiRouter.use(metricsRouter);