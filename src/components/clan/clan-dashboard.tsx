"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CreatureRenderer,
  DEFAULT_VISUAL_PARAMS,
} from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClanMember {
  creatureId: string;
  name: string;
  ownerName: string;
  role: string;
  ageDays: number;
  joinedAt: string;
  contributionScore: number;
  visualParams: Record<string, unknown>;
  isDead: boolean;
}

interface ClanData {
  id: string;
  name: string;
  motto: string | null;
  emblemColor: string | null;
  status: string;
  clanElo: number;
  clanEloPeak: number;
  prestige: number;
  clanWins: number;
  clanLosses: number;
  totalMembers: number;
  maxMembers: number;
  energyVault: number;
  description: string | null;
  createdAt: string;
}

interface InvitationItem {
  id: string;
  clanId: string;
  clanName: string;
  clanEmblemColor: string | null;
  creatureId: string;
  creatureName: string;
  creatureOwnerName: string;
  direction: string;
  status?: string;
  message: string | null;
  expiresAt: string;
  visualParams: Record<string, unknown>;
  ageDays: number;
}

interface EligibleCreature {
  id: string;
  name: string;
  ageDays: number;
  visualParams: Record<string, unknown>;
}

const EMBLEM_COLORS = [
  { id: "red", label: "Rosso Sangue", value: "#dc2626" },
  { id: "blue", label: "Blu Notte", value: "#2563eb" },
  { id: "purple", label: "Viola Tossico", value: "#9333ea" },
  { id: "green", label: "Verde Acido", value: "#16a34a" },
  { id: "amber", label: "Ambra Oscura", value: "#d97706" },
  { id: "cyan", label: "Ciano Neon", value: "#06b6d4" },
  { id: "pink", label: "Rosa Infetto", value: "#db2777" },
  { id: "grey", label: "Grigio Cenere", value: "#6b7280" },
];

const ROLE_ICONS: Record<string, string> = {
  boss: "\ud83d\udc51",
  luogotenente: "\u2b50",
  soldato: "\ud83d\udc80",
};

