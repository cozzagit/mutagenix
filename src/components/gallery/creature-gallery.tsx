'use client';

import { CreatureRenderer } from '@/components/creature/creature-renderer';
import { DEFAULT_VISUAL_PARAMS } from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';

interface GalleryItem {
  id: string;
  name: string;
  userName: string;
  ageDays: number;
  generation: number;
  visualParams: Record<string, unknown>;
}

interface CreatureGalleryProps {
  items: GalleryItem[];
}

function CreatureCard({ item }: { item: GalleryItem }) {
  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(item.visualParams as Partial<VisualParams>),
  };

  return (
    <div className="group rounded-xl border border-border bg-surface p-3 transition-all duration-200 hover:border-border-glow hover:shadow-[0_0_20px_#3d5afe11]">
      {/* Creature SVG */}
      <div className="flex justify-center rounded-lg bg-background/50 p-2">
        <CreatureRenderer
          params={visualParams}
          size={140}
          animated={false}
        />
      </div>

      {/* Info */}
      <div className="mt-3 space-y-1">
        <h3 className="truncate text-sm font-bold text-foreground">
          {item.name}
        </h3>
        <p className="truncate text-[11px] text-muted">
          di <span className="text-primary-light">{item.userName}</span>
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="tabular-nums">
            Giorno {item.ageDays}
          </span>
          <span className="tabular-nums">
            Gen. {item.generation}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CreatureGallery({ items }: CreatureGalleryProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 rounded-full bg-surface-2 p-6">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-12 w-12 text-muted"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-bold text-foreground">
          Galleria vuota
        </h2>
        <p className="max-w-xs text-sm text-muted">
          Nessuna creatura trovata. Sii il primo a crearne una!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-foreground">
          Galleria
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          {items.length} creatur{items.length === 1 ? 'a' : 'e'} nel laboratorio
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <CreatureCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
