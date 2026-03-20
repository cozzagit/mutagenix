import Link from 'next/link';

/* ------------------------------------------------------------------ */
/* Element data (symbols, names, colors, hints)                        */
/* ------------------------------------------------------------------ */

const ELEMENTS_GUIDE = [
  { symbol: 'N', name: 'Azoto', color: '#3d5afe', hint: 'Un gas fondamentale per la vita. Cosa far\u00E0 alla tua creatura?' },
  { symbol: 'K', name: 'Potassio', color: '#b26eff', hint: 'Essenziale per i segnali nervosi. Forse la mente si risveglier\u00E0...' },
  { symbol: 'Na', name: 'Sodio', color: '#ff9100', hint: 'Conduttore di impulsi elettrici. Sinapsi in fermento.' },
  { symbol: 'C', name: 'Carbonio', color: '#6b6d7b', hint: 'Il mattone della vita organica. La base di ogni struttura.' },
  { symbol: 'O', name: 'Ossigeno', color: '#00f0ff', hint: 'Il respiro dell\u2019evoluzione. Alimenta ogni processo vitale.' },
  { symbol: 'P', name: 'Fosforo', color: '#39ff7f', hint: 'Brilla al buio e alimenta il pensiero. Luce e intelletto.' },
  { symbol: 'S', name: 'Zolfo', color: '#ffd600', hint: 'Odore acre, natura aggressiva. Qualcosa di pericoloso si agita.' },
  { symbol: 'Ca', name: 'Calcio', color: '#ffcc80', hint: 'Ossa, gusci, corazze. La durezza prende forma.' },
  { symbol: 'Fe', name: 'Ferro', color: '#ff4466', hint: 'Sangue e acciaio. La forza bruta scorre nelle vene.' },
  { symbol: 'Cl', name: 'Cloro', color: '#76ff03', hint: 'Corrosivo e imprevedibile. L\u2019evoluzione non \u00E8 sempre gentile.' },
];

const SYNERGIES_GUIDE = [
  { name: 'Ossatura', color: '#ffcc80' },
  { name: 'Sangue', color: '#ff4466' },
  { name: 'Veleno', color: '#76ff03' },
  { name: 'Neurale', color: '#b26eff' },
  { name: 'Organico', color: '#00f0ff' },
  { name: 'Caotico', color: '#ffd600' },
];

const PERSONALITY_GUIDE = [
  { name: 'Aggressivit\u00E0', color: '#ff4466', desc: 'Determina la ferocia e la postura combattiva della creatura.' },
  { name: 'Luminosit\u00E0', color: '#00f0ff', desc: 'Controlla la bioluminescenza e il bagliore interiore.' },
  { name: 'Tossicit\u00E0', color: '#76ff03', desc: 'Misura il livello di veleno e sostanze nocive nel corpo.' },
  { name: 'Intelligenza', color: '#b26eff', desc: 'Influenza le proporzioni della testa e la complessit\u00E0 degli occhi.' },
  { name: 'Corazza', color: '#ffcc80', desc: 'Rende il corpo pi\u00F9 solido, con placche e protezioni naturali.' },
];

const TIPS = [
  'Sperimenta: non esiste una strategia perfetta.',
  'Osserva come la tua creatura reagisce a ciascun elemento.',
  'Le sinergie si sbloccano quando pi\u00F9 elementi superano una certa soglia.',
  'La storia conta: il percorso evolutivo influenza il risultato finale.',
  'Una creatura instabile muta in modi imprevedibili \u2014 a volte sorprendenti.',
  'Non aver paura di cambiare strategia: l\u2019adattamento \u00E8 la chiave dell\u2019evoluzione.',
];

/* ------------------------------------------------------------------ */
/* Card component                                                      */
/* ------------------------------------------------------------------ */

function GuideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/30 bg-surface/40 p-5 backdrop-blur-sm sm:p-6">
      <h2 className="mb-4 text-base font-bold text-foreground sm:text-lg">{title}</h2>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function GuidaPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/lab"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 text-muted transition-colors hover:border-primary/40 hover:text-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-black text-foreground sm:text-2xl">
            Guida all&apos;Evoluzione
          </h1>
          <p className="text-xs text-muted">Tutto quello che devi sapere sul laboratorio</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* How the lab works */}
        <GuideCard title="Come funziona il laboratorio">
          <p className="text-sm leading-relaxed text-muted">
            Ogni giorno puoi iniettare un esperimento nella tua creatura. Hai a disposizione{' '}
            <span className="font-semibold text-accent">50 crediti</span> da distribuire tra 10 elementi chimici.
            La combinazione che scegli determina come la tua creatura muter&agrave;.
          </p>
        </GuideCard>

        {/* Elements */}
        <GuideCard title="Gli Elementi">
          <p className="mb-4 text-sm text-muted">
            Dieci elementi chimici, dieci vie evolutive. Cosa far&agrave; ciascuno alla tua creatura? Scoprilo sperimentando.
          </p>
          <div className="flex flex-col gap-2.5">
            {ELEMENTS_GUIDE.map((el) => (
              <div
                key={el.symbol}
                className="flex items-start gap-3 rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2.5"
              >
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black"
                  style={{
                    color: el.color,
                    backgroundColor: `${el.color}15`,
                    border: `1px solid ${el.color}30`,
                    textShadow: `0 0 8px ${el.color}44`,
                  }}
                >
                  {el.symbol}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground">{el.name}</span>
                  <p className="text-[11px] leading-relaxed text-muted italic">
                    &ldquo;{el.hint}&rdquo;
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GuideCard>

        {/* Mutations */}
        <GuideCard title="Le Mutazioni">
          <p className="text-sm leading-relaxed text-muted">
            Dopo ogni iniezione, la tua creatura inizia a mutare. Le mutazioni non sono casuali &mdash; dipendono
            da cosa hai iniettato, dalla storia delle iniezioni precedenti, e da{' '}
            <span className="font-semibold text-bio-purple">sinergie nascoste</span> tra gli elementi.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            La mutazione avviene in quattro fasi: destabilizzazione, rimodellamento, dettagli emergenti e stabilizzazione.
            Osserva attentamente la tua creatura durante il processo.
          </p>
        </GuideCard>

        {/* Synergies */}
        <GuideCard title="Le Sinergie">
          <p className="mb-4 text-sm leading-relaxed text-muted">
            Esistono combinazioni speciali di elementi che, quando raggiungono certe soglie, sbloccano effetti unici e potenti.
            Scoprirle fa parte del gioco.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SYNERGIES_GUIDE.map((syn) => (
              <div
                key={syn.name}
                className="flex items-center gap-2 rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: syn.color,
                    boxShadow: `0 0 6px ${syn.color}66`,
                  }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: syn.color }}
                >
                  {syn.name}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted italic">
            Quali elementi attivano ciascuna sinergia? Sta a te scoprirlo.
          </p>
        </GuideCard>

        {/* Personality */}
        <GuideCard title="La Personalit\u00E0">
          <p className="mb-4 text-sm leading-relaxed text-muted">
            La tua creatura non &egrave; solo un corpo &mdash; sviluppa tratti caratteriali che ne influenzano
            l&apos;aspetto e il comportamento.
          </p>
          <div className="flex flex-col gap-2">
            {PERSONALITY_GUIDE.map((trait) => (
              <div key={trait.name} className="flex items-center gap-3">
                <span
                  className="h-1.5 w-8 shrink-0 rounded-full"
                  style={{
                    backgroundColor: trait.color,
                    boxShadow: `0 0 4px ${trait.color}44`,
                  }}
                />
                <div className="min-w-0">
                  <span className="text-xs font-semibold" style={{ color: trait.color }}>
                    {trait.name}
                  </span>
                  <span className="text-[11px] text-muted"> &mdash; {trait.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </GuideCard>

        {/* Stability */}
        <GuideCard title="Stabilit\u00E0">
          <p className="text-sm leading-relaxed text-muted">
            L&apos;equilibrio tra gli elementi determina la stabilit&agrave; della creatura. Una creatura{' '}
            <span className="font-semibold text-danger">instabile</span> muta in modi imprevedibili.
            Una creatura <span className="font-semibold text-accent">stabile</span> consolida i suoi tratti.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full"
                style={{
                  width: '60%',
                  background: 'linear-gradient(90deg, #ff3d3d, #ff9100, #00e5a0)',
                }}
              />
            </div>
            <div className="flex gap-3 text-[9px] font-medium">
              <span className="text-danger">Instabile</span>
              <span className="text-accent">Stabile</span>
            </div>
          </div>
        </GuideCard>

        {/* Tips */}
        <GuideCard title="Consigli">
          <div className="flex flex-col gap-2">
            {TIPS.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[8px] font-bold text-primary">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-muted">{tip}</p>
              </div>
            ))}
          </div>
        </GuideCard>

        {/* Back to lab */}
        <div className="flex justify-center pt-2">
          <Link
            href="/lab"
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/20 active:scale-95"
            style={{ border: '1px solid #3d5afe33' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5" />
            </svg>
            Torna al Laboratorio
          </Link>
        </div>
      </div>
    </div>
  );
}
