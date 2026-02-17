'use client';

import { useCallback } from 'react';

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  className?: string;
}

export default function ShareButton({
  title = 'Werkpilot — Das Betriebssystem für Schweizer KMUs',
  text = 'Mehr Kunden. Weniger Admin. Virtuelles Backoffice für KMUs.',
  url,
  className,
}: ShareButtonProps) {
  const handleShare = useCallback(async () => {
    const shareUrl = url || window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        // Could show a toast here
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    }
  }, [title, text, url]);

  return (
    <button
      onClick={handleShare}
      className={className || 'inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors'}
      style={{
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
        background: 'transparent',
      }}
      aria-label="Seite teilen"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Teilen
    </button>
  );
}
