import { io, type Socket } from "socket.io-client";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export function createRealtimeSocket(token: string): Socket {
  return io(API_BASE_URL, {
    auth: {
      token,
    },
    transports: ["websocket", "polling"],
  });
}