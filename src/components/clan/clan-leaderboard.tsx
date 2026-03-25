"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClanRankEntry {
  position: number;
  id: string;
  name: string;
  emblemColor: string | null;
  status: string;
  memberCount: number;
  clanElo: number;
  prestige: number;
  clanWins: number;
  clanLosses: number;
  bossCreatureName: string;
  bossOwnerName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClanLeaderboard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [clans, setClans] = useState<ClanRankEntry[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<Set<string>>(new Set());
  const [userHasClan, setUserHasClan] = useState(false);
  const [eligibleCreatureId, setEligibleCreatureId] = useState<string | null>(null);

  const fetchClans = useCallback(async () => {
    try {
      const res = await fetch("/api/clans");
      if (!res.ok) return;
      const json = await res.json();
      setClans(json.data ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user is in a clan and find eligible creature
  const fetchUserStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/clan");
      if (!res.ok) return;
      const json = await res.json();
      setUserHasClan(!!json.data);

      if (!json.data) {
        // Find an eligible creature
        const res2 = await fetch("/api/creature");
        if (!res2.ok) return;
        const json2 = await res2.json();
        const c = json2.data;
        if (c && !c.isDead && !c.isArchived && (c.ageDays ?? 0) >= 40) {
          setEligibleCreatureId(c.id);
        }
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchClans();
    fetchUserStatus();
  }, [fetchClans, fetchUserStatus]);

  async function handleRequestJoin(clanId: string) {
    if (!eligibleCreatureId) return;
    setRequesting(clanId);

    try {
      const res = await fetch(`/api/clan/${clanId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatureId: eligibleCreatureId }),
      });

      if (res.ok) {
        setRequestSent((prev) => new Set(prev).add(clanId));
      }
    } catch {
      // silently ignore
    } finally {
      setRequesting(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-black uppercase tracking-wider text-foreground sm:text-2xl"
            style={{ textShadow: "0 0 15px rgba(220, 38, 38, 0.2)" }}
          >
            Classifica Clan
          </h1>
          <p className="mt-1 text-xs text-muted">
            Le Famiglie pi&ugrave; potenti della biosfera.
          </p>
        </div>
        <Link
          href="/clan"
          className="rounded-lg border border-border/30 bg-surface/50 px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
        >
          Il Mio Clan
        </Link>
      </div>

      {/* Clan list */}
      {clans.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">Nessun clan fondato ancora.</p>
          <Link
            href="/clan"
            className="mt-4 inline-block rounded-lg border border-danger/30 bg-danger/10 px-6 py-2.5 text-sm font-bold text-danger transition hover:bg-danger/20"
          >
            Fonda il Primo Clan
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {clans.map((clan) => {
            const emblemColor = clan.emblemColor || "#6b7280";
            const canRequest =
              !userHasClan &&
              eligibleCreatureId &&
              !requestSent.has(clan.id) &&
              ["forming", "active"].includes(clan.status);

            return (
              <div
                key={clan.id}
                className="rounded-xl border bg-surface/30 p-4 transition hover:bg-surface/50"
                style={{ borderColor: `${emblemColor}22` }}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2/50 text-xs font-black text-muted">
                    {clan.position}
                  </div>

                  {/* Emblem dot */}
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: emblemColor,
                      boxShadow: `0 0 8px ${emblemColor}66`,
                    }}
                  />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-black uppercase text-foreground">
                        {clan.name}
                      </span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase"
                        style={{
                          backgroundColor:
                            clan.status === "active"
                              ? "#16a34a18"
                              : "#d9770618",
                          color:
                            clan.status === "active" ? "#16a34a" : "#d97706",
                        }}
                      >
                        {clan.status === "active" ? "Attivo" : "In Formazione"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted">
                      Boss: {clan.bossCreatureName} ({clan.bossOwnerName})
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden shrink-0 items-center gap-3 text-center sm:flex">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {clan.memberCount}
                      </div>
                      <div className="text-[8px] text-muted">Membri</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold" style={{ color: emblemColor }}>
                        {clan.clanElo}
                      </div>
                      <div className="text-[8px] text-muted">ELO</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {clan.prestige}
                      </div>
                      <div className="text-[8px] text-muted">Prestigio</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {clan.clanWins}/{clan.clanLosses}
                      </div>
                      <div className="text-[8px] text-muted">V/S</div>
                    </div>
                  </div>

                  {/* Mobile stats */}
                  <div className="flex shrink-0 flex-col items-end gap-0.5 sm:hidden">
                    <span className="text-xs font-bold" style={{ color: emblemColor }}>
                      {clan.clanElo}
                    </span>
                    <span className="text-[9px] text-muted">
                      {clan.memberCount} membri
                    </span>
                  </div>

                  {/* Join button */}
                  {canRequest && (
                    <button
                      onClick={() => handleRequestJoin(clan.id)}
                      disabled={requesting !== null}
                      className="shrink-0 rounded-lg bg-primary/20 px-3 py-1.5 text-[10px] font-bold text-primary transition hover:bg-primary/30 disabled:opacity-50"
                    >
                      {requesting === clan.id ? "..." : "Chiedi di Entrare"}
                    </button>
                  )}

                  {requestSent.has(clan.id) && (
                    <span className="shrink-0 text-[10px] text-primary/60">
                      Richiesta inviata
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
