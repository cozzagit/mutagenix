"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = "partner" | "richieste" | "creature" | "albero";

interface PartnerData {
  creatureId: string;
  name: string;
  ownerName: string;
  ageDays: number;
  tier: string;
  stability: number;
  familyGeneration: number;
  visualParams: Record<string, unknown>;
  topElements: { elementId: string; level: number }[];
  childCount: number;
}

interface BreedingRequest {
  id: string;
  requesterCreatureId: string;
  status: string;
  message: string | null;
  energyCost: number;
  expiresAt: string;
  createdAt: string;
  requester: {
    creatureName: string;
    ownerName: string;
    ageDays: number;
    stability: number;
    visualParams: Record<string, unknown>;
  };
}

interface CreatureData {
  id: string;
  name: string;
  ageDays: number | null;
  familyGeneration: number | null;
  isFounder: boolean;
  isDead: boolean;
  stability: number | null;
  visualParams: Record<string, unknown>;
  isActive: boolean;
  parentNames: { parentA: string | null; parentB: string | null } | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTierLabel(tier: string): string {
  const map: Record<string, string> = {
    novice: "Novizio",
    intermediate: "Intermedio",
    veteran: "Veterano",
    legend: "Leggenda",
    immortal: "Immortale",
    divine: "Divinit\u00E0",
    eternal: "Eterno",
  };
  return map[tier] ?? tier;
}

function getTierColor(tier: string): string {
  const map: Record<string, string> = {
    novice: "bg-muted/15 text-muted",
    intermediate: "bg-primary/15 text-primary",
    veteran: "bg-bio-purple/15 text-bio-purple",
    legend: "bg-amber-500/15 text-amber-400",
    immortal: "bg-red-500/15 text-red-400",
    divine: "bg-amber-500/20 text-amber-400 border border-amber-400/30",
    eternal: "bg-gradient-to-r from-amber-500/20 via-yellow-300/20 to-amber-500/20 text-amber-300 border border-amber-300/50 shadow-[0_0_8px_rgba(252,211,77,0.3)]",
  };
  return map[tier] ?? "bg-muted/15 text-muted";
}

function getGenLabel(gen: number | null): string {
  if (!gen || gen <= 1) return "Gen 1";
  return `Gen ${gen}`;
}

function getElementColor(elementId: string): string {
  const map: Record<string, string> = {
    N: "#3d5afe",
    K: "#b26eff",
    Na: "#ff9100",
    C: "#6b6d7b",
    O: "#00f0ff",
    P: "#39ff7f",
    S: "#ffd600",
    Ca: "#ffcc80",
    Fe: "#ff4466",
    Cl: "#76ff03",
  };
  return map[elementId] ?? "#888888";
}

function hoursRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
}

/* ------------------------------------------------------------------ */
/* Sub: Tab bar                                                       */
/* ------------------------------------------------------------------ */

const TABS: { id: Tab; label: string }[] = [
  { id: "partner", label: "CERCA PARTNER" },
  { id: "richieste", label: "RICHIESTE" },
  { id: "creature", label: "LE MIE CREATURE" },
  { id: "albero", label: "ALBERO" },
];

/* ------------------------------------------------------------------ */
/* Sub: Propose Breeding Modal                                        */
/* ------------------------------------------------------------------ */

