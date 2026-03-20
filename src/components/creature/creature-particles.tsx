"use client";

import { useMemo } from "react";

interface CreatureParticlesProps {
  color: string;
  count: number;
  intensity: number;
}

/**
 * Floating bioluminescent particles rendered as SVG circles.
 * Each particle gets a unique animation delay and size for organic variety.
 */
export function CreatureParticles({
  color,
  count,
  intensity,
}: CreatureParticlesProps) {
  const particles = useMemo(() => {
    const result: {
      cx: number;
      cy: number;
      r: number;
      opacity: number;
      animClass: string;
      delay: string;
    }[] = [];

    for (let i = 0; i < count; i++) {
      // Distribute particles in a loose ring around center (200, 200)
      const angle = (Math.PI * 2 * i) / count + (i * 0.7);
      const dist = 80 + (i % 3) * 30 + (i % 2) * 15;
      const cx = 200 + Math.cos(angle) * dist;
      const cy = 200 + Math.sin(angle) * dist;
      const r = 1 + (i % 3) * 0.8;
      const opacity = 0.2 + intensity * 0.5 * ((i % 3 + 1) / 3);
      const animVariant = (i % 3) + 1;
      const delay = `${(i * 0.6).toFixed(1)}s`;

      result.push({
        cx,
        cy,
        r,
        opacity,
        animClass: `particle-float-${animVariant}`,
        delay,
      });
    }

    return result;
  }, [count, intensity]);

  if (count <= 0 || intensity <= 0) return null;

  return (
    <g className="creature-particles">
      {particles.map((p, i) => (
        <circle
          key={`particle-${i}`}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={color}
          opacity={p.opacity}
          style={{
            animation: `${p.animClass} ${3 + (i % 3)}s ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}
    </g>
  );
}
