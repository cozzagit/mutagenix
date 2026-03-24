"use client";

import Link from "next/link";
import { CreatureRenderer } from "@/components/creature/creature-renderer";
import { DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { InstallButton } from "@/components/pwa/install-button";

/* ------------------------------------------------------------------ */
/* Creature showcase data                                              */
/* ------------------------------------------------------------------ */

const CREATURE_KRAXON: VisualParams = {
  ...DEFAULT_VISUAL_PARAMS,
  bodyWidth: 180, bodyHeight: 160, bodyBlobiness: 0.3, bodyHue: 5, bodySaturation: 75, bodyLightness: 25, bodyOpacity: 0.95,
  headSize: 0.5, eyeCount: 2, eyeSize: 14, eyeGlow: 0.3, pupilShape: 0.8,
  limbCount: 4, limbLength: 65, limbThickness: 7, clawSize: 10,
  spineCount: 8, spineLength: 18, tailLength: 40, furDensity: 0.15, skinRoughness: 0.5,
  postureAngle: 35, glowIntensity: 0.3, glowHue: 0,
  aggressionLevel: 0.8, luminosityLevel: 0.1, toxicityLevel: 0.1, intelligenceLevel: 0.1, armoringLevel: 0.6,
  furColor: "hsl(30, 40%, 50%)", spineColor: "hsl(0, 60%, 35%)", clawColor: "hsl(40, 30%, 70%)",
  eyeIrisColor: "hsl(0, 80%, 45%)", activeSynergyVisuals: ["blood_red"],
};

const CREATURE_LUMIVEX: VisualParams = {
  ...DEFAULT_VISUAL_PARAMS,
  bodyWidth: 120, bodyHeight: 130, bodyBlobiness: 0.5, bodyHue: 260, bodySaturation: 60, bodyLightness: 22, bodyOpacity: 0.8,
  headSize: 0.7, eyeCount: 3, eyeSize: 16, eyeGlow: 0.8, pupilShape: 0,
  limbCount: 4, limbLength: 50, limbThickness: 4, clawSize: 3,
  spineCount: 0, spineLength: 0, tailLength: 20, furDensity: 0, skinRoughness: 0.1,
  postureAngle: 40, glowIntensity: 0.7, glowHue: 270,
  aggressionLevel: 0.05, luminosityLevel: 0.9, toxicityLevel: 0, intelligenceLevel: 0.85, armoringLevel: 0,
  eyeIrisColor: "hsl(270, 90%, 65%)", activeSynergyVisuals: ["neural_glow"],
};

const CREATURE_VENOMAW: VisualParams = {
  ...DEFAULT_VISUAL_PARAMS,
  bodyWidth: 150, bodyHeight: 120, bodyBlobiness: 0.6, bodyHue: 110, bodySaturation: 70, bodyLightness: 20, bodyOpacity: 0.9,
  headSize: 0.45, eyeCount: 4, eyeSize: 10, eyeGlow: 0.4, pupilShape: 0.6,
  limbCount: 6, limbLength: 55, limbThickness: 5, clawSize: 8,
  spineCount: 10, spineLength: 20, tailLength: 50, furDensity: 0.6, skinRoughness: 0.7,
  postureAngle: 20, glowIntensity: 0.4, glowHue: 120,
  aggressionLevel: 0.5, luminosityLevel: 0.2, toxicityLevel: 0.9, intelligenceLevel: 0.1, armoringLevel: 0.3,
  furColor: "hsl(60, 70%, 45%)", spineColor: "hsl(120, 60%, 30%)", clawColor: "hsl(80, 50%, 60%)",
  eyeIrisColor: "hsl(90, 80%, 50%)", activeSynergyVisuals: ["toxic_green"],
};

// Titanex: compact armored tank — small, squat, heavily plated, NO tall posture
const CREATURE_TITANEX: VisualParams = {
  ...DEFAULT_VISUAL_PARAMS,
  bodyWidth: 170, bodyHeight: 100, bodyBlobiness: 0.1, bodyHue: 200, bodySaturation: 30, bodyLightness: 18, bodyOpacity: 1,
  headSize: 0.3, eyeCount: 2, eyeSize: 8, eyeGlow: 0.1, pupilShape: 0.7,
  limbCount: 4, limbLength: 35, limbThickness: 9, clawSize: 4,
  spineCount: 3, spineLength: 10, tailLength: 15, furDensity: 0, skinRoughness: 0.9,
  postureAngle: 10, glowIntensity: 0.08, glowHue: 200,
  aggressionLevel: 0.2, luminosityLevel: 0, toxicityLevel: 0, intelligenceLevel: 0.1, armoringLevel: 0.95,
  spineColor: "hsl(200, 20%, 40%)", clawColor: "hsl(210, 15%, 55%)",
  eyeIrisColor: "hsl(200, 50%, 40%)", activeSynergyVisuals: ["skeletal"],
  furColor: "hsl(200, 10%, 30%)", bodySecondaryHue: 210, bodySecondaryLightness: 25,
};

// Serpix: serpentine — very tall and narrow, no arms, long tail, slit pupils
const CREATURE_SERPIX: VisualParams = {
  ...DEFAULT_VISUAL_PARAMS,
  bodyWidth: 80, bodyHeight: 180, bodyBlobiness: 0.4, bodyHue: 160, bodySaturation: 55, bodyLightness: 18, bodyOpacity: 0.9,
  headSize: 0.35, eyeCount: 2, eyeSize: 12, eyeGlow: 0.5, pupilShape: 1.0,
  limbCount: 0, limbLength: 0, limbThickness: 3, clawSize: 0,
  spineCount: 12, spineLength: 12, tailLength: 60, tailCurve: 0.8, furDensity: 0, skinRoughness: 0.4,
  postureAngle: 38, glowIntensity: 0.35, glowHue: 160,
  aggressionLevel: 0.3, luminosityLevel: 0.4, toxicityLevel: 0.5, intelligenceLevel: 0.3, armoringLevel: 0.1,
  furColor: "hsl(160, 30%, 35%)", spineColor: "hsl(140, 50%, 30%)", clawColor: "hsl(160, 40%, 50%)",
  eyeIrisColor: "hsl(50, 90%, 55%)", activeSynergyVisuals: ["toxic_green"],
  bodySecondaryHue: 140, bodySecondaryLightness: 22,
};

// Florath: furry symbiotic creature — covered in dense organic fur, peaceful, balanced
const CREATURE_FLORATH: VisualParams = {
  ...DEFAULT_VISUAL_PARAMS,
  bodyWidth: 130, bodyHeight: 140, bodyBlobiness: 0.7, bodyHue: 30, bodySaturation: 45, bodyLightness: 30, bodyOpacity: 0.85,
  headSize: 0.5, eyeCount: 2, eyeSize: 13, eyeGlow: 0.25, pupilShape: 0,
  limbCount: 4, limbLength: 45, limbThickness: 5, clawSize: 2,
  spineCount: 0, spineLength: 0, tailLength: 35, tailCurve: 0.7, furDensity: 0.85, skinRoughness: 0.2,
  postureAngle: 30, glowIntensity: 0.2, glowHue: 40,
  aggressionLevel: 0.05, luminosityLevel: 0.15, toxicityLevel: 0, intelligenceLevel: 0.4, armoringLevel: 0.1,
  furColor: "hsl(45, 60%, 55%)", spineColor: "hsl(30, 40%, 40%)", clawColor: "hsl(35, 30%, 60%)",
  eyeIrisColor: "hsl(30, 70%, 50%)", activeSynergyVisuals: ["organic_harmony"],
  bodySecondaryHue: 35, bodySecondaryLightness: 38,
};

const SHOWCASE_CREATURES = [
  { params: CREATURE_KRAXON, name: "Kraxon", desc: "Bestia aggressiva forgiata nel sangue e nel ferro." },
  { params: CREATURE_LUMIVEX, name: "Lumivex", desc: "Intelligenza bioluminescente che pulsa di luce viola." },
  { params: CREATURE_SERPIX, name: "Serpix", desc: "Serpente ancestrale con occhi ipnotici e spine dorsali." },
  { params: CREATURE_VENOMAW, name: "Venomaw", desc: "Orrore tossico ricoperto di spine e veleno." },
  { params: CREATURE_TITANEX, name: "Titanex", desc: "Carro armato biologico, tozzo e impenetrabile." },
  { params: CREATURE_FLORATH, name: "Florath", desc: "Creatura simbiotica ricoperta di pelliccia dorata." },
];

/* ------------------------------------------------------------------ */
/* Element teaser data                                                 */
/* ------------------------------------------------------------------ */

const ELEMENT_TEASER = [
  { symbol: "N", name: "Azoto", color: "#3d5afe" },
  { symbol: "K", name: "Potassio", color: "#b26eff" },
  { symbol: "Na", name: "Sodio", color: "#ff9100" },
  { symbol: "C", name: "Carbonio", color: "#6b6d7b" },
  { symbol: "O", name: "Ossigeno", color: "#00f0ff" },
  { symbol: "P", name: "Fosforo", color: "#39ff7f" },
  { symbol: "S", name: "Zolfo", color: "#ffd600" },
  { symbol: "Ca", name: "Calcio", color: "#ffcc80" },
  { symbol: "Fe", name: "Ferro", color: "#ff4466" },
  { symbol: "Cl", name: "Cloro", color: "#76ff03" },
];

/* ------------------------------------------------------------------ */
/* Background gradient blob                                            */
/* ------------------------------------------------------------------ */

function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Animated gradient orbs */}
      <div
        className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #3d5afe 0%, transparent 70%)",
          animation: "hero-blob 14s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-24 top-1/4 h-[400px] w-[400px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, #00e5a0 0%, transparent 70%)",
          animation: "hero-blob 18s ease-in-out infinite",
          animationDelay: "-6s",
        }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full opacity-10"
        style={{
          background: "radial-gradient(circle, #b26eff 0%, transparent 70%)",
          animation: "hero-blob 22s ease-in-out infinite",
          animationDelay: "-12s",
        }}
      />
      {/* Subtle grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icon components                                                     */
/* ------------------------------------------------------------------ */

function FlaskIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5m-4.75-11.396c.25.023.5.05.75.082M5 14.5l-1.456 1.456a1.5 1.5 0 0 0 1.06 2.544h14.792a1.5 1.5 0 0 0 1.06-2.544L19 14.5m-14 0h14" />
    </svg>
  );
}

function DnaIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3c0 4 6 5 6 9s-6 5-6 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 3c0 4-6 5-6 9s6 5 6 9" />
      <line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
      <line x1="8" y1="18" x2="16" y2="18" strokeLinecap="round" />
    </svg>
  );
}

function SwordsIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l6-6m0 0l-3-3m3 3l3-3m-3 3l-6 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-6 6m0 0l3 3m-3-3l-3 3m3-3l6-6" />
    </svg>
  );
}

function HeartDnaIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 10h5M9.5 13h5" />
    </svg>
  );
}

function ShieldIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function WarningIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function CrownIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.09 6.26L20.18 9.27l-5.09 3.94L16.18 20 12 16.77 7.82 20l1.09-6.79L3.82 9.27l6.09-1.01L12 2Z" />
    </svg>
  );
}

function TreeIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M12 7l-4 4M12 7l4 4M12 13l-3 3M12 13l3 3" />
      <circle cx="8" cy="11" r="1.5" />
      <circle cx="16" cy="11" r="1.5" />
      <circle cx="9" cy="16" r="1.5" />
      <circle cx="15" cy="16" r="1.5" />
      <circle cx="12" cy="3" r="1.5" />
    </svg>
  );
}

function UsersIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Game phases data                                                    */
/* ------------------------------------------------------------------ */

