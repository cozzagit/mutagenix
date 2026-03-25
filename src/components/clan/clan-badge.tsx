"use client";

export function ClanBadge({
  clanName,
  emblemColor,
  compact,
}: {
  clanName: string;
  emblemColor?: string;
  compact?: boolean;
}) {
  const color = emblemColor || "#6b7280";
  const abbrev = clanName.slice(0, 3).toUpperCase();

  if (compact) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}66`,
        }}
        title={clanName}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase"
      style={{
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}33`,
      }}
      title={clanName}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {abbrev}
    </span>
  );
}
