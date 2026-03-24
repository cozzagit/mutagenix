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

  useEffect(() => {
    // Fade in sequence
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setTextVisible(true), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto"
      style={{
        backgroundColor: visible ? 'rgba(0, 0, 0, 0.92)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: 'blur(12px)',
        transition: 'background-color 1.5s ease',
      }}
    >
      {/* Shimmer particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              backgroundColor: `hsl(${35 + Math.random() * 15}, 80%, ${55 + Math.random() * 20}%)`,
              opacity: 0,
              animation: `senescence-particle ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative mx-4 flex max-w-lg flex-col items-center px-6 py-10 text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 1.5s ease, transform 1.5s ease',
        }}
      >
        {/* The number 1000 */}
        <div
          className="mb-6 text-8xl font-black tabular-nums tracking-tight sm:text-9xl"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 30%, #d97706 60%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 40px rgba(245, 158, 11, 0.3))',
            animation: 'senescence-glow 3s ease-in-out infinite',
          }}
        >
          1000
        </div>

        {/* Title */}
        <h2
          className="mb-2 text-2xl font-black tracking-wide text-amber-100 sm:text-3xl"
          style={{
            textShadow: '0 0 30px rgba(245, 158, 11, 0.2)',
          }}
        >
          L&apos;Eternit&agrave; Ha Un Prezzo
        </h2>

        {/* Creature name */}
        <p
          className="mb-8 text-lg font-semibold"
          style={{
            color: '#d97706',
            opacity: textVisible ? 0.8 : 0,
            transition: 'opacity 2s ease',
          }}
        >
          {creatureName}
        </p>

        {/* Narrative text */}
        <div
          className="mb-10 max-w-md text-sm leading-[1.8] sm:text-[15px]"
          style={{
            color: '#d4c5a0',
            opacity: textVisible ? 1 : 0,
            transform: textVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 2s ease 0.3s, transform 2s ease 0.3s',
          }}
        >
          <p className="mb-4">
            Mille giorni. Mille iniezioni. {creatureName} ha sfidato il tempo, la chimica
            e la logica. Ha combattuto, ha vinto, ha perso. Ha mutato in modi che la scienza
            non credeva possibili.
          </p>
          <p className="mb-4 font-semibold text-amber-300">
            Ma ogni organismo ha un limite.
          </p>
          <p className="mb-4">
            La senescenza &egrave; iniziata. Il corpo che hai costruito con tanta cura inizier&agrave;
            lentamente a decadere. I tratti fisici si atrofizzeranno. La potenza in battaglia
            caler&agrave;. Gli elementi chimici verranno espulsi.
          </p>
          <p className="mb-4 italic" style={{ color: '#b8a070' }}>
            Non &egrave; una punizione &mdash; &egrave; biologia.
          </p>
          <p className="mb-4">
            Ma c&apos;&egrave; una via d&apos;uscita: il DNA di {creatureName} pu&ograve; vivere per sempre
            attraverso i suoi discendenti. Trova un partner, genera figli, e tramanda
            la grandezza genetica prima che sia troppo tardi.
          </p>
          <p className="font-semibold text-amber-200">
            La vera immortalit&agrave; non &egrave; vivere per sempre &mdash; &egrave; lasciare un&apos;eredit&agrave;.
          </p>
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
              backgroundColor: '#d97706',
              boxShadow: '0 8px 20px -4px rgba(217, 119, 6, 0.3)',
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
              borderColor: 'rgba(217, 119, 6, 0.3)',
              color: '#d97706',
            }}
          >
            Ho Capito
          </button>
        </div>

        {/* Footer note */}
        <p
          className="mt-8 text-[11px]"
          style={{
            color: '#8a7a5a',
            opacity: textVisible ? 1 : 0,
            transition: 'opacity 2s ease 1.5s',
          }}
        >
          La senescenza &egrave; permanente e irreversibile.
        </p>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes senescence-glow {
          0%, 100% { filter: drop-shadow(0 0 40px rgba(245, 158, 11, 0.3)); }
          50% { filter: drop-shadow(0 0 60px rgba(245, 158, 11, 0.5)); }
        }
        @keyframes senescence-particle {
          0%, 100% { opacity: 0; transform: translateY(0) scale(1); }
          50% { opacity: 0.6; transform: translateY(-20px) scale(1.5); }
        }
      `}</style>
    </div>
  );
}