const GAME_PHASES = [
  {
    phase: 1,
    title: "Laboratorio",
    icon: <FlaskIcon className="h-8 w-8" />,
    desc: "Inietta esperimenti chimici nella tua creatura. 10 elementi, infinite combinazioni. Ogni iniezione fa avanzare l\u2019evoluzione di un giorno.",
    color: "#3d5afe",
  },
  {
    phase: 2,
    title: "Evoluzione",
    icon: <DnaIcon className="h-8 w-8" />,
    desc: "Osserva la mutazione in tempo reale. Il corpo cresce, i tratti emergono, la personalit\u00E0 si forma. Il tuo percorso evolutivo determina il risultato.",
    color: "#00e5a0",
  },
  {
    phase: 3,
    title: "Arena",
    icon: <SwordsIcon className="h-8 w-8" />,
    desc: "Combatti contro i guerrieri degli altri giocatori. Sistema ELO, 10 round automatici, conseguenze reali. Ogni battaglia conta.",
    color: "#ff3d3d",
  },
  {
    phase: 4,
    title: "Riproduzione",
    icon: <HeartDnaIcon className="h-8 w-8" />,
    desc: "Accoppia la tua creatura con quelle di altri giocatori. I figli ereditano il 65% dal partner \u2014 scegli bene con chi ti allei. Costruisci un albero genealogico fino a 3 generazioni.",
    color: "#b26eff",
  },
];

