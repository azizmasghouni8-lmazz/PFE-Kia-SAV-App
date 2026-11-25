interface KiaLogoProps {
  variant?: 'light' | 'dark';
  subtitle?: string;
  badge?: string;
  badgeColor?: 'red' | 'dark' | 'outline';
  className?: string;
}

export function KiaLogo({
  variant = 'dark',
  subtitle = 'City Cars',
  badge,
  badgeColor = 'red',
  className = '',
}: KiaLogoProps) {
  const isLight = variant === 'light';

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Official Kia vector wordmark */}
      <div className="flex items-center">
        <svg
          viewBox="0 0 100 32"
          className={`h-6 sm:h-7 w-auto ${isLight ? 'text-white' : 'text-[#05141f]'}`}
          fill="currentColor"
        >
          {/* Official Geometric KIA wordmark */}
          <path d="M4 27 L4 6 L12 6 L12 18 L26 6 L35 6 L18 20 L36 27 L26 27 L13 22 L12 23 L12 27 Z" />
          <path d="M42 27 L42 6 L50 6 L50 27 Z" />
          <path d="M57 27 L70 6 L80 6 L93 27 L84 27 L81 21 L69 21 L66 27 Z M72 16 L78 16 L75 10 Z" />
        </svg>
      </div>

      {/* Subtitle / Separator */}
      {subtitle && (
        <div className="flex items-center gap-1.5 pl-1 border-l border-outline/30">
          <span
            className={`font-headline-sm font-semibold tracking-tight text-sm sm:text-base ${
              isLight ? 'text-white/90' : 'text-on-surface-variant'
            }`}
          >
            {subtitle}
          </span>
        </div>
      )}

      {/* Optional Badge */}
      {badge && (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-[11px] uppercase tracking-wider font-bold ${
            badgeColor === 'red'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : badgeColor === 'dark'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-high text-on-surface'
          }`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
