"use client";

import { useEffect, useRef } from "react";

interface TimeFlowEffectProps {
  color?: string;
  intensity?: number;
}

/**
 * 时间流逝动效 — 沙漏流沙 + 光晕脉冲 + 时间刻度
 *
 * 设计意象:
 *   1. 沙粒: 从上方缓缓下坠，带左右微微摆动，像沙漏中的细沙
 *   2. 光晕: 随机位置出现柔光点，缓缓膨胀后消逝，像时间刻度闪烁
 *   3. 刻度线: 垂直的半透明短线段，像时间的刻度标记
 *   4. 整体氛围: 安静、缓慢、不可逆，象征时间无声流逝
 */
export function TimeFlowEffect({ color, intensity = 1 }: TimeFlowEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;

    // ── Sand grains ──────────────────────────────────────
    interface Grain {
      x: number;
      y: number;
      vy: number;
      vx: number;
      size: number;
      alpha: number;
      maxAlpha: number;
      swayPhase: number;
      swaySpeed: number;
      warmth: number; // 0=white, 1=warm tint
    }

    const grainCount = Math.round(50 * intensity);
    const grains: Grain[] = [];

    const spawnGrain = (fromTop = true): Grain => ({
      x: Math.random() * W(),
      y: fromTop ? -Math.random() * 30 : Math.random() * H(),
      vy: 0.2 + Math.random() * 0.35,
      vx: (Math.random() - 0.5) * 0.15,
      size: 1.2 + Math.random() * 2.0,
      alpha: 0,
      maxAlpha: 0.35 + Math.random() * 0.35,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.004 + Math.random() * 0.008,
      warmth: Math.random(),
    });

    for (let i = 0; i < grainCount; i++) {
      grains.push(spawnGrain(false));
    }

    // ── Glow pulses ─────────────────────────────────────
    interface Glow {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      alpha: number;
      maxAlpha: number;
      growSpeed: number;
      fadeSpeed: number;
      phase: "grow" | "fade";
    }

    const glows: Glow[] = [];
    const maxGlows = Math.round(6 * intensity);
    let glowTimer = 0;

    const spawnGlow = (): Glow => ({
      x: 60 + Math.random() * (W() - 120),
      y: 20 + Math.random() * (H() - 40),
      radius: 0,
      maxRadius: 25 + Math.random() * 50,
      alpha: 0,
      maxAlpha: 0.12 + Math.random() * 0.15,
      growSpeed: 0.2 + Math.random() * 0.3,
      fadeSpeed: 0.006 + Math.random() * 0.008,
      phase: "grow",
    });

    // ── Time ticks (vertical dash marks that fade in/out) ─
    interface Tick {
      x: number;
      y: number;
      height: number;
      alpha: number;
      maxAlpha: number;
      phase: "in" | "hold" | "out";
      timer: number;
      holdTime: number;
    }

    const ticks: Tick[] = [];
    const maxTicks = Math.round(8 * intensity);
    let tickTimer = 0;

    const spawnTick = (): Tick => ({
      x: Math.random() * W(),
      y: 10 + Math.random() * (H() - 30),
      height: 4 + Math.random() * 12,
      alpha: 0,
      maxAlpha: 0.15 + Math.random() * 0.2,
      phase: "in",
      timer: 0,
      holdTime: 60 + Math.random() * 120,
    });

    // ── Animation loop ───────────────────────────────────
    const draw = () => {
      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);

      // Draw sand grains
      for (const g of grains) {
        g.swayPhase += g.swaySpeed;
        g.x += g.vx + Math.sin(g.swayPhase) * 0.2;
        g.y += g.vy;

        // Fade in near top, fade out near bottom
        const distToBottom = h - g.y;
        if (g.y < 20) {
          g.alpha = Math.min(g.alpha + 0.015, g.maxAlpha);
        } else if (distToBottom < 40) {
          g.alpha = Math.max(g.alpha - 0.012, 0);
        } else {
          g.alpha += (g.maxAlpha - g.alpha) * 0.03;
        }

        if (g.y > h + 10 || g.alpha <= 0) {
          Object.assign(g, spawnGrain(true));
        }

        // Color: white to warm cream
        const r = 255;
        const gr = Math.round(255 - g.warmth * 35);
        const b = Math.round(255 - g.warmth * 70);

        // Draw grain as soft circle with glow
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${gr},${b},${g.alpha})`;
        ctx.fill();

        // Soft glow around grain
        if (g.size > 1.8 && g.alpha > 0.2) {
          const glowR = g.size * 3;
          const gradient = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, glowR);
          gradient.addColorStop(0, `rgba(${r},${gr},${b},${g.alpha * 0.3})`);
          gradient.addColorStop(1, `rgba(${r},${gr},${b},0)`);
          ctx.beginPath();
          ctx.arc(g.x, g.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      // Spawn & draw glow pulses
      glowTimer++;
      if (glowTimer > 80 && glows.length < maxGlows) {
        glows.push(spawnGlow());
        glowTimer = 0;
      }

      for (let i = glows.length - 1; i >= 0; i--) {
        const gl = glows[i];

        if (gl.phase === "grow") {
          gl.radius += gl.growSpeed;
          gl.alpha += (gl.maxAlpha - gl.alpha) * 0.04;
          if (gl.radius >= gl.maxRadius) gl.phase = "fade";
        } else {
          gl.alpha -= gl.fadeSpeed;
        }

        if (gl.alpha <= 0) {
          glows.splice(i, 1);
          continue;
        }

        const gradient = ctx.createRadialGradient(
          gl.x, gl.y, 0,
          gl.x, gl.y, gl.radius
        );
        gradient.addColorStop(0, `rgba(255,255,255,${gl.alpha})`);
        gradient.addColorStop(0.4, `rgba(255,250,240,${gl.alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(255,245,230,0)`);
        ctx.beginPath();
        ctx.arc(gl.x, gl.y, gl.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Spawn & draw time ticks
      tickTimer++;
      if (tickTimer > 50 && ticks.length < maxTicks) {
        ticks.push(spawnTick());
        tickTimer = 0;
      }

      for (let i = ticks.length - 1; i >= 0; i--) {
        const tk = ticks[i];
        tk.timer++;

        if (tk.phase === "in") {
          tk.alpha = Math.min(tk.alpha + 0.008, tk.maxAlpha);
          if (tk.alpha >= tk.maxAlpha) tk.phase = "hold";
        } else if (tk.phase === "hold") {
          if (tk.timer > tk.holdTime) tk.phase = "out";
        } else {
          tk.alpha -= 0.006;
        }

        if (tk.alpha <= 0) {
          ticks.splice(i, 1);
          continue;
        }

        // Draw tick as a short vertical line
        ctx.beginPath();
        ctx.moveTo(tk.x, tk.y);
        ctx.lineTo(tk.x, tk.y + tk.height);
        ctx.strokeStyle = `rgba(255,255,255,${tk.alpha})`;
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [color, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 3 }}
    />
  );
}
