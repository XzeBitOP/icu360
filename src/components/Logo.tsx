/* In-app logo follows the active theme (device setting or manual toggle): light logo in light mode, dark logo in dark mode. */
export function Logo({ size = 38, className = "" }: { size?: number; className?: string }) {
  const src = size > 96 ? 256 : 96;
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/logo-light-${src}.png`} alt="ICU 360" width={size} height={size} className="block dark:hidden w-full h-full" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/logo-dark-${src}.png`} alt="ICU 360" width={size} height={size} className="hidden dark:block w-full h-full" decoding="async" />
    </span>
  );
}
