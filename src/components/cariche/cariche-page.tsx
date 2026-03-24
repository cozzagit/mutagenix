"use client";

import { useEffect, useState } from "react";
import { CaricaBadge } from "./carica-badge";

interface CaricaHolder {
  creatureId: string;
  userId: string;
  creatureName: string;
  ownerName: string;
  metricValue: number;
  awardedAt: string;
  expiresAt: string;
}

interface CaricaData {
  id: string;
  name: string;
  bonus: string;
  badgeColor: string;
  icon: string;
  holder: CaricaHolder | null;
}

function formatMetric(caricaId: string, value: number): string {
  switch (caricaId) {
    case 'primario':
      return `Benessere: ${Math.round(value)}`;
    case 'console':
      return `ELO settimanale: ${value >= 0 ? '+' : ''}${Math.round(value)}`;
    case 'pontefice':
      return `Luminosit\u00E0: ${value.toFixed(1)}`;
    case 'tossicarca':
      return `Tossicit\u00E0: ${value.toFixed(1)}`;
    case 'patriarca':
      return `Discendenti vivi: ${Math.round(value)}`;
    case 'custode':
      return `Stabilit\u00E0: ${(value * 100).toFixed(0)}%`;
    case 'alchimista':
      return `Sinergie attive: ${Math.round(value)}`;
    default:
      return `${value}`;
  }
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Scaduta';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}g ${hours}h`;
  return `${hours}h`;
}

export function CarichePage({ userId }: { userId: string }) {
  const [cariche, setCariche] = useState<CaricaData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/cariche");
        if (!res.ok) return;
        const json = await res.json();
        setCariche(json.data ?? []);
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-black text-foreground sm:text-2xl">
          Cariche del Laboratorio
        </h1>
        <p className="mt-1 text-xs text-muted">
          Sette ruoli di prestigio assegnati settimanalmente alle creature pi&ugrave; meritevoli.
          Ogni carica conferisce un bonus unico al suo detentore.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cariche.map((c) => {
            const isOwner = c.holder?.userId === userId;
            return (
              <div
                key={c.id}
                className="group relative overflow-hidden rounded-2xl border bg-surface/40 p-4 backdrop-blur-sm transition-all hover:bg-surface/60"
                style={{
                  borderColor: c.holder ? `${c.badgeColor}30` : 'var(--border)',
                }}
              >
                {/* Glow accent */}
                {c.holder && (
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-20"
                    style={{
                      background: `radial-gradient(circle, ${c.badgeColor} 0%, transparent 70%)`,
                    }}
                  />
                )}

                {/* Icon + Name */}
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                    style={{
                      backgroundColor: `${c.badgeColor}15`,
                      border: `1px solid ${c.badgeColor}30`,
                    }}
                  >
                    {c.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm font-bold leading-tight"
                      style={{ color: c.badgeColor }}
                    >
                      {c.name}
                    </h3>
                    <p className="text-[10px] text-muted">{c.bonus}</p>
                  </div>
                </div>

                {/* Holder info */}
                {c.holder ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {c.holder.creatureName}
                        </p>
                        <p className="truncate text-[10px] text-muted">
                          di {c.holder.ownerName}
                          {isOwner && (
                            <span className="ml-1 text-accent font-bold">(tu)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted">
                        {formatMetric(c.id, c.holder.metricValue)}
                      </span>
                      <span className="text-[9px] text-muted">
                        Scade: {timeUntil(c.holder.expiresAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs italic text-muted/60">
                    Vacante — nessuna creatura qualificata
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div
        className="mt-8 rounded-xl p-4 text-[12px] leading-relaxed"
        style={{
          borderLeft: '3px solid #fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.05)',
          color: '#ccc',
        }}
      >
        <p className="mb-1 font-semibold" style={{ color: '#fbbf24' }}>
          Come funzionano le Cariche
        </p>
        <p>
          Le cariche vengono ricalcolate ogni settimana. La creatura con il punteggio pi&ugrave;
          alto in ciascuna metrica riceve il titolo e il bonus associato. Una creatura pu&ograve;
          detenere pi&ugrave; cariche contemporaneamente. Anche le creature dei bot sono eligibili.
        </p>
      </div>
    </div>
  );
}
