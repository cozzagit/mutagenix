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

type Tab = "partner" | "richieste" | "creature";

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
  parentNames: string[] | null;
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm p-0 md:p-4">
      <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-border/50 bg-surface p-5 md:p-6">
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
      {creature.parentNames && creature.parentNames.length > 0 && (
        <p className="text-[9px] text-muted text-center mb-2">
          Genitori: {creature.parentNames.join(" + ")}
        </p>
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

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl border border-border/30 bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

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

      {/* Family tree link */}
      <div className="mt-8 text-center">
        <a
          href="/family"
          className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-surface-2 px-4 py-2 text-xs text-muted transition-colors hover:text-foreground hover:border-border/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Visualizza Albero Genealogico
        </a>
      </div>
    </div>
  );
}
