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
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              Nel laboratorio puoi iniettare esperimenti chimici nella tua creatura. Hai a disposizione{' '}
              <span className="font-semibold text-accent">50 crediti</span> da distribuire tra 10 elementi chimici.
            </p>
            <p>
              <span className="font-semibold text-foreground">Ogni iniezione fa avanzare la creatura di un giorno evolutivo.</span>{' '}
              Dopo aver confermato l&apos;esperimento, la mutazione inizia in tempo reale: vedrai il tuo organismo trasformarsi
              davanti ai tuoi occhi.
            </p>
            <p>
              La creatura cresce <span className="font-semibold text-bio-cyan">solo quando tu inietti</span>. Se non giochi, resta ferma.
              Chi torna spesso al laboratorio fa evolvere la sua creatura più velocemente.
              Non esiste un limite giornaliero fisso: appena la mutazione è completata, puoi iniettare di nuovo.
            </p>
          </div>
        </GuideCard>

        {/* Elements */}
        <GuideCard title="Gli Elementi">
          <p className="mb-4 text-sm text-muted">
            Dieci elementi chimici, dieci vie evolutive. Cosa farà ciascuno alla tua creatura? Scoprilo sperimentando.
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
            Dopo ogni iniezione, la tua creatura inizia a mutare. Le mutazioni non sono casuali — dipendono
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
        <GuideCard title="La Personalità">
          <p className="mb-4 text-sm leading-relaxed text-muted">
            La tua creatura non è solo un corpo — sviluppa tratti caratteriali che ne influenzano
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
                  <span className="text-[11px] text-muted"> — {trait.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </GuideCard>

        {/* Stability */}
        <GuideCard title="Stabilit&agrave;">
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              La stabilit&agrave; misura l&apos;equilibrio chimico del tuo organismo. Uno squilibrio troppo
              grande tra gli elementi causa instabilit&agrave;.
            </p>

            <div className="mt-1 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '100%',
                    background: 'linear-gradient(90deg, #ff3d3d 0%, #ff9100 30%, #00e5a0 70%, #00f0ff 100%)',
                  }}
                />
              </div>
            </div>

            <p className="font-semibold text-foreground">Effetti della stabilit&agrave;:</p>

            <div className="flex flex-col gap-2.5">
              {[
                {
                  label: 'Instabile',
                  range: '< 30%',
                  color: '#ff3d3d',
                  desc: 'Il tuo guerriero &egrave; caotico e imprevedibile in battaglia. Rischia di fallire gli attacchi, ferirsi da solo o far esplodere i propri attacchi speciali. Durante le iniezioni, pu&ograve; subire regressioni e mutazioni caotiche.',
                },
                {
                  label: 'Variabile',
                  range: '30-70%',
                  color: '#ff9100',
                  desc: 'Occasionali malfunzionamenti in battaglia, ma nulla di grave.',
                },
                {
                  label: 'Stabile',
                  range: '70-90%',
                  color: '#00e5a0',
                  desc: 'Il tuo guerriero combatte con precisione. Bonus alla precisione e all\'efficacia degli attacchi speciali.',
                },
                {
                  label: 'Cristallizzato',
                  range: '> 90%',
                  color: '#00f0ff',
                  desc: 'Perfezione biochimica. Il corpo si rigenera in battaglia e resiste ai veleni.',
                },
              ].map((tier) => (
                <div key={tier.label} className="flex items-start gap-3">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: tier.color,
                      boxShadow: `0 0 6px ${tier.color}66`,
                    }}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold" style={{ color: tier.color }}>
                      {tier.label} ({tier.range})
                    </span>
                    <p className="text-[11px] text-muted">{tier.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #00f0ff',
                backgroundColor: 'rgba(0, 240, 255, 0.05)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold text-bio-cyan mb-1">Come aumentare la stabilit&agrave;</p>
              <p>
                Distribuisci i crediti in modo pi&ugrave; equilibrato tra gli elementi.
                Un organismo che riceve sempre gli stessi 2-3 elementi diventa instabile.
              </p>
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

        {/* Fase Guerriero */}
        <GuideCard title="La Fase Guerriero">
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              Quando il corpo del tuo organismo raggiunge la maturità (circa dopo 40 iniezioni), le sostanze
              chimiche iniziano a sviluppare tratti da combattimento. La crescita fisica rallenta e l&apos;energia
              si concentra sulla preparazione alla battaglia.
            </p>
            <p>Sei tratti di combattimento emergono gradualmente:</p>
            <div className="flex flex-col gap-2">
              {[
                { name: 'Attacco', color: '#ff3d3d', desc: 'La potenza dei colpi in battaglia' },
                { name: 'Difesa', color: '#4488ff', desc: 'La capacità di assorbire danni' },
                { name: 'Velocità', color: '#00e5e5', desc: 'Chi colpisce per primo e la possibilità di attacchi doppi' },
                { name: 'Resistenza', color: '#ff9100', desc: 'Quanti round il guerriero può sostenere' },
                { name: 'Speciale', color: '#b26eff', desc: 'La potenza delle mosse devastanti' },
                { name: 'Cicatrici', color: '#8a8a8a', desc: 'L\u2019esperienza accumulata in battaglia (crescono sempre)' },
              ].map((trait) => (
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
                    <span className="text-[11px] text-muted"> — {trait.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] italic text-muted">
              La transizione è graduale: non esiste un momento preciso in cui il tuo organismo &ldquo;diventa&rdquo;
              guerriero. È un processo continuo.
            </p>
          </div>
        </GuideCard>

        {/* Arena V2 — Farming e Squadre */}
        <GuideCard title="Arena V2 &mdash; Farming e Squadre">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #00e5a0',
                backgroundColor: 'rgba(0, 229, 160, 0.08)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: '#00e5a0' }}>
                NUOVO &mdash; Battaglie di Farming e Sistema Squadre
              </p>
              <p>
                Nuove modalit&agrave; di combattimento, gestione squadre e bonus di coordinazione.
              </p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Battaglie di Farming</p>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                <li>&bull; Sempre disponibili, senza restrizioni di fascia</li>
                <li>&bull; Tre formati: <strong className="text-foreground">1v1</strong> (singolo), <strong className="text-foreground">2v2</strong> (coppia), <strong className="text-foreground">3v3</strong> (squadra completa)</li>
                <li>&bull; <span className="text-accent font-semibold">Nessuna morte</span> &mdash; i danni sono leggeri e recuperabili</li>
                <li>&bull; Guadagni risorse e Farming AXP</li>
                <li>&bull; Limite giornaliero: 20 battaglie farming al giorno</li>
              </ul>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Sistema Squadre</p>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                <li>&bull; Seleziona <strong className="text-foreground">3 titolari</strong> e fino a <strong className="text-foreground">3 riserve</strong></li>
                <li>&bull; La rotazione automatica sceglie i migliori titolari disponibili</li>
                <li>&bull; Nelle battaglie 2v2/3v3, i titolari combattono nell&apos;ordine scelto</li>
                <li>&bull; Le riserve subentrano se un titolare non &egrave; disponibile (morto, wellness basso)</li>
              </ul>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Bonus Clan</p>
              <p className="text-[13px]">
                Combattere con creature dello stesso clan nella tua squadra conferisce un bonus di coordinazione
                di <strong className="text-accent">+4 a +8% agli stats</strong> di tutti i membri del clan nella squadra.
                Pi&ugrave; parenti, pi&ugrave; coordinazione.
              </p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Malus Parentela</p>
              <p className="text-[13px]">
                Combattere <strong className="text-danger">contro</strong> creature con cui hai legami di parentela
                comporta una penalit&agrave; dal <strong className="text-danger">-4% al -15%</strong> agli stats.
                I guerrieri esitano a colpire i propri parenti.
              </p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Formati</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { format: '1v1', label: 'Singolo', desc: 'Una creatura contro una', color: '#00e5a0' },
                  { format: '2v2', label: 'Coppia', desc: 'Due duelli, vince chi ne prende di più', color: '#3d5afe' },
                  { format: '3v3', label: 'Squadra', desc: 'Tre duelli, la squadra più forte prevale', color: '#b26eff' },
                ].map((f) => (
                  <div
                    key={f.format}
                    className="flex flex-col items-center gap-1 rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2.5"
                  >
                    <span className="text-sm font-black" style={{ color: f.color }}>{f.format}</span>
                    <span className="text-[10px] font-semibold text-foreground">{f.label}</span>
                    <span className="text-[9px] text-muted text-center">{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Tornei</p>
              <p className="text-[13px] mb-3">
                I tornei sono competizioni strutturate con iscrizione, pi&ugrave; match e conseguenze permanenti.
                I danni si accumulano durante tutto il torneo e alla fine le creature pi&ugrave; danneggiate rischiano la morte.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                {[
                  { name: 'Campionato', desc: 'Girone all\'italiana: tutti contro tutti, vince chi ha pi\u00F9 punti', color: '#3d5afe' },
                  { name: 'Eliminazione', desc: 'Tabellone a eliminazione diretta: perdi e sei fuori', color: '#ff4466' },
                  { name: 'Random', desc: 'Eliminazione con accoppiamenti casuali', color: '#ffd600' },
                ].map((t) => (
                  <div
                    key={t.name}
                    className="flex flex-col gap-0.5 rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2"
                  >
                    <span className="text-xs font-black" style={{ color: t.color }}>{t.name}</span>
                    <span className="text-[10px] text-muted">{t.desc}</span>
                  </div>
                ))}
              </div>

              <ul className="flex flex-col gap-1.5 text-[13px]">
                <li>&bull; <strong className="text-foreground">Iscrizione:</strong> iscriviti nella tab TORNEI, potrebbe costare energia</li>
                <li>&bull; <strong className="text-foreground">Squadra snapshot:</strong> la tua squadra viene salvata all&apos;iscrizione</li>
                <li>&bull; <strong className="text-danger">Danno persistente:</strong> i danni subiti si accumulano tra un match e l&apos;altro &mdash; le creature iniziano ogni match con l&apos;HP residuo dal precedente</li>
                <li>&bull; <strong className="text-foreground">Punteggio campionato:</strong> Vittoria = 3pt, Pareggio = 1pt, Sconfitta = 0pt</li>
                <li>&bull; <strong className="text-foreground">Morte a fine torneo:</strong> alla fine del torneo, le creature pi&ugrave; danneggiate e in bassa classifica possono morire</li>
                <li>&bull; <span className="text-accent font-semibold">Le creature fondatrici (isFounder) sono SEMPRE immuni alla morte da torneo</span></li>
                <li>&bull; HP minimo: una creatura non scende mai sotto il 20% di HP persistente</li>
              </ul>
            </div>
          </div>
        </GuideCard>

        {/* L'Arena */}
        <GuideCard title="L&apos;Arena">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <p>
              Quando il tuo guerriero è pronto, puoi entrare nell&apos;Arena e sfidare le creature degli altri giocatori.
            </p>

            <div>
              <p className="mb-2 font-semibold text-foreground">Come funziona:</p>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                <li>• I combattimenti sono automatici — la tua creatura combatte in base ai suoi stats</li>
                <li>• Ogni battaglia dura fino a 10 round</li>
                <li>• Chi è più veloce attacca per primo</li>
                <li>• Ogni 3 round si scatena un attacco speciale</li>
                <li>• La personalità dominante influenza lo stile di combattimento</li>
                <li>• Le sinergie chimiche danno bonus in battaglia</li>
              </ul>
            </div>

            <div>
              <p className="mb-3 font-semibold text-foreground">Fasce di combattimento:</p>
              <p className="mb-3 text-[13px]">
                I guerrieri sono divisi in fasce per garantire sfide equilibrate:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Novizio', range: 'Giorno 40-60', color: '#8a8a8a', bg: '#8a8a8a', desc: null },
                  { name: 'Intermedio', range: 'Giorno 61-100', color: '#4488ff', bg: '#4488ff', desc: null },
                  { name: 'Veterano', range: 'Giorno 101-150', color: '#b26eff', bg: '#b26eff', desc: null },
                  { name: 'Leggenda', range: 'Giorno 151-299', color: '#ffd600', bg: '#ffd600', desc: null },
                  { name: 'Immortale', range: 'Giorno 300-499', color: '#f87171', bg: '#f87171', desc: '+10% stats combattimento, +5 crediti bonus' },
                  { name: 'Divinità', range: 'Giorno 500+', color: '#ec4899', bg: '#ec4899', desc: '+20% stats combattimento, +10 crediti bonus, immune al Trauma' },
                ].map((tier) => (
                  <div
                    key={tier.name}
                    className="flex items-center gap-2.5 rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-black"
                      style={{
                        color: tier.color,
                        backgroundColor: `${tier.bg}15`,
                        border: `1px solid ${tier.bg}30`,
                        textShadow: `0 0 6px ${tier.bg}44`,
                      }}
                    >
                      {tier.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold" style={{ color: tier.color }}>
                        {tier.name}
                      </span>
                      <p className="text-[10px] text-muted">{tier.range}</p>
                      {tier.desc && (
                        <p className="text-[9px] text-muted/80 italic">{tier.desc}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] italic text-muted">
                Puoi sfidare avversari nella tua fascia o in quella adiacente. Le fasce elite (Immortale e Divinità) conferiscono vantaggi competitivi in battaglia.
              </p>
            </div>
          </div>
        </GuideCard>

        {/* Esperienza Arena (AXP) */}
        <GuideCard title="Esperienza Arena (AXP)">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <p>
              Combattere nell&apos;Arena fa guadagnare Punti Esperienza (<strong className="text-foreground">AXP</strong>):
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { result: 'Vittoria', axp: '+10 AXP', color: '#00e5a0' },
                { result: 'Sconfitta', axp: '+5 AXP', color: '#ff3d3d' },
                { result: 'Pareggio', axp: '+7 AXP', color: '#ff9100' },
              ].map((item) => (
                <div
                  key={item.result}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2.5"
                >
                  <span className="text-xs font-semibold" style={{ color: item.color }}>
                    {item.result}
                  </span>
                  <span className="text-[11px] font-bold text-foreground">{item.axp}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">L&apos;AXP potenzia il tuo guerriero in battaglia:</p>
              <div className="flex flex-col gap-2">
                {[
                  { range: '0-49 AXP', label: 'Recluta', desc: 'nessun bonus', color: '#8a8a8a' },
                  { range: '50-99 AXP', label: 'Esperto', desc: '+5% stats combattimento', color: '#4488ff' },
                  { range: '100-199 AXP', label: 'Veterano dell\'Arena', desc: '+10% stats combattimento', color: '#b26eff' },
                  { range: '200+ AXP', label: 'Maestro d\'Armi', desc: '+15% stats combattimento', color: '#ffd600' },
                ].map((tier) => (
                  <div key={tier.label} className="flex items-center gap-3">
                    <span
                      className="h-1.5 w-8 shrink-0 rounded-full"
                      style={{
                        backgroundColor: tier.color,
                        boxShadow: `0 0 4px ${tier.color}44`,
                      }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold" style={{ color: tier.color }}>
                        {tier.range} &mdash; {tier.label}
                      </span>
                      <span className="text-[11px] text-muted"> &mdash; {tier.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #ff9100',
                backgroundColor: 'rgba(255, 145, 0, 0.05)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold text-warning mb-1">Attenzione: decadimento AXP!</p>
              <p>
                Se non combatti per pi&ugrave; di 3 giorni, perdi <strong>2 AXP al giorno</strong> di inattivit&agrave;.
                Un guerriero inattivo si arrugginisce!
              </p>
            </div>

            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #ff3d3d',
                backgroundColor: 'rgba(255, 61, 61, 0.05)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold text-danger mb-1">Penalit&agrave; ingresso tardivo</p>
              <p>
                I guerrieri che entrano in Arena dopo il <strong>Giorno 100</strong> senza esperienza
                subiscono una penalit&agrave; del <strong>15%</strong> a tutti gli stats di combattimento
                fino alle prime 10 battaglie. Crescere senza combattere ha un prezzo!
              </p>
            </div>
          </div>
        </GuideCard>

        {/* Conseguenze delle Battaglie */}
        <GuideCard title="Conseguenze delle Battaglie">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <p>Ogni battaglia ha conseguenze reali sul tuo guerriero.</p>

            <div>
              <p className="mb-1.5 font-semibold text-accent">Vincitore:</p>
              <ul className="flex flex-col gap-1 text-[13px]">
                <li>• Nessun tempo di recupero</li>
                <li>• Piccolo boost ai tratti di combattimento</li>
                <li>• Vittorie consecutive: bonus speciali e badge</li>
              </ul>
            </div>

            <div>
              <p className="mb-1.5 font-semibold" style={{ color: '#ff3d3d' }}>Sconfitto:</p>
              <ul className="flex flex-col gap-1 text-[13px]">
                <li>• Periodo di recupero prima di poter combattere di nuovo</li>
                <li>• Leggera riduzione dei tratti di combattimento (recuperabile con iniezioni)</li>
                <li>• Una nuova cicatrice permanente — segno di esperienza</li>
                <li>• Le cicatrici non sono solo estetiche: ogni cicatrice rende il guerriero leggermente più forte</li>
              </ul>
            </div>

            <p className="text-[13px]">
              <span className="font-semibold text-foreground">Attenzione:</span> dopo 5 sconfitte consecutive
              il guerriero entra in stato di <span className="font-semibold" style={{ color: '#ff3d3d' }}>Trauma</span>,
              con una penalità temporanea a tutti gli stats. Il Trauma si cura vincendo una battaglia o aspettando
              7 giorni.
            </p>

            <p className="text-[13px]">
              Il tuo guerriero non morirà mai in battaglia. La morte avviene solo per tua scelta nel laboratorio.
            </p>

            {/* Callout box */}
            <div
              className="rounded-lg p-4 text-[12px] italic leading-relaxed"
              style={{
                borderLeft: '3px solid #ff3d3d',
                backgroundColor: 'rgba(255, 61, 61, 0.05)',
                color: '#ccc',
              }}
            >
              &ldquo;Le cicatrici raccontano una storia. Un veterano con 20 cicatrici è più pericoloso di un novizio intatto.&rdquo;
            </div>
          </div>
        </GuideCard>

        {/* Stili di Combattimento */}
        <GuideCard title="Stili di Combattimento">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <p>La personalità dominante del tuo guerriero determina il suo stile in battaglia:</p>

            <div className="flex flex-col gap-2.5">
              {[
                { name: 'Aggressivo', color: '#ff4466', desc: 'Danni devastanti ma difese ridotte. Colpisce forte, incassa male.' },
                { name: 'Luminoso', color: '#00f0ff', desc: 'Può accecare l\u2019avversario, facendogli saltare un turno.' },
                { name: 'Tossico', color: '#76ff03', desc: 'Avvelena l\u2019avversario con danni che si accumulano ogni round.' },
                { name: 'Intelligente', color: '#b26eff', desc: 'Schiva gli attacchi con riflessi superiori.' },
                { name: 'Corazzato', color: '#ffcc80', desc: 'Riduce i danni speciali e può riflettere parte del danno subito.' },
              ].map((style) => (
                <div key={style.name} className="flex items-start gap-3">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: style.color,
                      boxShadow: `0 0 6px ${style.color}66`,
                    }}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold" style={{ color: style.color }}>
                      {style.name}
                    </span>
                    <span className="text-[11px] text-muted"> — {style.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">
                Anche le sinergie chimiche attive influenzano la battaglia:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { name: 'Ossatura', color: '#ffcc80', desc: 'Difesa potenziata' },
                  { name: 'Sangue', color: '#ff4466', desc: 'Rigenerazione HP ogni round' },
                  { name: 'Veleno', color: '#76ff03', desc: 'L\u2019avversario parte già avvelenato' },
                  { name: 'Neurale', color: '#b26eff', desc: 'Schivata e velocità potenziate' },
                  { name: 'Organico', color: '#00f0ff', desc: 'Bonus a tutti gli stats' },
                  { name: 'Caotico', color: '#ffd600', desc: 'Effetti imprevedibili ogni round' },
                ].map((syn) => (
                  <div
                    key={syn.name}
                    className="rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2"
                  >
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: syn.color }}
                    >
                      {syn.name}
                    </span>
                    <p className="text-[10px] text-muted">{syn.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GuideCard>

        {/* Cariche del Laboratorio */}
        <GuideCard title="Le Cariche del Laboratorio">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #fbbf24',
                backgroundColor: 'rgba(251, 191, 36, 0.08)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: '#fbbf24' }}>
                NUOVO &mdash; Gerarchia Sociale
              </p>
              <p>
                Ogni settimana vengono assegnate 7 cariche di prestigio alle creature pi&ugrave; meritevoli.
                Ogni carica conferisce un bonus unico al detentore.
              </p>
            </div>

            <div>
              <p className="mb-3 font-semibold text-foreground">Le 7 Cariche:</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { icon: '\u{1F3E5}', name: 'Primario del Laboratorio', color: '#4ade80', metric: 'Benessere pi\u00F9 alto', bonus: 'Decay benessere -20%' },
                  { icon: '\u2694\uFE0F', name: "Console dell'Arena", color: '#dc2626', metric: 'ELO settimanale pi\u00F9 alto (min 5 battaglie)', bonus: 'AXP +5%' },
                  { icon: '\u2728', name: 'Pontefice Luminoso', color: '#fbbf24', metric: 'Luminosit\u00E0 pi\u00F9 alta', bonus: 'Attacco Speciale +3%' },
                  { icon: '\u2620\uFE0F', name: 'Tossicarca', color: '#a855f7', metric: 'Tossicit\u00E0 pi\u00F9 alta', bonus: 'Danno veleno +3%' },
                  { icon: '\u{1F451}', name: 'Patriarca della Stirpe', color: '#3b82f6', metric: 'Pi\u00F9 discendenti vivi (min 2)', bonus: 'Costo breeding -15%' },
                  { icon: '\u{1F6E1}\uFE0F', name: 'Custode della Stabilit\u00E0', color: '#94a3b8', metric: 'Stabilit\u00E0 pi\u00F9 alta (min giorno 40)', bonus: 'Difesa +3%' },
                  { icon: '\u2697\uFE0F', name: 'Alchimista Supremo', color: '#f97316', metric: 'Pi\u00F9 sinergie attive', bonus: '+5 crediti iniezione' },
                ].map((c) => (
                  <div key={c.name} className="flex items-start gap-3 rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2.5">
                    <span className="mt-0.5 text-base">{c.icon}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold" style={{ color: c.color }}>
                        {c.name}
                      </span>
                      <p className="text-[11px] text-muted">{c.metric}</p>
                      <p className="text-[10px] font-medium" style={{ color: c.color }}>
                        Bonus: {c.bonus}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Come funziona il ciclo settimanale:</p>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                <li>&bull; Ogni settimana le cariche vengono ricalcolate automaticamente</li>
                <li>&bull; La creatura con il punteggio pi&ugrave; alto in ciascuna metrica riceve il titolo</li>
                <li>&bull; Una creatura pu&ograve; detenere pi&ugrave; cariche contemporaneamente</li>
                <li>&bull; Anche le creature dei bot sono eligibili</li>
                <li>&bull; I bonus delle cariche si sommano ad altri bonus (tier, AXP, sinergie)</li>
              </ul>
            </div>
          </div>
        </GuideCard>

        {/* Riproduzione e Clan */}
        <GuideCard title="Riproduzione e Clan">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #b26eff',
                backgroundColor: 'rgba(178, 110, 255, 0.08)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: '#b26eff' }}>
                NUOVO &mdash; Sistema di Riproduzione
              </p>
              <p>
                Le creature possono ora riprodursi e creare discendenti con tratti ereditari unici.
              </p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Come funziona la riproduzione:</p>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                <li>&bull; Due giocatori si accordano per far accoppiare le proprie creature</li>
                <li>&bull; Ciascun giocatore riceve <strong className="text-foreground">un figlio</strong> dalla coppia</li>
                <li>&bull; I figli nascono con tratti ereditati da entrambi i genitori</li>
              </ul>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Ereditariet&agrave; inversa-dominante (65/35):</p>
              <p>
                Ogni figlio eredita il <strong className="text-bio-purple">65%</strong> dei tratti dal genitore
                dell&apos;altro giocatore e il <strong className="text-bio-purple">35%</strong> dal proprio.
                Vuoi migliorarti? Accoppiati con qualcuno migliore di te. Ma attento: stai rendendo
                anche lui pi&ugrave; forte.
              </p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Albero genealogico:</p>
              <div className="flex flex-col gap-2">
                {[
                  { gen: 'Gen 1', label: 'Fondatore', color: '#00f0ff', desc: 'La creatura originale. Pu\u00F2 avere fino a 3 figli.' },
                  { gen: 'Gen 2', label: 'Discendente', color: '#b26eff', desc: 'Figlio di un fondatore. Pu\u00F2 riprodursi una volta.' },
                  { gen: 'Gen 3', label: 'Ultimo erede', color: '#ff9100', desc: 'Non pu\u00F2 riprodursi. Fine della linea.' },
                ].map((g) => (
                  <div key={g.gen} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex shrink-0 items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-black"
                      style={{
                        color: g.color,
                        backgroundColor: `${g.color}15`,
                        border: `1px solid ${g.color}30`,
                      }}
                    >
                      {g.gen}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold" style={{ color: g.color }}>
                        {g.label}
                      </span>
                      <p className="text-[11px] text-muted">{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] italic text-muted">
                Massimo 13 creature per famiglia (1 fondatore + fino a 3 figli + fino a 9 nipoti).
              </p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Costo energetico:</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { gen: 'Gen 1', cost: '30 energia', color: '#00f0ff' },
                  { gen: 'Gen 2', cost: '45 energia', color: '#b26eff' },
                  { gen: 'Gen 3', cost: 'Non pu\u00F2', color: '#ff9100' },
                ].map((g) => (
                  <div
                    key={g.gen}
                    className="flex flex-col items-center rounded-lg border border-border/20 bg-surface-2/40 px-3 py-2"
                  >
                    <span className="text-[10px] font-bold" style={{ color: g.color }}>{g.gen}</span>
                    <span className="text-[11px] font-semibold text-foreground">{g.cost}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Clan:</p>
              <p>
                Quando una creatura genera il primo figlio, viene creato automaticamente un
                clan intitolato al fondatore. Tutti i discendenti appartengono allo stesso clan.
              </p>
            </div>

            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #b26eff',
                backgroundColor: 'rgba(178, 110, 255, 0.05)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: '#b26eff' }}>Consiglio strategico</p>
              <p>
                Vuoi migliorarti? Accoppiati con qualcuno migliore di te. Ma attento: stai rendendo anche lui pi&ugrave; forte.
                La riproduzione &egrave; un&apos;arma a doppio taglio.
              </p>
            </div>
          </div>
        </GuideCard>

        {/* Sovradosaggio */}
        <GuideCard title="Sovradosaggio Elementale">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #ff9100',
                backgroundColor: 'rgba(255, 145, 0, 0.08)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: '#ff9100' }}>
                NUOVO &mdash; Aggiornamento Biosicurezza
              </p>
              <p>
                Il laboratorio ha introdotto protocolli di sicurezza contro il sovradosaggio elementale.
                Pompare sempre lo stesso elemento non &egrave; pi&ugrave; una strategia vincente.
              </p>
            </div>

            <p>
              Il corpo della tua creatura ha una capacit&agrave; limitata di assorbire ciascun elemento.
              Quando la <span className="font-semibold text-foreground">concentrazione di un singolo elemento
              diventa troppo dominante</span> rispetto al totale, l&apos;organismo inizia a rigettare
              i nutrienti in eccesso.
            </p>

            <div>
              <p className="mb-2 font-semibold text-foreground">Livelli di saturazione:</p>
              <div className="flex flex-col gap-2.5">
                {[
                  {
                    label: 'Saturazione lieve',
                    threshold: '> 25% del totale',
                    effect: '30% dei crediti sprecati',
                    color: '#ffd600',
                  },
                  {
                    label: 'Sovradosaggio severo',
                    threshold: '> 35% del totale',
                    effect: '60% dei crediti sprecati',
                    color: '#ff9100',
                  },
                  {
                    label: 'Sovradosaggio critico',
                    threshold: '> 45% del totale',
                    effect: '80% dei crediti sprecati',
                    color: '#ff3d3d',
                  },
                ].map((level) => (
                  <div key={level.label} className="flex items-start gap-3">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: level.color,
                        boxShadow: `0 0 6px ${level.color}66`,
                      }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold" style={{ color: level.color }}>
                        {level.label} ({level.threshold})
                      </span>
                      <p className="text-[11px] text-muted">{level.effect}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Regressione naturale dei tratti combat:</p>
              <p>
                I tratti di combattimento che superano il valore <strong className="text-foreground">85</strong> iniziano
                a <span className="font-semibold" style={{ color: '#ff3d3d' }}>degradare spontaneamente</span> ogni giorno.
                Il corpo non riesce a sostenere livelli estremi indefinitamente.
              </p>
              <p className="mt-2 text-[11px] italic">
                Esempio: un tratto a 100 perde circa 0.3 punti al giorno, mentre la crescita a quel livello &egrave;
                quasi impossibile. I valori convergeranno naturalmente verso 85-87.
              </p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-foreground">Diminishing returns potenziati:</p>
              <p>
                Pi&ugrave; un tratto combat &egrave; alto, pi&ugrave; &egrave; difficile farlo crescere ulteriormente.
                Superato il valore 70, la crescita rallenta drasticamente:
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[
                  { value: '50', eff: '75%' },
                  { value: '70', eff: '51%' },
                  { value: '80', eff: '36%' },
                  { value: '85', eff: '28%' },
                  { value: '90', eff: '19%' },
                  { value: '95', eff: '6%' },
                ].map((d) => (
                  <div
                    key={d.value}
                    className="flex flex-col items-center rounded-lg border border-border/20 bg-surface-2/40 px-2 py-1.5"
                  >
                    <span className="text-[10px] font-semibold text-foreground">{d.value}</span>
                    <span className="text-[9px] text-muted">{d.eff} eff.</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-lg p-4 text-[12px] leading-relaxed"
              style={{
                borderLeft: '3px solid #00f0ff',
                backgroundColor: 'rgba(0, 240, 255, 0.05)',
                color: '#ccc',
              }}
            >
              <p className="font-semibold text-bio-cyan mb-1">Strategia consigliata</p>
              <p>
                Diversifica le iniezioni! Un guerriero che riceve nutrienti bilanciati tra pi&ugrave; elementi
                eviter&agrave; il sovradosaggio e manterr&agrave; una crescita costante.
                La specializzazione estrema ha un costo biologico.
              </p>
            </div>
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
