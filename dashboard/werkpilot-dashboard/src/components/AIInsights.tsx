'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';

interface Insight {
  id: string;
  type: 'positive' | 'warning' | 'suggestion';
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
}

const MOCK_INSIGHTS: Insight[] = [
  {
    id: '1',
    type: 'positive',
    title: 'Pipeline wächst',
    description: 'Ihre Sales-Pipeline ist um 12% gewachsen. Besonders stark: Treuhand-Branche mit +18%.',
    action: 'Leads anzeigen',
    actionHref: '/crm',
  },
  {
    id: '2',
    type: 'warning',
    title: '2 Agents mit Fehlern',
    description: 'IT-Dept Agents #39 und #41 zeigen wiederkehrende Fehler seit 3 Stunden.',
    action: 'Agents prüfen',
    actionHref: '/agents',
  },
  {
    id: '3',
    type: 'suggestion',
    title: 'Scraping-Empfehlung',
    description: 'Basierend auf Ihrem Lead-Profil: "Beratung Bern" hat hohes Conversion-Potenzial.',
    action: 'Scraper öffnen',
    actionHref: '/scraper',
  },
];

const typeConfig = {
  positive: {
    icon: TrendingUp,
    color: 'var(--green)',
    glow: 'var(--green-glow, rgba(34,197,94,0.12))',
    gradientFrom: 'rgba(34,197,94,0.25)',
    gradientTo: 'rgba(34,197,94,0.05)',
    hoverGlow: '0 0 20px rgba(34,197,94,0.15), 0 4px 16px rgba(0,0,0,0.2)',
    borderRgb: '34, 197, 94',
  },
  warning: {
    icon: AlertTriangle,
    color: 'var(--amber)',
    glow: 'var(--amber-glow, rgba(245,158,11,0.15))',
    gradientFrom: 'rgba(245,158,11,0.3)',
    gradientTo: 'rgba(245,158,11,0.05)',
    hoverGlow: '0 0 20px rgba(245,158,11,0.15), 0 4px 16px rgba(0,0,0,0.2)',
    borderRgb: '245, 158, 11',
  },
  suggestion: {
    icon: Lightbulb,
    color: 'var(--blue)',
    glow: 'var(--blue-glow, rgba(96,165,250,0.12))',
    gradientFrom: 'rgba(96,165,250,0.25)',
    gradientTo: 'rgba(96,165,250,0.05)',
    hoverGlow: '0 0 20px rgba(96,165,250,0.15), 0 4px 16px rgba(0,0,0,0.2)',
    borderRgb: '96, 165, 250',
  },
};

/* ---------- Thinking dots animation ---------- */
function ThinkingDots() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 0',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--amber), var(--orange))',
              animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
              boxShadow: '0 0 8px rgba(245,158,11,0.3)',
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          letterSpacing: '0.05em',
        }}
      >
        Claude analysiert...
      </span>
    </div>
  );
}

