'use client';

import { ELEMENTS, type ElementId } from '@/lib/game-engine/constants';

const ELEMENT_COLORS: Record<ElementId, string> = {
  N: '#3d5afe',
  K: '#b26eff',
  Na: '#ff9100',
  C: '#6b6d7b',
  O: '#00f0ff',
  P: '#39ff7f',
  S: '#ffd600',
  Ca: '#ffcc80',
  Fe: '#ff4466',
  Cl: '#76ff03',
};

const ELEMENT_NAMES: Record<ElementId, string> = {
  N: 'Azoto',
  K: 'Potassio',
  Na: 'Sodio',
  C: 'Carbonio',
  O: 'Ossigeno',
  P: 'Fosforo',
  S: 'Zolfo',
  Ca: 'Calcio',
  Fe: 'Ferro',
  Cl: 'Cloro',
};

const ELEMENT_SHORT_NAMES: Record<ElementId, string> = {
  N: 'Az',
  K: 'Po',
  Na: 'So',
  C: 'Ca',
  O: 'Os',
  P: 'Fo',
  S: 'Zo',
  Ca: 'Cal',
  Fe: 'Fe',
  Cl: 'Cl',
};

interface ElementLevelsDisplayProps {
  elementLevels: Record<string, number>;
}

/** SVG circular progress ring */
function CircularProgress({
  value,
  max,
  color,
  symbol,
  size = 56,
}: {
  value: number;
  max: number;
  color: string;
  symbol: string;
  size?: number;
}) {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = max > 0 ? Math.min(value / max, 1) : 0;
  const strokeDashoffset = circumference * (1 - percent);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-3)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
            style={{
              filter: value > 0 ? `drop-shadow(0 0 4px ${color}66)` : undefined,
            }}
          />
        </svg>
        {/* Symbol in center */}
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-black"
          style={{
            color,
            textShadow: value > 0 ? `0 0 6px ${color}44` : undefined,
          }}
        >
          {symbol}
        </span>
      </div>
      {/* Numeric value */}
      <span
        className="text-[10px] font-semibold tabular-nums"
        style={{ color: value > 0 ? color : 'var(--color-muted)' }}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}

export function ElementLevelsDisplay({ elementLevels }: ElementLevelsDisplayProps) {
  const maxLevel = Math.max(
    ...ELEMENTS.map((el) => elementLevels[el] ?? 0),
    1,
  );
  const scaleCap = Math.max(maxLevel, 50);

  return (
    <div className="grid grid-cols-5 gap-3 justify-items-center">
      {ELEMENTS.map((el) => {
        const level = elementLevels[el] ?? 0;
        const color = ELEMENT_COLORS[el];

        return (
          <CircularProgress
            key={el}
            value={level}
            max={scaleCap}
            color={color}
            symbol={el}
          />
        );
      })}
    </div>
  );
}

export { ELEMENT_COLORS, ELEMENT_NAMES, ELEMENT_SHORT_NAMES };
