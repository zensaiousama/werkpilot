export default function MorphingLogo({ color = 'var(--color-warm)', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="morphing-logo"
    >
      <rect x="8" y="2" width="4" height="7" fill={color} rx="1">
        <animate attributeName="height" values="7;5;7" dur="3s" repeatCount="indefinite" />
        <animate attributeName="y" values="2;3;2" dur="3s" repeatCount="indefinite" />
      </rect>
      <rect x="2" y="8" width="7" height="4" fill={color} rx="1">
        <animate attributeName="width" values="7;5;7" dur="3s" repeatCount="indefinite" begin="0.5s" />
        <animate attributeName="x" values="2;3;2" dur="3s" repeatCount="indefinite" begin="0.5s" />
      </rect>
      <rect x="11" y="8" width="7" height="4" fill={color} rx="1">
        <animate attributeName="width" values="7;5;7" dur="3s" repeatCount="indefinite" begin="1s" />
      </rect>
      <rect x="8" y="11" width="4" height="7" fill={color} rx="1">
        <animate attributeName="height" values="7;5;7" dur="3s" repeatCount="indefinite" begin="1.5s" />
      </rect>
    </svg>
  );
}
