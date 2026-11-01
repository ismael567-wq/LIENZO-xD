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
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path
          d="M9.5 9.5V21.5H21"
          stroke="#DDF06A"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 14.5L21.5 21"
          stroke="#FFFDF7"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="22" cy="10.5" r="1.7" fill="#FFFDF7" />
      </svg>
      {withWord ? <span className="logo-word">Lienzo</span> : null}
    </span>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
