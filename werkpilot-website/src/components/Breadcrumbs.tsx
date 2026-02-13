import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="container mx-auto px-4 pt-24 pb-4"
    >
      <ol className="flex items-center gap-2 text-sm flex-wrap">
        <li>
          <Link
            href="/"
            className="hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            Home
          </Link>
        </li>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true">
              /
            </span>
            {item.href ? (
              <Link
                href={item.href}
                className="hover:underline"
                style={{ color: 'var(--color-accent)' }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
