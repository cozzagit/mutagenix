'use client';

/**
 * Lab Chamber — a sci-fi containment cylinder/tube that surrounds the creature.
 * Think: sci-fi movie specimen tube with liquid, bubbles, lights, and monitoring equipment.
 */

interface LabChamberProps {
  children: React.ReactNode;
  width: number;   // chamber width in px
  height: number;  // chamber height in px
  mutating?: boolean;
  glowColor?: string;
}

export function LabChamber({ children, width, height, mutating = false, glowColor = '#3d5afe' }: LabChamberProps) {
  const tubeW = width;
  const tubeH = height;
  const padding = 24;
  const totalW = tubeW + padding * 2;
  const totalH = tubeH + padding * 2 + 40; // extra for base

  const tubeLeft = padding;
  const tubeRight = padding + tubeW;
  const tubeTop = padding;
  const tubeBottom = padding + tubeH;
  const capRadius = tubeW * 0.5;

  return (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      {/* Background SVG: the chamber structure */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
      >
        <defs>
          {/* Glass gradient — semi-transparent with edge highlights */}
          <linearGradient id="glass-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.08} />
            <stop offset="15%" stopColor="#ffffff" stopOpacity={0.02} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="85%" stopColor="#ffffff" stopOpacity={0.02} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.08} />
          </linearGradient>

          {/* Liquid gradient — subtle colored fill at the bottom */}
          <linearGradient id="liquid-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={glowColor} stopOpacity={0} />
            <stop offset="60%" stopColor={glowColor} stopOpacity={0.02} />
            <stop offset="100%" stopColor={glowColor} stopOpacity={0.06} />
          </linearGradient>

          {/* Base metallic gradient */}
          <linearGradient id="base-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2a2b38" />
            <stop offset="50%" stopColor="#1a1b24" />
            <stop offset="100%" stopColor="#12131a" />
          </linearGradient>

          {/* Glow filter for the tube rim */}
          <filter id="tube-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>

          {/* Clip path for liquid/bubbles inside tube */}
          <clipPath id="tube-clip">
            <rect x={tubeLeft} y={tubeTop} width={tubeW} height={tubeH} rx={capRadius} />
          </clipPath>
        </defs>

        {/* === OUTER GLOW === */}
        <rect
          x={tubeLeft - 4} y={tubeTop - 4}
          width={tubeW + 8} height={tubeH + 8}
          rx={capRadius + 4}
          fill="none"
          stroke={glowColor}
          strokeWidth={1}
          opacity={mutating ? 0.3 : 0.1}
          filter="url(#tube-glow)"
          style={mutating ? { animation: 'pulse-glow 2s ease-in-out infinite' } : undefined}
        />

        {/* === GLASS TUBE === */}
        {/* Tube outline */}
        <rect
          x={tubeLeft} y={tubeTop}
          width={tubeW} height={tubeH}
          rx={capRadius}
          fill="none"
          stroke="#2a2b38"
          strokeWidth={2}
        />

        {/* Glass highlight — inner edge reflection */}
        <rect
          x={tubeLeft} y={tubeTop}
          width={tubeW} height={tubeH}
          rx={capRadius}
          fill="url(#glass-grad)"
        />

        {/* Liquid fill */}
        <rect
          x={tubeLeft} y={tubeTop}
          width={tubeW} height={tubeH}
          rx={capRadius}
          fill="url(#liquid-grad)"
        />

        {/* === BUBBLES inside the tube === */}
        <g clipPath="url(#tube-clip)" opacity={mutating ? 0.6 : 0.25}>
          {[...Array(8)].map((_, i) => {
            const bx = tubeLeft + 10 + (i * 37) % tubeW;
            const by = tubeBottom - 20 - (i * 47) % (tubeH * 0.7);
            const br = 1.5 + (i % 3) * 1;
            return (
              <circle
                key={`bubble-${i}`}
                cx={bx} cy={by} r={br}
                fill="#ffffff"
                opacity={0.15 + (i % 4) * 0.05}
                style={{
                  animation: `float ${3 + i * 0.7}s ease-in-out ${i * 0.4}s infinite`,
                }}
              />
            );
          })}
        </g>

        {/* === LEFT REFLECTION LINE === */}
        <line
          x1={tubeLeft + 6} y1={tubeTop + capRadius}
          x2={tubeLeft + 6} y2={tubeBottom - capRadius}
          stroke="#ffffff"
          strokeWidth={1}
          opacity={0.06}
          strokeLinecap="round"
        />

        {/* === RIGHT REFLECTION LINE === */}
        <line
          x1={tubeRight - 8} y1={tubeTop + capRadius + 20}
          x2={tubeRight - 8} y2={tubeBottom - capRadius - 10}
          stroke="#ffffff"
          strokeWidth={0.5}
          opacity={0.04}
          strokeLinecap="round"
        />

        {/* === MEASUREMENT MARKS on left side === */}
        {[0.2, 0.4, 0.6, 0.8].map((frac, i) => {
          const my = tubeTop + tubeH * (1 - frac);
          return (
            <g key={`mark-${i}`} opacity={0.15}>
              <line
                x1={tubeLeft} y1={my}
                x2={tubeLeft + 8} y2={my}
                stroke="#ffffff" strokeWidth={0.5}
              />
              <text
                x={tubeLeft + 10} y={my + 3}
                fill="#6b6d7b" fontSize={7} fontFamily="monospace"
              >
                {Math.round(frac * 100)}
              </text>
            </g>
          );
        })}

        {/* === BASE / PLATFORM === */}
        <rect
          x={tubeLeft - 12} y={tubeBottom + 2}
          width={tubeW + 24} height={8}
          rx={3}
          fill="url(#base-grad)"
          stroke="#2a2b38"
          strokeWidth={1}
        />
        {/* Base details — small lights */}
        {[0.2, 0.4, 0.6, 0.8].map((frac, i) => (
          <circle
            key={`light-${i}`}
            cx={tubeLeft + tubeW * frac}
            cy={tubeBottom + 6}
            r={1.5}
            fill={i === 1 ? '#00e5a0' : i === 2 && mutating ? '#ff4466' : '#3d5afe'}
            opacity={0.5}
            style={mutating && i === 2 ? { animation: 'pulse-glow 1s ease-in-out infinite' } : undefined}
          />
        ))}

        {/* Base bottom plate */}
        <rect
          x={tubeLeft - 20} y={tubeBottom + 10}
          width={tubeW + 40} height={5}
          rx={2}
          fill="#12131a"
          stroke="#1a1b24"
          strokeWidth={0.5}
        />

        {/* === TOP CAP / RING === */}
        <ellipse
          cx={tubeLeft + tubeW / 2} cy={tubeTop + 2}
          rx={tubeW * 0.35} ry={3}
          fill="none"
          stroke="#2a2b38"
          strokeWidth={1.5}
        />

        {/* === TUBE CONNECTORS (pipes) on the sides === */}
        {/* Left pipe */}
        <g opacity={0.3}>
          <line x1={tubeLeft - 8} y1={tubeTop + tubeH * 0.3} x2={tubeLeft} y2={tubeTop + tubeH * 0.3}
            stroke="#2a2b38" strokeWidth={3} strokeLinecap="round" />
          <circle cx={tubeLeft - 10} cy={tubeTop + tubeH * 0.3} r={3}
            fill="#1a1b24" stroke="#2a2b38" strokeWidth={1} />
        </g>
        {/* Right pipe */}
        <g opacity={0.3}>
          <line x1={tubeRight} y1={tubeTop + tubeH * 0.6} x2={tubeRight + 8} y2={tubeTop + tubeH * 0.6}
            stroke="#2a2b38" strokeWidth={3} strokeLinecap="round" />
          <circle cx={tubeRight + 10} cy={tubeTop + tubeH * 0.6} r={3}
            fill="#1a1b24" stroke="#2a2b38" strokeWidth={1} />
        </g>
      </svg>

      {/* Creature inside the chamber */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: padding,
          top: padding,
          width: tubeW,
          height: tubeH,
        }}
      >
        {children}
      </div>
    </div>
  );
}
