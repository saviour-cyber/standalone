import { useEffect, useRef } from "react";

interface FlightCanvasProps {
  status: string;
  multiplier: number;
  crashMultiplier?: number | null;
  roundNumber?: number;
}

export function FlightCanvas({
  status,
  multiplier,
  crashMultiplier,
  roundNumber,
}: FlightCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const currentMultiplierRef = useRef<number>(1);
  const targetMultiplierRef = useRef<number>(multiplier);
  const particlesRef = useRef<
    Array<{ x: number; y: number; vx: number; vy: number; alpha: number; size: number; color: string }>
  >([]);

  targetMultiplierRef.current = multiplier;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 420);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    const render = () => {
      const isRunning = status === "MULTIPLIER_RUNNING";
      const isCrashed = status === "ROUND_CRASHED" || status === "SETTLEMENT_PENDING";

      if (isRunning) {
        currentMultiplierRef.current +=
          (targetMultiplierRef.current - currentMultiplierRef.current) * 0.15;
      } else if (status === "ROUND_CREATED" || status === "ROUND_STARTED") {
        currentMultiplierRef.current = 1.0;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle background coordinate grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      const stepX = width / 8;
      const stepY = height / 6;

      for (let x = stepX; x < width; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = stepY; y < height; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Origin point (bottom-left offset)
      const originX = 40;
      const originY = height - 40;
      const maxW = width - 100;
      const maxH = height - 100;

      // Scale: 1.0x -> 0%, 15.0x -> 100%
      const norm = Math.min(
        1,
        Math.max(0, Math.log(Math.max(1, currentMultiplierRef.current)) / Math.log(15))
      );

      const targetX = originX + norm * maxW;
      const targetY = originY - norm * maxH;

      if (isRunning || isCrashed) {
        // 2. Draw curved flight path area fill
        const gradient = ctx.createLinearGradient(originX, originY, targetX, targetY);
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.0)");
        gradient.addColorStop(1, isCrashed ? "rgba(239, 68, 68, 0.18)" : "rgba(201, 243, 107, 0.22)");

        ctx.beginPath();
        ctx.moveTo(originX, originY);
        const cpX = originX + (targetX - originX) * 0.65;
        const cpY = originY;
        ctx.quadraticCurveTo(cpX, cpY, targetX, targetY);
        ctx.lineTo(targetX, originY);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // 3. Draw glowing curve stroke
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.quadraticCurveTo(cpX, cpY, targetX, targetY);
        ctx.strokeStyle = isCrashed ? "#ef4444" : "#c9f36b";
        ctx.lineWidth = 3;
        ctx.shadowColor = isCrashed ? "rgba(239, 68, 68, 0.8)" : "rgba(201, 243, 107, 0.8)";
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 4. Particle exhaust
        if (isRunning && Math.random() < 0.6) {
          particlesRef.current.push({
            x: targetX - 10,
            y: targetY + 4,
            vx: -(Math.random() * 2 + 1),
            vy: (Math.random() - 0.5) * 1.5,
            alpha: 0.9,
            size: Math.random() * 4 + 2,
            color: Math.random() > 0.4 ? "#f4a261" : "#c9f36b",
          });
        }

        // Draw and update exhaust particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.025;
          p.size *= 0.96;

          if (p.alpha <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // 5. Draw Plane Sprite at (targetX, targetY)
        if (!isCrashed) {
          ctx.save();
          ctx.translate(targetX, targetY);
          const angle = Math.atan2(targetY - cpY, targetX - cpX) * 0.5 - 0.1;
          ctx.rotate(angle);

          // Plane Fuselage
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.moveTo(22, 0); // nose
          ctx.lineTo(-14, -8); // top tail
          ctx.lineTo(-18, -4);
          ctx.lineTo(-24, -14); // stabilizer
          ctx.lineTo(-20, 0);
          ctx.lineTo(-16, 6);
          ctx.closePath();
          ctx.fill();

          // Jet wing
          ctx.fillStyle = "#dc2626";
          ctx.beginPath();
          ctx.moveTo(-4, -4);
          ctx.lineTo(8, -18);
          ctx.lineTo(-8, -18);
          ctx.lineTo(-10, -4);
          ctx.closePath();
          ctx.fill();

          // Cockpit windshield
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.ellipse(8, -4, 5, 2.5, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();

          // Engine jet flame glow
          ctx.fillStyle = "#fbbf24";
          ctx.shadowColor = "#f59e0b";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(-16, 2, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.restore();
        }
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [status]);

  const isRunning = status === "MULTIPLIER_RUNNING";
  const isCrashed = status === "ROUND_CRASHED" || status === "SETTLEMENT_PENDING";
  const isWaiting = status === "ROUND_CREATED" || status === "ROUND_STARTED";

  return (
    <div className="relative w-full h-[360px] md:h-[420px] bg-[#0d1210] rounded-2xl overflow-hidden border border-[#27312d] shadow-2xl flex items-center justify-center select-none">
      {/* 2D Canvas Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Floating Header Badges */}
      <div className="absolute top-4 left-5 right-5 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-mono tracking-widest text-zinc-400 bg-black/50 px-3 py-1 rounded-full border border-zinc-800 backdrop-blur-md">
            Round #{roundNumber || "—"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border backdrop-blur-md ${
              isRunning
                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-400"
                : isCrashed
                ? "bg-red-950/60 border-red-700/60 text-red-400"
                : "bg-amber-950/60 border-amber-700/60 text-amber-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? "bg-emerald-400 animate-ping"
                  : isCrashed
                  ? "bg-red-500"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            {status.replaceAll("_", " ")}
          </span>
        </div>
        <div className="text-xs font-mono text-zinc-400 bg-black/50 px-3 py-1 rounded-full border border-zinc-800 backdrop-blur-md flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
          Provably Fair
        </div>
      </div>

      {/* Center Stage State Overlays */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center pointer-events-none">
        {isWaiting && (
          <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-zinc-800 stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-lime-400 stroke-current animate-pulse"
                  strokeWidth="3.5"
                  strokeDasharray="75, 100"
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-mono font-bold text-lime-400 tracking-wider">
                BETS
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-lime-400/10 border border-lime-400/30 text-lime-400">
                BETTING WINDOW OPEN
              </span>
              <p className="text-xs font-mono tracking-wider uppercase text-zinc-400">
                Place stakes before takeoff
              </p>
            </div>
            <div className="w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-lime-400 to-emerald-400 animate-pulse w-3/4 rounded-full" />
            </div>
          </div>
        )}

        {isRunning && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="text-6xl md:text-8xl font-mono font-extrabold tracking-tight text-white drop-shadow-[0_0_35px_rgba(201,243,107,0.45)]">
              {multiplier.toFixed(2)}
              <span className="text-lime-400 text-4xl md:text-5xl ml-1">x</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-400 mt-2">
              Authoritative Multiplier
            </p>
          </div>
        )}

        {isCrashed && (
          <div className="flex flex-col items-center animate-in zoom-in-90 duration-150">
            <span className="text-red-500 font-black tracking-widest text-sm md:text-base uppercase bg-red-950/70 border border-red-700/60 px-4 py-1 rounded-full mb-3 shadow-lg">
              FLEW AWAY!
            </span>
            <div className="text-6xl md:text-8xl font-mono font-extrabold text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,0.7)]">
              {(crashMultiplier || multiplier).toFixed(2)}
              <span className="text-red-400 text-4xl md:text-5xl ml-1">x</span>
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-2">Crashed at this multiplier</p>
          </div>
        )}
      </div>
    </div>
  );
}
