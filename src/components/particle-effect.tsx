'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  life: number;
  maxLife: number;
  hue: number;
  tailLen: number;
  flicker: number;
  flickerSpeed: number;
}

interface ParticleEffectProps {
  color?: string;
  count?: number;
}

export default function ParticleEffect({ color, count = 50 }: ParticleEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  const getBaseHue = (c: string): number => {
    if (!c || c === '#fff' || c === '#ffffff' || c === 'white') return 45;
    const hex = c.replace('#', '');
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) return 45;
      let h = 0;
      const d = max - min;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
      return h * 360;
    }
    return 45;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseHue = getBaseHue(color ?? '#ffffff');

    const resize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();

    const createParticle = (fromLeft?: boolean): Particle => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const goingRight = fromLeft !== undefined ? fromLeft : Math.random() > 0.3;
      return {
        x: goingRight ? -10 - Math.random() * 40 : w + 10 + Math.random() * 40,
        y: Math.random() * h,
        size: Math.random() * 1.8 + 0.5,
        speedX: goingRight ? (Math.random() * 0.6 + 0.2) : -(Math.random() * 0.4 + 0.1),
        speedY: (Math.random() - 0.5) * 0.08,
        opacity: Math.random() * 0.4 + 0.1,
        life: 0,
        maxLife: Math.random() * 500 + 300,
        hue: baseHue + (Math.random() - 0.5) * 30,
        tailLen: Math.random() * 18 + 8,
        flicker: Math.random() * Math.PI * 2,
        flickerSpeed: Math.random() * 0.03 + 0.01,
      };
    };

    // Initialize particles spread across the canvas
    particlesRef.current = Array.from({ length: count }, () => {
      const p = createParticle();
      p.x = Math.random() * canvas.offsetWidth;
      p.life = Math.random() * p.maxLife * 0.6;
      return p;
    });

    const animate = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life++;
        p.flicker += p.flickerSpeed;

        // Life-based fade
        const lifeRatio = p.life / p.maxLife;
        let alpha = p.opacity;
        if (lifeRatio < 0.15) alpha *= lifeRatio / 0.15;
        else if (lifeRatio > 0.75) alpha *= (1 - lifeRatio) / 0.25;

        // Gentle flicker
        alpha *= 0.7 + 0.3 * Math.sin(p.flicker);
        alpha = Math.max(0, Math.min(1, alpha));

        if (alpha < 0.01) continue;

        // Draw tail (line trailing behind particle)
        const tailX = p.x - p.speedX * p.tailLen;
        const tailY = p.y - p.speedY * p.tailLen;
        const grad = ctx.createLinearGradient(tailX, tailY, p.x, p.y);
        grad.addColorStop(0, `hsla(${p.hue}, 25%, 88%, 0)`);
        grad.addColorStop(1, `hsla(${p.hue}, 25%, 88%, ${alpha})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.size * 0.8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw head glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 20%, 95%, ${alpha})`;
        ctx.fill();

        // Respawn if dead or out of bounds
        if (p.life >= p.maxLife || p.x > w + 50 || p.x < -50 || p.y < -20 || p.y > h + 20) {
          particles[i] = createParticle();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [color, count]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
}
