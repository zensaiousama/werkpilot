const statusColors: Record<string, string> = {
  'New Lead': 'var(--blue)',
  'Researched': 'var(--purple)',
  'Fitness Check': 'var(--orange)',
  'Contacted': 'var(--amber)',
  'Interested': 'var(--green)',
  'Meeting': 'var(--green)',
  'Proposal': 'var(--amber)',
  'Negotiation': 'var(--orange)',
  'Won': 'var(--green)',
  'Client': 'var(--green)',
  'Lost': 'var(--red)',
  'running': 'var(--green)',
  'idle': 'var(--text-muted)',
  'error': 'var(--red)',
  'pending': 'var(--amber)',
  'done': 'var(--green)',
  'failed': 'var(--red)',
  'in_progress': 'var(--blue)',
};

const statusIcons: Record<string, string> = {
  'Won': '✓',
  'Client': '★',
  'Lost': '✕',
  'running': '▶',
  'error': '!',
  'done': '✓',
  'failed': '✕',
};

export default function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const color = statusColors[status] || 'var(--text-muted)';
  const icon = statusIcons[status];
  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        isSmall ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
      }`}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        transition: 'all 150ms ease',
      }}
    >
      {icon ? (
        <span style={{ fontSize: isSmall ? '9px' : '11px', lineHeight: 1 }}>{icon}</span>
      ) : (
        <span
          className={isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'}
          style={{
            borderRadius: '50%',
            backgroundColor: color,
            animation: status === 'running' || status === 'pending' || status === 'in_progress'
              ? 'pulse-dot 2s infinite'
              : undefined,
          }}
        />
      )}
      {status}
    </span>
  );
}
