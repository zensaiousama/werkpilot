'use client';

/**
 * Real-time connection status indicator
 *
 * Shows:
 * - Green dot when connected to SSE
 * - Red dot when disconnected
 * - Yellow animated dot when reconnecting
 * - Tooltip with last event timestamp
 *
 * Compact design for header placement
 */

import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { Radio, WifiOff, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RealTimeIndicatorProps {
  /** Show event count badge */
  showEventCount?: boolean;
  /** Custom className */
  className?: string;
}

export default function RealTimeIndicator({
  showEventCount = false,
  className = ''
}: RealTimeIndicatorProps) {
  const { connectionStatus, isConnected, lastEvent, eventHistory, reconnect } = useRealtimeUpdates();
  const [relativeTime, setRelativeTime] = useState<string>('');

  // Format relative timestamp
  useEffect(() => {
    if (!lastEvent) {
      setRelativeTime('');
      return;
    }

    const updateTime = () => {
      const diffSec = Math.floor((Date.now() - new Date(lastEvent.timestamp).getTime()) / 1000);
      if (diffSec < 5) {
        setRelativeTime('gerade eben');
      } else if (diffSec < 60) {
        setRelativeTime(`vor ${diffSec}s`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) {
          setRelativeTime(`vor ${diffMin} Min`);
        } else {
          const diffH = Math.floor(diffMin / 60);
          setRelativeTime(`vor ${diffH}h`);
        }
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 5000);
    return () => clearInterval(timer);
  }, [lastEvent]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'var(--green)';
      case 'reconnecting': return 'var(--yellow)';
      case 'disconnected': return 'var(--red)';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Radio size={12} />;
      case 'reconnecting': return <RefreshCw size={12} className="animate-spin" />;
      case 'disconnected': return <WifiOff size={12} />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Live';
      case 'reconnecting': return 'Verbinde...';
      case 'disconnected': return 'Offline';
    }
  };

  const getTooltipText = () => {
    if (connectionStatus === 'connected') {
      return lastEvent
        ? `Verbunden - Letzte Aktualisierung: ${relativeTime}`
        : 'Verbunden - Warten auf Ereignisse';
    }
    if (connectionStatus === 'reconnecting') {
      return 'Verbindung wird wiederhergestellt...';
    }
    return 'Nicht verbunden - Klicken zum Neuladen';
  };

  const handleClick = () => {
    if (connectionStatus !== 'connected') {
      reconnect();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${className}`}
      style={{
        backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.1)' : 'var(--surface)',
        borderColor: isConnected ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)',
        cursor: connectionStatus !== 'connected' ? 'pointer' : 'default',
      }}
      title={getTooltipText()}
      aria-label={getStatusText()}
    >
      {/* Status indicator dot/icon */}
      <span
        className="relative flex items-center justify-center"
        style={{ width: 10, height: 10, color: getStatusColor() }}
      >
        {connectionStatus === 'connected' ? (
          <>
            {/* Animated pulse ring */}
            <span
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: getStatusColor(),
                opacity: 0.4,
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}
            />
            {/* Solid dot */}
            <span
              className="relative rounded-full"
              style={{
                width: 6,
                height: 6,
                backgroundColor: getStatusColor(),
              }}
            />
          </>
        ) : (
          getStatusIcon()
        )}
      </span>

      {/* Status text */}
      <span
        className="text-xs font-semibold"
        style={{
          color: getStatusColor(),
          fontFamily: 'var(--font-mono)',
        }}
      >
        {getStatusText()}
      </span>

      {/* Event count badge (optional) */}
      {showEventCount && eventHistory.length > 0 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
          }}
        >
          {eventHistory.length}
        </span>
      )}

      {/* Last event time */}
      {isConnected && relativeTime && (
        <span
          className="text-xs"
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
          }}
        >
          {relativeTime}
        </span>
      )}
    </button>
  );
}

// Add CSS animation for pulse effect
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse-dot {
      0%, 100% {
        transform: scale(1);
        opacity: 0.4;
      }
      50% {
        transform: scale(1.5);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
