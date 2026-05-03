"use client";

import { useEffect, useRef } from "react";

interface TimeFlowEffectProps {
  color?: string;
  intensity?: number;
}

/**
 * 时间流逝动效 — 沙漏流沙 + 光晕脉冲
 *
 * 设计意象:
 *   1. 沙粒: 从上方随机位置缓缓下坠，带有微微左右摆动，像沙漏中的细沙
 *   2. 光晕: 底部随机位置出现微弱光点，缓缓膨胀后消逝，像时间刻度的闪烁
 *   3. 整体氛围: 安静、缓慢、不可逆，象征时间无声流逝
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

    // Parse base color
    const parseColor = (c: string) => {
      if (c && c.startsWith("#") && c.length >= 7) {
        return {
          r: parseInt(c.slice(1, 3), 16),
          g: parseInt(c.slice(3, 5), 16),
          b: parseInt(c.slice(5, 7), 16),
        };
      }
      return { r: 200, g: 180, b: 160 };
    };

    const base = parseColor(color || "#c8b496");
    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;

    // ── Sand grains ──────────────────────────────────────
    interface Grain {
      x: number;
      y: number;
      vy: number;        // fall speed
      vx: number;        // horizontal sway
      size: number;
      alpha: number;
      maxAlpha: number;
      swayPhase: number;
      swaySpeed: number;
      colorShift: number; // subtle hue variation
    }

    const grainCount = Math.round(35 * intensity);
    const grains: Grain[] = [];

    const spawnGrain = (fromTop = true): Grain => ({
      x: Math.random() * W(),
      y: fromTop ? -Math.random() * 20 : Math.random() * H(),
      vy: 0.12 + Math.random() * 0.22,  // slow fall
      vx: (Math.random() - 0.5) * 0.1,
      size: 0.6 + Math.random() * 1.2,
      alpha: 0,
      maxAlpha: 0.15 + Math.random() * 0.25,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.003 + Math.random() * 0.005,
      colorShift: (Math.random() - 0.5) * 40,
    });

    for (let i = 0; i < grainCount; i++) {
      grains.push(spawnGrain(false));
    }

    // ── Glow pulses (time markers) ───────────────────────
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
      colorShift: number;
    }

    const glows: Glow[] = [];
    const maxGlows = Math.round(5 * intensity);
    let glowTimer = 0;

    const spawnGlow = (): Glow => ({
      x: 40 + Math.random() * (W() - 80),
      y: H() * 0.4 + Math.random() * H() * 0.5,
      radius: 0,
      maxRadius: 15 + Math.random() * 30,
      alpha: 0,
      maxAlpha: 0.06 + Math.random() * 0.06,
      growSpeed: 0.15 + Math.random() * 0.2,
      fadeSpeed: 0.004 + Math.random() * 0.006,
      phase: "grow",
      colorShift: (Math.random() - 0.5) * 30,
    });

    // ── Time threads (thin flowing lines) ────────────────
    interface Thread {
      points: { x: number; y: number }[];
      speed: number;
      offset: number;
      alpha: number;
      maxAlpha: number;
      amplitude: number;
      wavelength: number;
      y0: number; // base y position
    }

    const threadCount = Math.round(3 * intensity);
    const threads: Thread[] = [];

    for (let i = 0; i < threadCount; i++) {
      threads.push({
        points: [],
        speed: 0.15 + Math.random() * 0.2,
        offset: Math.random() * 1000,
        alpha: 0,
        maxAlpha: 0.04 + Math.random() * 0.05,
        amplitude: 3 + Math.random() * 6,
        wavelength: 80 + Math.random() * 120,
        y0: H() * (0.3 + Math.random() * 0.5),
      });
    }

    // ── Animation loop ───────────────────────────────────
    const rgba = (r: number, g: number, b: number, a: number) =>
      `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

    const draw = () => {
      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);

      // Draw time threads (flowing sine waves)
      for (const t of threads) {
        t.offset += t.speed;
        t.alpha += (t.maxAlpha - t.alpha) * 0.01;

        ctx.beginPath();
        ctx.strokeStyle = rgba(
          base.r + 30,
          base.g + 30,
          base.b + 30,
          t.alpha
        );
        ctx.lineWidth = 0.5;

        for (let x = 0; x < w; x += 3) {
          const y =
            t.y0 +
            Math.sin((x + t.offset) / t.wavelength) * t.amplitude +
            Math.sin((x + t.offset * 0.7) / (t.wavelength * 0.5)) * (t.amplitude * 0.3);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw sand grains
      for (const g of grains) {
        // Sway
        g.swayPhase += g.swaySpeed;
        g.x += g.vx + Math.sin(g.swayPhase) * 0.15;
        g.y += g.vy;

        // Fade in near top, fade out near bottom
        const distToBottom = h - g.y;
        if (g.y < 10) {
          g.alpha = Math.min(g.alpha + 0.005, g.maxAlpha);
        } else if (distToBottom < 30) {
          g.alpha = Math.max(g.alpha - 0.008, 0);
        } else {
          g.alpha += (g.maxAlpha - g.alpha) * 0.02;
        }

        // Reset when fallen off
        if (g.y > h + 5 || g.alpha <= 0) {
          Object.assign(g, spawnGrain(true));
        }

        // Draw grain as a tiny soft circle
        const cr = Math.max(0, Math.min(255, base.r + g.colorShift));
        const cg = Math.max(0, Math.min(255, base.g + g.colorShift * 0.6));
        const cb = Math.max(0, Math.min(255, base.b + g.colorShift * 0.3));

        ctx.beginPath();
        ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
        ctx.fillStyle = rgba(cr, cg, cb, g.alpha);
        ctx.fill();
      }

      // Spawn & draw glow pulses
      glowTimer++;
      if (glowTimer > 120 && glows.length < maxGlows) {
        glows.push(spawnGlow());
        glowTimer = 0;
      }

      for (let i = glows.length - 1; i >= 0; i--) {
        const gl = glows[i];

        if (gl.phase === "grow") {
          gl.radius += gl.growSpeed;
          gl.alpha += (gl.maxAlpha - gl.alpha) * 0.03;
          if (gl.radius >= gl.maxRadius) gl.phase = "fade";
        } else {
          gl.alpha -= gl.fadeSpeed;
        }

        if (gl.alpha <= 0) {
          glows.splice(i, 1);
          continue;
        }

        const gr = Math.max(0, Math.min(255, base.r + gl.colorShift));
        const gg = Math.max(0, Math.min(255, base.g + gl.colorShift * 0.5));
        const gb = Math.max(0, Math.min(255, base.b + gl.colorShift * 0.3));

        const gradient = ctx.createRadialGradient(
          gl.x, gl.y, 0,
          gl.x, gl.y, gl.radius
        );
        gradient.addColorStop(0, rgba(gr, gg, gb, gl.alpha));
        gradient.addColorStop(1, rgba(gr, gg, gb, 0));
        ctx.beginPath();
        ctx.arc(gl.x, gl.y, gl.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
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
