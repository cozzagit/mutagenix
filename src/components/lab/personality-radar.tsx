'use client';

const PERSONALITY_TRAITS = [
  { key: 'aggression', label: 'Aggressività', color: '#ff4466' },
  { key: 'luminosity', label: 'Luminosità', color: '#00f0ff' },
  { key: 'toxicity', label: 'Tossicità', color: '#76ff03' },
  { key: 'intelligence', label: 'Intelligenza', color: '#b26eff' },
  { key: 'armoring', label: 'Corazza', color: '#ffcc80' },
] as const;

interface Props {
  traitValues: Record<string, number>;
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

export function PersonalityRadar({ traitValues, size = 160 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;
  const innerR = outerR * 0.45; // donut hole

  // Get raw values and normalize to percentages
  const rawValues = PERSONALITY_TRAITS.map((t) => traitValues[t.key] ?? 0);
  const total = rawValues.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted">Personalità</p>
        <p className="text-[10px] text-muted">Nessun tratto sviluppato</p>
      </div>
    );
  }

  const percentages = rawValues.map((v) => (v / total) * 100);

  // Build pie slices
  let currentAngle = 0;
  const slices = PERSONALITY_TRAITS.map((trait, i) => {
    const pct = percentages[i];
    const sliceAngle = (pct / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const midAngle = startAngle + sliceAngle / 2;
    currentAngle = endAngle;

    // Label position (outside the pie)
    const labelR = outerR + 12;
    const labelPos = polarToCartesian(cx, cy, labelR, midAngle);
    const isLeft = labelPos.x < cx;

    return {
      ...trait,
      pct: Math.round(pct),
      path: sliceAngle > 0.5 ? describeArc(cx, cy, outerR, startAngle, endAngle) : '',
      labelX: labelPos.x,
      labelY: labelPos.y,
      isLeft,
      midAngle,
    };
  });

  // Filter out zero slices
  const visibleSlices = slices.filter((s) => s.pct > 0);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted">Personalità</p>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Pie slices */}
        {visibleSlices.map((slice, i) => (
          <g key={slice.key}>
            <path
              d={slice.path}
              fill={slice.color}
              opacity={0.75}
              stroke="var(--color-background)"
              strokeWidth={1.5}
            />
            {/* Glow on hover-like effect via drop-shadow */}
            <path
              d={slice.path}
              fill={slice.color}
              opacity={0.15}
              style={{ filter: `drop-shadow(0 0 4px ${slice.color})` }}
            />
          </g>
        ))}

        {/* Inner hole (donut) */}
        <circle cx={cx} cy={cy} r={innerR} fill="var(--color-background)" />
        <circle cx={cx} cy={cy} r={innerR} fill="var(--color-surface)" opacity={0.5} />

        {/* Labels */}
        {visibleSlices.map((slice) => (
          slice.pct >= 8 && (
            <g key={`label-${slice.key}`}>
              {/* Line from slice to label */}
              {(() => {
                const innerLabelR = (outerR + innerR) / 2;
                const pos = polarToCartesian(cx, cy, innerLabelR, slice.midAngle);
                return (
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--color-background)"
                    fontSize={8}
                    fontWeight={800}
                  >
                    {slice.pct}%
                  </text>
                );
              })()}
            </g>
          )
        ))}
      </svg>

      {/* Legend below */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-1">
        {visibleSlices.map((slice) => (
          <div key={slice.key} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: slice.color, boxShadow: `0 0 3px ${slice.color}66` }}
            />
            <span className="text-[9px] text-muted">
              {slice.label} <span className="font-semibold" style={{ color: slice.color }}>{slice.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
