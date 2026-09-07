import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { gameState } from "./services/game";
import { durableSettleRound } from "./services/durablePlatform";

export function registerRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });
  io.on("connection", socket => {
    socket.emit("ROUND_STATE", gameState.snapshot());
    const timer = setInterval(
      () => socket.emit("ROUND_STATE", gameState.snapshot()),
      1000
    );
    socket.on("disconnect", () => clearInterval(timer));
  });
  gameState.onEvent(event => {
    io.emit(event.type, event.payload);
    if (event.type === "SETTLED" && process.env.REAL_MONEY_ENABLED === "true")
      durableSettleRound(String(event.payload.roundId)).catch(error =>
        console.error("[Settlement] durable round settlement failed", error)
      );
  });
  return io;
}