/* ---------- Single insight card ---------- */
function InsightCard({
  insight,
  index,
}: {
  insight: Insight;
  index: number;
}) {
  const config = typeConfig[insight.type];
  const Icon = config.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${hovered ? config.color : `rgba(${config.borderRgb}, 0.5)`}`,
        backgroundColor: 'var(--bg)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? config.hoverGlow : '0 1px 3px rgba(0,0,0,0.1)',
        cursor: 'default',
        animation: `fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 120}ms both`,
        position: 'relative' as const,
        overflow: 'hidden',
      }}
    >
      {/* Subtle top-left glow on hover */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '120px',
          height: '60px',
          background: `radial-gradient(ellipse at top left, rgba(${config.borderRgb}, ${hovered ? 0.08 : 0}), transparent)`,
          transition: 'all 0.4s ease',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
        {/* Icon in gradient circle */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `1px solid rgba(${config.borderRgb}, 0.2)`,
            boxShadow: hovered
              ? `0 0 12px rgba(${config.borderRgb}, 0.2)`
              : `0 0 6px rgba(${config.borderRgb}, 0.08)`,
            transition: 'box-shadow 0.3s ease',
          }}
        >
          <Icon size={16} style={{ color: config.color }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 3,
              letterSpacing: '-0.01em',
            }}
          >
            {insight.title}
          </p>

          {/* Description */}
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            {insight.description}
          </p>

          {/* Action button */}
          {insight.action && insight.actionHref && (
            <a
              href={insight.actionHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11.5,
                fontWeight: 600,
                marginTop: 10,
                padding: '4px 11px',
                borderRadius: 'var(--radius-sm)',
                color: config.color,
                background: `rgba(${config.borderRgb}, 0.08)`,
                border: `1px solid rgba(${config.borderRgb}, 0.15)`,
                textDecoration: 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget;
                target.style.background = `rgba(${config.borderRgb}, 0.15)`;
                target.style.borderColor = `rgba(${config.borderRgb}, 0.3)`;
                const arrow = target.querySelector('.action-arrow') as HTMLElement;
                if (arrow) arrow.style.transform = 'translateX(3px)';
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget;
                target.style.background = `rgba(${config.borderRgb}, 0.08)`;
                target.style.borderColor = `rgba(${config.borderRgb}, 0.15)`;
                const arrow = target.querySelector('.action-arrow') as HTMLElement;
                if (arrow) arrow.style.transform = 'translateX(0)';
              }}
            >
              {insight.action}
              <span
                className="action-arrow"
                style={{
                  display: 'inline-flex',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <ArrowRight size={12} />
              </span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Gradient divider ---------- */
function GradientDivider() {
  return (
    <div
      style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), rgba(245,158,11,0.08), rgba(255,255,255,0.04), transparent)',
        margin: '0 12px',
      }}
    />
  );
}

/* ---------- Main component ---------- */
export default function AIInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real AI insights from API, fallback to mock data
    fetch('/api/ai/insights')
      .then((r) => r.json())
      .then((data) => {
        if (data.insights?.length) {
          setInsights(data.insights);
        } else {
          setInsights(MOCK_INSIGHTS);
        }
        setLoading(false);
      })
      .catch(() => {
        setInsights(MOCK_INSIGHTS);
        setLoading(false);
      });
  }, []);

  return (
    <div
      className="card-glass-premium"
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40%',
          right: '-20%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-15%',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(96,165,250,0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ---------- HEADER ---------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          position: 'relative',
        }}
      >
        {/* Left: icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'spin 8s linear infinite',
            }}
          >
            <Sparkles size={15} style={{ color: 'var(--amber)' }} />
          </div>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              background: 'linear-gradient(135deg, var(--amber) 0%, var(--orange) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              lineHeight: 1,
            }}
          >
            AI INSIGHTS
          </h2>
        </div>

        {/* Right: Claude badge */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            padding: '3px 10px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.1))',
            color: 'var(--amber)',
            border: '1px solid rgba(245,158,11,0.2)',
            animation: 'glow-pulse 3s ease-in-out infinite',
            letterSpacing: '0.04em',
          }}
        >
          Claude
        </span>
      </div>

      {/* Subtle header underline glow */}
      <div
        style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.12), rgba(249,115,22,0.08), transparent)',
        }}
      />

      {/* ---------- BODY ---------- */}
      <div style={{ padding: '12px 14px 8px', position: 'relative' }}>
        {loading ? (
          <ThinkingDots />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {insights.map((insight, index) => (
              <div key={insight.id}>
                <InsightCard insight={insight} index={index} />
                {index < insights.length - 1 && <GradientDivider />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- FOOTER ---------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          padding: '8px 14px 12px',
          borderTop: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <Sparkles
          size={10}
          style={{
            color: 'var(--text-muted)',
            animation: 'glow-breathe 3s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}
        >
          Powered by Claude AI
        </span>
      </div>
    </div>
  );
}
