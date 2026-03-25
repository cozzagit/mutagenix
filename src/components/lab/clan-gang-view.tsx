'use client';

import { useMemo } from 'react';
import {
  CreatureRenderer,
  DEFAULT_VISUAL_PARAMS,
} from '@/components/creature/creature-renderer';
import type { VisualParams } from '@/lib/game-engine/visual-mapper';
import type { LaboratoriCreature } from './laboratori-directory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClanGangViewProps {
  creatures: LaboratoriCreature[];
}

interface ClanGroup {
  name: string;
  emblemColor: string;
  members: LaboratoriCreature[];
}

// ---------------------------------------------------------------------------
// Build clan groups from creatures
// ---------------------------------------------------------------------------

function buildClanGroups(creatures: LaboratoriCreature[]): ClanGroup[] {
  const clanMap = new Map<string, ClanGroup>();

  for (const c of creatures) {
    if (!c.clanInfo) continue;
    const key = c.clanInfo.name;
    if (!clanMap.has(key)) {
      clanMap.set(key, {
        name: c.clanInfo.name,
        emblemColor: c.clanInfo.emblemColor,
        members: [],
      });
    }
    clanMap.get(key)!.members.push(c);
  }

  // Sort clans by member count (biggest gangs first)
  return Array.from(clanMap.values()).sort(
    (a, b) => b.members.length - a.members.length,
  );
}

// ---------------------------------------------------------------------------
// Creature mini-renderer helper
// ---------------------------------------------------------------------------

function CreatureMini({
  creature,
  size,
}: {
  creature: LaboratoriCreature;
  size: number;
}) {
  const visualParams: VisualParams = {
    ...DEFAULT_VISUAL_PARAMS,
    ...(creature.visualParams as Partial<VisualParams>),
  } as VisualParams;

  return (
    <CreatureRenderer
      params={visualParams}
      size={size}
      animated={false}
      seed={42}
    />
  );
}

// ---------------------------------------------------------------------------
// Gang Photo Card — one card per clan
// ---------------------------------------------------------------------------

function ClanGangCard({ group }: { group: ClanGroup }) {
  // Sort members by role hierarchy: boss → luogotenente → soldato/member
  const boss = group.members.find((m) => m.clanInfo?.role === 'boss');
  const luogos = group.members.filter(
    (m) => m.clanInfo?.role === 'luogotenente',
  );
  const soldati = group.members.filter(
    (m) =>
      m.clanInfo?.role === 'soldato' ||
      m.clanInfo?.role === 'member' ||
      !m.clanInfo?.role,
  );

  // Remove boss from soldati if accidentally matched
  const soldatiFiltered = soldati.filter((s) => s.id !== boss?.id);
  const luogosFiltered = luogos.filter((l) => l.id !== boss?.id);

  return (
    <div
      className="rounded-2xl border bg-surface/30 p-5 text-center"
      style={{ borderColor: `${group.emblemColor}33` }}
    >
      {/* Clan name with emblem glow */}
      <h3
        className="text-lg font-black uppercase tracking-wider mb-1"
        style={{
          color: group.emblemColor,
          textShadow: `0 0 20px ${group.emblemColor}44`,
        }}
      >
        {group.name}
      </h3>
      <p className="text-[10px] text-muted mb-4">
        {group.members.length} membr{group.members.length === 1 ? 'o' : 'i'}
      </p>

      {/* Gang photo arrangement */}
      <div className="relative flex flex-col items-center gap-1">
        {/* Back row: Soldati */}
        {soldatiFiltered.length > 0 && (
          <div className="flex items-end justify-center mb-[-10px] relative z-0">
            {soldatiFiltered.map((s, i) => (
              <div
                key={s.id}
                className="flex flex-col items-center"
                style={{
                  marginLeft: i > 0 ? '-8px' : '0',
                  zIndex: i,
                }}
              >
                <CreatureMini creature={s} size={50} />
                <p className="text-[7px] text-muted/60 mt-0.5 max-w-[50px] truncate">
                  {s.name}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Middle row: Luogotenenti */}
        {luogosFiltered.length > 0 && (
          <div className="flex items-end justify-center gap-4 relative z-10">
            {luogosFiltered.map((l) => (
              <div key={l.id} className="flex flex-col items-center">
                <div className="relative">
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]">
                    &#11088;
                  </span>
                  <CreatureMini creature={l} size={65} />
                </div>
                <p className="text-[8px] text-muted mt-0.5 max-w-[65px] truncate">
                  {l.name}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Front center: Boss */}
        {boss && (
          <div className="flex flex-col items-center relative z-20 mt-[-5px]">
            <div className="relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm">
                &#128081;
              </span>
              <div
                style={{
                  filter: `drop-shadow(0 0 8px ${group.emblemColor}44)`,
                }}
              >
                <CreatureMini creature={boss} size={85} />
              </div>
            </div>
            <p className="text-[10px] font-bold text-foreground mt-0.5">
              {boss.name}
            </p>
            <p className="text-[8px] text-muted">{boss.ownerName}</p>
          </div>
        )}

        {/* Fallback: no boss — show all members flat */}
        {!boss && luogosFiltered.length === 0 && soldatiFiltered.length === 0 && (
          <div className="flex items-end justify-center gap-2">
            {group.members.map((m) => (
              <div key={m.id} className="flex flex-col items-center">
                <CreatureMini creature={m} size={60} />
                <p className="text-[8px] text-muted mt-0.5 max-w-[60px] truncate">
                  {m.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clan link */}
      <a
        href="/clan"
        className="mt-4 inline-block text-[9px] font-bold uppercase tracking-wider transition-colors hover:text-foreground"
        style={{ color: `${group.emblemColor}99` }}
      >
        Vedi Clan &rarr;
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ClanGangView({ creatures }: ClanGangViewProps) {
  const clanGroups = useMemo(() => buildClanGroups(creatures), [creatures]);

  // Creatures without a clan
  const freeCreatures = useMemo(
    () => creatures.filter((c) => !c.clanInfo && !c.isDead),
    [creatures],
  );

  if (clanGroups.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-muted/20 bg-surface/30">
          <span className="text-2xl">&#128481;</span>
        </div>
        <p className="text-sm font-bold text-muted/70">
          Nessun clan formato.
        </p>
        <p className="text-[11px] text-muted/50">
          Fonda la tua Famiglia!
        </p>
        <a
          href="/clan"
          className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
        >
          Vai ai Clan
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clan gang cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {clanGroups.map((group) => (
          <ClanGangCard key={group.name} group={group} />
        ))}
      </div>

      {/* Free creatures section */}
      {freeCreatures.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 border-b border-muted/15 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted/50">
              Creature Libere
            </span>
            <span className="text-[9px] text-muted/30">
              {freeCreatures.length} senza clan
            </span>
          </div>
          <div className="flex flex-wrap gap-2 opacity-50">
            {freeCreatures.map((c) => (
              <div key={c.id} className="flex flex-col items-center">
                <CreatureMini creature={c} size={40} />
                <p className="text-[6px] text-muted/40 mt-0.5 max-w-[40px] truncate">
                  {c.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
