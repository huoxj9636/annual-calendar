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
}

interface ParticleEffectProps {
  color?: string;
  count?: number;
}

export default function ParticleEffect({ color, count = 60 }: ParticleEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  // Parse color to get base hue
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

    const createParticle = (): Particle => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      return {
        x: Math.random() * w,
        y: Math.random() * h - h,
        size: Math.random() * 2.5 + 0.8,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: Math.random() * 0.4 + 0.15,
        opacity: Math.random() * 0.5 + 0.15,
        life: 0,
        maxLife: Math.random() * 400 + 200,
        hue: baseHue + (Math.random() - 0.5) * 40,
      };
    };

    // Initialize particles
    particlesRef.current = Array.from({ length: count }, () => {
      const p = createParticle();
      p.y = Math.random() * canvas.offsetHeight; // spread initially
      p.life = Math.random() * p.maxLife;
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

        // Fade in/out based on life
        const lifeRatio = p.life / p.maxLife;
        let alpha = p.opacity;
        if (lifeRatio < 0.1) alpha *= lifeRatio / 0.1;
        else if (lifeRatio > 0.8) alpha *= (1 - lifeRatio) / 0.2;

        // Draw particle as a soft circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 30%, 90%, ${alpha})`;
        ctx.fill();

        // Respawn if dead or out of bounds
        if (p.life >= p.maxLife || p.y > h + 10 || p.x < -10 || p.x > w + 10) {
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
