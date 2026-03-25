'use client';

import { useEffect, useState } from 'react';

const TIER_CONFIG: Record<string, { label: string; color: string; glow: string; emoji: string }> = {
  novice: { label: 'NOVIZIO', color: '#9ca3af', glow: '#9ca3af44', emoji: '⚔' },
  intermediate: { label: 'INTERMEDIO', color: '#3d5afe', glow: '#3d5afe66', emoji: '⚔' },
  veteran: { label: 'VETERANO', color: '#b26eff', glow: '#b26eff66', emoji: '🛡' },
  legend: { label: 'LEGGENDA', color: '#fbbf24', glow: '#fbbf2466', emoji: '👑' },
  immortal: { label: 'IMMORTALE', color: '#ef4444', glow: '#ef444466', emoji: '🔥' },
  divine: { label: 'DIVINITÀ', color: '#ec4899', glow: '#ec489966', emoji: '✨' },
};

interface Props {
  tier: string;
  onClose: () => void;
}

export function TierCelebration({ tier, onClose }: Props) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.novice;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 300);
    const t2 = setTimeout(() => setPhase('exit'), 4000);
    const t3 = setTimeout(onClose, 4800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onClose]);

  const isDivine = tier === 'divine';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      style={{
        backgroundColor: phase === 'enter' ? 'transparent' : 'rgba(10,11,15,0.9)',
        transition: 'background-color 0.5s ease',
      }}
      onClick={onClose}
    >
      {/* Particles */}
      {phase !== 'enter' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 3 + (i % 4) * 2,
                height: 3 + (i % 4) * 2,
                backgroundColor: isDivine
                  ? ['#fbbf24', '#ec4899', '#06b6d4', '#a855f7'][i % 4]
                  : config.color,
                left: `${10 + (i * 4.2) % 80}%`,
                bottom: '-10px',
                opacity: 0,
                animation: `tier-particle ${1.5 + (i % 5) * 0.3}s ease-out ${i * 0.1}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        className="flex flex-col items-center gap-4"
        style={{
          opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(0.5)' : phase === 'exit' ? 'scale(1.2)' : 'scale(1)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Emoji */}
        <span className="text-5xl" style={{ animation: 'tier-bounce 0.6s ease-out 0.5s both' }}>
          {config.emoji}
        </span>

        {/* Title */}
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted mb-2">
            Nuovo Livello Raggiunto
          </p>
          <h2
            className={`text-4xl md:text-5xl font-black uppercase tracking-wider ${isDivine ? 'bg-gradient-to-r from-amber-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent' : ''}`}
            style={{
              color: isDivine ? undefined : config.color,
              textShadow: `0 0 40px ${config.glow}, 0 0 80px ${config.glow}`,
              animation: 'tier-glow-pulse 1.5s ease-in-out infinite',
            }}
          >
            {config.label}
          </h2>
        </div>

        {/* Bonus info */}
        {(tier === 'immortal' || tier === 'divine') && (
          <div
            className="rounded-lg border px-4 py-2 text-center text-xs"
            style={{
              borderColor: `${config.color}33`,
              backgroundColor: `${config.color}11`,
              color: config.color,
              opacity: 0,
              animation: 'tier-fade-in 0.5s ease-out 1s forwards',
            }}
          >
            {tier === 'immortal' && '+10% stats combattimento · +5 crediti bonus'}
            {tier === 'divine' && '+20% stats combattimento · +10 crediti bonus · Immune al Trauma'}
          </div>
        )}

        {/* Tap to close hint */}
        <p
          className="text-[10px] text-muted mt-2"
          style={{ opacity: 0, animation: 'tier-fade-in 0.5s ease-out 2s forwards' }}
        >
          Tocca per continuare
        </p>
      </div>

      <style>{`
        @keyframes tier-particle {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translateY(-100vh) rotate(${Math.random() * 360}deg); opacity: 0; }
        }
        @keyframes tier-bounce {
          0% { transform: scale(0) rotate(-20deg); }
          60% { transform: scale(1.3) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes tier-glow-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
        @keyframes tier-fade-in {
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