/* ------------------------------------------------------------------ */
/* Feature cards data                                                  */
/* ------------------------------------------------------------------ */

const FEATURE_CARDS = [
  {
    icon: <FlaskIcon className="h-6 w-6" />,
    title: "10 Elementi Chimici",
    desc: "Azoto, Ferro, Fosforo... ogni elemento influenza corpo, mente e abilit\u00E0 in modi unici.",
    color: "#3d5afe",
  },
  {
    icon: <DnaIcon className="h-6 w-6" />,
    title: "6 Sinergie Nascoste",
    desc: "Combinazioni speciali di elementi sbloccano effetti unici: Ossatura, Sangue, Veleno, Neural, Organico, Caotico.",
    color: "#00e5a0",
  },
  {
    icon: <ShieldIcon className="h-6 w-6" />,
    title: "Stato Vitale",
    desc: "La tua creatura ha bisogno di cure: nutrimento, attivit\u00E0, stimoli, riposo. Trascurarla ha conseguenze in battaglia.",
    color: "#00f0ff",
  },
  {
    icon: <WarningIcon className="h-6 w-6" />,
    title: "Sovradosaggio",
    desc: "Iniettare sempre lo stesso elemento causa sovradosaggio. La diversificazione \u00E8 la chiave dell\u2019evoluzione.",
    color: "#ff9100",
  },
  {
    icon: <CrownIcon className="h-6 w-6" />,
    title: "7 Cariche Settimanali",
    desc: "Primario, Console, Pontefice, Tossicarca, Patriarca, Custode, Alchimista \u2014 ruoli prestigiosi con bonus reali.",
    color: "#fbbf24",
  },
  {
    icon: <TreeIcon className="h-6 w-6" />,
    title: "Albero Genealogico",
    desc: "Fino a 3 generazioni, 13 creature per giocatore. Ogni figlio porta il DNA di due famiglie.",
    color: "#b26eff",
  },
];

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <HeroBackground />

      {/* ==================== HERO ==================== */}
      <section className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs font-medium tracking-wider text-muted backdrop-blur-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" style={{ boxShadow: "0 0 6px #00e5a088" }} />
          BIOTECH EVOLUTION GAME
        </div>

        <h1 className="mb-5 text-6xl font-black tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
          <span
            className="bg-gradient-to-r from-primary-light via-bio-cyan to-accent bg-clip-text text-transparent"
            style={{
              textShadow: "0 0 80px #3d5afe33, 0 0 120px #00e5a022",
              WebkitTextStroke: "0.5px rgba(61, 90, 254, 0.1)",
            }}
          >
            MUTAGENIX
          </span>
        </h1>

        <p className="glow-cyan mb-3 text-lg font-bold tracking-[0.3em] text-bio-cyan sm:text-xl md:text-2xl">
          Crea. Muta. Evolvi. Combatti.
        </p>

        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Inietta esperimenti chimici, osserva la mutazione in tempo reale,
          combatti nell&apos;arena e riproduci la tua stirpe.
          L&apos;evoluzione digitale ti aspetta.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/register"
            className="focus-ring inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-light hover:shadow-primary/40 active:scale-[0.97]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5" />
            </svg>
            Inizia l&apos;Evoluzione
          </Link>
          <Link
            href="/login"
            className="focus-ring inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 px-6 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-surface-3 active:scale-[0.97]"
          >
            Accedi
          </Link>
        </div>

        {/* PWA Install button */}
        <div className="mt-4">
          <InstallButton variant="landing" />
        </div>

        {/* Scroll hint */}
        <div className="mt-16 flex flex-col items-center gap-1 text-muted opacity-50">
          <span className="text-[10px] uppercase tracking-widest">Scopri</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" style={{ animation: "float 2s ease-in-out infinite" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
          </svg>
        </div>
      </section>

      {/* ==================== CREATURE SHOWCASE ==================== */}
      <section className="relative z-10 border-t border-border/30 bg-gradient-to-b from-surface/40 to-background px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-center text-2xl font-black text-foreground sm:text-3xl">
            Ogni Creatura &egrave; Unica
          </h2>
          <p className="mx-auto mb-12 max-w-md text-center text-sm text-muted">
            La combinazione di elementi chimici che scegli determina l&apos;aspetto, la personalit&agrave; e le abilit&agrave; della tua creatura.
          </p>

          <div className="grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-3">
            {SHOWCASE_CREATURES.map((c) => (
              <div
                key={c.name}
                className="group flex flex-col items-center rounded-2xl border border-border/30 bg-surface/40 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-surface/60 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-3 transition-transform duration-500 group-hover:scale-105">
                  <CreatureRenderer params={c.params} size={200} animated={false} seed={42} />
                </div>
                <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                <p className="mt-1 text-center text-[11px] leading-relaxed text-muted">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== COME FUNZIONA (4 phases) ==================== */}
      <section className="relative z-10 border-t border-border/30 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-center text-2xl font-black text-foreground sm:text-3xl">
            Come Funziona
          </h2>
          <p className="mx-auto mb-14 max-w-lg text-center text-sm text-muted">
            Quattro fasi. Un&apos;evoluzione senza fine.
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {GAME_PHASES.map((phase) => (
              <div
                key={phase.phase}
                className="group relative flex flex-col items-center rounded-2xl border border-border/30 bg-surface/40 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:bg-surface/60"
                style={{
                  ["--phase-color" as string]: phase.color,
                }}
              >
                {/* Phase number */}
                <span
                  className="absolute -top-3 left-4 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: `${phase.color}20`,
                    color: phase.color,
                    boxShadow: `0 0 10px ${phase.color}22`,
                  }}
                >
                  {phase.phase}
                </span>

                {/* Icon */}
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: `${phase.color}12`,
                    color: phase.color,
                  }}
                >
                  {phase.icon}
                </div>

                <h3 className="mb-2 text-sm font-bold text-foreground">{phase.title}</h3>
                <p className="text-xs leading-relaxed text-muted">{phase.desc}</p>

                {/* Hover border glow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${phase.color}30`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== SISTEMA DI GIOCO ==================== */}
      <section className="relative z-10 border-t border-border/30 bg-gradient-to-b from-surface/30 to-background px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-center text-2xl font-black text-foreground sm:text-3xl">
            Un Ecosistema Complesso
          </h2>
          <p className="mx-auto mb-14 max-w-lg text-center text-sm text-muted">
            Meccaniche profonde sotto una superficie di biochimica e caos evolutivo.
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.title}
                className="group flex flex-col rounded-2xl border border-border/30 bg-surface/40 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-surface/60"
              >
                {/* Icon */}
                <div
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: `${card.color}12`,
                    color: card.color,
                  }}
                >
                  {card.icon}
                </div>

                <h3 className="mb-1.5 text-sm font-bold text-foreground">{card.title}</h3>
                <p className="text-xs leading-relaxed text-muted">{card.desc}</p>

                {/* Hover border glow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${card.color}20`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Elements grid embedded */}
          <div className="mt-14">
            <h3 className="mb-6 text-center text-lg font-bold text-foreground">
              La Tavola degli Elementi
            </h3>
            <div className="grid grid-cols-5 gap-3 sm:gap-4">
              {ELEMENT_TEASER.map((el) => (
                <div
                  key={el.symbol}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border/30 bg-surface/40 py-3 transition-all duration-300 hover:border-primary/20 hover:bg-surface/60"
                >
                  <span
                    className="text-xl font-black sm:text-2xl"
                    style={{
                      color: el.color,
                      textShadow: `0 0 12px ${el.color}44`,
                    }}
                  >
                    {el.symbol}
                  </span>
                  <span className="text-[9px] font-medium text-muted sm:text-[10px]">
                    {el.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PROSSIMAMENTE ==================== */}
      <section className="relative z-10 border-t border-[#fbbf24]/15 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-center text-2xl font-black text-foreground sm:text-3xl">
            Prossimamente
          </h2>
          <p className="mx-auto mb-10 text-center text-sm text-muted">
            L&apos;evoluzione non si ferma mai.
          </p>

          {/* Clan teaser card */}
          <div className="mx-auto max-w-lg">
            <div
              className="group relative overflow-hidden rounded-2xl border p-6 backdrop-blur-sm transition-all duration-500 hover:shadow-lg"
              style={{
                borderColor: "rgba(251, 191, 36, 0.2)",
                backgroundColor: "rgba(251, 191, 36, 0.03)",
              }}
            >
              {/* Shimmer overlay */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  background: "linear-gradient(110deg, transparent 30%, rgba(251, 191, 36, 0.4) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 4s ease-in-out infinite",
                }}
              />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: "rgba(251, 191, 36, 0.1)",
                    color: "#fbbf24",
                  }}
                >
                  <UsersIcon className="h-7 w-7" />
                </div>

                <h3 className="mb-2 text-base font-bold text-foreground">
                  Formazione di Clan
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  Alleanze tra scienziati. Guerre tra stirpi.
                  Il laboratorio sta per diventare politico.
                </p>
              </div>

              {/* Hover border glow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  boxShadow: "inset 0 0 0 1px rgba(251, 191, 36, 0.25), 0 0 30px rgba(251, 191, 36, 0.06)",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="relative z-10 border-t border-border/30 px-6 py-16 sm:py-24">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <h2 className="mb-4 text-2xl font-black text-foreground sm:text-3xl">
            Pronto a Creare il Tuo Mostro?
          </h2>
          <p className="mb-8 text-sm text-muted">
            Unisciti al laboratorio. Il tuo blob ti aspetta.
          </p>
          <Link
            href="/register"
            className="focus-ring inline-flex h-12 min-w-[240px] items-center justify-center gap-2 rounded-xl bg-primary px-8 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-light hover:shadow-primary/40 active:scale-[0.97]"
          >
            Inizia l&apos;Evoluzione
          </Link>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="relative z-10 border-t border-border/30 px-6 py-8">
        <p className="text-center text-xs text-muted">
          Mutagenix &copy; 2026 &mdash; Un esperimento di evoluzione digitale
        </p>
      </footer>

      {/* Shimmer animation for Coming Soon card */}
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: 200% 0; }
          50% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
