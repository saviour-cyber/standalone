import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface GameState {
  id: string;
  roundNumber: number;
  status: string;
  multiplier: number;
  crashMultiplier?: number | null;
  commitment?: string;
  seed?: string;
}

export function useGameSocket(fallbackState?: GameState) {
  const [gameState, setGameState] = useState<GameState>(
    fallbackState || {
      id: "init",
      roundNumber: 0,
      status: "CONNECTING",
      multiplier: 1.0,
    }
  );
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to same origin /socket.io
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("ROUND_STATE", (state: GameState) => {
      setGameState((prev) => ({ ...prev, ...state }));
    });

    socket.on("MULTIPLIER_UPDATE", (payload: { roundId: string; multiplier: number }) => {
      setGameState((prev) => ({
        ...prev,
        id: payload.roundId,
        multiplier: payload.multiplier,
        status: "MULTIPLIER_RUNNING",
      }));
    });

    socket.on("ROUND_CREATED", (payload: any) => {
      setGameState((prev) => ({
        ...prev,
        status: "ROUND_CREATED",
        multiplier: 1.0,
        id: payload.roundId,
        commitment: payload.commitment,
      }));
    });

    socket.on("ROUND_STARTED", () => {
      setGameState((prev) => ({ ...prev, status: "ROUND_STARTED", multiplier: 1.0 }));
    });

    socket.on("MULTIPLIER_RUNNING", () => {
      setGameState((prev) => ({ ...prev, status: "MULTIPLIER_RUNNING" }));
    });

    socket.on("ROUND_CRASHED", (payload: any) => {
      setGameState((prev) => ({
        ...prev,
        status: "ROUND_CRASHED",
        multiplier: payload.multiplier,
        crashMultiplier: payload.multiplier,
      }));
    });

    socket.on("SETTLED", () => {
      setGameState((prev) => ({ ...prev, status: "SETTLED" }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update with fallback if socket hasn't connected yet
  useEffect(() => {
    if (!isConnected && fallbackState) {
      setGameState((prev) => ({ ...prev, ...fallbackState }));
    }
  }, [fallbackState, isConnected]);

  return { gameState, isConnected };
}
