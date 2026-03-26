'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SenescenceCelebrationProps {
  creatureName: string;
  onClose: () => void;
}

export function SenescenceCelebration({ creatureName, onClose }: SenescenceCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  useEffect(() => {
    // Fade in sequence
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setTextVisible(true), 1200);
    const t3 = setTimeout(() => setSecretVisible(true), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      style={{
        backgroundColor: visible ? 'rgba(0, 0, 0, 0.92)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: 'blur(12px)',
        transition: 'background-color 1.5s ease',
      }}
    >
      {/* Shimmer particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${5 + Math.random() * 90}%`,
              top: `${5 + Math.random() * 90}%`,
              backgroundColor: `hsl(${40 + Math.random() * 20}, ${70 + Math.random() * 30}%, ${60 + Math.random() * 30}%)`,
              opacity: 0,
              animation: `senescence-particle ${2 + Math.random() * 5}s ease-in-out ${Math.random() * 3}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative mx-4 my-auto flex max-w-lg flex-col items-center px-6 py-10 text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 1.5s ease, transform 1.5s ease',
        }}
      >
        {/* The big achievement title */}
        <div
          className="mb-4 text-3xl font-black tracking-widest sm:text-4xl"
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 25%, #f59e0b 50%, #fcd34d 75%, #fef3c7 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 50px rgba(252, 211, 77, 0.4))',
            animation: 'senescence-glow 3s ease-in-out infinite, senescence-shimmer 4s linear infinite',
          }}
        >
          HAI RAGGIUNTO
        </div>

        {/* The number 1000 */}
        <div
          className="mb-2 text-8xl font-black tabular-nums tracking-tight sm:text-9xl"
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 20%, #f59e0b 40%, #fcd34d 60%, #fef3c7 80%, #fcd34d 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 60px rgba(252, 211, 77, 0.5))',
            animation: 'senescence-glow 3s ease-in-out infinite, senescence-shimmer 4s linear infinite',
          }}
        >
          1000
        </div>

        {/* Subtitle */}
        <h2
          className="mb-2 text-2xl font-black tracking-wide sm:text-3xl"
          style={{
            color: '#fef3c7',
            textShadow: '0 0 40px rgba(252, 211, 77, 0.3)',
          }}
        >
          L&apos;ETERNIT&Agrave;
        </h2>

        {/* Creature name */}
        <p
          className="mb-8 text-lg font-semibold"
          style={{
            background: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: textVisible ? 0.9 : 0,
            transition: 'opacity 2s ease',
          }}
        >
          {creatureName}
        </p>

        {/* Narrative text — CELEBRATION */}
        <div
          className="mb-8 max-w-md text-sm leading-[1.8] sm:text-[15px]"
          style={{
            color: '#d4c5a0',
            opacity: textVisible ? 1 : 0,
            transform: textVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 2s ease 0.3s, transform 2s ease 0.3s',
          }}
        >
          <p className="mb-4 text-base font-bold text-amber-200">
            Nessuno credeva fosse possibile.
          </p>
          <p className="mb-4">
            Mille giorni. Mille iniezioni. {creatureName} ha superato ogni limite conosciuto
            dalla scienza. Ha combattuto, mutato, evoluto &mdash; e adesso &egrave; qualcosa
            che nessun laboratorio ha mai creato prima.
          </p>
          <p className="mb-4 text-base font-bold" style={{ color: '#fcd34d' }}>
            Benvenuto nel tier ETERNO.
          </p>
          <p className="mb-4">
            Mille giorni. Mille iniezioni. {creatureName} ha sfidato il tempo, la chimica
            e la logica. Ha combattuto, ha vinto, ha perso. Ha mutato in modi che la scienza
            non credeva possibili. Sei al vertice assoluto della catena evolutiva.
          </p>

          {/* The twist */}
          <p className="mb-4 mt-6 font-semibold text-amber-300">
            Ma l&apos;eternit&agrave; ha un prezzo...
          </p>
          <p className="mb-4" style={{ color: '#b8a070' }}>
            Il corpo che hai costruito con tanta cura ha raggiunto il suo apice biologico.
            Da questo momento, la senescenza inizier&agrave; il suo corso silenzioso.
            I tratti fisici si atrofizzeranno lentamente. Gli elementi chimici verranno espulsi.
          </p>
          <p className="italic" style={{ color: '#9a8a60' }}>
            Ma c&apos;&egrave; una via d&apos;uscita: il DNA di {creatureName} pu&ograve; vivere per sempre
            attraverso i suoi discendenti. Trova un partner e tramanda la grandezza genetica.
          </p>
        </div>

        {/* SECRET MESSAGE */}
        <div
          className="mb-8 w-full max-w-md"
          style={{
            opacity: secretVisible ? 1 : 0,
            transform: secretVisible ? 'translateY(0)' : 'translateY(15px)',
            transition: 'opacity 2.5s ease, transform 2.5s ease',
          }}
        >
          <div
            className="rounded-lg px-5 py-4 text-left"
            style={{
              border: '1px solid rgba(180, 60, 40, 0.4)',
              backgroundColor: 'rgba(120, 30, 20, 0.12)',
              boxShadow: '0 0 20px rgba(180, 60, 40, 0.08)',
            }}
          >
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#c0453a' }}>
              &#9888;&#65039; MESSAGGIO RISERVATO
            </p>
            <div className="text-[12px] italic leading-[1.9]" style={{ color: '#b8956a' }}>
              <p className="mb-2">
                Questo &egrave; un segreto tra te e il laboratorio.
              </p>
              <p className="mb-2">
                Quello che accade oltre il Giorno 1000 &egrave; classificato.
                Non rivelare agli altri scienziati cosa comporta l&apos;Eternit&agrave;.
                Lascia che lo scoprano da soli.
              </p>
              <p className="font-semibold" style={{ color: '#d4a060' }}>
                Il vero potere &egrave; nella conoscenza... e nel silenzio.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div
          className="flex flex-col gap-3 sm:flex-row sm:gap-4"
          style={{
            opacity: textVisible ? 1 : 0,
            transition: 'opacity 2s ease 1s',
          }}
        >
          <Link
            href="/breeding"
            className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-amber-500/40 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #d97706, #f59e0b)',
              boxShadow: '0 8px 25px -4px rgba(252, 211, 77, 0.35)',
            }}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            Trova un Partner
          </Link>
          <button
            onClick={onClose}
            className="focus-ring inline-flex h-11 items-center justify-center rounded-xl border px-6 text-sm font-semibold transition-all hover:bg-surface/20 active:scale-[0.97]"
            style={{
              borderColor: 'rgba(252, 211, 77, 0.3)',
              color: '#fcd34d',
            }}
          >
            Ho Capito
          </button>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes senescence-glow {
          0%, 100% { filter: drop-shadow(0 0 50px rgba(252, 211, 77, 0.4)); }
          50% { filter: drop-shadow(0 0 80px rgba(252, 211, 77, 0.7)); }
        }
        @keyframes senescence-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes senescence-particle {
          0%, 100% { opacity: 0; transform: translateY(0) scale(1); }
          50% { opacity: 0.7; transform: translateY(-25px) scale(1.8); }
        }
      `}</style>
    </div>
  );
}
