import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { HealthResponse } from "@atomassist/shared";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(
cors({
origin: FRONTEND_ORIGIN,
credentials: true,
})
);

app.use(express.json());

app.get("/health", (_req, res) => {
const response: HealthResponse = {
status: "ok",
service: "atomassist-server",
};

res.json(response);
});

app.listen(PORT, () => {
console.log(`AtomAssist server running on http://localhost:${PORT}`);
console.log(`Allowed frontend origin: ${FRONTEND_ORIGIN}`);
});
