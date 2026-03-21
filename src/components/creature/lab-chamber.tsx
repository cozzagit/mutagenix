'use client';

/**
 * Lab Chamber — an atmospheric sci-fi containment environment for the creature.
 *
 * Built primarily with CSS effects, gradients, and subtle SVG accents.
 * Inspired by Kamino clone labs, Prometheus specimen rooms, Jurassic Park genetics labs.
 * The creature is the star — everything else is ambient atmosphere.
 */

import { useMemo } from 'react';

interface LabChamberProps {
  children: React.ReactNode;
  width: number;
  height: number;
  mutating?: boolean;
  glowColor?: string;
  stability?: number;   // 0-1
  dayNumber?: number;
}

/* ------------------------------------------------------------------ */
/* Tiny helper: format day as DAY.023                                  */
/* ------------------------------------------------------------------ */
function formatDay(n: number): string {
  return `DAY.${String(n).padStart(3, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Tiny helper: format stability as percentage                         */
/* ------------------------------------------------------------------ */
function formatStability(s: number): string {
  return `STAB: ${Math.round(s * 100)}%`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export function LabChamber({
  children,
  width,
  height,
  mutating = false,
  glowColor = '#3d5afe',
  stability = 0.5,
  dayNumber = 1,
}: LabChamberProps) {
  const padding = 32;
  const totalW = width + padding * 2;
  const totalH = height + padding * 2;

  // Memoize particles so positions don't shift on re-render
  const particles = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      left: 20 + (i * 17) % 60,   // percentage
      size: 1.5 + (i % 3) * 0.5,
      duration: mutating ? 2 + i * 0.4 : 4 + i * 0.8,
      delay: i * 0.6,
      opacity: 0.15 + (i % 3) * 0.08,
    })),
    [mutating],
  );

  const borderColor = mutating ? '#b26eff' : glowColor;
  const borderOpacity = mutating ? 0.35 : 0.18;

  return (
    <div
      className="relative select-none"
      style={{ width: totalW, height: totalH }}
    >
      {/* ============================================================ */}
      {/* LAYER 1 — Background environment                             */}
      {/* ============================================================ */}

      {/* Dark vignette gradient */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: `
            radial-gradient(
              ellipse 60% 55% at 50% 48%,
              rgba(15, 16, 24, 0.0) 0%,
              rgba(10, 11, 15, 0.6) 60%,
              rgba(10, 11, 15, 0.95) 100%
            )
          `,
        }}
      />

      {/* Subtle holographic grid */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 39px,
              rgba(61, 90, 254, 0.035) 39px,
              rgba(61, 90, 254, 0.035) 40px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 39px,
              rgba(61, 90, 254, 0.035) 39px,
              rgba(61, 90, 254, 0.035) 40px
            )
          `,
        }}
      />

      {/* Central radial glow behind creature */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(
              ellipse 50% 45% at 50% 50%,
              ${glowColor}${mutating ? '18' : '0a'} 0%,
              transparent 70%
            )
          `,
          transition: 'background 0.6s ease',
        }}
      />

      {/* ============================================================ */}
      {/* LAYER 2 — Containment field                                   */}
      {/* ============================================================ */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: padding - 1,
          top: padding - 1,
          width: width + 2,
          height: height + 2,
          border: `1px solid`,
          borderColor: `${borderColor}${Math.round(borderOpacity * 255).toString(16).padStart(2, '0')}`,
          borderRadius: 6,
          boxShadow: mutating
            ? `0 0 20px ${borderColor}22, 0 0 60px ${borderColor}11, inset 0 0 30px ${borderColor}08`
            : `0 0 12px ${borderColor}11, 0 0 40px ${borderColor}08, inset 0 0 20px ${borderColor}05`,
          transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
          animation: mutating ? 'chamber-pulse 2s ease-in-out infinite' : undefined,
        }}
      />

      {/* Corner brackets — top-left */}
      <svg
        className="absolute pointer-events-none"
        style={{ left: padding - 6, top: padding - 6 }}
        width="16" height="16" viewBox="0 0 16 16"
      >
        <path
          d="M1 12 L1 1 L12 1"
          fill="none"
          stroke={borderColor}
          strokeWidth="1"
          opacity={mutating ? 0.5 : 0.25}
          strokeLinecap="round"
        />
      </svg>
      {/* Corner brackets — top-right */}
      <svg
        className="absolute pointer-events-none"
        style={{ right: padding - 6, top: padding - 6 }}
        width="16" height="16" viewBox="0 0 16 16"
      >
        <path
          d="M15 12 L15 1 L4 1"
          fill="none"
          stroke={borderColor}
          strokeWidth="1"
          opacity={mutating ? 0.5 : 0.25}
          strokeLinecap="round"
        />
      </svg>
      {/* Corner brackets — bottom-left */}
      <svg
        className="absolute pointer-events-none"
        style={{ left: padding - 6, bottom: padding - 6 }}
        width="16" height="16" viewBox="0 0 16 16"
      >
        <path
          d="M1 4 L1 15 L12 15"
          fill="none"
          stroke={borderColor}
          strokeWidth="1"
          opacity={mutating ? 0.5 : 0.25}
          strokeLinecap="round"
        />
      </svg>
      {/* Corner brackets — bottom-right */}
      <svg
        className="absolute pointer-events-none"
        style={{ right: padding - 6, bottom: padding - 6 }}
        width="16" height="16" viewBox="0 0 16 16"
      >
        <path
          d="M15 4 L15 15 L4 15"
          fill="none"
          stroke={borderColor}
          strokeWidth="1"
          opacity={mutating ? 0.5 : 0.25}
          strokeLinecap="round"
        />
      </svg>

      {/* ============================================================ */}
      {/* LAYER 3 — Floating HUD elements                              */}
      {/* ============================================================ */}

      {/* Top-left: SPECIMEN label with blinking dot */}
      <div
        className="absolute flex items-center gap-1 pointer-events-none"
        style={{
          left: padding + 6,
          top: padding + 6,
          opacity: 0.35,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 8,
          letterSpacing: '0.08em',
          color: '#6b6d7b',
        }}
      >
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: mutating ? '#b26eff' : '#00e5a0',
            display: 'inline-block',
            animation: 'blink 3s ease-in-out infinite',
          }}
        />
        <span>{mutating ? 'MUTATING...' : 'SPECIMEN'}</span>
      </div>

      {/* Top-right: Day counter */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: padding + 6,
          top: padding + 6,
          opacity: 0.3,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 8,
          letterSpacing: '0.08em',
          color: '#6b6d7b',
        }}
      >
        {formatDay(dayNumber)}
      </div>

      {/* Bottom-left: Heartbeat SVG */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: padding + 4,
          bottom: padding + 6,
          opacity: 0.3,
        }}
      >
        <svg width="48" height="14" viewBox="0 0 48 14">
          <path
            d="M0 7 L8 7 L11 2 L14 12 L17 4 L20 9 L23 7 L48 7"
            fill="none"
            stroke={mutating ? '#b26eff' : '#00e5a0'}
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 80,
              strokeDashoffset: 0,
              animation: `heartbeat-draw ${mutating ? '1s' : '2s'} linear infinite`,
            }}
          />
        </svg>
      </div>

      {/* Bottom-right: Stability readout */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: padding + 6,
          bottom: padding + 6,
          opacity: 0.3,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 8,
          letterSpacing: '0.08em',
          color: '#6b6d7b',
        }}
      >
        {formatStability(stability)}
      </div>

      {/* ============================================================ */}
      {/* LAYER 4 — Floating particles                                  */}
      {/* ============================================================ */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${padding + (width * p.left) / 100}px`,
            bottom: `${padding + 20}px`,
            width: p.size,
            height: p.size,
            backgroundColor: mutating ? '#b26eff' : glowColor,
            opacity: p.opacity,
            animation: `chamber-particle-rise ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* ============================================================ */}
      {/* LAYER 5 — Edge lighting                                       */}
      {/* ============================================================ */}

      {/* Top-down overhead light */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: padding,
          top: padding,
          width: width,
          height: height * 0.35,
          background: `linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.015) 0%,
            transparent 100%
          )`,
          borderRadius: '6px 6px 0 0',
        }}
      />

      {/* Left rim light */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: padding - 1,
          top: padding + 16,
          width: 1,
          height: height - 32,
          background: `linear-gradient(
            to bottom,
            transparent 0%,
            ${glowColor}15 30%,
            ${glowColor}20 50%,
            ${glowColor}15 70%,
            transparent 100%
          )`,
          filter: 'blur(1px)',
        }}
      />

      {/* Right rim light */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: padding - 1,
          top: padding + 16,
          width: 1,
          height: height - 32,
          background: `linear-gradient(
            to bottom,
            transparent 0%,
            ${glowColor}15 30%,
            ${glowColor}20 50%,
            ${glowColor}15 70%,
            transparent 100%
          )`,
          filter: 'blur(1px)',
        }}
      />

      {/* ============================================================ */}
      {/* CREATURE — centered                                           */}
      {/* ============================================================ */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: padding,
          top: padding,
          width: width,
          height: height,
        }}
      >
        {children}
      </div>

      {/* ============================================================ */}
      {/* INLINE STYLES — keyframes for chamber-specific animations     */}
      {/* ============================================================ */}
      <style>{`
        @keyframes chamber-pulse {
          0%, 100% {
            box-shadow:
              0 0 20px ${borderColor}22,
              0 0 60px ${borderColor}11,
              inset 0 0 30px ${borderColor}08;
          }
          50% {
            box-shadow:
              0 0 30px ${borderColor}33,
              0 0 80px ${borderColor}1a,
              inset 0 0 40px ${borderColor}0f;
          }
        }

        @keyframes chamber-particle-rise {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.2;
          }
          50% {
            transform: translateY(-${height * 0.5}px) translateX(${3}px);
            opacity: 0.15;
          }
          90% {
            opacity: 0.05;
          }
          100% {
            transform: translateY(-${height * 0.85}px) translateX(-${2}px);
            opacity: 0;
          }
        }

        @keyframes heartbeat-draw {
          0% {
            stroke-dashoffset: 80;
          }
          100% {
            stroke-dashoffset: -80;
          }
        }
      `}</style>
    </div>
  );
}
