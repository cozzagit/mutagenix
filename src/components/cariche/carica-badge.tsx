"use client";

import { CARICHE } from "@/lib/game-engine/constants";

interface CaricaBadgeProps {
  caricaId: string;
  compact?: boolean;
}

export function CaricaBadge({ caricaId, compact = false }: CaricaBadgeProps) {
  const carica = CARICHE.find((c) => c.id === caricaId);
  if (!carica) return null;

  if (compact) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm"
        style={{
          backgroundColor: `${carica.badgeColor}20`,
          border: `1px solid ${carica.badgeColor}40`,
        }}
        title={carica.name}
      >
        {carica.icon}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        backgroundColor: `${carica.badgeColor}15`,
        color: carica.badgeColor,
        border: `1px solid ${carica.badgeColor}30`,
      }}
    >
      <span>{carica.icon}</span>
      <span>{carica.name}</span>
    </span>
  );
}
