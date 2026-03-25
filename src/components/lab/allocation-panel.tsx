'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ELEMENTS, GAME_CONFIG, type ElementId } from '@/lib/game-engine/constants';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ELEMENT_COLORS, ELEMENT_SHORT_NAMES } from './element-levels-display';

interface AllocationPanelProps {
  creatureId: string;
  elementLevels: Record<string, number>;
  onAllocated: (recipe?: Record<string, number>) => void;
  open: boolean;
  onClose: () => void;
  bonusCredits?: number;
}

interface MutationResult {
  traitId: string;
  delta: number;
  triggerType: string;
  triggerDetails?: string;
}

// MAX_PER_VIAL is the maximum that can go into a single vial (equal to max total credits)
const BASE_MAX_PER_VIAL = GAME_CONFIG.DAILY_CREDITS;

export function AllocationPanel({
  creatureId,
  elementLevels,
  onAllocated,
  open,
  onClose,
  bonusCredits = 0,
}: AllocationPanelProps) {
  const { toast } = useToast();
  const [credits, setCredits] = useState<Record<ElementId, number>>(() => {
    const initial = {} as Record<ElementId, number>;
    for (const el of ELEMENTS) initial[el] = 0;
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeVial, setActiveVial] = useState<ElementId | null>(null);
  const [glowingVial, setGlowingVial] = useState<ElementId | null>(null);

  const maxCredits = GAME_CONFIG.DAILY_CREDITS + bonusCredits;
  const totalUsed = ELEMENTS.reduce((sum, el) => sum + credits[el], 0);
  const remaining = maxCredits - totalUsed;

  // Reset credits when panel opens
  useEffect(() => {
    if (open) {
      const reset = {} as Record<ElementId, number>;
      for (const el of ELEMENTS) reset[el] = 0;
      setCredits(reset);
    }
  }, [open]);

  // ---- Pointer drag logic ----

  const vialRefs = useRef<Map<ElementId, HTMLDivElement>>(new Map());

  const setVialRef = useCallback(
    (el: ElementId) => (node: HTMLDivElement | null) => {
      if (node) {
        vialRefs.current.set(el, node);
      } else {
        vialRefs.current.delete(el);
      }
    },
    [],
  );

  const getCreditsFromPointerY = useCallback(
    (el: ElementId, clientY: number): number => {
      const vialEl = vialRefs.current.get(el);
      if (!vialEl) return 0;
      const rect = vialEl.getBoundingClientRect();
      const relativeY = rect.bottom - clientY;
      const ratio = Math.max(0, Math.min(1, relativeY / rect.height));
      return Math.round(ratio * maxCredits);
    },
    [maxCredits],
  );

  const clampCredit = useCallback(
    (el: ElementId, desired: number): number => {
      const otherUsed = totalUsed - credits[el];
      const maxAllowed = maxCredits - otherUsed;
      return Math.max(0, Math.min(desired, maxAllowed, maxCredits));
    },
    [totalUsed, credits, maxCredits],
  );

  const handlePointerDown = useCallback(
    (el: ElementId, e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setActiveVial(el);
      const newValue = getCreditsFromPointerY(el, e.clientY);
      const clamped = clampCredit(el, newValue);
      setCredits((prev) => ({ ...prev, [el]: clamped }));
      setGlowingVial(el);
    },
    [credits, getCreditsFromPointerY, clampCredit],
  );

  const handlePointerMove = useCallback(
    (el: ElementId, e: React.PointerEvent) => {
      if (activeVial !== el) return;
      e.preventDefault();
      const newValue = getCreditsFromPointerY(el, e.clientY);
      const clamped = clampCredit(el, newValue);
      setCredits((prev) => {
        if (prev[el] === clamped) return prev;
        return { ...prev, [el]: clamped };
      });
      setGlowingVial(el);
    },
    [activeVial, getCreditsFromPointerY, clampCredit],
  );

  const handlePointerUp = useCallback(
    (el: ElementId, e: React.PointerEvent) => {
      if (activeVial !== el) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveVial(null);
    },
    [activeVial],
  );

  // Clear glow after short delay
  useEffect(() => {
    if (!glowingVial) return;
    const timer = setTimeout(() => setGlowingVial(null), 300);
    return () => clearTimeout(timer);
  }, [glowingVial, credits]);

  // ---- Submit ----

  const handleSubmit = useCallback(async () => {
    if (totalUsed === 0) return;
    setIsSubmitting(true);

    try {
      const body: Record<string, number> = {};
      for (const el of ELEMENTS) {
        if (credits[el] > 0) body[el] = credits[el];
      }

      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureId, credits: body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message =
          data?.error?.message ?? "Errore durante l'allocazione";
        toast('error', message);
        return;
      }

      const responseData = await res.json().catch(() => null);

      // Show overdose warnings if present
      const overdoseEvents = responseData?.data?.overdoseEvents as string[] | undefined;
      if (overdoseEvents && overdoseEvents.length > 0) {
        toast('warning', overdoseEvents.join(' '));
      } else {
        toast('success', 'Iniezione completata! La creatura sta mutando...');
      }

      // Pass the recipe so dashboard can use it for auto-inject
      const recipe: Record<string, number> = {};
      for (const el of ELEMENTS) { if (credits[el] > 0) recipe[el] = credits[el]; }
      onAllocated(recipe);
    } catch {
      toast('error', 'Errore di rete. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  }, [totalUsed, credits, creatureId, toast, onAllocated]);

  // ---- Render ----

  const progressPercent = (totalUsed / maxCredits) * 100;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto max-w-2xl rounded-t-2xl border border-b-0 border-border bg-surface px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-4 shadow-2xl shadow-black/50 max-h-[85dvh] overflow-y-auto">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Iniezione Giornaliera
            </h3>
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-bold tabular-nums transition-colors"
                style={{
                  color: remaining > 0 ? 'var(--color-primary)' : 'var(--color-accent)',
                  textShadow:
                    remaining > 0 ? '0 0 8px #3d5afe66' : '0 0 8px #00e5a066',
                }}
              >
                {totalUsed}/{maxCredits}
                {bonusCredits > 0 && (
                  <span className="text-[10px] text-accent ml-1">(+{bonusCredits} bonus)</span>
                )}
              </span>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label="Chiudi"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Credits progress bar */}
          <div className="mb-4">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background:
                    remaining > 0
                      ? 'linear-gradient(90deg, #3d5afe, #6979ff)'
                      : 'linear-gradient(90deg, #00e5a0, #39ff7f)',
                  boxShadow:
                    remaining > 0
                      ? '0 0 12px #3d5afe66'
                      : '0 0 12px #00e5a066',
                }}
              />
            </div>
          </div>

          {/* Vials: horizontal row, scrollable on mobile */}
          <div
            className="flex justify-center gap-1 pb-2 sm:gap-1.5 md:gap-3"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {ELEMENTS.map((el) => {
              const color = ELEMENT_COLORS[el];
              const shortName = ELEMENT_SHORT_NAMES[el];
              const allocated = credits[el];
              const fillPercent = (allocated / maxCredits) * 100;
              const isActive = activeVial === el;
              const isGlowing = glowingVial === el;
              const isEmpty = allocated === 0 && remaining === 0 && totalUsed > 0;

              return (
                <div
                  key={el}
                  className="flex shrink-0 flex-col items-center gap-0.5"
                >
                  {/* Element symbol */}
                  <span
                    className="text-[10px] font-black"
                    style={{
                      color,
                      textShadow: allocated > 0 ? `0 0 6px ${color}66` : undefined,
                    }}
                  >
                    {el}
                  </span>

                  {/* Vial */}
                  <div
                    ref={setVialRef(el)}
                    className="relative cursor-pointer select-none w-[30px] h-[120px] sm:w-[36px] sm:h-[130px] md:w-[48px] md:h-[140px]"
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => handlePointerDown(el, e)}
                    onPointerMove={(e) => handlePointerMove(el, e)}
                    onPointerUp={(e) => handlePointerUp(el, e)}
                    onPointerCancel={(e) => handlePointerUp(el, e)}
                  >
                    <div
                      className="absolute inset-0 overflow-hidden border-2 transition-all duration-150"
                      style={{
                        borderRadius: '24px 24px 8px 8px',
                        borderColor: isActive
                          ? color
                          : allocated > 0
                            ? `${color}66`
                            : 'var(--color-border)',
                        backgroundColor: `${color}0a`,
                        boxShadow: isGlowing
                          ? `0 0 16px ${color}44, inset 0 0 16px ${color}11`
                          : isActive
                            ? `0 0 10px ${color}33`
                            : undefined,
                        opacity: isEmpty ? 0.35 : 1,
                      }}
                    >
                      {/* Fill level */}
                      <div
                        className="absolute bottom-0 left-0 right-0 transition-all duration-200 ease-out"
                        style={{
                          height: `${fillPercent}%`,
                          background: `linear-gradient(0deg, ${color}cc, ${color}88)`,
                          boxShadow: `inset 0 2px 8px ${color}44, 0 -2px 12px ${color}33`,
                          borderRadius: '0 0 6px 6px',
                        }}
                      >
                        {allocated > 0 && (
                          <div
                            className="absolute left-1 right-1 top-0 h-0.5 rounded-full"
                            style={{
                              background: `linear-gradient(90deg, transparent, ${color}88, transparent)`,
                            }}
                          />
                        )}
                      </div>

                      {/* Bubbles when active */}
                      {isActive && allocated > 0 && (
                        <>
                          <div
                            className="absolute h-1 w-1 rounded-full"
                            style={{
                              backgroundColor: `${color}44`,
                              bottom: `${Math.min(fillPercent + 5, 95)}%`,
                              left: '30%',
                              animation: 'float 1.5s ease-in-out infinite',
                            }}
                          />
                          <div
                            className="absolute h-0.5 w-0.5 rounded-full"
                            style={{
                              backgroundColor: `${color}33`,
                              bottom: `${Math.min(fillPercent + 10, 90)}%`,
                              left: '60%',
                              animation: 'float 2s ease-in-out infinite 0.5s',
                            }}
                          />
                        </>
                      )}

                      {/* Measurement marks */}
                      <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between py-2">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="mx-1.5 h-px"
                            style={{
                              backgroundColor:
                                allocated > 0
                                  ? `${color}22`
                                  : 'var(--color-border)',
                              opacity: 0.4,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Allocated count */}
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{
                      color: allocated > 0 ? color : 'var(--color-muted)',
                      textShadow: allocated > 0 ? `0 0 4px ${color}44` : undefined,
                    }}
                  >
                    {allocated}
                  </span>

                  {/* Short name */}
                  <span className="text-[9px] text-muted">{shortName}</span>
                </div>
              );
            })}
          </div>

          {/* Desktop: wider vials */}
          <style>{`
            @media (min-width: 768px) {
              .vial-strip > div > div {
                height: 180px !important;
              }
            }
          `}</style>

          {/* Submit */}
          <div className="mt-3">
            <Button
              variant="accent"
              size="lg"
              fullWidth
              disabled={totalUsed === 0}
              loading={isSubmitting}
              onClick={handleSubmit}
              className="relative overflow-hidden"
              style={
                totalUsed > 0
                  ? { boxShadow: '0 0 24px #00e5a033, 0 4px 16px #00e5a022' }
                  : undefined
              }
            >
              {totalUsed > 0
                ? `Inietta Esperimento`
                : 'Seleziona Crediti'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
