'use client';

import { useEffect, useState } from 'react';

interface SunPhase {
  glowColor: string;
  coreColor: string;
  brightness: number;
  size: number;
}

function getSunPhase(hour: number): SunPhase {
  if (hour >= 5 && hour < 7) {
    // 日出 - warm golden
    return {
      glowColor: 'rgba(255, 183, 77, 0.35)',
      coreColor: 'rgba(255, 213, 79, 0.7)',
      brightness: 0.6,
      size: 80,
    };
  }
  if (hour >= 7 && hour < 10) {
    // 早晨 - bright warm white
    return {
      glowColor: 'rgba(255, 224, 130, 0.4)',
      coreColor: 'rgba(255, 245, 200, 0.8)',
      brightness: 0.8,
      size: 90,
    };
  }
  if (hour >= 10 && hour < 14) {
    // 正午 - brightest
    return {
      glowColor: 'rgba(255, 249, 196, 0.45)',
      coreColor: 'rgba(255, 255, 240, 0.9)',
      brightness: 1.0,
      size: 100,
    };
  }
  if (hour >= 14 && hour < 17) {
    // 下午 - warm
    return {
      glowColor: 'rgba(255, 204, 128, 0.38)',
      coreColor: 'rgba(255, 224, 160, 0.75)',
      brightness: 0.75,
      size: 85,
    };
  }
  if (hour >= 17 && hour < 19) {
    // 日落 - deep orange red
    return {
      glowColor: 'rgba(255, 138, 60, 0.35)',
      coreColor: 'rgba(255, 171, 90, 0.65)',
      brightness: 0.5,
      size: 95,
    };
  }
  if (hour >= 19 && hour < 21) {
    // 暮色 - dim warm
    return {
      glowColor: 'rgba(200, 120, 80, 0.2)',
      coreColor: 'rgba(220, 150, 100, 0.4)',
      brightness: 0.25,
      size: 70,
    };
  }
  // 夜晚 - very dim, like moonlight
  return {
    glowColor: 'rgba(180, 200, 230, 0.12)',
    coreColor: 'rgba(200, 215, 240, 0.25)',
    brightness: 0.15,
    size: 55,
  };
}

export function SunGlowEffect() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<SunPhase>({
    glowColor: 'rgba(255, 249, 196, 0.45)',
    coreColor: 'rgba(255, 255, 240, 0.9)',
    brightness: 1.0,
    size: 100,
  });

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const hour = new Date().getHours();
      setPhase(getSunPhase(hour));
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: '32%',
        top: '50%',
        transform: 'translate(-50%, -20%)',
        width: phase.size * 4,
        height: phase.size * 4,
        zIndex: 2,
      }}
    >
      {/* Outer glow - large soft spread */}
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: phase.size * 4,
          height: phase.size * 4,
          background: `radial-gradient(circle, ${phase.glowColor} 0%, transparent 70%)`,
          opacity: phase.brightness,
          filter: 'blur(20px)',
        }}
      />
      {/* Mid glow */}
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: phase.size * 2,
          height: phase.size * 2,
          background: `radial-gradient(circle, ${phase.coreColor} 0%, transparent 65%)`,
          opacity: phase.brightness * 0.9,
          filter: 'blur(8px)',
        }}
      />
      {/* Core - the sun disk */}
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: phase.size * 0.5,
          height: phase.size * 0.5,
          background: `radial-gradient(circle, rgba(255,255,255,${phase.brightness * 0.9}) 0%, ${phase.coreColor} 60%, transparent 100%)`,
          filter: 'blur(2px)',
        }}
      />
      {/* Light rays - subtle spokes */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: phase.size * 3,
          height: phase.size * 3,
          background: `conic-gradient(from 0deg, transparent 0deg, ${phase.glowColor} 5deg, transparent 10deg, transparent 30deg, ${phase.glowColor} 35deg, transparent 40deg, transparent 60deg, ${phase.glowColor} 65deg, transparent 70deg, transparent 90deg, ${phase.glowColor} 95deg, transparent 100deg, transparent 120deg, ${phase.glowColor} 125deg, transparent 130deg, transparent 150deg, ${phase.glowColor} 155deg, transparent 160deg, transparent 180deg, ${phase.glowColor} 185deg, transparent 190deg, transparent 210deg, ${phase.glowColor} 215deg, transparent 220deg, transparent 240deg, ${phase.glowColor} 245deg, transparent 250deg, transparent 270deg, ${phase.glowColor} 275deg, transparent 280deg, transparent 300deg, ${phase.glowColor} 305deg, transparent 310deg, transparent 330deg, ${phase.glowColor} 335deg, transparent 340deg, transparent 360deg)`,
          opacity: phase.brightness * 0.3,
          filter: 'blur(4px)',
        }}
      />
    </div>
  );
}
