'use client';

import { useEffect, useRef } from 'react';

interface AnalogClockProps {
  size?: number;
  color?: string;
  bgColor?: string;
  showNumber?: boolean;
}

export function AnalogClock({ size = 72, color = 'rgba(255,255,255,0.85)', bgColor = 'rgba(255,255,255,0.08)', showNumber = false }: AnalogClockProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cx = size / 2;
  const cy = size / 2;
  const faceR = size / 2 - 3;

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const now = new Date();
      const h = now.getHours() % 12;
      const m = now.getMinutes();
      const s = now.getSeconds();
      const ms = now.getMilliseconds();

      const secAngle = (s + ms / 1000) * 6;
      const minAngle = (m + s / 60) * 6;
      const hourAngle = (h + m / 60) * 30;

      if (svgRef.current) {
        const hourHand = svgRef.current.querySelector('[data-hand="hour"]') as SVGGElement | null;
        const minHand = svgRef.current.querySelector('[data-hand="minute"]') as SVGGElement | null;
        const secHand = svgRef.current.querySelector('[data-hand="second"]') as SVGGElement | null;
        if (hourHand) hourHand.setAttribute('transform', `rotate(${hourAngle} ${cx} ${cy})`);
        if (minHand) minHand.setAttribute('transform', `rotate(${minAngle} ${cx} ${cy})`);
        if (secHand) secHand.setAttribute('transform', `rotate(${secAngle} ${cx} ${cy})`);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [cx, cy]);

  // Minute ticks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * 6 - 90) * (Math.PI / 180);
    const isHour = i % 5 === 0;
    const outerR = faceR - 1;
    const innerR = isHour ? faceR - 4 : faceR - 2;
    return {
      x1: cx + outerR * Math.cos(angle),
      y1: cy + outerR * Math.sin(angle),
      x2: cx + innerR * Math.cos(angle),
      y2: cy + innerR * Math.sin(angle),
      isHour,
    };
  });

  // Hour numbers (only 12, 3, 6, 9)
  const mainNumbers = [12, 3, 6, 9].map((num) => {
    const i = num % 12;
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const numR = faceR - 10;
    return {
      num,
      x: cx + numR * Math.cos(angle),
      y: cy + numR * Math.sin(angle),
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
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={faceR + 1} fill="none" stroke={color} strokeWidth={1} opacity={0.15} />
      {/* Clock face */}
      <circle cx={cx} cy={cy} r={faceR} fill={bgColor} stroke={color} strokeWidth={1.5} opacity={0.85} />

      {/* Ticks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={color}
          strokeWidth={t.isHour ? 2 : 0.7}
          strokeLinecap="round"
          opacity={t.isHour ? 0.9 : 0.35}
        />
      ))}

      {/* Main numbers (12, 3, 6, 9) */}
      {mainNumbers.map((n, i) => (
        <text
          key={i}
          x={n.x} y={n.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.08}
          fontWeight="500"
          fill={color}
          opacity={0.8}
        >
          {n.num}
        </text>
      ))}

      {/* Hour hand */}
      <g data-hand="hour">
        <line x1={cx} y1={cy + faceR * 0.08} x2={cx} y2={cy - faceR * 0.48} stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.95} />
      </g>

      {/* Minute hand */}
      <g data-hand="minute">
        <line x1={cx} y1={cy + faceR * 0.08} x2={cx} y2={cy - faceR * 0.68} stroke={color} strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
      </g>

      {/* Second hand */}
      <g data-hand="second">
        <line x1={cx} y1={cy + faceR * 0.15} x2={cx} y2={cy - faceR * 0.75} stroke="#ef4444" strokeWidth={0.9} strokeLinecap="round" />
        <circle cx={cx} cy={cy + faceR * 0.15} r={1.2} fill="#ef4444" />
      </g>

      {/* Center decoration - small sun motif */}
      <g opacity={0.12}>
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * 45) * (Math.PI / 180);
          const ir = faceR * 0.18;
          const or = faceR * 0.28;
          return (
            <line
              key={i}
              x1={cx + ir * Math.cos(angle)}
              y1={cy + ir * Math.sin(angle)}
              x2={cx + or * Math.cos(angle)}
              y2={cy + or * Math.sin(angle)}
              stroke={color}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={faceR * 0.13} fill="none" stroke={color} strokeWidth={0.8} />
      </g>

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={2.5} fill={color} />
      <circle cx={cx} cy={cy} r={1.2} fill={bgColor} />
    </svg>
  );
}
