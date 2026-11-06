export function Logo({
  size = 30,
  withWord = false,
  tone = 'dark',
}: {
  size?: number;
  withWord?: boolean;
  tone?: 'dark' | 'light';
}) {
  return (
    <span className={`logo ${tone === 'light' ? 'is-light' : ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="logo-mark"
      >
        {/* Teja de tiza con una sonrisa trazada a mano. */}
        <rect
          x="2.5"
          y="2.5"
          width="27"
          height="27"
          rx="8.5"
          fill="var(--logo-tile, #f3f0e8)"
        />
        <circle cx="11.6" cy="13.4" r="1.45" fill="var(--logo-ink, #1e1c19)" />
        <circle cx="20.4" cy="13.4" r="1.45" fill="var(--logo-ink, #1e1c19)" />
        <path
          d="M9.7 18.1c1.3 3 3.7 4.8 6.3 4.8s5-1.8 6.3-4.8"
          stroke="var(--logo-ink, #1e1c19)"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <circle cx="25.4" cy="7.4" r="2.5" fill="var(--logo-spark, #c7ec4a)" />
      </svg>
      {withWord ? <span className="logo-word">tiza</span> : null}
    </span>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
