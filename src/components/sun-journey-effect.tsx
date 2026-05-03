"use client";

import { useEffect, useRef } from "react";

interface SunJourneyProps {
  /** hex color from skin swatch, used to tint the sun glow */
  color?: string;
  /** 1 = default, lower = subtler */
  intensity?: number;
}

/**
 * 日出东方·日落西方 — 时间流逝动效
 *
 * 一轮柔光从画面左侧缓缓升起，沿弧线横越天空，最终从右侧落下，
 * 周而复始，象征日月轮转、时光如梭。
 *
 * 与头图背景融合的设计:
 *   - 太阳是一个柔和的大面积径向渐变光晕，不是实心圆
 *   - 光晕颜色从暖金 → 淡橙 → 白，自然融入水彩背景
 *   - 底部有一条极淡的地平线光带，随太阳位置变化明暗
 *   - 天空色温随太阳位置微妙偏移 (偏暖/偏冷)
 *   - 全部使用 globalCompositeOperation = "lighter" 加法混合，只增亮不遮挡
 */
export function SunJourneyEffect({ color, intensity = 1 }: SunJourneyProps) {
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

    // Parse skin color for tinting
    let tintR = 255, tintG = 200, tintB = 100;
    if (color) {
      const hex = color.replace("#", "");
      if (hex.length === 6) {
        tintR = parseInt(hex.substring(0, 2), 16);
        tintG = parseInt(hex.substring(2, 4), 16);
        tintB = parseInt(hex.substring(4, 6), 16);
      }
    }
    // Mix tint with warm gold: 60% tint + 40% gold
    const sunR = Math.round(tintR * 0.5 + 255 * 0.5);
    const sunG = Math.round(Math.min(tintG * 0.4 + 200 * 0.6, 255));
    const sunB = Math.round(Math.min(tintB * 0.2 + 80 * 0.8, 255));

    // Sun journey cycle — t goes 0→1 over one full cycle
    let t = 0;
    const cycleMs = 25000 / intensity; // 25s per cycle, faster with higher intensity

    // Star-like sparkles that appear when sun is at low positions
    interface Sparkle {
      x: number;
      y: number;
      alpha: number;
      maxAlpha: number;
      size: number;
      phase: number;
      speed: number;
    }
    const sparkles: Sparkle[] = [];
    const maxSparkles = 12;

    const spawnSparkle = (): Sparkle => ({
      x: Math.random() * W(),
      y: 8 + Math.random() * (H() * 0.6),
      alpha: 0,
      maxAlpha: 0.15 + Math.random() * 0.25,
      size: 1 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
    });

    for (let i = 0; i < maxSparkles; i++) {
      sparkles.push(spawnSparkle());
    }

    let lastTime = performance.now();

    const draw = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      const w = W();
      const h = H();

      // Skip frame if canvas not ready
      if (w < 1 || h < 1) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // Advance time
      t += dt / cycleMs;
      if (t > 1) t -= 1;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // ── Sun position along arc ──────────────────────────
      // Arc: rises from left, peaks in center, sets to right
      // x: 0→w linear
      // y: follows a parabolic arc, peaking at center (highest point = low y)
      const sunX = t * w;
      const arcPeak = h * 0.15; // How high the sun rises
      const baseY = h * 0.85;   // Sun at horizon when at edges
      const sunY = baseY - (baseY - arcPeak) * 4 * t * (1 - t);

      // Sun height factor: 0 at edges (horizon), 1 at peak
      const heightFactor = 4 * t * (1 - t);

      // ── Sky color temperature shift ─────────────────────
      // When sun is low (edges): warm amber tint
      // When sun is high (center): neutral/slightly cool
      const warmth = 1 - heightFactor; // 1=warm at horizon, 0=neutral at peak
      const skyAlpha = 0.03 * intensity * warmth;

      if (skyAlpha > 0.005) {
        const skyGrad = ctx.createLinearGradient(0, 0, w, 0);
        // Warm side (near sun)
        const warmAlpha = skyAlpha * (sunX < w / 2 ? 0.8 : 0.4);
        const coolAlpha = skyAlpha * (sunX < w / 2 ? 0.2 : 0.6);
        skyGrad.addColorStop(0, `rgba(${sunR},${Math.round(sunG * 0.7)},${Math.round(sunB * 0.5)},${warmAlpha})`);
        skyGrad.addColorStop(1, `rgba(${Math.round(sunR * 0.6)},${Math.round(sunG * 0.8)},${sunB},${coolAlpha})`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Sun glow (main) ─────────────────────────────────
      // Large soft radial gradient, blended with "lighter"
      const sunRadius = Math.max(1, (60 + 40 * heightFactor) * intensity);
      const sunAlpha = (0.08 + 0.12 * heightFactor) * intensity;

      const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
      // Core: bright warm white
      sunGrad.addColorStop(0, `rgba(255,252,240,${sunAlpha})`);
      // Mid: skin-tinted warm glow
      sunGrad.addColorStop(0.3, `rgba(${sunR},${sunG},${sunB},${sunAlpha * 0.7})`);
      // Edge: fade out
      sunGrad.addColorStop(0.7, `rgba(${sunR},${Math.round(sunG * 0.8)},${Math.round(sunB * 0.6)},${sunAlpha * 0.25})`);
      sunGrad.addColorStop(1, `rgba(${sunR},${Math.round(sunG * 0.6)},${Math.round(sunB * 0.4)},0)`);
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();

      // ── Secondary softer bloom ───────────────────────────
      const bloomR = Math.max(2, sunRadius * 2.2);
      const bloomInnerR = Math.max(1, sunRadius * 0.5);
      const bloomAlpha = sunAlpha * 0.3;
      const bloomGrad = ctx.createRadialGradient(sunX, sunY, bloomInnerR, sunX, sunY, bloomR);
      bloomGrad.addColorStop(0, `rgba(${sunR},${sunG},${sunB},${bloomAlpha})`);
      bloomGrad.addColorStop(0.5, `rgba(${sunR},${Math.round(sunG * 0.7)},${Math.round(sunB * 0.5)},${bloomAlpha * 0.3})`);
      bloomGrad.addColorStop(1, `rgba(${sunR},${Math.round(sunG * 0.5)},${Math.round(sunB * 0.3)},0)`);
      ctx.beginPath();
      ctx.arc(sunX, sunY, bloomR, 0, Math.PI * 2);
      ctx.fillStyle = bloomGrad;
      ctx.fill();

      // ── Horizon light band ───────────────────────────────
      // A subtle horizontal glow at the bottom that brightens when sun is near horizon
      const horizonAlpha = 0.04 * warmth * intensity;
      if (horizonAlpha > 0.003) {
        const hGrad = ctx.createLinearGradient(sunX, h, sunX, h * 0.5);
        hGrad.addColorStop(0, `rgba(${sunR},${sunG},${Math.round(sunB * 0.7)},${horizonAlpha})`);
        hGrad.addColorStop(0.4, `rgba(${sunR},${Math.round(sunG * 0.6)},${Math.round(sunB * 0.5)},${horizonAlpha * 0.3})`);
        hGrad.addColorStop(1, `rgba(${sunR},${Math.round(sunG * 0.4)},${Math.round(sunB * 0.3)},0)`);
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);
      }

      // ── Sparkles (star-like dots, more visible when sun is low) ──
      const sparkleVisibility = warmth * intensity;
      for (const sp of sparkles) {
        sp.phase += sp.speed;
        const twinkle = 0.5 + 0.5 * Math.sin(sp.phase);
        sp.alpha = sp.maxAlpha * sparkleVisibility * twinkle;

        if (sp.alpha > 0.01) {
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,250,${sp.alpha})`;
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";

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