const ROLE_LABELS: Record<string, string> = {
  boss: "Boss",
  luogotenente: "Luogotenente",
  soldato: "Soldato",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClanDashboard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [clanData, setClanData] = useState<ClanData | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [myCreatureId, setMyCreatureId] = useState<string>("");
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);

  // Invitations state
  const [invites, setInvites] = useState<InvitationItem[]>([]);
  const [requests, setRequests] = useState<InvitationItem[]>([]);
  const [outgoing, setOutgoing] = useState<InvitationItem[]>([]);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleCreatures, setEligibleCreatures] = useState<EligibleCreature[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Leave clan state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  // Add own creatures modal
  const [showAddOwnModal, setShowAddOwnModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"famiglia" | "inviti" | "classifica" | "guerre">("famiglia");

  // Responding state
  const [responding, setResponding] = useState<string | null>(null);

  const fetchClan = useCallback(async () => {
    try {
      const res = await fetch("/api/clan");
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        setClanData(json.data.clan);
        setMembers(json.data.members);
        setMyRole(json.data.myRole);
        setMyCreatureId(json.data.myCreatureId);
        setPendingInvitationsCount(json.data.pendingInvitationsCount);
      } else {
        setClanData(null);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch("/api/clan/invitations");
      if (!res.ok) return;
      const json = await res.json();
      setInvites(json.data?.invites ?? []);
      setRequests(json.data?.requests ?? []);
      setOutgoing(json.data?.outgoing ?? []);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchClan();
    fetchInvitations();
  }, [fetchClan, fetchInvitations]);

  const fetchEligibleCreatures = useCallback(async () => {
    setLoadingEligible(true);
    try {
      const res = await fetch("/api/creatures?eligible_for_clan=true");
      if (!res.ok) {
        // Fallback: fetch all user creatures and filter client-side
        const res2 = await fetch("/api/creature");
        if (!res2.ok) return;
        const json = await res2.json();
        const all = Array.isArray(json.data) ? json.data : [json.data].filter(Boolean);
        setEligibleCreatures(
          all
            .filter((c: Record<string, unknown>) =>
              !c.isDead && !c.isArchived && (c.ageDays as number) >= 40
            )
            .map((c: Record<string, unknown>) => ({
              id: c.id as string,
              name: c.name as string,
              ageDays: c.ageDays as number,
              visualParams: (c.visualParams ?? {}) as Record<string, unknown>,
            })),
        );
        return;
      }
      const json = await res.json();
      setEligibleCreatures(json.data ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoadingEligible(false);
    }
  }, []);

  async function respondToInvitation(
    clanId: string,
    invId: string,
    action: "accept" | "reject",
  ) {
    setResponding(invId);
    try {
      const res = await fetch(`/api/clan/${clanId}/invitation/${invId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchClan();
        await fetchInvitations();
      }
    } catch {
      // silently ignore
    } finally {
      setResponding(null);
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

  // =========================================================================
  // STATE 1: No clan
  // =========================================================================
  if (!clanData) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">&#x1F480;</div>
          <h1
            className="text-2xl font-black uppercase tracking-wider text-foreground sm:text-3xl"
            style={{ textShadow: "0 0 20px rgba(220, 38, 38, 0.3)" }}
          >
            La Famiglia
          </h1>
          <p className="mt-2 text-sm text-muted">
            Non fai parte di nessun clan.
          </p>
        </div>

        {/* Action buttons */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => {
              setShowCreateModal(true);
              fetchEligibleCreatures();
            }}
            className="rounded-lg border border-danger/30 bg-danger/10 px-6 py-3 text-sm font-bold text-danger transition-all hover:bg-danger/20 hover:shadow-lg hover:shadow-danger/10"
          >
            Fonda un Clan
          </button>
          <Link
            href="/clans"
            className="rounded-lg border border-border/50 bg-surface/50 px-6 py-3 text-center text-sm font-medium text-muted transition-all hover:bg-surface hover:text-foreground"
          >
            Cerca un Clan
          </Link>
        </div>

        {/* Pending invitations */}
        {invites.length > 0 && (
          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">
              Inviti Ricevuti
            </h2>
            <div className="space-y-3">
              {invites.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  invitation={inv}
                  type="invite"
                  responding={responding}
                  onRespond={respondToInvitation}
                />
              ))}
            </div>
          </div>
        )}

        {/* Create modal */}
        {showCreateModal && (
          <CreateClanModal
            eligibleCreatures={eligibleCreatures}
            loading={loadingEligible}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              fetchClan();
            }}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // STATE 2: Has a clan
  // =========================================================================
  const emblemColor = clanData.emblemColor || "#6b7280";
  const isBossOrLuogo = myRole === "boss" || myRole === "luogotenente";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6">
      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border/30">
        {(
          [
            { key: "famiglia" as const, label: "Famiglia" },
            { key: "inviti" as const, label: "Inviti", badge: pendingInvitationsCount },
            { key: "guerre" as const, label: "Guerre" },
            { key: "classifica" as const, label: "Classifica" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.key
                ? "border-b-2 text-foreground"
                : "text-muted hover:text-foreground"
            }`}
            style={
              activeTab === tab.key
                ? { borderBottomColor: emblemColor }
                : undefined
            }
          >
            {tab.label}
            {"badge" in tab && tab.badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* FAMIGLIA tab */}
      {activeTab === "famiglia" && (
        <div>
          {/* Clan Identity Card */}
          <div
            className="mb-6 rounded-xl border bg-surface/30 p-5"
            style={{ borderColor: `${emblemColor}33` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1
                  className="text-xl font-black uppercase tracking-wider text-foreground sm:text-2xl"
                  style={{
                    textShadow: `0 0 20px ${emblemColor}44`,
                  }}
                >
                  {clanData.name}
                </h1>
                {clanData.motto && (
                  <p className="mt-1 text-sm italic text-muted">
                    &ldquo;{clanData.motto}&rdquo;
                  </p>
                )}
                {clanData.description && (
                  <p className="mt-2 text-xs text-muted">
                    {clanData.description}
                  </p>
                )}
              </div>
              {myRole === "boss" && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="rounded-lg border border-border/30 bg-surface/50 px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
                >
                  Modifica
                </button>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-4 flex flex-wrap gap-4">
              <StatBadge label="ELO" value={clanData.clanElo} color={emblemColor} />
              <StatBadge label="Prestigio" value={clanData.prestige} color={emblemColor} />
              <StatBadge label="V/S" value={`${clanData.clanWins}/${clanData.clanLosses}`} />
              <StatBadge
                label="Membri"
                value={`${clanData.totalMembers}/${clanData.maxMembers}`}
              />
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                style={{
                  backgroundColor: clanData.status === "active" ? "#16a34a22" : "#d9770622",
                  color: clanData.status === "active" ? "#16a34a" : "#d97706",
                }}
              >
                {clanData.status === "active" ? "Attivo" : "In Formazione"}
              </span>
            </div>
          </div>

          {/* Invite button (boss/luogotenente) */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {isBossOrLuogo && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="rounded-lg border border-border/30 bg-surface/50 px-4 py-2 text-xs font-bold text-muted transition hover:bg-surface hover:text-foreground"
              >
                + Invita Membro
              </button>
            )}
            <button
              onClick={() => setShowAddOwnModal(true)}
              className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-bold text-accent transition hover:bg-accent/20"
            >
              {isBossOrLuogo ? '+ Aggiungi i Miei' : '+ Proponi i Miei'}
            </button>
          </div>

          {/* Members Grid */}
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Membri della Famiglia
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members
              .sort((a, b) => {
                const roleOrder = { boss: 0, luogotenente: 1, soldato: 2 };
                return (roleOrder[a.role as keyof typeof roleOrder] ?? 3) - (roleOrder[b.role as keyof typeof roleOrder] ?? 3);
              })
              .map((member) => (
                <MemberCard
                  key={member.creatureId}
                  member={member}
                  emblemColor={emblemColor}
                  isBoss={myRole === "boss"}
                  clanId={clanData.id}
                  onRefresh={fetchClan}
                />
              ))}
          </div>
        </div>
      )}

      {/* INVITI tab */}
      {activeTab === "inviti" && (
        <div>
          {isBossOrLuogo && requests.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                Richieste di Adesione
              </h2>
              <div className="space-y-3">
                {requests.map((req) => (
                  <InvitationCard
                    key={req.id}
                    invitation={req}
                    type="request"
                    responding={responding}
                    onRespond={respondToInvitation}
                  />
                ))}
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                Inviti Ricevuti
              </h2>
              <div className="space-y-3">
                {invites.map((inv) => (
                  <InvitationCard
                    key={inv.id}
                    invitation={inv}
                    type="invite"
                    responding={responding}
                    onRespond={respondToInvitation}
                  />
                ))}
              </div>
            </div>
          )}

          {isBossOrLuogo && outgoing.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                Inviti Inviati
              </h2>
              <div className="space-y-3">
                {outgoing.map((inv) => (
                  <OutgoingInviteCard key={inv.id} invitation={inv} emblemColor={emblemColor} />
                ))}
              </div>
            </div>
          )}

          {invites.length === 0 && requests.length === 0 && outgoing.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              Nessun invito o richiesta pendente.
            </p>
          )}
        </div>
      )}

      {/* GUERRE tab */}
      {activeTab === "guerre" && (
        <ClanWarsTab clanId={clanData.id} isBoss={myRole === "boss"} emblemColor={emblemColor} />
      )}

      {/* CLASSIFICA tab — inline leaderboard */}
      {activeTab === "classifica" && <InlineClanLeaderboard />}

      {/* Leave Clan button */}
      <div className="mt-8 border-t border-border/20 pt-6">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-2 text-xs font-bold text-danger/80 transition hover:bg-danger/10 hover:text-danger"
        >
          Lascia La Famiglia
        </button>
      </div>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLeaveModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-danger/30 bg-background p-6 shadow-2xl shadow-black/50">
            <div className="mb-2 text-center text-3xl">&#x2620;&#xFE0F;</div>
            <h2
              className="mb-2 text-center text-lg font-black uppercase tracking-wider text-danger"
              style={{ textShadow: "0 0 20px rgba(220, 38, 38, 0.4)" }}
            >
              Il Prezzo del Tradimento
            </h2>
            <p className="mb-4 text-center text-sm leading-relaxed text-muted">
              Attenzione! Lasciare la Famiglia ha un prezzo.
              I tuoi ex-compagni ti attaccheranno e perderai permanentemente il{" "}
              <span className="font-bold text-danger">10-20% delle tue stats combat</span>.
              Vuoi davvero tradire?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-lg border border-border/30 bg-surface/50 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
              >
                Resta
              </button>
              <button
                onClick={async () => {
                  setLeaving(true);
                  try {
                    const res = await fetch(`/api/clan/${clanData.id}/leave`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ creatureId: myCreatureId }),
                    });
                    if (res.ok) {
                      const json = await res.json();
                      if (json.data?.betrayalId) {
                        // Store betrayal data for the cinematic scene
                        try {
                          sessionStorage.setItem(
                            `betrayal-${json.data.betrayalId}`,
                            JSON.stringify(json.data.betrayalResult),
                          );
                        } catch { /* silently ignore */ }
                        window.location.href = `/clan/esecuzione/${json.data.betrayalId}`;
                      } else {
                        window.location.reload();
                      }
                    }
                  } catch {
                    // silently ignore
                  } finally {
                    setLeaving(false);
                    setShowLeaveModal(false);
                  }
                }}
                disabled={leaving}
                className="flex-1 rounded-lg bg-danger/80 py-2.5 text-xs font-black uppercase text-white transition hover:bg-danger disabled:opacity-50"
              >
                {leaving ? "..." : "Tradisci"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && clanData && (
        <EditClanModal
          clan={clanData}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchClan();
          }}
        />
      )}

      {/* Invite modal */}
      {showInviteModal && clanData && (
        <InviteMemberModal
          clanId={clanData.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            fetchClan();
          }}
        />
      )}

      {showAddOwnModal && clanData && (
        <AddOwnCreaturesModal
          clanId={clanData.id}
          isBoss={myRole === 'boss'}
          existingMemberIds={members.map((m) => m.creatureId)}
          onClose={() => setShowAddOwnModal(false)}
          onDone={() => {
            setShowAddOwnModal(false);
            fetchClan();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div
        className="text-lg font-black text-foreground"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  );
}

function MemberCard({
  member,
  emblemColor,
  isBoss,
  clanId,
  onRefresh,
}: {
  member: ClanMember;
  emblemColor: string;
  isBoss: boolean;
  clanId: string;
  onRefresh: () => void;
}) {
  const [promoting, setPromoting] = useState(false);

  async function handlePromote(role: "luogotenente" | "soldato") {
    setPromoting(true);
    try {
      const res = await fetch(`/api/clan/${clanId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatureId: member.creatureId, role }),
      });
      if (res.ok) onRefresh();
    } catch {
      // silently ignore
    } finally {
      setPromoting(false);
    }
  }

  const roleIcon = ROLE_ICONS[member.role] ?? "";
  const roleLabel = ROLE_LABELS[member.role] ?? member.role;

  return (
    <div
      className="rounded-xl border bg-surface/30 p-3 transition-all hover:bg-surface/50"
      style={{ borderColor: `${emblemColor}22` }}
    >
      <div className="flex items-start gap-3">
        <div className="h-[60px] w-[60px] shrink-0">
          <CreatureRenderer
            params={member.visualParams as unknown as VisualParams ?? DEFAULT_VISUAL_PARAMS}
            size={60}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{roleIcon}</span>
            <span className="truncate text-sm font-bold text-foreground">
              {member.name}
            </span>
          </div>
          <div className="text-[10px] text-muted">
            di {member.ownerName}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
              style={{
                backgroundColor:
                  member.role === "boss"
                    ? "#d9770622"
                    : member.role === "luogotenente"
                    ? "#94a3b822"
                    : "#6b728022",
                color:
                  member.role === "boss"
                    ? "#d97706"
                    : member.role === "luogotenente"
                    ? "#94a3b8"
                    : "#6b7280",
              }}
            >
              {roleLabel}
            </span>
            <span className="text-[10px] text-muted">
              Giorno {member.ageDays}
            </span>
          </div>
          {member.contributionScore > 0 && (
            <div className="mt-1 text-[9px] text-muted">
              Contributo: {member.contributionScore}
            </div>
          )}
        </div>
      </div>

      {/* Promote/demote buttons for boss */}
      {isBoss && member.role !== "boss" && (
        <div className="mt-2 flex gap-1.5 border-t border-border/20 pt-2">
          {member.role === "soldato" && (
            <button
              onClick={() => handlePromote("luogotenente")}
              disabled={promoting}
              className="flex-1 rounded-md bg-surface-2/50 px-2 py-1 text-[10px] font-medium text-muted transition hover:text-foreground disabled:opacity-50"
            >
              Promuovi
            </button>
          )}
          {member.role === "luogotenente" && (
            <button
              onClick={() => handlePromote("soldato")}
              disabled={promoting}
              className="flex-1 rounded-md bg-surface-2/50 px-2 py-1 text-[10px] font-medium text-muted transition hover:text-foreground disabled:opacity-50"
            >
              Degrada
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InvitationCard({
  invitation,
  type,
  responding,
  onRespond,
}: {
  invitation: InvitationItem;
  type: "invite" | "request";
  responding: string | null;
  onRespond: (clanId: string, invId: string, action: "accept" | "reject") => void;
}) {
  const isResponding = responding === invitation.id;
  const emblemColor = invitation.clanEmblemColor || "#6b7280";

  return (
    <div
      className="rounded-xl border bg-surface/30 p-4"
      style={{ borderColor: `${emblemColor}33` }}
    >
      <div className="flex items-start gap-3">
        <div className="h-[50px] w-[50px] shrink-0">
          <CreatureRenderer
            params={invitation.visualParams as unknown as VisualParams ?? DEFAULT_VISUAL_PARAMS}
            size={50}
          />
        </div>
        <div className="min-w-0 flex-1">
          {type === "invite" ? (
            <>
              <div className="text-sm font-bold text-foreground">
                {invitation.clanName}
              </div>
              <div className="text-[10px] text-muted">
                Invita {invitation.creatureName} ad unirsi
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-foreground">
                {invitation.creatureName}
              </div>
              <div className="text-[10px] text-muted">
                di {invitation.creatureOwnerName} vuole unirsi
              </div>
            </>
          )}
          {invitation.message && (
            <p className="mt-1 text-xs italic text-muted">
              &ldquo;{invitation.message}&rdquo;
            </p>
          )}
          <div className="mt-1 text-[9px] text-muted">
            Giorno {invitation.ageDays} &middot; Scade{" "}
            {new Date(invitation.expiresAt).toLocaleDateString("it-IT")}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onRespond(invitation.clanId, invitation.id, "accept")}
          disabled={isResponding}
          className="flex-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/30 disabled:opacity-50"
        >
          {type === "invite" ? "Accetta" : "Approva"}
        </button>
        <button
          onClick={() => onRespond(invitation.clanId, invitation.id, "reject")}
          disabled={isResponding}
          className="flex-1 rounded-lg bg-surface-2/50 px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
        >
          {type === "invite" ? "Rifiuta" : "Nega"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Clan Modal
// ---------------------------------------------------------------------------

function CreateClanModal({
  eligibleCreatures,
  loading,
  onClose,
  onCreated,
}: {
  eligibleCreatures: EligibleCreature[];
  loading: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedCreature, setSelectedCreature] = useState<string>("");
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [emblemColor, setEmblemColor] = useState(EMBLEM_COLORS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!selectedCreature || !name.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/clan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatureId: selectedCreature,
          name: name.trim(),
          motto: motto.trim() || undefined,
          emblemColor,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message ?? "Errore nella creazione");
        setSubmitting(false);
        return;
      }

      onCreated();
    } catch {
      setError("Errore di rete");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-danger/20 bg-background p-6 shadow-2xl shadow-black/40">
        <h2
          className="mb-1 text-lg font-black uppercase tracking-wider text-foreground"
          style={{ textShadow: "0 0 15px rgba(220, 38, 38, 0.3)" }}
        >
          Fonda La Famiglia
        </h2>
        <p className="mb-5 text-xs text-muted">
          Scegli il fondatore e dai un nome alla tua organizzazione.
        </p>

        {/* Creature selector */}
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Fondatore
        </label>
        {loading ? (
          <div className="mb-4 flex h-20 items-center justify-center rounded-lg border border-border/30 bg-surface/30">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : eligibleCreatures.length === 0 ? (
          <div className="mb-4 rounded-lg border border-border/30 bg-surface/30 p-4 text-center text-xs text-muted">
            Nessuna creatura idonea (serve Giorno 40+, viva, non in un clan)
          </div>
        ) : (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {eligibleCreatures.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCreature(c.id)}
                className={`flex shrink-0 flex-col items-center rounded-lg border p-2 transition ${
                  selectedCreature === c.id
                    ? "border-primary bg-primary/10"
                    : "border-border/30 bg-surface/30 hover:bg-surface/50"
                }`}
              >
                <div className="h-10 w-10">
                  <CreatureRenderer
                    params={c.visualParams as unknown as VisualParams ?? DEFAULT_VISUAL_PARAMS}
                    size={40}
                  />
                </div>
                <span className="mt-1 text-[9px] font-medium text-foreground">
                  {c.name}
                </span>
                <span className="text-[8px] text-muted">G.{c.ageDays}</span>
              </button>
            ))}
          </div>
        )}

        {/* Name */}
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Nome del Clan
        </label>
        <input
          type="text"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. I Predatori..."
          className="mb-4 w-full rounded-lg border border-border/30 bg-surface/50 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none"
        />

        {/* Motto */}
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Motto (opzionale)
        </label>
        <input
          type="text"
          maxLength={60}
          value={motto}
          onChange={(e) => setMotto(e.target.value)}
          placeholder="La nostra legge..."
          className="mb-4 w-full rounded-lg border border-border/30 bg-surface/50 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none"
        />

        {/* Color picker */}
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Colore Emblema
        </label>
        <div className="mb-5 flex flex-wrap gap-2">
          {EMBLEM_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setEmblemColor(c.value)}
              title={c.label}
              className={`h-7 w-7 rounded-full border-2 transition ${
                emblemColor === c.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:border-muted"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        {error && (
          <p className="mb-3 text-xs text-danger">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border/30 bg-surface/50 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
          >
            Annulla
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedCreature || !name.trim() || submitting}
            className="flex-1 rounded-lg bg-danger/80 py-2.5 text-xs font-black uppercase text-white transition hover:bg-danger disabled:opacity-50"
          >
            {submitting ? "Creazione..." : "Fonda La Famiglia"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Clan Modal
// ---------------------------------------------------------------------------

function EditClanModal({
  clan,
  onClose,
  onSaved,
}: {
  clan: ClanData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(clan.name);
  const [motto, setMotto] = useState(clan.motto ?? "");
  const [emblemColor, setEmblemColor] = useState(clan.emblemColor || EMBLEM_COLORS[0].value);
  const [description, setDescription] = useState(clan.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/clan/${clan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          motto: motto.trim(),
          emblemColor,
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message ?? "Errore nel salvataggio");
        setSubmitting(false);
        return;
      }

      onSaved();
    } catch {
      setError("Errore di rete");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/30 bg-background p-6 shadow-2xl shadow-black/40">
        <h2 className="mb-4 text-lg font-bold text-foreground">Modifica Clan</h2>

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Nome
        </label>
        <input
          type="text"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-border/30 bg-surface/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Motto
        </label>
        <input
          type="text"
          maxLength={60}
          value={motto}
          onChange={(e) => setMotto(e.target.value)}
          className="mb-3 w-full rounded-lg border border-border/30 bg-surface/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Descrizione
        </label>
        <textarea
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mb-3 w-full rounded-lg border border-border/30 bg-surface/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-none"
        />

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Colore Emblema
        </label>
        <div className="mb-5 flex flex-wrap gap-2">
          {EMBLEM_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setEmblemColor(c.value)}
              title={c.label}
              className={`h-7 w-7 rounded-full border-2 transition ${
                emblemColor === c.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:border-muted"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        {error && <p className="mb-3 text-xs text-danger">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border/30 bg-surface/50 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex-1 rounded-lg bg-primary/80 py-2.5 text-xs font-bold text-white transition hover:bg-primary disabled:opacity-50"
          >
            {submitting ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite Member Modal
// ---------------------------------------------------------------------------

function InviteMemberModal({
  clanId,
  onClose,
  onInvited,
}: {
  clanId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [searchResults, setSearchResults] = useState<
    {
      creatureId: string;
      name: string;
      ownerName: string;
      ageDays: number;
      visualParams: Record<string, unknown>;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAvailable() {
      try {
        const res = await fetch("/api/clan/available-creatures");
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data ?? []);
        } else {
          // Fallback: we'll show an empty state
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAvailable();
  }, []);

  async function handleInvite(creatureId: string) {
    setInviting(creatureId);
    setError("");

    try {
      const res = await fetch(`/api/clan/${clanId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatureId,
          message: message.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Errore nell'invito");
        setInviting(null);
        return;
      }

      // directAdd = own creature added immediately, otherwise invite sent
      onInvited();
    } catch {
      setError("Errore di rete");
      setInviting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border/30 bg-background p-6 shadow-2xl shadow-black/40">
        <h2 className="mb-1 text-lg font-bold text-foreground">Invita Membro</h2>
        <p className="mb-4 text-xs text-muted">
          Seleziona una creatura da invitare nella Famiglia.
        </p>

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Messaggio (opzionale)
        </label>
        <input
          type="text"
          maxLength={100}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Unisciti a noi..."
          className="mb-4 w-full rounded-lg border border-border/30 bg-surface/50 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none"
        />

        {error && <p className="mb-3 text-xs text-danger">{error}</p>}

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : searchResults.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Nessuna creatura disponibile per l&apos;invito.
          </p>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {searchResults.map((c) => (
              <div
                key={c.creatureId}
                className="flex items-center gap-3 rounded-lg border border-border/20 bg-surface/30 p-2"
              >
                <div className="h-10 w-10 shrink-0">
                  <CreatureRenderer
                    params={c.visualParams as unknown as VisualParams ?? DEFAULT_VISUAL_PARAMS}
                    size={40}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-foreground">{c.name}</div>
                  <div className="text-[10px] text-muted">
                    di {c.ownerName} &middot; G.{c.ageDays}
                  </div>
                </div>
                <button
                  onClick={() => handleInvite(c.creatureId)}
                  disabled={inviting !== null}
                  className="shrink-0 rounded-lg bg-primary/20 px-3 py-1.5 text-[10px] font-bold text-primary transition hover:bg-primary/30 disabled:opacity-50"
                >
                  {inviting === c.creatureId ? "..." : "Invita"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-border/30 bg-surface/50 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outgoing Invite Card (read-only, shows status)
// ---------------------------------------------------------------------------

function OutgoingInviteCard({
  invitation,
  emblemColor,
}: {
  invitation: InvitationItem;
  emblemColor: string;
}) {
  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "In Attesa", color: "#d97706" },
    accepted: { label: "Accettato", color: "#16a34a" },
    rejected: { label: "Rifiutato", color: "#dc2626" },
  };
  const st = statusLabels[invitation.status ?? "pending"] ?? statusLabels.pending;

  return (
    <div
      className="rounded-xl border bg-surface/30 p-4"
      style={{ borderColor: `${emblemColor}22` }}
    >
      <div className="flex items-start gap-3">
        <div className="h-[50px] w-[50px] shrink-0">
          <CreatureRenderer
            params={invitation.visualParams as unknown as VisualParams ?? DEFAULT_VISUAL_PARAMS}
            size={50}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-foreground">
            {invitation.creatureName}
          </div>
          <div className="text-[10px] text-muted">
            di {invitation.creatureOwnerName}
          </div>
          {invitation.message && (
            <p className="mt-1 text-xs italic text-muted">
              &ldquo;{invitation.message}&rdquo;
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
              style={{
                backgroundColor: `${st.color}22`,
                color: st.color,
              }}
            >
              {st.label}
            </span>
            <span className="text-[9px] text-muted">
              Scade {new Date(invitation.expiresAt).toLocaleDateString("it-IT")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clan Wars Tab
// ---------------------------------------------------------------------------

interface ClanWarSummary {
  id: string;
  challengerClanId: string;
  challengerClanName: string;
  defenderClanId: string;
  defenderClanName: string;
  format: string;
  status: string;
  challengerWins: number;
  defenderWins: number;
  winnerClanId: string | null;
  createdAt: string;
}

function ClanWarsTab({
  clanId,
  isBoss,
  emblemColor,
}: {
  clanId: string;
  isBoss: boolean;
  emblemColor: string;
}) {
  const [wars, setWars] = useState<ClanWarSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  useEffect(() => {
    async function fetchWars() {
      try {
        const res = await fetch(`/api/clan-war?clanId=${clanId}`);
        if (res.ok) {
          const json = await res.json();
          setWars(json.data ?? []);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    fetchWars();
  }, [clanId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  const activeWars = wars.filter((w) => w.status === "in_progress" || w.status === "pending" || w.status === "accepted");
  const completedWars = wars.filter((w) => w.status === "completed" || w.status === "declined");

  return (
    <div>
      {isBoss && (
        <div className="mb-4">
          <button
            onClick={() => setShowChallengeModal(true)}
            className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-xs font-bold text-danger transition hover:bg-danger/20"
          >
            Sfida un Clan
          </button>
        </div>
      )}

      {activeWars.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Guerre Attive
          </h2>
          <div className="space-y-3">
            {activeWars.map((war) => (
              <WarCard key={war.id} war={war} clanId={clanId} emblemColor={emblemColor} />
            ))}
          </div>
        </div>
      )}

      {completedWars.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Storico Guerre
          </h2>
          <div className="space-y-3">
            {completedWars.map((war) => (
              <WarCard key={war.id} war={war} clanId={clanId} emblemColor={emblemColor} />
            ))}
          </div>
        </div>
      )}

      {wars.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          Nessuna guerra dichiarata. Il Boss pu&ograve; sfidare altri clan.
        </p>
      )}

      {showChallengeModal && (
        <ChallengeModal
          clanId={clanId}
          onClose={() => setShowChallengeModal(false)}
          onChallenged={() => {
            setShowChallengeModal(false);
            // Refetch wars
            fetch(`/api/clan-war?clanId=${clanId}`)
              .then((r) => r.json())
              .then((json) => setWars(json.data ?? []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// War Card
// ---------------------------------------------------------------------------

function WarCard({
  war,
  clanId,
  emblemColor,
}: {
  war: ClanWarSummary;
  clanId: string;
  emblemColor: string;
}) {
  const isChallenger = war.challengerClanId === clanId;
  const opponentName = isChallenger ? war.defenderClanName : war.challengerClanName;
  const myWins = isChallenger ? war.challengerWins : war.defenderWins;
  const opponentWins = isChallenger ? war.defenderWins : war.challengerWins;
  const won = war.winnerClanId === clanId;
  const lost = war.winnerClanId !== null && war.winnerClanId !== clanId;

  const statusColors: Record<string, { label: string; color: string }> = {
    pending: { label: "In Attesa", color: "#d97706" },
    accepted: { label: "Accettata", color: "#3d5afe" },
    in_progress: { label: "In Corso", color: "#16a34a" },
    completed: { label: won ? "VITTORIA" : lost ? "SCONFITTA" : "Completata", color: won ? "#16a34a" : lost ? "#dc2626" : "#6b7280" },
    declined: { label: "Rifiutata", color: "#6b7280" },
  };
  const st = statusColors[war.status] ?? statusColors.pending;

  const formatMap: Record<string, string> = { bo3: "Bo3", bo5: "Bo5", bo7: "Bo7" };

  return (
    <Link
      href={`/clan/guerra/${war.id}`}
      className="block rounded-xl border bg-surface/30 p-4 transition hover:bg-surface/50"
      style={{ borderColor: `${emblemColor}22` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">
            vs {opponentName}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
              style={{ backgroundColor: `${st.color}22`, color: st.color }}
            >
              {st.label}
            </span>
            <span className="text-[10px] text-muted">
              {formatMap[war.format] ?? war.format}
            </span>
          </div>
        </div>
        {war.status !== "pending" && war.status !== "declined" && (
          <div className="text-center">
            <div className="text-lg font-black text-foreground">
              {myWins} - {opponentWins}
            </div>
            <div className="text-[9px] text-muted uppercase">Match</div>
          </div>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Challenge Modal
// ---------------------------------------------------------------------------

function ChallengeModal({
  clanId,
  onClose,
  onChallenged,
}: {
  clanId: string;
  onClose: () => void;
  onChallenged: () => void;
}) {
  const [clansToChallenge, setClansToChallenge] = useState<Array<{ id: string; name: string; clanElo: number; totalMembers: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClan, setSelectedClan] = useState("");
  const [format, setFormat] = useState("bo5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchClans() {
      try {
        const res = await fetch("/api/clan-war/available-clans");
        if (res.ok) {
          const json = await res.json();
          setClansToChallenge((json.data ?? []).filter((c: { id: string }) => c.id !== clanId));
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    fetchClans();
  }, [clanId]);

  async function handleChallenge() {
    if (!selectedClan) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/clan-war/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defenderClanId: selectedClan, format }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message ?? "Errore nella sfida");
        setSubmitting(false);
        return;
      }
      onChallenged();
    } catch {
      setError("Errore di rete");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-danger/20 bg-background p-6 shadow-2xl shadow-black/40">
        <h2
          className="mb-1 text-lg font-black uppercase tracking-wider text-foreground"
          style={{ textShadow: "0 0 15px rgba(220, 38, 38, 0.3)" }}
        >
          Sfida di Clan
        </h2>
        <p className="mb-5 text-xs text-muted">
          Scegli il clan avversario e il formato della guerra.
        </p>

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Formato
        </label>
        <div className="mb-4 flex gap-2">
          {(["bo3", "bo5", "bo7"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded-lg border py-2 text-xs font-bold uppercase transition ${
                format === f
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-border/30 bg-surface/30 text-muted hover:text-foreground"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
          Clan Avversario
        </label>
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : clansToChallenge.length === 0 ? (
          <p className="mb-4 text-center text-xs text-muted">
            Nessun clan disponibile per la sfida.
          </p>
        ) : (
          <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
            {clansToChallenge.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClan(c.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                  selectedClan === c.id
                    ? "border-danger/40 bg-danger/10"
                    : "border-border/20 bg-surface/30 hover:bg-surface/50"
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-foreground">{c.name}</div>
                  <div className="text-[10px] text-muted">{c.totalMembers} membri</div>
                </div>
                <div className="text-sm font-bold text-muted">{c.clanElo}</div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="mb-3 text-xs text-danger">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border/30 bg-surface/50 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
          >
            Annulla
          </button>
          <button
            onClick={handleChallenge}
            disabled={!selectedClan || submitting}
            className="flex-1 rounded-lg bg-danger/80 py-2.5 text-xs font-black uppercase text-white transition hover:bg-danger disabled:opacity-50"
          >
            {submitting ? "..." : "Dichiara Guerra"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline Clan Leaderboard (shown in Classifica tab)                   */
/* ------------------------------------------------------------------ */

interface LeaderboardClan {
  id: string;
  name: string;
  emblemColor: string | null;
  status: string;
  clanElo: number;
  prestige: number;
  clanWins: number;
  clanLosses: number;
  totalMembers: number;
  bossCreatureName?: string;
  bossOwnerName?: string;
}

function InlineClanLeaderboard() {
  const [clans, setClans] = useState<LeaderboardClan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClans() {
      try {
        const res = await fetch("/api/clans");
        if (!res.ok) return;
        const json = await res.json();
        setClans(json.data ?? []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    fetchClans();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-2/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (clans.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted">Nessun clan attivo.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden md:grid md:grid-cols-[2.5rem_1fr_5rem_5rem_5rem_4rem] gap-2 px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider border-b border-border/30">
        <span>#</span>
        <span>Clan</span>
        <span>ELO</span>
        <span>Prestige</span>
        <span>V/S</span>
        <span>Membri</span>
      </div>
      {clans.map((clan, i) => (
        <div
          key={clan.id}
          className="grid grid-cols-[2rem_1fr_auto] md:grid-cols-[2.5rem_1fr_5rem_5rem_5rem_4rem] gap-2 px-3 py-2.5 text-xs items-center border-b border-border/10"
        >
          <span className="font-mono text-muted">{i + 1}</span>
          <div className="flex items-center gap-2 truncate">
            {clan.emblemColor && (
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: clan.emblemColor, boxShadow: `0 0 6px ${clan.emblemColor}44` }} />
            )}
            <span className="font-bold text-foreground truncate">{clan.name}</span>
          </div>
          {/* Mobile right side */}
          <div className="flex items-center gap-2 md:hidden">
            <span className="font-mono font-bold text-foreground">{clan.clanElo}</span>
            <span className="text-[9px] text-muted">{clan.totalMembers}m</span>
          </div>
          {/* Desktop columns */}
          <span className="hidden md:block font-mono text-foreground">{clan.clanElo}</span>
          <span className="hidden md:block font-mono text-amber-400">{clan.prestige}</span>
          <span className="hidden md:block text-muted">
            <span className="text-accent">{clan.clanWins}V</span> <span className="text-danger">{clan.clanLosses}S</span>
          </span>
          <span className="hidden md:block text-muted">{clan.totalMembers}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add Own Creatures Modal                                             */
/* ------------------------------------------------------------------ */

function AddOwnCreaturesModal({
  clanId,
  isBoss,
  existingMemberIds,
  onClose,
  onDone,
}: {
  clanId: string;
  isBoss: boolean;
  existingMemberIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [myCreatures, setMyCreatures] = useState<Array<{
    id: string; name: string; ageDays: number | null; visualParams: Record<string, unknown>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; ok: boolean; msg: string }>>([]);

  useEffect(() => {
    async function fetchMine() {
      try {
        const res = await fetch("/api/creatures");
        if (!res.ok) return;
        const json = await res.json();
        const eligible = (json.data ?? []).filter((c: { id: string; ageDays: number | null; isDead: boolean }) =>
          !existingMemberIds.includes(c.id) && (c.ageDays ?? 0) >= 40 && !c.isDead
        );
        setMyCreatures(eligible);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    fetchMine();
  }, [existingMemberIds]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    const newResults: typeof results = [];

    for (const creatureId of selected) {
      try {
        if (isBoss) {
          // Boss: add directly via invite endpoint (which handles own creatures directly)
          const res = await fetch(`/api/clan/${clanId}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatureId }),
          });
          const json = await res.json();
          const name = myCreatures.find(c => c.id === creatureId)?.name ?? '?';
          newResults.push({ name, ok: res.ok, msg: res.ok ? 'Aggiunto!' : (json.error?.message ?? 'Errore') });
        } else {
          // Non-boss: send request for each creature
          const res = await fetch(`/api/clan/${clanId}/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatureId }),
          });
          const json = await res.json();
          const name = myCreatures.find(c => c.id === creatureId)?.name ?? '?';
          newResults.push({ name, ok: res.ok, msg: res.ok ? 'Richiesta inviata!' : (json.error?.message ?? 'Errore') });
        }
      } catch {
        const name = myCreatures.find(c => c.id === creatureId)?.name ?? '?';
        newResults.push({ name, ok: false, msg: 'Errore di rete' });
      }
    }

    setResults(newResults);
    setSubmitting(false);

    // If all succeeded, close after a short delay
    if (newResults.every(r => r.ok)) {
      setTimeout(onDone, 1000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border/30 bg-background p-5 shadow-2xl shadow-black/40 my-auto max-h-[85dvh] overflow-y-auto">
        <h2 className="mb-1 text-lg font-bold text-foreground">
          {isBoss ? 'Aggiungi le Tue Creature' : 'Proponi le Tue Creature'}
        </h2>
        <p className="mb-4 text-xs text-muted">
          {isBoss
            ? 'Seleziona le creature da aggiungere direttamente alla Famiglia.'
            : 'Seleziona le creature da proporre al Boss per l\'ingresso nella Famiglia.'}
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-surface-2 animate-pulse" />)}
          </div>
        ) : myCreatures.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nessuna creatura idonea disponibile.</p>
        ) : (
          <>
            <div className="space-y-1.5 mb-4">
              {myCreatures.map((c) => {
                const isSelected = selected.has(c.id);
                const result = results.find(r => r.name === c.name);
                const vp = { ...DEFAULT_VISUAL_PARAMS, ...(c.visualParams as Partial<VisualParams>) } as VisualParams;
                return (
                  <button
                    key={c.id}
                    onClick={() => !result && toggleSelect(c.id)}
                    disabled={!!result}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                      result
                        ? result.ok ? 'border-accent/40 bg-accent/5' : 'border-danger/40 bg-danger/5'
                        : isSelected
                          ? 'border-accent/50 bg-accent/10'
                          : 'border-border/20 bg-surface/40 hover:border-border/40'
                    }`}
                  >
                    <div className="shrink-0">
                      <CreatureRenderer params={vp} size={40} animated={false} seed={42} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted">Giorno {c.ageDays ?? 0}</p>
                    </div>
                    {result ? (
                      <span className={`text-[10px] font-bold ${result.ok ? 'text-accent' : 'text-danger'}`}>
                        {result.msg}
                      </span>
                    ) : isSelected ? (
                      <span className="text-accent text-sm">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-border/30 py-2 text-xs font-bold text-muted transition hover:text-foreground">
                Chiudi
              </button>
              <button
                onClick={handleSubmit}
                disabled={selected.size === 0 || submitting}
                className="flex-1 rounded-lg bg-accent/20 border border-accent/30 py-2 text-xs font-bold text-accent transition hover:bg-accent/30 disabled:opacity-50"
              >
                {submitting ? '...' : isBoss
                  ? `Aggiungi ${selected.size} creatur${selected.size === 1 ? 'a' : 'e'}`
                  : `Proponi ${selected.size} creatur${selected.size === 1 ? 'a' : 'e'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
