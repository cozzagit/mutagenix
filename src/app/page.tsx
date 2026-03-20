"use client";

import Link from "next/link";
import { CreatureRenderer } from "@/components/creature/creature-renderer";
import { DEFAULT_VISUAL_PARAMS } from "@/components/creature/creature-renderer";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";

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

function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5m-4.75-11.396c.25.023.5.05.75.082M5 14.5l-1.456 1.456a1.5 1.5 0 0 0 1.06 2.544h14.792a1.5 1.5 0 0 0 1.06-2.544L19 14.5m-14 0h14" />
    </svg>
  );
}

function SyringeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  );
}

function DnaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3c0 4 6 5 6 9s-6 5-6 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 3c0 4-6 5-6 9s6 5 6 9" />
      <line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
      <line x1="8" y1="18" x2="16" y2="18" strokeLinecap="round" />
    </svg>
  );
}

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
          Crea. Muta. Evolvi.
        </p>

        <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          Il tuo organismo parte come un blob informe. Ogni giorno decidi tu come nutrirlo.
          Ogni scelta lo trasforma in qualcosa di unico.
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
            Ogni creatura &egrave; unica
          </h2>
          <p className="mx-auto mb-12 max-w-md text-center text-sm text-muted">
            La combinazione di elementi chimici che scegli determina l&apos;aspetto, la personalit&agrave; e le abilit&agrave; della tua creatura.
          </p>

          <div className="grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-3">
            {SHOWCASE_CREATURES.map((c) => (
              <div
                key={c.name}
                className="group flex flex-col items-center rounded-2xl border border-border/30 bg-surface/40 p-4 backdrop-blur-sm transition-all hover:border-primary/20 hover:bg-surface/60"
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

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="relative z-10 border-t border-border/30 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-2xl font-black text-foreground sm:text-3xl">
            Come funziona
          </h2>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { icon: <FlaskIcon />, title: "Registrati e ricevi il tuo blob", desc: "Un organismo primordiale ti aspetta nel laboratorio. Il suo destino dipende solo da te." },
              { icon: <SyringeIcon />, title: "Ogni giorno inietta elementi chimici", desc: "Distribuisci 50 crediti tra 10 elementi. La tua strategia determina la mutazione." },
              { icon: <DnaIcon />, title: "Guarda il tuo organismo mutare", desc: "Corpo, arti, occhi, personalit\u00E0 \u2014 tutto cambia in base alle tue scelte." },
            ].map((step, i) => (
              <div key={step.title} className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {step.icon}
                  </div>
                  <span
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-primary"
                    style={{ boxShadow: "0 0 8px #3d5afe33" }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="mb-2 text-sm font-bold text-foreground">{step.title}</h3>
                <p className="text-xs leading-relaxed text-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== ELEMENTS TEASER ==================== */}
      <section className="relative z-10 border-t border-border/30 bg-gradient-to-b from-surface/30 to-background px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-center text-2xl font-black text-foreground sm:text-3xl">
            10 Elementi, Infinite Possibilit&agrave;
          </h2>
          <p className="mx-auto mb-10 max-w-md text-center text-sm text-muted">
            Ogni elemento influenza la tua creatura in modi diversi. Scopri le combinazioni e le sinergie nascoste.
          </p>

          <div className="grid grid-cols-5 gap-3 sm:gap-4">
            {ELEMENT_TEASER.map((el) => (
              <div
                key={el.symbol}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/30 bg-surface/40 py-3 transition-all hover:border-primary/20"
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
      </section>

      {/* ==================== CTA ==================== */}
      <section className="relative z-10 border-t border-border/30 px-6 py-16 sm:py-24">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <h2 className="mb-4 text-2xl font-black text-foreground sm:text-3xl">
            Pronto a creare il tuo mostro?
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
    </div>
  );
}
