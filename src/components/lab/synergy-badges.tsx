'use client';

import { useMemo } from 'react';
import { SYNERGIES, ELEMENTS, type ElementId } from '@/lib/game-engine/constants';

const SYNERGY_DISPLAY: Record<string, { label: string; color: string; glow: string }> = {
  ossatura: {
    label: 'Ossatura',
    color: '#ffcc80',
    glow: '0 0 6px #ffcc8055, 0 0 14px #ffcc8033',
  },
  sangue: {
    label: 'Sangue',
    color: '#ff4466',
    glow: '0 0 6px #ff446655, 0 0 14px #ff446633',
  },
  veleno: {
    label: 'Veleno',
    color: '#39ff7f',
    glow: '0 0 6px #39ff7f55, 0 0 14px #39ff7f33',
  },
  neural: {
    label: 'Neurale',
    color: '#b26eff',
    glow: '0 0 6px #b26eff55, 0 0 14px #b26eff33',
  },
  organico: {
    label: 'Organico',
    color: '#00f0ff',
    glow: '0 0 6px #00f0ff55, 0 0 14px #00f0ff33',
  },
  caotico: {
    label: 'Caotico',
    color: '#ff9100',
    glow: '0 0 6px #ff910055, 0 0 14px #ff910033',
  },
};

interface SynergyBadgesProps {
  elementLevels: Record<string, number>;
}

function isCaoticoActive(elementLevels: Record<string, number>): boolean {
  const nonZero = ELEMENTS.map((e) => elementLevels[e] ?? 0).filter((v) => v > 0);
  if (nonZero.length < 2) return false;
  const max = Math.max(...nonZero);
  const min = Math.min(...nonZero);
  return max > 3 * min;
}

function isOrganicoActive(elementLevels: Record<string, number>): boolean {
  const values = (['C', 'N', 'O'] as const).map((e) => elementLevels[e] ?? 0);
  if (values.some((v) => v <= 8)) return false;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return variance < 3;
}

export function SynergyBadges({ elementLevels }: SynergyBadgesProps) {
  const activeSynergies = useMemo(() => {
    const active: string[] = [];

    for (const synergy of SYNERGIES) {
      if (synergy.id === 'caotico') {
        if (isCaoticoActive(elementLevels)) active.push(synergy.id);
      } else if (synergy.id === 'organico') {
        if (isOrganicoActive(elementLevels)) active.push(synergy.id);
      } else {
        const meetsThresholds = synergy.elements.every(
          (el) => (elementLevels[el] ?? 0) >= (synergy.thresholds[el] ?? 0),
        );
        if (meetsThresholds) active.push(synergy.id);
      }
    }

    return active;
  }, [elementLevels]);

  if (activeSynergies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeSynergies.map((synergyId) => {
        const info = SYNERGY_DISPLAY[synergyId];
        if (!info) return null;

        const isCaotico = synergyId === 'caotico';

        return (
          <span
            key={synergyId}
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold"
            style={{
              color: info.color,
              borderColor: `${info.color}44`,
              backgroundColor: `${info.color}12`,
              boxShadow: info.glow,
              ...(isCaotico
                ? {
                    background: `linear-gradient(135deg, #ff910012, #b26eff12, #39ff7f12, #00f0ff12)`,
                  }
                : {}),
            }}
          >
            {info.label}
          </span>
        );
      })}
    </div>
  );
}
