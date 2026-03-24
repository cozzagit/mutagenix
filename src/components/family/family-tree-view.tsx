"use client";

import { useState, useEffect, useCallback } from "react";
import { CreatureRenderer, DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface TreeNode {
  creatureId: string;
  name: string;
  ageDays: number | null;
  familyGeneration: number;
  isDead: boolean;
  isActive: boolean;
  visualParams: Record<string, unknown>;
  children: TreeNode[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGenLabel(gen: number): string {
  return `Gen ${gen}`;
}

/* ------------------------------------------------------------------ */
/* Sub: Tree Node                                                     */
/* ------------------------------------------------------------------ */

function TreeNodeCard({
  node,
  isRoot,
}: {
  node: TreeNode;
  isRoot?: boolean;
}) {
  const vp = { ...DEFAULT_VISUAL_PARAMS, ...(node.visualParams as Partial<VisualParams>) } as VisualParams;

  return (
    <div className="flex flex-col items-center">
      {/* Node */}
      <div
        className={`flex flex-col items-center rounded-xl border p-2.5 transition-all ${
          node.isActive
            ? "border-accent/60 bg-accent/5 shadow-[0_0_12px_rgba(0,229,160,0.15)]"
            : node.isDead
              ? "border-border/20 bg-surface/40 opacity-50"
              : "border-border/30 bg-surface/80"
        }`}
      >
        <div className={node.isDead ? "grayscale" : ""}>
          <CreatureRenderer params={vp} size={60} animated={false} seed={42} />
        </div>
        <p className="text-[10px] font-bold text-foreground truncate max-w-[80px] mt-1 text-center">
          {node.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[8px] text-muted">
            Giorno {node.ageDays ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="rounded-sm bg-bio-purple/15 px-1 py-0.5 text-[7px] font-bold text-bio-purple">
            {getGenLabel(node.familyGeneration)}
          </span>
          {node.isDead && (
            <span className="rounded-sm bg-danger/15 px-1 py-0.5 text-[7px] font-bold text-danger">
              Morta
            </span>
          )}
          {isRoot && (
            <span className="rounded-sm bg-primary/15 px-1 py-0.5 text-[7px] font-bold text-primary">
              Fondatore
            </span>
          )}
        </div>
      </div>

      {/* Connector line to children */}
      {node.children.length > 0 && (
        <>
          {/* Vertical line down from parent */}
          <div className="w-px h-6 bg-border/40" />

          {/* Horizontal line spanning all children */}
          {node.children.length > 1 && (
            <div className="relative w-full flex justify-center">
              <div
                className="h-px bg-border/40 absolute top-0"
                style={{
                  width: `${Math.max(0, (node.children.length - 1) * 100)}%`,
                  maxWidth: "100%",
                }}
              />
            </div>
          )}

          {/* Children */}
          <div className="flex gap-4 md:gap-6 mt-0">
            {node.children.map((child) => (
              <div key={child.creatureId} className="flex flex-col items-center">
                {/* Vertical connector from horizontal line */}
                <div className="w-px h-6 bg-border/40" />
                <TreeNodeCard node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */

interface FamilyTreeViewProps {
  userId: string;
}

export function FamilyTreeView({ userId: _userId }: FamilyTreeViewProps) {
  const { toast } = useToast();
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCreatureId, setActiveCreatureId] = useState<string | null>(null);

  // First fetch the active creature to know which family tree to load
  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      // Get active creature
      const creatRes = await fetch("/api/creatures");
      if (!creatRes.ok) throw new Error();
      const creatJson = await creatRes.json();
      const creatures = creatJson.data ?? [];
      const active = creatures.find((c: { isActive: boolean }) => c.isActive);

      if (!active) {
        setLoading(false);
        return;
      }

      setActiveCreatureId(active.id);

      // Get family tree
      const treeRes = await fetch(`/api/creatures/${active.id}/family-tree`);
      if (!treeRes.ok) throw new Error();
      const treeJson = await treeRes.json();
      setTree(treeJson.data);
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
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-black text-foreground tracking-tight">
            <span className="text-bio-purple" style={{ textShadow: '0 0 12px #b26eff44' }}>
              Albero Genealogico
            </span>
          </h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-bio-purple border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!tree || !activeCreatureId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-black text-foreground tracking-tight">
            <span className="text-bio-purple" style={{ textShadow: '0 0 12px #b26eff44' }}>
              Albero Genealogico
            </span>
          </h1>
        </div>
        <div className="rounded-xl border border-border/30 bg-surface-2 p-8 text-center">
          <p className="text-sm text-muted">Nessun albero genealogico disponibile.</p>
          <p className="text-[10px] text-muted mt-1">L&apos;albero apparir&agrave; dopo il primo accoppiamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-lg font-black text-foreground tracking-tight">
          <span className="text-bio-purple" style={{ textShadow: '0 0 12px #b26eff44' }}>
            Albero Genealogico
          </span>
        </h1>
        <p className="text-xs text-muted mt-1">
          La discendenza della tua stirpe, dal fondatore alla prole pi&ugrave; recente.
        </p>
      </div>

      {/* Tree */}
      <div className="overflow-x-auto pb-8">
        <div className="flex justify-center min-w-fit px-4">
          <TreeNodeCard node={tree} isRoot />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-[9px] text-muted">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span>Attiva</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-border/40" />
          <span>Inattiva</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-danger/50" />
          <span>Morta</span>
        </div>
      </div>

      {/* Back link */}
      <div className="text-center mt-8">
        <a
          href="/breeding"
          className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Torna al Laboratorio DNA
        </a>
      </div>
    </div>
  );
}
