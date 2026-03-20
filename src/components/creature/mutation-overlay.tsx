"use client";

import { useMemo } from "react";

interface MutationOverlayProps {
  progress: number; // 0 to 1
  active: boolean;
}

/**
 * Visual overlay shown when a creature is actively mutating.
 * Renders expanding ripples, molecular particles, a progress ring,
 * and a completion flash effect layered on top of the creature SVG.
 */
export function MutationOverlay({ progress, active }: MutationOverlayProps) {
  const helixParticles = useMemo(() => {
    const pts: { cx: number; cy: number; r: number; delay: string; strand: number }[] = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const angle = t * Math.PI * 4; // two full rotations
      const yPos = 140 + t * 120;
      const strand = i % 2;
      const xOffset = Math.sin(angle + strand * Math.PI) * 30;
      pts.push({
        cx: 200 + xOffset,
        cy: yPos,
        r: 1.5 + (i % 3) * 0.5,
        delay: `${(i * 0.12).toFixed(2)}s`,
        strand,
      });
    }
    return pts;
  }, []);

  if (!active) return null;

  const progressAngle = progress * 360;
  const ringR = 140;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset = circumference * (1 - progress);
  const flashOpacity = progress >= 0.98 ? 0.7 : 0;

  return (
    <g className="mutation-overlay">
      {/* Expanding ripple rings */}
      <circle
        cx={200}
        cy={200}
        r={60}
        fill="none"
        stroke="hsl(260, 80%, 65%)"
        strokeWidth={1}
        opacity={0.4}
        style={{
          animation: "mutation-ripple 2s ease-out infinite",
          transformOrigin: "200px 200px",
        }}
      />
      <circle
        cx={200}
        cy={200}
        r={60}
        fill="none"
        stroke="hsl(180, 80%, 55%)"
        strokeWidth={0.8}
        opacity={0.3}
        style={{
          animation: "mutation-ripple 2s ease-out 0.7s infinite",
          transformOrigin: "200px 200px",
        }}
      />
      <circle
        cx={200}
        cy={200}
        r={60}
        fill="none"
        stroke="hsl(300, 70%, 60%)"
        strokeWidth={0.6}
        opacity={0.25}
        style={{
          animation: "mutation-ripple 2s ease-out 1.3s infinite",
          transformOrigin: "200px 200px",
        }}
      />

      {/* DNA helix molecular particles */}
      <g
        style={{
          animation: "helix-spin 4s linear infinite",
          transformOrigin: "200px 200px",
        }}
      >
        {helixParticles.map((p, i) => (
          <circle
            key={`helix-${i}`}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={p.strand === 0 ? "hsl(260, 90%, 70%)" : "hsl(180, 90%, 65%)"}
            opacity={0.6}
            style={{
              animation: `helix-particle-pulse 1.5s ease-in-out ${p.delay} infinite`,
            }}
          />
        ))}
        {/* Cross-links between strands */}
        {Array.from({ length: 8 }).map((_, i) => {
          const t = (i + 0.5) / 8;
          const yPos = 140 + t * 120;
          const angle = t * Math.PI * 4;
          const x1 = 200 + Math.sin(angle) * 30;
          const x2 = 200 + Math.sin(angle + Math.PI) * 30;
          return (
            <line
              key={`link-${i}`}
              x1={x1}
              y1={yPos}
              x2={x2}
              y2={yPos}
              stroke="hsl(220, 60%, 50%)"
              strokeWidth={0.5}
              opacity={0.3}
              strokeDasharray="2 3"
            />
          );
        })}
      </g>

      {/* Progress ring */}
      <circle
        cx={200}
        cy={200}
        r={ringR}
        fill="none"
        stroke="hsl(260, 30%, 25%)"
        strokeWidth={2}
        opacity={0.3}
      />
      <circle
        cx={200}
        cy={200}
        r={ringR}
        fill="none"
        stroke="url(#mutation-progress-grad)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        opacity={0.8}
        transform="rotate(-90 200 200)"
      />

      {/* Progress gradient definition */}
      <defs>
        <linearGradient id="mutation-progress-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(260, 90%, 65%)" />
          <stop offset="50%" stopColor="hsl(180, 90%, 60%)" />
          <stop offset="100%" stopColor="hsl(120, 90%, 60%)" />
        </linearGradient>
      </defs>

      {/* Completion flash */}
      <circle
        cx={200}
        cy={200}
        r={160}
        fill="white"
        opacity={flashOpacity}
        style={{
          transition: "opacity 0.3s ease-out",
        }}
      />
    </g>
  );
}
