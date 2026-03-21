"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";

interface ArenaRegistrationProps {
  creatureName: string;
  visualParams: Record<string, unknown>;
}

export function ArenaRegistration({ creatureName, visualParams }: ArenaRegistrationProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(visualParams as Partial<VisualParams>) } as VisualParams;

  async function handleRegister() {
    setLoading(true);
    try {
      const res = await fetch("/api/arena/register", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast("error", json.error?.message ?? "Errore nella registrazione.");
        return;
      }
      toast("success", json.data?.message ?? "Registrazione completata!");
      router.refresh();
    } catch {
      toast("error", "Errore di rete durante la registrazione.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="flex flex-col items-center text-center">
        {/* Creature with dramatic presentation */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-danger/10 blur-3xl" />
          <div className="relative">
            <CreatureRenderer params={vp} size={160} animated />
          </div>
        </div>

        <h1 className="text-xl font-black text-foreground mb-2">
          <span className="text-danger glow-red">ENTRA NELL&apos;ARENA</span>
        </h1>

        <p className="text-sm text-muted mb-2 max-w-xs">
          <strong className="text-foreground">{creatureName}</strong> ha raggiunto la fase guerriero.
        </p>
        <p className="text-xs text-muted mb-8 max-w-xs">
          Registrati per combattere contro le creature di altri giocatori.
          Guadagna ELO, scala la classifica e dimostra il valore del tuo esperimento.
        </p>

        <Button
          variant="danger"
          size="lg"
          loading={loading}
          onClick={handleRegister}
          className="shadow-lg shadow-danger/30"
        >
          ENTRA NELL&apos;ARENA
        </Button>

        <p className="text-[10px] text-muted mt-4">
          ELO iniziale: 1000 · Fascia: Novizio · 5 battaglie al giorno
        </p>
      </div>
    </div>
  );
}
