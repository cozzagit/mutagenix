'use client';

import { useEffect, useState } from 'react';
import type { MutationEntry } from '@/types/game';

const TRAIT_LABELS: Record<string, string> = {
  bodySize: 'Corpo',
  headSize: 'Testa',
  limbGrowth: 'Arti',
  eyeDev: 'Occhi',
  skinTex: 'Pelle',
  furDensity: 'Pelliccia',
  spininess: 'Spine',
  tailGrowth: 'Coda',
  clawDev: 'Artigli',
  posture: 'Postura',
};

const SYNERGY_DISPLAY: Record<string, { label: string; color: string; glow: string }> = {
  ossatura: {
    label: 'Ossatura',
    color: '#ffcc80',
    glow: '0 0 8px #ffcc8066, 0 0 20px #ffcc8033',
  },
  sangue: {
    label: 'Sangue',
    color: '#ff4466',
    glow: '0 0 8px #ff446666, 0 0 20px #ff446633',
  },
  veleno: {
    label: 'Veleno',
    color: '#39ff7f',
    glow: '0 0 8px #39ff7f66, 0 0 20px #39ff7f33',
  },
  neural: {
    label: 'Neurale',
    color: '#b26eff',
    glow: '0 0 8px #b26eff66, 0 0 20px #b26eff33',
  },
  organico: {
    label: 'Organico',
    color: '#00f0ff',
    glow: '0 0 8px #00f0ff66, 0 0 20px #00f0ff33',
  },
  caotico: {
    label: 'Caotico',
    color: '#ff9100',
    glow: '0 0 8px #ff910066, 0 0 20px #ff910033',
  },
};

interface MutationFeedProps {
  mutations: MutationEntry[];
  activeSynergies: string[];
}

function AnimatedDelta({ value, delay }: { value: number; delay: number }) {
  const [displayed, setDisplayed] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(showTimer);
  }, [delay]);

  useEffect(() => {
    if (!visible) return;

    const duration = 600;
    const steps = 20;
    const stepTime = duration / steps;
    let current = 0;

    const interval = setInterval(() => {
      current++;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(value * eased);

      if (current >= steps) {
        setDisplayed(value);
        clearInterval(interval);
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, [value, visible]);

  if (!visible) return <span className="text-muted">---</span>;

  return (
    <span
      className={`font-mono font-bold tabular-nums transition-opacity duration-300 ${
        value > 0 ? 'text-bio-green' : value < 0 ? 'text-bio-red' : 'text-muted'
      }`}
    >
      {displayed > 0 ? '+' : ''}
      {displayed.toFixed(1)}
    </span>
  );
}

function SynergyBadge({ synergyId }: { synergyId: string }) {
  const info = SYNERGY_DISPLAY[synergyId];
  if (!info) return null;

  const isCaotico = synergyId === 'caotico';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all duration-500 ${
        isCaotico ? 'animate-pulse' : ''
      }`}
      style={{
        color: info.color,
        borderColor: `${info.color}44`,
        backgroundColor: `${info.color}15`,
        boxShadow: info.glow,
        ...(isCaotico
          ? {
              background: `linear-gradient(135deg, #ff910015, #b26eff15, #39ff7f15, #00f0ff15)`,
              borderImage: `linear-gradient(135deg, #ff9100, #b26eff, #39ff7f, #00f0ff) 1`,
            }
          : {}),
      }}
    >
      {info.label}
    </span>
  );
}

export function MutationFeed({ mutations, activeSynergies }: MutationFeedProps) {
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHeaderVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (mutations.length === 0) return null;

  return (
    <div className="rounded-xl border border-border-glow bg-surface p-4">
      {/* Header with glow */}
      <div
        className={`mb-4 transition-all duration-700 ${
          headerVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <h3 className="text-sm font-bold text-bio-green glow-green">
          Mutazione completata!
        </h3>
      </div>

      {/* Trait changes */}
      <div className="space-y-2">
        {mutations.map((mut, idx) => (
          <div
            key={`${mut.traitId}-${idx}`}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">
                {TRAIT_LABELS[mut.traitId] ?? mut.traitId}
              </span>
              <span className="text-[10px] text-muted">
                {mut.oldValue.toFixed(1)} &rarr; {mut.newValue.toFixed(1)}
              </span>
            </div>
            <AnimatedDelta value={mut.delta} delay={200 + idx * 120} />
          </div>
        ))}
      </div>

      {/* Active synergies */}
      {activeSynergies.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-muted">
            Sinergie attive
          </span>
          <div className="flex flex-wrap gap-2">
            {activeSynergies.map((syn) => (
              <SynergyBadge key={syn} synergyId={syn} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
