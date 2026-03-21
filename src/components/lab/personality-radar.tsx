'use client';

const PERSONALITY_DEFS = [
  { key: 'aggression', label: 'Aggressività', color: '#ff4466',
    weights: { Fe: 0.4, S: 0.3, Cl: 0.2, Ca: 0.1 } },
  { key: 'luminosity', label: 'Luminosità', color: '#00f0ff',
    weights: { P: 0.4, O: 0.2, K: 0.2, Na: 0.2 } },
  { key: 'toxicity', label: 'Tossicità', color: '#76ff03',
    weights: { S: 0.4, Cl: 0.3, P: 0.2, N: 0.1 } },
  { key: 'intelligence', label: 'Intelligenza', color: '#b26eff',
    weights: { K: 0.3, Na: 0.3, P: 0.2, O: 0.2 } },
  { key: 'armoring', label: 'Corazza', color: '#ffcc80',
    weights: { Ca: 0.4, Fe: 0.3, C: 0.2, S: 0.1 } },
] as const;

interface Props {
  elementLevels: Record<string, number>;
  size?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function PersonalityRadar({ elementLevels, size = 160 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;
  const innerR = outerR * 0.45;

  // Calculate personality from ELEMENT LEVELS, not accumulated traits
  const rawScores = PERSONALITY_DEFS.map((def) => {
    let sum = 0;
    for (const [el, w] of Object.entries(def.weights)) {
      sum += (elementLevels[el] ?? 0) * w;
    }
    return sum * sum; // square to amplify differences
  });

  const total = rawScores.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted">Personalità</p>
        <p className="text-[10px] text-muted">Nessun tratto sviluppato</p>
      </div>
    );
  }

  const percentages = rawScores.map((v) => (v / total) * 100);

  // Build pie slices
  let currentAngle = 0;
  const slices = PERSONALITY_DEFS.map((def, i) => {
    const pct = percentages[i];
    const sliceAngle = (pct / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const midAngle = startAngle + sliceAngle / 2;
    currentAngle = endAngle;

    return {
      ...def,
      pct: Math.round(pct),
      path: sliceAngle > 0.5 ? describeArc(cx, cy, outerR, startAngle, endAngle) : '',
      midAngle,
    };
  });

  const visibleSlices = slices.filter((s) => s.pct > 0);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted">Personalità</p>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {visibleSlices.map((slice) => (
          <g key={slice.key}>
            <path d={slice.path} fill={slice.color} opacity={0.75}
              stroke="var(--color-background)" strokeWidth={1.5} />
            <path d={slice.path} fill={slice.color} opacity={0.15}
              style={{ filter: `drop-shadow(0 0 4px ${slice.color})` }} />
          </g>
        ))}

        <circle cx={cx} cy={cy} r={innerR} fill="var(--color-background)" />
        <circle cx={cx} cy={cy} r={innerR} fill="var(--color-surface)" opacity={0.5} />

        {visibleSlices.map((slice) =>
          slice.pct >= 8 && (() => {
            const innerLabelR = (outerR + innerR) / 2;
            const pos = polarToCartesian(cx, cy, innerLabelR, slice.midAngle);
            return (
              <text key={`pct-${slice.key}`} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                fill="var(--color-background)" fontSize={8} fontWeight={800}>
                {slice.pct}%
              </text>
            );
          })()
        )}

        <defs>
          <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3d5afe" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#b26eff" stopOpacity={0.1} />
          </radialGradient>
        </defs>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-1">
        {visibleSlices.map((slice) => (
          <div key={slice.key} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: slice.color, boxShadow: `0 0 3px ${slice.color}66` }} />
            <span className="text-[9px] text-muted">
              {slice.label} <span className="font-semibold" style={{ color: slice.color }}>{slice.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
