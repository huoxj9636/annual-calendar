'use client';

import { useEffect, useRef } from 'react';

interface AnalogClockProps {
  size?: number;
  color?: string;
  bgColor?: string;
}

export function AnalogClock({ size = 64, color = 'rgba(255,255,255,0.85)', bgColor = 'rgba(255,255,255,0.08)' }: AnalogClockProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const now = new Date();
      const h = now.getHours() % 12;
      const m = now.getMinutes();
      const s = now.getSeconds();
      const ms = now.getMilliseconds();

      // Smooth second hand
      const secAngle = (s + ms / 1000) * 6; // 360/60 = 6 deg/sec
      const minAngle = (m + s / 60) * 6;    // smooth minute
      const hourAngle = (h + m / 60) * 30;  // 360/12 = 30 deg/hour

      if (svgRef.current) {
        const hourHand = svgRef.current.querySelector('[data-hand="hour"]') as SVGGElement | null;
        const minHand = svgRef.current.querySelector('[data-hand="minute"]') as SVGGElement | null;
        const secHand = svgRef.current.querySelector('[data-hand="second"]') as SVGGElement | null;
        if (hourHand) hourHand.setAttribute('transform', `rotate(${hourAngle})`);
        if (minHand) minHand.setAttribute('transform', `rotate(${minAngle})`);
        if (secHand) secHand.setAttribute('transform', `rotate(${secAngle})`);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const r = size / 2;
  const cx = r;
  const cy = r;

  // Clock face radius
  const faceR = r - 2;

  // Hour markers
  const markers = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const isMain = i % 3 === 0;
    const outerR = faceR - 1;
    const innerR = isMain ? faceR - 5 : faceR - 3.5;
    return {
      x1: cx + outerR * Math.cos(angle),
      y1: cy + outerR * Math.sin(angle),
      x2: cx + innerR * Math.cos(angle),
      y2: cy + innerR * Math.sin(angle),
      isMain,
    };
  });

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
    >
      {/* Clock face */}
      <circle cx={cx} cy={cy} r={faceR} fill={bgColor} stroke={color} strokeWidth={1.2} opacity={0.9} />

      {/* Hour markers */}
      {markers.map((m, i) => (
        <line
          key={i}
          x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
          stroke={color}
          strokeWidth={m.isMain ? 1.5 : 0.8}
          strokeLinecap="round"
          opacity={m.isMain ? 0.9 : 0.5}
        />
      ))}

      {/* Hour hand */}
      <g data-hand="hour">
        <line x1={cx} y1={cy} x2={cx} y2={cy - faceR * 0.45} stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
      </g>

      {/* Minute hand */}
      <g data-hand="minute">
        <line x1={cx} y1={cy} x2={cx} y2={cy - faceR * 0.65} stroke={color} strokeWidth={1.5} strokeLinecap="round" opacity={0.8} />
      </g>

      {/* Second hand */}
      <g data-hand="second">
        <line x1={cx} y1={cy + faceR * 0.12} x2={cx} y2={cy - faceR * 0.72} stroke={color} strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
      </g>

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} fill={color} opacity={0.9} />
    </svg>
  );
}
