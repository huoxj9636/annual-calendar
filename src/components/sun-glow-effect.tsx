'use client';

import { useEffect, useRef, useState } from 'react';

interface SunPhase {
  glowColor: string;
  coreColor: string;
  rayColor: string;
  brightness: number;
  size: number;
}

function getSunPhase(hour: number): SunPhase {
  if (hour >= 5 && hour < 7) {
    return { glowColor: '#FFB74D', coreColor: '#FFF176', rayColor: '#FFE082', brightness: 0.7, size: 60 };
  }
  if (hour >= 7 && hour < 10) {
    return { glowColor: '#FFD54F', coreColor: '#FFF9C4', rayColor: '#FFF59D', brightness: 0.85, size: 70 };
  }
  if (hour >= 10 && hour < 14) {
    return { glowColor: '#FFF9C4', coreColor: '#FFFFFF', rayColor: '#FFFDE7', brightness: 1.0, size: 80 };
  }
  if (hour >= 14 && hour < 17) {
    return { glowColor: '#FFCC80', coreColor: '#FFE0B2', rayColor: '#FFD180', brightness: 0.8, size: 70 };
  }
  if (hour >= 17 && hour < 19) {
    return { glowColor: '#FF8A65', coreColor: '#FFAB91', rayColor: '#FF9E80', brightness: 0.65, size: 75 };
  }
  if (hour >= 19 && hour < 21) {
    return { glowColor: '#CE93D8', coreColor: '#E1BEE7', rayColor: '#F3E5F5', brightness: 0.35, size: 55 };
  }
  // 夜晚
  return { glowColor: '#90CAF9', coreColor: '#BBDEFB', rayColor: '#E3F2FD', brightness: 0.2, size: 45 };
}

export function SunGlowEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const phaseRef = useRef<SunPhase>(getSunPhase(12));
  const animRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const hour = new Date().getHours();
      phaseRef.current = getSunPhase(hour);
    };
    update();
    const timer = setInterval(update, 60000);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      life: number; maxLife: number;
      size: number; alpha: number;
      hue: number;
    }

    const particles: Particle[] = [];
    const MAX_PARTICLES = 60;

    function spawnParticle(w: number, h: number) {
      const phase = phaseRef.current;
      return {
        x: Math.random() * w,
        y: Math.random() * h * 0.8,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.4,
        life: 0,
        maxLife: 200 + Math.random() * 300,
        size: 1 + Math.random() * 2.5,
        alpha: 0.3 + Math.random() * 0.5 * phase.brightness,
        hue: 30 + Math.random() * 30,
      };
    }

    // 初始化粒子
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = spawnParticle(1, 1);
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;
      ctx.clearRect(0, 0, w, h);

      const phase = phaseRef.current;
      const sunX = w * 0.32;
      const sunY = h * 0.55;
      const r = phase.size;

      // 1. 外层巨大光晕
      const outerR = Math.max(2, r * 5);
      const outerGrad = ctx.createRadialGradient(sunX, sunY, Math.max(1, r * 0.5), sunX, sunY, outerR);
      outerGrad.addColorStop(0, phase.glowColor + 'AA');
      outerGrad.addColorStop(0.3, phase.glowColor + '55');
      outerGrad.addColorStop(0.7, phase.glowColor + '18');
      outerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. 中层辉光
      const midR = Math.max(2, r * 2.5);
      const midGrad = ctx.createRadialGradient(sunX, sunY, Math.max(1, r * 0.2), sunX, sunY, midR);
      midGrad.addColorStop(0, phase.coreColor + 'CC');
      midGrad.addColorStop(0.4, phase.glowColor + '66');
      midGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = midGrad;
      ctx.fillRect(0, 0, w, h);

      // 3. 太阳核心圆盘
      const coreR = Math.max(2, r * 0.6);
      const coreGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, coreR);
      coreGrad.addColorStop(0, '#FFFFFFEE');
      coreGrad.addColorStop(0.3, phase.coreColor + 'DD');
      coreGrad.addColorStop(0.7, phase.glowColor + '88');
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, coreR, 0, Math.PI * 2);
      ctx.fill();

      // 4. 光线射线 - 旋转的十字光芒
      ctx.save();
      ctx.translate(sunX, sunY);
      const time = Date.now() * 0.0003;
      ctx.rotate(time);
      const rayCount = 8;
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const rayLen = r * 3 + Math.sin(time * 2 + i) * r * 0.5;
        ctx.save();
        ctx.rotate(angle);
        const rayGrad = ctx.createLinearGradient(0, 0, rayLen, 0);
        rayGrad.addColorStop(0, phase.coreColor + '99');
        rayGrad.addColorStop(0.3, phase.rayColor + '44');
        rayGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(rayLen, -0.5);
        ctx.lineTo(rayLen, 0.5);
        ctx.lineTo(0, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // 5. 粒子 - 微尘漂浮
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        if (p.life > p.maxLife || p.y < -10 || p.x < -10 || p.x > w + 10) {
          particles[i] = spawnParticle(w, h);
          particles[i].y = h * 0.3 + Math.random() * h * 0.6;
          continue;
        }

        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(1, lifeRatio * 5);
        const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1;
        const a = p.alpha * fadeIn * fadeOut * phase.brightness;

        if (a > 0.01) {
          ctx.save();
          ctx.globalAlpha = a;
          // 辉光
          const glowR = Math.max(1, p.size * 3);
          const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
          glowGrad.addColorStop(0, `hsla(${p.hue}, 80%, 85%, 0.8)`);
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
          // 核心
          ctx.fillStyle = `hsla(${p.hue}, 60%, 95%, 1)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size * 0.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    // 设置canvas尺寸
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resizeCanvas();
    const resizeObs = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) resizeObs.observe(canvas.parentElement);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(animRef.current);
      resizeObs.disconnect();
    };
  }, []);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 2, mixBlendMode: 'screen' }}
    />
  );
}