function ProposeModal({
  partner,
  myCreatures,
  onConfirm,
  onCancel,
  loading,
}: {
  partner: PartnerData;
  myCreatures: CreatureData[];
  onConfirm: (creatureId: string, message: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [message, setMessage] = useState("");
  const activeCreature = myCreatures.find((c) => c.isActive);
  const selectedId = activeCreature?.id ?? "";

  const pVp = { ...DEFAULT_VISUAL_PARAMS, ...(partner.visualParams as Partial<VisualParams>) } as VisualParams;
  const myVp = activeCreature
    ? ({ ...DEFAULT_VISUAL_PARAMS, ...(activeCreature.visualParams as Partial<VisualParams>) } as VisualParams)
    : DEFAULT_VISUAL_PARAMS;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm p-0 md:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-border/50 bg-surface p-5 md:p-6 max-h-[85dvh] overflow-y-auto md:my-auto md:max-h-[90dvh]">
        <h3 className="text-lg font-black text-foreground mb-4">Proponi Accoppiamento</h3>

        {/* Creatures side by side */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <CreatureRenderer params={myVp} size={100} animated />
            <p className="text-[10px] text-muted mt-1 truncate max-w-[100px]">
              {activeCreature?.name ?? "—"}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6 text-accent">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            <span className="text-[9px] text-accent font-bold">DNA</span>
          </div>
          <div className="text-center">
            <CreatureRenderer params={pVp} size={100} animated />
            <p className="text-[10px] text-muted mt-1 truncate max-w-[100px]">
              {partner.name}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-lg bg-surface-2 p-3 mb-4 text-xs text-muted space-y-1">
          <p>Partner di: <strong className="text-foreground">{partner.ownerName}</strong></p>
          <p>Generazione: <strong className="text-foreground">{getGenLabel(partner.familyGeneration)}</strong></p>
          <p>Figli precedenti: <strong className="text-foreground">{partner.childCount}</strong></p>
        </div>

        {/* Message */}
        <div className="mb-4">
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">
            Messaggio (opzionale)
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Scrivi un messaggio al proprietario..."
            maxLength={200}
            className="w-full rounded-lg border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" fullWidth onClick={onCancel} disabled={loading}>
            ANNULLA
          </Button>
          <Button
            variant="accent"
            size="sm"
            fullWidth
            onClick={() => onConfirm(selectedId, message)}
            loading={loading}
            disabled={!selectedId}
          >
            PROPONI
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: Partner Card                                                  */
/* ------------------------------------------------------------------ */

function PartnerCard({
  partner,
  onPropose,
}: {
  partner: PartnerData;
  onPropose: (partner: PartnerData) => void;
}) {
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(partner.visualParams as Partial<VisualParams>) } as VisualParams;

  return (
    <div className="group flex flex-col rounded-xl border border-border/50 bg-surface/80 p-3 transition-all hover:border-accent/40 hover:bg-surface">
      {/* Creature */}
      <div className="flex justify-center mb-2">
        <CreatureRenderer params={vp} size={100} animated={false} seed={42} />
      </div>

      {/* Name */}
      <p className="text-sm font-bold text-foreground truncate text-center leading-tight">
        {partner.name}
      </p>

      {/* Owner + day */}
      <p className="text-[10px] text-muted truncate text-center mb-2">
        {partner.ownerName} &middot; Giorno {partner.ageDays}
      </p>

      {/* Badges */}
      <div className="flex items-center justify-center gap-1 mb-2 flex-wrap">
        <span className={`rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getTierColor(partner.tier)}`}>
          {getTierLabel(partner.tier)}
        </span>
        <span className="rounded-sm bg-bio-purple/15 px-1.5 py-0.5 text-[8px] font-bold text-bio-purple">
          {getGenLabel(partner.familyGeneration)}
        </span>
      </div>

      {/* Stability */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] text-muted">Stabilit&agrave;</span>
          <span className="text-[9px] font-bold" style={{ color: partner.stability >= 0.7 ? '#00e5a0' : partner.stability >= 0.4 ? '#ff9100' : '#ff3d3d' }}>
            {Math.round(partner.stability * 100)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${partner.stability * 100}%`,
              backgroundColor: partner.stability >= 0.7 ? '#00e5a0' : partner.stability >= 0.4 ? '#ff9100' : '#ff3d3d',
            }}
          />
        </div>
      </div>

      {/* Top elements */}
      {partner.topElements && partner.topElements.length > 0 && (
        <div className="flex items-center justify-center gap-1 mb-2">
          {partner.topElements.slice(0, 3).map((el) => (
            <span
              key={el.elementId}
              className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
              style={{
                color: getElementColor(el.elementId),
                backgroundColor: `${getElementColor(el.elementId)}20`,
              }}
            >
              {el.elementId} {Math.round(el.level)}
            </span>
          ))}
        </div>
      )}

      {/* Child count */}
      <p className="text-[9px] text-muted text-center mb-3">
        {partner.childCount} {partner.childCount === 1 ? "figlio" : "figli"}
      </p>

      {/* Propose button */}
      <Button
        variant="accent"
        size="sm"
        fullWidth
        onClick={() => onPropose(partner)}
        className="!min-h-[36px] !h-8 uppercase font-black tracking-wider text-[11px]"
      >
        PROPONI
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: Request Card                                                  */
/* ------------------------------------------------------------------ */

function RequestCard({
  request,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: {
  request: BreedingRequest;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  accepting: boolean;
  rejecting: boolean;
}) {
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(request.requester.visualParams as Partial<VisualParams>) } as VisualParams;
  const hours = hoursRemaining(request.expiresAt);

  return (
    <div className="flex flex-col rounded-xl border border-border/50 bg-surface/80 p-4">
      <div className="flex items-start gap-4">
        {/* Creature */}
        <div className="shrink-0">
          <CreatureRenderer params={vp} size={80} animated={false} seed={42} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {request.requester.creatureName}
          </p>
          <p className="text-[10px] text-muted">
            di <strong className="text-foreground">{request.requester.ownerName}</strong> &middot; Giorno {request.requester.ageDays}
          </p>
          <p className="text-[10px] text-muted mt-1">
            Stabilit&agrave;: <strong style={{ color: request.requester.stability >= 0.7 ? '#00e5a0' : request.requester.stability >= 0.4 ? '#ff9100' : '#ff3d3d' }}>
              {Math.round(request.requester.stability * 100)}%
            </strong>
          </p>

          {request.message && (
            <p className="text-xs text-foreground/80 mt-2 italic border-l-2 border-border/50 pl-2">
              &ldquo;{request.message}&rdquo;
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted">
            <span>Costo energia: <strong className="text-warning">{request.energyCost}</strong></span>
            <span>Scade tra: <strong className={hours <= 2 ? "text-danger" : "text-foreground"}>{hours}h</strong></span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => onReject(request.id)}
          loading={rejecting}
          disabled={accepting}
          className="!text-danger"
        >
          RIFIUTA
        </Button>
        <Button
          variant="accent"
          size="sm"
          fullWidth
          onClick={() => onAccept(request.id)}
          loading={accepting}
          disabled={rejecting}
        >
          ACCETTA
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub: Creature Manager Card                                         */
/* ------------------------------------------------------------------ */

function CreatureCard({
  creature,
  onActivate,
  activating,
}: {
  creature: CreatureData;
  onActivate: (id: string) => void;
  activating: boolean;
}) {
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(creature.visualParams as Partial<VisualParams>) } as VisualParams;
  const isDead = creature.isDead;

  return (
    <div
      className={`flex flex-col rounded-xl border p-3 transition-all ${
        creature.isActive
          ? "border-accent/60 bg-accent/5 shadow-[0_0_12px_rgba(0,229,160,0.15)]"
          : isDead
            ? "border-border/20 bg-surface/40 opacity-60"
            : "border-border/50 bg-surface/80 hover:border-border/80"
      }`}
    >
      {/* Creature */}
      <div className={`flex justify-center mb-2 ${isDead ? "grayscale" : ""}`}>
        <CreatureRenderer params={vp} size={90} animated={!isDead} seed={42} />
      </div>

      {/* Name */}
      <p className="text-sm font-bold text-foreground truncate text-center leading-tight">
        {creature.name}
      </p>

      {/* Day */}
      <p className="text-[10px] text-muted text-center mb-2">
        Giorno {creature.ageDays ?? 0}
      </p>

      {/* Badges */}
      <div className="flex items-center justify-center gap-1 mb-2 flex-wrap">
        <span className="rounded-sm bg-bio-purple/15 px-1.5 py-0.5 text-[8px] font-bold text-bio-purple">
          {getGenLabel(creature.familyGeneration)}
        </span>
        {creature.isFounder && (
          <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[8px] font-bold text-primary">
            Fondatore
          </span>
        )}
        {isDead && (
          <span className="rounded-sm bg-danger/15 px-1.5 py-0.5 text-[8px] font-bold text-danger">
            Morta
          </span>
        )}
        {creature.isActive && (
          <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-[8px] font-bold text-accent">
            Attiva
          </span>
        )}
      </div>

      {/* Parent names */}
      {creature.parentNames && (creature.parentNames.parentA || creature.parentNames.parentB) && (
        <div className="flex items-center justify-center gap-1 mb-2">
          <span className="text-[9px] text-bio-purple">&#9829;</span>
          <p className="text-[9px] text-muted">
            {[creature.parentNames.parentA, creature.parentNames.parentB].filter(Boolean).join(" + ")}
          </p>
        </div>
      )}

      {/* Activate button */}
      {!creature.isActive && !isDead && (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => onActivate(creature.id)}
          loading={activating}
          className="!min-h-[32px] !h-7 uppercase text-[10px] font-bold mt-auto"
        >
          ATTIVA
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Partner                                                       */
/* ------------------------------------------------------------------ */

function PartnerTab() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState<PartnerData | null>(null);
  const [myCreatures, setMyCreatures] = useState<CreatureData[]>([]);
  const [sending, setSending] = useState(false);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/breeding/partners");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPartners(json.data ?? []);
    } catch {
      toast("error", "Errore nel caricamento dei partner.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Fetch my creatures when opening modal
  useEffect(() => {
    if (!proposing) return;
    async function fetchMine() {
      try {
        const res = await fetch("/api/creatures");
        if (!res.ok) throw new Error();
        const json = await res.json();
        setMyCreatures(json.data ?? []);
      } catch {
        // silent
      }
    }
    fetchMine();
  }, [proposing]);

  const handleConfirm = useCallback(async (creatureId: string, message: string) => {
    if (!proposing) return;
    setSending(true);
    try {
      const res = await fetch("/api/breeding/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCreatureId: proposing.creatureId,
          creatureId,
          message: message || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast("error", json.error?.message ?? "Errore nell'invio della richiesta.");
        return;
      }
      toast("success", "Richiesta di accoppiamento inviata!");
      setProposing(null);
      fetchPartners();
    } catch {
      toast("error", "Errore di rete.");
    } finally {
      setSending(false);
    }
  }, [proposing, toast, fetchPartners]);

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl border border-border/30 bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : partners.length === 0 ? (
        <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
          <p className="text-sm text-muted">Nessun partner disponibile al momento.</p>
          <p className="text-[10px] text-muted mt-1">I partner devono avere creature attive e non in fase embrionale.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
          {partners.map((p) => (
            <PartnerCard key={p.creatureId} partner={p} onPropose={setProposing} />
          ))}
        </div>
      )}

      {proposing && (
        <ProposeModal
          partner={proposing}
          myCreatures={myCreatures}
          onConfirm={handleConfirm}
          onCancel={() => setProposing(null)}
          loading={sending}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Richieste                                                     */
/* ------------------------------------------------------------------ */

interface SentRequest {
  id: string;
  status: string;
  energyCost: number;
  expiresAt: string;
  createdAt: string;
  targetCreatureName: string;
  targetOwnerName: string;
}

function RichiesteTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [requests, setRequests] = useState<BreedingRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<"accept" | "reject" | "cancel" | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [inRes, sentRes] = await Promise.all([
        fetch("/api/breeding/requests"),
        fetch("/api/breeding/requests/sent"),
      ]);
      if (inRes.ok) {
        const json = await inRes.json();
        setRequests((json.data ?? []).filter((r: BreedingRequest) => r.status === "pending"));
      }
      if (sentRes.ok) {
        const json = await sentRes.json();
        setSentRequests(json.data ?? []);
      }
    } catch {
      toast("error", "Errore nel caricamento delle richieste.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAccept = useCallback(async (id: string) => {
    setProcessingId(id);
    setProcessingAction("accept");
    try {
      const res = await fetch(`/api/breeding/requests/${id}/accept`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast("error", json.error?.message ?? "Errore nell'accettazione.");
        return;
      }
      toast("success", "Accoppiamento completato!");
      router.push(`/breeding/reveal/${json.data.breedingId}`);
    } catch {
      toast("error", "Errore di rete.");
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  }, [toast, router]);

  const handleReject = useCallback(async (id: string) => {
    setProcessingId(id);
    setProcessingAction("reject");
    try {
      const res = await fetch(`/api/breeding/requests/${id}/reject`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        toast("error", json.error?.message ?? "Errore nel rifiuto.");
        return;
      }
      toast("info", "Richiesta rifiutata.");
      fetchRequests();
    } catch {
      toast("error", "Errore di rete.");
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  }, [toast, fetchRequests]);

  const handleCancel = useCallback(async (id: string) => {
    setProcessingId(id);
    setProcessingAction("cancel");
    try {
      const res = await fetch(`/api/breeding/requests/${id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        toast("error", json.error?.message ?? "Errore nell'annullamento.");
        return;
      }
      toast("info", "Richiesta annullata.");
      fetchRequests();
    } catch {
      toast("error", "Errore di rete.");
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  }, [toast, fetchRequests]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl border border-border/30 bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Incoming requests */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Richieste Ricevute</h3>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-surface-2 p-6 text-center">
            <p className="text-xs text-muted">Nessuna richiesta in arrivo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onAccept={handleAccept}
                onReject={handleReject}
                accepting={processingId === req.id && processingAction === "accept"}
                rejecting={processingId === req.id && processingAction === "reject"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sent requests */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Richieste Inviate</h3>
        {sentRequests.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-surface-2 p-6 text-center">
            <p className="text-xs text-muted">Non hai richieste inviate.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sentRequests.map((sr) => (
              <div key={sr.id} className="flex items-center justify-between rounded-xl border border-border/30 bg-surface/80 p-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{sr.targetCreatureName}</p>
                  <p className="text-[10px] text-muted">di {sr.targetOwnerName} &middot; {sr.energyCost} energia &middot; Scade tra {Math.max(0, Math.ceil((new Date(sr.expiresAt).getTime() - Date.now()) / 3600000))}h</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${sr.status === 'pending' ? 'bg-amber-500/15 text-amber-400' : sr.status === 'accepted' ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'}`}>
                    {sr.status === 'pending' ? 'In attesa' : sr.status === 'accepted' ? 'Accettata' : sr.status === 'rejected' ? 'Rifiutata' : sr.status === 'cancelled' ? 'Annullata' : sr.status}
                  </span>
                  {sr.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(sr.id)}
                      disabled={processingId === sr.id}
                      className="rounded-lg border border-danger/30 bg-danger/10 px-2 py-1 text-[10px] font-bold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                    >
                      Annulla
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Creature Manager                                              */
/* ------------------------------------------------------------------ */

function CreatureManagerTab() {
  const { toast } = useToast();
  const router = useRouter();
  const [creatures, setCreatures] = useState<CreatureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const fetchCreatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/creatures");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCreatures(json.data ?? []);
    } catch {
      toast("error", "Errore nel caricamento delle creature.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCreatures();
  }, [fetchCreatures]);

  const handleActivate = useCallback(async (id: string) => {
    setActivatingId(id);
    try {
      const res = await fetch(`/api/creatures/${id}/activate`, { method: "PATCH" });
      if (!res.ok) {
        const json = await res.json();
        toast("error", json.error?.message ?? "Errore nell'attivazione.");
        return;
      }
      toast("success", "Creatura attivata!");
      fetchCreatures();
      router.refresh();
    } catch {
      toast("error", "Errore di rete.");
    } finally {
      setActivatingId(null);
    }
  }, [toast, fetchCreatures, router]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-56 rounded-xl border border-border/30 bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (creatures.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
        <p className="text-sm text-muted">Nessuna creatura trovata.</p>
      </div>
    );
  }

  // Sort: active first, then alive, then dead
  const sorted = [...creatures].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isDead !== b.isDead) return a.isDead ? 1 : -1;
    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
      {sorted.map((c) => (
        <CreatureCard
          key={c.id}
          creature={c}
          onActivate={handleActivate}
          activating={activatingId === c.id}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Albero Genealogico                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Family Tree types (matching API response)                           */
/* ------------------------------------------------------------------ */

interface TreeCreature {
  creatureId: string;
  name: string;
  ageDays: number;
  familyGeneration: number;
  isFounder: boolean;
  isDead: boolean;
  isActive: boolean;
  isMine: boolean;
  ownerName: string;
  stability: number;
  visualParams: Record<string, unknown>;
}

interface BreedingEvent {
  breedingId: string;
  partnerParent: TreeCreature;
  myOffspring: TreeCreature | null;
  partnerOffspring: TreeCreature | null;
  childBreedings: BreedingEvent[];
}

interface FamilyTreeData {
  rootCreatureId: string;
  requestedCreatureId: string;
  root: TreeCreature;
  breedings: BreedingEvent[];
}

/* ------------------------------------------------------------------ */
/* Shared color helpers                                                */
/* ------------------------------------------------------------------ */

const GEN_COLORS: Record<number, { color: string; glow: string }> = {
  1: { color: "#3d5afe", glow: "rgba(61,90,254,0.35)" },
  2: { color: "#b26eff", glow: "rgba(178,110,255,0.35)" },
  3: { color: "#00e5a0", glow: "rgba(0,229,160,0.35)" },
};

function getGenColor(gen: number) {
  return GEN_COLORS[gen] ?? GEN_COLORS[3]!;
}

function getStabilityColor(stability: number): string {
  if (stability >= 0.7) return "#00e5a0";
  if (stability >= 0.4) return "#ff9100";
  return "#ff3d3d";
}

/* ------------------------------------------------------------------ */
/* SVG connector between parents (horizontal with DNA helix + heart)   */
/* ------------------------------------------------------------------ */

function ParentConnector() {
  return (
    <div className="flex items-center shrink-0 px-1">
      <svg width="60" height="28" viewBox="0 0 60 28" fill="none" className="shrink-0">
        {/* Glowing gradient line */}
        <defs>
          <linearGradient id="parentGrad" x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#3d5afe" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ec4899" stopOpacity="0.8" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
          </linearGradient>
          <filter id="parentGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Main line */}
        <path d="M 2 14 C 15 14, 20 8, 30 14 C 40 20, 45 14, 58 14" stroke="url(#parentGrad)" strokeWidth="2" strokeLinecap="round" filter="url(#parentGlow)" />
        {/* DNA helix decoration */}
        <path d="M 18 8 C 22 12, 26 16, 30 14 C 34 12, 38 8, 42 12" stroke="#ec4899" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        <path d="M 18 20 C 22 16, 26 12, 30 14 C 34 16, 38 20, 42 16" stroke="#b26eff" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        {/* Heart center */}
        <text x="30" y="17" textAnchor="middle" fontSize="10" fill="#ec4899" opacity="0.7">{'\u2764'}</text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SVG curved lines from parents to offspring                          */
/* ------------------------------------------------------------------ */

function OffspringConnectors({ hasMyOffspring, hasPartnerOffspring }: { hasMyOffspring: boolean; hasPartnerOffspring: boolean }) {
  if (!hasMyOffspring && !hasPartnerOffspring) return null;

  const w = 320;
  const h = 50;
  const midX = w / 2;
  const leftX = w * 0.25;
  const rightX = w * 0.75;

  return (
    <div className="flex justify-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="shrink-0">
        <defs>
          <linearGradient id="myLineGrad" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3d5afe" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="partnerLineGrad" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Junction dot at top center */}
        <circle cx={midX} cy={4} r={3} fill="#ec4899" opacity={0.6} filter="url(#lineGlow)" />

        {/* My offspring — solid glowing curve */}
        {hasMyOffspring && (
          <path
            d={`M ${midX} 4 C ${midX} 25, ${leftX} 20, ${leftX} ${h - 2}`}
            stroke="url(#myLineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#lineGlow)"
          />
        )}

        {/* Partner offspring — dashed subtle curve */}
        {hasPartnerOffspring && (
          <path
            d={`M ${midX} 4 C ${midX} 25, ${rightX} 20, ${rightX} ${h - 2}`}
            stroke="url(#partnerLineGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="4 3"
          />
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Creature card (used for both parents and offspring)                 */
/* ------------------------------------------------------------------ */

function FamilyCreatureCard({
  creature,
  role,
  size = 65,
}: {
  creature: TreeCreature;
  role: "mine" | "partner";
  size?: number;
}) {
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(creature.visualParams as Partial<VisualParams>) } as VisualParams;
  const genC = getGenColor(creature.familyGeneration);
  const isMine = role === "mine";

  const borderColor = creature.isActive
    ? "#00e5a0"
    : creature.isDead
      ? "rgba(255,255,255,0.06)"
      : isMine
        ? genC.color
        : "rgba(255,255,255,0.12)";

  return (
    <div
      className="relative rounded-xl border p-2.5 transition-all"
      style={{
        borderColor,
        borderStyle: isMine ? "solid" : "dashed",
        background: creature.isActive
          ? "rgba(0,229,160,0.05)"
          : creature.isDead
            ? "rgba(255,255,255,0.02)"
            : isMine
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.02)",
        boxShadow: creature.isActive
          ? "0 0 16px rgba(0,229,160,0.25), inset 0 0 20px rgba(0,229,160,0.03)"
          : isMine && !creature.isDead
            ? `0 0 10px ${genC.glow}`
            : "none",
        opacity: creature.isDead ? 0.4 : isMine ? 1 : 0.7,
        filter: creature.isDead ? "grayscale(100%)" : "none",
        minWidth: 130,
        maxWidth: 170,
      }}
    >
      {/* Active pulse ring */}
      {creature.isActive && (
        <div
          className="absolute -inset-px rounded-xl animate-pulse pointer-events-none"
          style={{ boxShadow: "0 0 12px rgba(0,229,160,0.3)" }}
        />
      )}

      {/* Creature SVG */}
      <div className="flex justify-center mb-1.5 relative">
        <CreatureRenderer params={vp} size={size} animated={creature.isActive} seed={42} />
        {creature.isDead && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3d3d" strokeWidth={1.5} opacity={0.8}>
              <circle cx="12" cy="10" r="7" />
              <circle cx="9.5" cy="9" r="1.5" fill="#ff3d3d" />
              <circle cx="14.5" cy="9" r="1.5" fill="#ff3d3d" />
              <path d="M10 14h4M10 14v3M12 14v3M14 14v3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Name */}
      <p className="text-[11px] font-bold text-foreground truncate text-center leading-tight">
        {creature.name}
      </p>

      {/* Owner label */}
      <p className="text-[9px] text-muted truncate text-center mt-0.5">
        {isMine ? creature.ownerName : `di ${creature.ownerName}`}
      </p>

      {/* Day count */}
      <p className="text-[9px] text-muted text-center mt-0.5">
        Giorno {creature.ageDays}
      </p>

      {/* Badges */}
      <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
        <span
          className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold"
          style={{
            color: genC.color,
            backgroundColor: `${genC.color}20`,
          }}
        >
          Gen {creature.familyGeneration}
        </span>

        {creature.isFounder && (
          <span
            className="rounded-sm px-1.5 py-0.5 text-[8px] font-bold flex items-center gap-0.5"
            style={{ color: "#ffd600", backgroundColor: "rgba(255,214,0,0.12)" }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#ffd600">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Fondatore
          </span>
        )}

        <span className="flex items-center gap-0.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: getStabilityColor(creature.stability) }}
          />
          <span className="text-[8px] text-muted">{Math.round(creature.stability * 100)}%</span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single breeding event: parents + offspring                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Traditional Family Tree Layout                                      */
/*                                                                     */
/* Structure:                                                          */
/*   [ROOT] at top center                                              */
/*     |--- [Partner1]    [Partner2]    [Partner3]                      */
/*     |       |              |             |                          */
/*     |    [Child1,2]    [Child3,4]    [Child5,6]                     */
/*     |       |                                                       */
/*     |    [Partner4]                                                  */
/*     |       |                                                       */
/*     |    [GrandChild]                                               */
/* ------------------------------------------------------------------ */

/** Max breedings per creature */
const MAX_BREEDINGS = 3;

/** Empty slot placeholder for unused breeding slots */
function EmptySlot({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed p-2.5 flex flex-col items-center justify-center"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)', minWidth: 130, maxWidth: 170, minHeight: 100 }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1.2} className="mb-1.5">
        <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
        <path d="M12 9v6M9 12h6" strokeLinecap="round" />
      </svg>
      <p className="text-[8px] text-muted/40 uppercase tracking-wider font-bold">{label}</p>
    </div>
  );
}

/**
 * A single breeding column: shows partner, then offspring below.
 * The "parent" creature is NOT re-rendered — it's already visible above.
 */
function BreedingColumn({
  event,
  parentGen,
  depth,
}: {
  event: BreedingEvent;
  parentGen: number;
  depth: number;
}) {
  const childGenC = getGenColor(parentGen + 1);
  const offspring = [event.myOffspring, event.partnerOffspring].filter(Boolean) as TreeCreature[];

  return (
    <div className="flex flex-col items-center">
      {/* Partner card with heart */}
      <div className="relative">
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[8px] text-pink-400/60">{'\u2764'}</span>
        <FamilyCreatureCard creature={event.partnerParent} role="partner" size={depth === 0 ? 58 : 50} />
      </div>

      {/* SVG curve to offspring */}
      {offspring.length > 0 && (
        <>
          <svg width={offspring.length * 150} height="30" viewBox={`0 0 ${offspring.length * 150} 30`} fill="none" className="shrink-0">
            <circle cx={offspring.length * 75} cy={3} r={2.5} fill={childGenC.color} opacity={0.5} />
            {offspring.map((child, i) => {
              const midX = offspring.length * 75;
              const childX = offspring.length === 1 ? midX : 75 + i * 150;
              return (
                <path key={child.creatureId}
                  d={`M ${midX} 3 C ${midX} 15, ${childX} 13, ${childX} 28`}
                  stroke={child.isMine ? childGenC.color : "rgba(255,255,255,0.15)"}
                  strokeWidth={child.isMine ? 2 : 1.5} strokeLinecap="round"
                  strokeDasharray={child.isMine ? "none" : "4 3"}
                  opacity={child.isMine ? 0.7 : 0.4}
                />
              );
            })}
          </svg>

          <div className="flex items-start gap-3">
            {offspring.map((child) => {
              // Count this child's actual breedings
              const childBreedingCount = (child.creatureId === event.myOffspring?.creatureId)
                ? event.childBreedings.length : 0;

              return (
                <div key={child.creatureId} className="flex flex-col items-center">
                  <span className="text-[7px] font-bold uppercase tracking-wider mb-0.5"
                    style={{ color: child.isMine ? childGenC.color : 'rgba(255,255,255,0.25)' }}>
                    {child.isMine ? 'Tuo' : 'Partner'}
                  </span>
                  <FamilyCreatureCard creature={child} role={child.isMine ? "mine" : "partner"} size={depth === 0 ? 50 : 44} />

                  {/* Sub-breedings: show actual + empty slots up to MAX_BREEDINGS */}
                  {child.isMine && (
                    <div className="flex flex-col items-center mt-1">
                      {(childBreedingCount > 0 || true) && (
                        <>
                          {/* Vertical connector */}
                          <svg width="2" height="14" viewBox="0 0 2 14" fill="none">
                            <line x1="1" y1="0" x2="1" y2="14" stroke={childGenC.color} strokeWidth="1.5"
                              opacity={childBreedingCount > 0 ? 0.4 : 0.15}
                              strokeDasharray={childBreedingCount > 0 ? "none" : "3 3"} />
                          </svg>

                          {/* Sub-breeding columns + empty slots */}
                          <div className="flex items-start gap-3">
                            {/* Actual breedings */}
                            {child.creatureId === event.myOffspring?.creatureId && event.childBreedings.map((childEvent) => (
                              <BreedingColumn
                                key={childEvent.breedingId}
                                event={childEvent}
                                parentGen={child.familyGeneration}
                                depth={depth + 1}
                              />
                            ))}
                            {/* Empty slots for remaining breeding capacity */}
                            {Array.from({ length: MAX_BREEDINGS - childBreedingCount }).map((_, i) => (
                              <EmptySlot key={`empty-${child.creatureId}-${i}`} label="Slot libero" />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Full family tree: root on top, ALWAYS 3 breeding slots below.
 * Each creature appears exactly ONCE.
 */
function FamilyTreeLayout({ root, breedings }: { root: TreeCreature; breedings: BreedingEvent[] }) {
  const genC = getGenColor(root.familyGeneration);
  const emptyCount = MAX_BREEDINGS - breedings.length;
  const totalSlots = MAX_BREEDINGS;

  return (
    <div className="flex flex-col items-center">
      {/* Root creature — shown ONCE at the top */}
      <FamilyCreatureCard creature={root} role="mine" size={75} />

      {/* SVG trunk: 3 curved lines from root down (solid for active, dashed for empty) */}
      <svg
        width={totalSlots * 200}
        height="36"
        viewBox={`0 0 ${totalSlots * 200} 36`}
        fill="none"
        className="shrink-0"
      >
        <defs>
          <filter id="trunkGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: totalSlots }).map((_, i) => {
          const totalW = totalSlots * 200;
          const midX = totalW / 2;
          const branchX = (totalW * (i + 1)) / (totalSlots + 1);
          const isActive = i < breedings.length;

          return (
            <path
              key={i}
              d={`M ${midX} 2 C ${midX} 18, ${branchX} 14, ${branchX} 34`}
              stroke={genC.color}
              strokeWidth={isActive ? 2 : 1}
              strokeLinecap="round"
              opacity={isActive ? 0.45 : 0.12}
              strokeDasharray={isActive ? "none" : "4 4"}
              filter={isActive ? "url(#trunkGlow)" : undefined}
            />
          );
        })}
      </svg>

      {/* 3 columns: actual breedings + empty slots */}
      <div className="flex items-start justify-center gap-5 md:gap-7">
        {/* Actual breeding columns */}
        {breedings.map((event) => (
          <BreedingColumn
            key={event.breedingId}
            event={event}
            parentGen={root.familyGeneration}
            depth={0}
          />
        ))}
        {/* Empty breeding slots */}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <EmptySlot key={`root-empty-${i}`} label="Slot libero" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legacy BreedingEventCard (unused, kept for reference)               */
/* ------------------------------------------------------------------ */

function BreedingEventCard({
  primaryParent,
  event,
  depth,
}: {
  primaryParent: TreeCreature;
  event: BreedingEvent;
  depth: number;
}) {
  const parentSize = depth === 0 ? 70 : 60;
  const offspringSize = depth === 0 ? 58 : 50;
  const hasOffspring = !!(event.myOffspring || event.partnerOffspring);
  const genC = getGenColor(primaryParent.familyGeneration);
  const nextGenC = getGenColor(primaryParent.familyGeneration + 1);

  return (
    <div className="flex flex-col items-center">
      {/* Breeding number badge */}
      {depth === 0 && (
        <div className="mb-2 flex items-center gap-1.5">
          <div className="h-px flex-1 min-w-8" style={{ background: `linear-gradient(to right, transparent, ${genC.color}40)` }} />
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: genC.color, backgroundColor: `${genC.color}15` }}>
            Accoppiamento
          </span>
          <div className="h-px flex-1 min-w-8" style={{ background: `linear-gradient(to left, transparent, ${genC.color}40)` }} />
        </div>
      )}

      {/* Parent pair row */}
      <div className="flex items-center justify-center">
        <FamilyCreatureCard creature={primaryParent} role="mine" size={parentSize} />
        <ParentConnector />
        <FamilyCreatureCard creature={event.partnerParent} role="partner" size={parentSize} />
      </div>

      {/* SVG curved connections to offspring */}
      {hasOffspring && (
        <OffspringConnectors
          hasMyOffspring={!!event.myOffspring}
          hasPartnerOffspring={!!event.partnerOffspring}
        />
      )}

      {/* Offspring row */}
      {hasOffspring && (
        <div className="flex items-start justify-center gap-6 md:gap-10">
          {/* My offspring (left) — solid border, glow */}
          <div className="flex flex-col items-center">
            {event.myOffspring ? (
              <>
                <div className="mb-1 text-center">
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: nextGenC.color }}>Tuo figlio</span>
                </div>
                <FamilyCreatureCard creature={event.myOffspring} role="mine" size={offspringSize} />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border/20 p-3 text-center" style={{ minWidth: 130 }}>
                <p className="text-[9px] text-muted">Nessun figlio tuo</p>
              </div>
            )}
          </div>

          {/* Partner offspring (right) — dashed border, faded */}
          <div className="flex flex-col items-center">
            {event.partnerOffspring ? (
              <>
                <div className="mb-1 text-center">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-muted/50">Figlio partner</span>
                </div>
                <FamilyCreatureCard creature={event.partnerOffspring} role="partner" size={offspringSize} />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border/20 p-3 text-center opacity-50" style={{ minWidth: 130 }}>
                <p className="text-[9px] text-muted">Figlio partner</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recursive: if my offspring has child breedings, show next generation */}
      {event.myOffspring && event.childBreedings.length > 0 && (
        <div className="flex flex-col items-center mt-3">
          {/* Curved connection line from offspring down to next breeding */}
          <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
            <defs>
              <linearGradient id={`nextGen-${depth}`} x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor={nextGenC.color} stopOpacity="0.6" />
                <stop offset="100%" stopColor={getGenColor(primaryParent.familyGeneration + 2).color} stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <path
              d={`M 20 0 C 20 12, 20 24, 20 36`}
              stroke={`url(#nextGen-${depth})`}
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#lineGlow)"
            />
            {/* DNA helix marker */}
            <circle cx="20" cy="18" r="4" fill="none" stroke={nextGenC.color} strokeWidth="1" opacity="0.5" />
            <circle cx="20" cy="18" r="1.5" fill={nextGenC.color} opacity="0.6" />
          </svg>

          {event.childBreedings.map((childEvent) => (
            <BreedingEventCard
              key={childEvent.breedingId}
              primaryParent={event.myOffspring!}
              event={childEvent}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full Albero tab component                                           */
/* ------------------------------------------------------------------ */

function AlberoTab({ onSwitchToPartner }: { onSwitchToPartner: () => void }) {
  const { toast } = useToast();
  const [treeData, setTreeData] = useState<FamilyTreeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const creatRes = await fetch("/api/creatures");
      if (!creatRes.ok) throw new Error();
      const creatJson = await creatRes.json();
      const allCreatures = creatJson.data ?? [];
      const active = allCreatures.find((c: { isActive: boolean }) => c.isActive);

      if (!active) {
        setLoading(false);
        return;
      }

      const treeRes = await fetch(`/api/creatures/${active.id}/family-tree`);
      if (!treeRes.ok) throw new Error();
      const treeJson = await treeRes.json();
      setTreeData(treeJson.data ?? null);
    } catch {
      toast("error", "Errore nel caricamento dell'albero genealogico.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <div className="relative">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: "#b26eff", borderRightColor: "#3d5afe" }} />
          <div className="absolute inset-1 h-8 w-8 animate-spin rounded-full border-2 border-transparent" style={{ borderBottomColor: "#00e5a0", animationDirection: "reverse", animationDuration: "1.5s" }} />
        </div>
        <p className="text-[10px] text-muted mt-3 animate-pulse">Analisi sequenze genetiche...</p>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#b26eff" strokeWidth={1.2} className="mx-auto mb-3 opacity-40">
          <path d="M6 3c0 4.97 5.37 8 12 8M18 3c0 4.97-5.37 8-12 8M6 21c0-4.97 5.37-8 12-8M18 21c0-4.97-5.37-8-12-8" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-muted">Nessun albero genealogico disponibile.</p>
        <p className="text-[10px] text-muted mt-1">Attiva una creatura per visualizzare la sua discendenza.</p>
      </div>
    );
  }

  /* Count all unique creatures in the tree */
  function countBreedingCreatures(breedings: BreedingEvent[]): Set<string> {
    const ids = new Set<string>();
    for (const b of breedings) {
      ids.add(b.partnerParent.creatureId);
      if (b.myOffspring) ids.add(b.myOffspring.creatureId);
      if (b.partnerOffspring) ids.add(b.partnerOffspring.creatureId);
      for (const id of countBreedingCreatures(b.childBreedings)) {
        ids.add(id);
      }
    }
    return ids;
  }
  function maxGenBreedings(breedings: BreedingEvent[]): number {
    let max = 0;
    for (const b of breedings) {
      max = Math.max(max, b.partnerParent.familyGeneration);
      if (b.myOffspring) max = Math.max(max, b.myOffspring.familyGeneration);
      if (b.partnerOffspring) max = Math.max(max, b.partnerOffspring.familyGeneration);
      max = Math.max(max, maxGenBreedings(b.childBreedings));
    }
    return max;
  }

  const allIds = countBreedingCreatures(treeData.breedings);
  allIds.add(treeData.root.creatureId);
  const totalNodes = allIds.size;
  const deepestGen = Math.max(treeData.root.familyGeneration, maxGenBreedings(treeData.breedings));
  const hasBreedings = treeData.breedings.length > 0;

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b26eff" strokeWidth={1.8}>
              <path d="M6 3c0 4.97 5.37 8 12 8M18 3c0 4.97-5.37 8-12 8M6 21c0-4.97 5.37-8 12-8M18 21c0-4.97-5.37-8-12-8" strokeLinecap="round" />
            </svg>
            Albero Genealogico
          </h3>
          <p className="text-[10px] text-muted mt-0.5">
            Entrambi i genitori e la prole di ogni accoppiamento.
          </p>
        </div>
        <div className="flex gap-3 text-[9px] text-muted">
          <span>{totalNodes} {totalNodes === 1 ? "creatura" : "creature"}</span>
          <span>{deepestGen} {deepestGen === 1 ? "generazione" : "generazioni"}</span>
        </div>
      </div>

      {/* Tree visualization — traditional family tree */}
      <div className="overflow-x-auto pb-6 -mx-4 px-4">
        <div className="flex flex-col items-center min-w-fit">
          {hasBreedings ? (
            <FamilyTreeLayout root={treeData.root} breedings={treeData.breedings} />
          ) : (
            <div className="flex flex-col items-center">
              <FamilyCreatureCard creature={treeData.root} role="mine" size={80} />
              <div className="mt-6 text-center">
                <svg width="2" height="24" className="mx-auto mb-3">
                  <line x1="1" y1="0" x2="1" y2="24" stroke={getGenColor(treeData.root.familyGeneration).color} strokeWidth="2" opacity="0.4" />
                </svg>
                <p className="text-sm text-muted mb-1">Il tuo capostipite non ha ancora discendenti.</p>
                <p className="text-[10px] text-muted mb-4">
                  Inizia un accoppiamento per espandere la tua stirpe genetica.
                </p>
                <Button variant="accent" size="sm" onClick={onSwitchToPartner} className="uppercase font-bold tracking-wider text-[11px]">
                  Cerca un Partner
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generation color legend */}
      <div className="flex items-center justify-center gap-4 text-[9px] text-muted border-t border-border/20 pt-4 flex-wrap">
        {[1, 2, 3].filter(g => g <= deepestGen).map((gen) => {
          const c = getGenColor(gen);
          return (
            <div key={gen} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: c.color, boxShadow: `0 0 4px ${c.glow}` }}
              />
              <span>Gen {gen}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#00e5a0", boxShadow: "0 0 4px rgba(0,229,160,0.3)" }} />
          <span>Attiva</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-muted/30" />
          <span>Morta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full border border-dashed border-border/50" />
          <span>DNA altrui</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */

interface BreedingHubProps {
  userId: string;
}

export function BreedingHub({ userId: _userId }: BreedingHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>("partner");
  const [requestCount, setRequestCount] = useState(0);
  const [creatureCount, setCreatureCount] = useState(0);

  // Fetch badge counts
  useEffect(() => {
    async function fetchCounts() {
      try {
        const [reqRes, creatRes] = await Promise.all([
          fetch("/api/breeding/requests"),
          fetch("/api/creatures"),
        ]);
        if (reqRes.ok) {
          const json = await reqRes.json();
          setRequestCount((json.data ?? []).filter((r: BreedingRequest) => r.status === "pending").length);
        }
        if (creatRes.ok) {
          const json = await creatRes.json();
          setCreatureCount((json.data ?? []).length);
        }
      } catch {
        // silent
      }
    }
    fetchCounts();
  }, [activeTab]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-lg font-black text-foreground tracking-tight">
          <span className="text-accent" style={{ textShadow: '0 0 12px #00e5a044' }}>
            Laboratorio DNA
          </span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Combina il DNA delle creature per generare nuova prole.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-border/30 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3 py-2 text-[11px] md:text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "text-accent border-accent"
                : "text-muted border-transparent hover:text-foreground"
            }`}
          >
            {tab.id === "albero" && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0">
                <path d="M6 3c0 4.97 5.37 8 12 8M18 3c0 4.97-5.37 8-12 8M6 21c0-4.97 5.37-8 12-8M18 21c0-4.97-5.37-8-12-8" strokeLinecap="round" />
              </svg>
            )}
            {tab.label}
            {tab.id === "richieste" && requestCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-background">
                {requestCount > 9 ? "9+" : requestCount}
              </span>
            )}
            {tab.id === "creature" && creatureCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-[9px] font-bold text-muted">
                {creatureCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "partner" && <PartnerTab />}
      {activeTab === "richieste" && <RichiesteTab />}
      {activeTab === "creature" && <CreatureManagerTab />}
      {activeTab === "albero" && <AlberoTab onSwitchToPartner={() => setActiveTab("partner")} />}
    </div>
  );
}
