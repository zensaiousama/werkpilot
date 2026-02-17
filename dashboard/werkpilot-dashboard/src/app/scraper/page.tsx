'use client';

import { useState, useCallback } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  Loader2,
  Star,
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  Trash2,
  Activity,
  TrendingUp,
  Database,
  Zap,
  Shield,
  Smartphone,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface ScrapeResult {
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
}

interface FitnessCheckResult {
  score: number;
  ssl: boolean;
  seo: {
    metaTitle: boolean;
    metaDescription: boolean;
    h1Tags: boolean;
  };
  mobile: boolean;
  performance: {
    loadTime: number;
    imageOptimization: boolean;
  };
  timestamp: Date;
}

interface SearchHistoryEntry {
  query: string;
  resultCount: number;
  timestamp: Date;
  cached: boolean;
}

interface Statistics {
  totalScraped: number;
  totalImported: number;
  avgRating: number;
}

// Swiss postal code to Kanton mapping
const plzToKanton: Record<string, string> = {
  '1': 'VD', '10': 'VD', '11': 'VD', '12': 'GE', '13': 'VD', '14': 'VD',
  '15': 'FR', '16': 'FR', '17': 'FR', '18': 'VS', '19': 'VS',
  '20': 'NE', '21': 'NE', '22': 'NE', '23': 'NE', '24': 'NE', '25': 'JU',
  '26': 'JU', '27': 'JU', '28': 'BE', '29': 'BE',
  '30': 'BE', '31': 'BE', '32': 'SO', '33': 'BE', '34': 'BE', '35': 'BE',
  '36': 'BE', '37': 'BE', '38': 'BE', '39': 'BE',
  '40': 'SO', '41': 'AG', '42': 'AG', '43': 'AG', '44': 'BL', '45': 'SO',
  '46': 'SO', '47': 'BL', '48': 'BE', '49': 'AG',
  '50': 'AG', '51': 'AG', '52': 'AG', '53': 'AG', '54': 'AG', '55': 'AG',
  '56': 'AG', '57': 'AG', '58': 'AG', '59': 'AG',
  '60': 'LU', '61': 'LU', '62': 'NW', '63': 'OW', '64': 'LU',
  '65': 'SZ', '66': 'SZ', '67': 'UR', '68': 'SZ',
  '70': 'SZ', '80': 'ZH', '81': 'ZH', '82': 'ZH', '83': 'ZH',
  '84': 'ZH', '85': 'ZH', '86': 'TG', '87': 'TG', '88': 'TG',
  '89': 'SH', '90': 'SG', '91': 'SG', '92': 'SG', '93': 'SG',
  '94': 'AR', '95': 'SG',
  '96': 'AI',
};

function extractKanton(address: string): string {
  const plzMatch = address.match(/(\d{4})/);
  if (plzMatch) {
    const plz = plzMatch[1];
    const prefix2 = plz.substring(0, 2);
    const prefix1 = plz.substring(0, 1);
    return plzToKanton[prefix2] || plzToKanton[prefix1] || 'ZH';
  }
  const kantonMap: Record<string, string> = {
    'zürich': 'ZH', 'zurich': 'ZH', 'bern': 'BE', 'basel': 'BS',
    'luzern': 'LU', 'lucerne': 'LU', 'aargau': 'AG', 'st. gallen': 'SG',
    'st.gallen': 'SG', 'thurgau': 'TG', 'zug': 'ZG', 'solothurn': 'SO',
    'schaffhausen': 'SH', 'genf': 'GE', 'genève': 'GE', 'lausanne': 'VD',
    'winterthur': 'ZH', 'biel': 'BE',
  };
  const lower = address.toLowerCase();
  for (const [key, val] of Object.entries(kantonMap)) {
    if (lower.includes(key)) return val;
  }
  return 'ZH';
}

function extractOrt(address: string): string {
  const plzMatch = address.match(/\d{4}\s+(.+)/);
  if (plzMatch) return plzMatch[1].trim();
  return address.split(',').pop()?.trim() || address;
}

function mapToLead(result: ScrapeResult, query: string) {
  const parts = query.trim().split(/\s+/);
  const branche = parts[0] || 'Unbekannt';
  const kanton = extractKanton(result.address || query);
  const ort = extractOrt(result.address || query);

  return {
    firma: result.name,
    kontakt: null,
    email: result.email || null,
    telefon: result.phone || null,
    website: result.website || null,
    adresse: result.address || null,
    branche,
    kanton,
    ort,
    status: 'New Lead',
    leadScore: 0,
    googleRating: result.rating || null,
    googleReviews: result.reviews || null,
    quelle: 'Google Maps Scraper',
  };
}

function getScoreBadgeColor(score: number): string {
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--amber)';
  return 'var(--red)';
}

export default function ScraperPage() {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importedIndices, setImportedIndices] = useState<Set<number>>(new Set());
  const [importingIndices, setImportingIndices] = useState<Set<number>>(new Set());
  const [importingAll, setImportingAll] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [fitnessResults, setFitnessResults] = useState<Map<number, FitnessCheckResult>>(new Map());
  const [checkingFitness, setCheckingFitness] = useState<Set<number>>(new Set());
  const [statistics, setStatistics] = useState<Statistics>({
    totalScraped: 0,
    totalImported: 0,
    avgRating: 0,
  });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setImportedIndices(new Set());
    setFitnessResults(new Map());
    setProgress(0);

    // Simulate progress bar
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return p + Math.random() * 15;
      });
    }, 300);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), maxResults }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Scraping fehlgeschlagen');
      }

      const data = await res.json();
      const scraped = data.results || [];
      setResults(scraped);

      // Update statistics
      const totalRating = scraped.reduce((sum: number, r: ScrapeResult) => sum + (r.rating || 0), 0);
      const validRatings = scraped.filter((r: ScrapeResult) => r.rating !== null).length;
      setStatistics((prev) => ({
        totalScraped: prev.totalScraped + scraped.length,
        totalImported: prev.totalImported,
        avgRating: validRatings > 0 ? totalRating / validRatings : 0,
      }));

      setHistory((prev) => [
        {
          query: query.trim(),
          resultCount: scraped.length,
          timestamp: new Date(),
          cached: data.cached || false,
        },
        ...prev.slice(0, 4),
      ]);

      setTimeout(() => setProgress(0), 1000);
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [query, maxResults]);

  const handleImportSingle = useCallback(
    async (index: number) => {
      const result = results[index];
      if (!result || importedIndices.has(index)) return;

      setImportingIndices((prev) => new Set(prev).add(index));

      try {
        const lead = mapToLead(result, query);
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        });

        if (!res.ok) throw new Error('Import fehlgeschlagen');

        setImportedIndices((prev) => new Set(prev).add(index));
        setStatistics((prev) => ({ ...prev, totalImported: prev.totalImported + 1 }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
      } finally {
        setImportingIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [results, importedIndices, query]
  );

  const handleImportAll = useCallback(async () => {
    const unimported = results
      .map((r, i) => ({ result: r, index: i }))
      .filter(({ index }) => !importedIndices.has(index));

    if (unimported.length === 0) return;

    setImportingAll(true);

    try {
      const leads = unimported.map(({ result }) => mapToLead(result, query));
      const res = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });

      if (!res.ok) throw new Error('Bulk import fehlgeschlagen');

      const allIndices = new Set(importedIndices);
      unimported.forEach(({ index }) => allIndices.add(index));
      setImportedIndices(allIndices);
      setStatistics((prev) => ({ ...prev, totalImported: prev.totalImported + unimported.length }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
    } finally {
      setImportingAll(false);
    }
  }, [results, importedIndices, query]);

  const handleFitnessCheck = useCallback(
    async (index: number) => {
      const result = results[index];
      if (!result?.website || checkingFitness.has(index)) return;

      setCheckingFitness((prev) => new Set(prev).add(index));

      try {
        const res = await fetch('/api/fitness-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: result.website }),
        });

        if (!res.ok) throw new Error('Fitness Check fehlgeschlagen');

        const data = await res.json();
        setFitnessResults((prev) => {
          const next = new Map(prev);
          next.set(index, {
            score: data.score || 0,
            ssl: data.ssl || false,
            seo: data.seo || { metaTitle: false, metaDescription: false, h1Tags: false },
            mobile: data.mobile || false,
            performance: data.performance || { loadTime: 0, imageOptimization: false },
            timestamp: new Date(),
          });
          return next;
        });
      } catch (err) {
        console.error('Fitness check failed:', err);
      } finally {
        setCheckingFitness((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [results, checkingFitness]
  );

  const quickSearches = [
    'Treuhand Zürich',
    'Zahnarzt Basel',
    'Immobilien Bern',
    'Handwerk Luzern',
    'IT Dienstleistung Schweiz',
  ];

  const allImported = results.length > 0 && results.every((_, i) => importedIndices.has(i));
  const importedCount = importedIndices.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-xl md:text-2xl font-bold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
        >
          Lead Scraper
        </h1>
        <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Google Maps durchsuchen, Leads importieren und Website-Fitness prüfen
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="card-glass-premium p-5 rounded-xl"
          style={{
            borderColor: 'color-mix(in srgb, var(--green) 20%, var(--border))',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--green) 15%, transparent)' }}
            >
              <Database size={20} style={{ color: 'var(--green)' }} />
            </div>
            <div>
              <div
                className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
              >
                {statistics.totalScraped}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Gesamt gescraped
              </div>
            </div>
          </div>
        </div>

        <div
          className="card-glass-premium p-5 rounded-xl"
          style={{
            borderColor: 'color-mix(in srgb, var(--green) 20%, var(--border))',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--green) 15%, transparent)' }}
            >
              <TrendingUp size={20} style={{ color: 'var(--green)' }} />
            </div>
            <div>
              <div
                className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
              >
                {statistics.totalImported}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Importiert ins CRM
              </div>
            </div>
          </div>
        </div>

        <div
          className="card-glass-premium p-5 rounded-xl"
          style={{
            borderColor: 'color-mix(in srgb, var(--green) 20%, var(--border))',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--green) 15%, transparent)' }}
            >
              <Star size={20} style={{ color: 'var(--green)' }} />
            </div>
            <div>
              <div
                className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
              >
                {statistics.avgRating > 0 ? statistics.avgRating.toFixed(1) : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Durchschn. Rating
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div
        className="card-glass-premium p-4 md:p-6 rounded-xl"
        style={{ borderColor: 'color-mix(in srgb, var(--green) 20%, var(--border))' }}
      >
        {/* Search Input */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--border)',
            }}
          >
            <Search size={20} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
              placeholder="z.B. Treuhand Zürich"
              className="flex-1 bg-transparent outline-none text-base"
              style={{
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all min-h-[44px] w-full sm:w-auto"
            style={{
              backgroundColor: loading ? 'var(--surface-hover)' : 'var(--green)',
              color: loading ? 'var(--text-secondary)' : '#000',
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              opacity: !query.trim() && !loading ? 0.5 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
            {loading ? 'Scrape...' : 'Scrapen'}
          </button>
        </div>

        {/* Quick Search Templates */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Vorlagen:
          </span>
          {quickSearches.map((qs) => (
            <button
              key={qs}
              onClick={() => setQuery(qs)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: query === qs ? 'color-mix(in srgb, var(--green) 20%, transparent)' : 'var(--bg)',
                color: query === qs ? 'var(--green)' : 'var(--text-secondary)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: query === qs ? 'var(--green)' : 'var(--border)',
                cursor: 'pointer',
              }}
            >
              {qs}
            </button>
          ))}
        </div>

        {/* Max Results Slider */}
        <div className="flex items-center gap-4 mt-4">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Max Ergebnisse
          </span>
          <input
            type="range"
            min={5}
            max={50}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="flex-1"
            style={{
              accentColor: 'var(--green)',
              height: '4px',
            }}
          />
          <span
            className="text-sm font-bold w-8 text-right"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
          >
            {maxResults}
          </span>
        </div>
      </div>

      {/* Animated Progress Bar */}
      {progress > 0 && (
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: progress >= 100 ? 'var(--green)' : 'var(--green)',
              boxShadow: progress >= 100 ? '0 0 20px rgba(34, 197, 94, 0.5)' : '0 0 12px rgba(34, 197, 94, 0.3)',
            }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-lg border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--red) 10%, transparent)',
            borderColor: 'var(--red)',
            color: 'var(--red)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-sm font-medium" style={{ cursor: 'pointer' }}>
            Schliessen
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2
              className="text-sm font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              {results.length} ERGEBNISSE
            </h2>
            <button
              onClick={handleImportAll}
              disabled={allImported || importingAll}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] w-full sm:w-auto"
              style={{
                backgroundColor: allImported ? 'color-mix(in srgb, var(--green) 15%, transparent)' : 'var(--green)',
                color: allImported ? 'var(--green)' : '#000',
                opacity: allImported ? 0.7 : 1,
                cursor: allImported ? 'default' : 'pointer',
              }}
            >
              {importingAll ? (
                <Loader2 size={16} className="animate-spin" />
              ) : allImported ? (
                <CheckCircle2 size={16} />
              ) : (
                <Download size={16} />
              )}
              {allImported ? 'Alle importiert' : importingAll ? 'Importiere...' : 'Alle importieren'}
            </button>
          </div>

          {/* Results Table */}
          <div className="space-y-3">
            {results.map((result, index) => {
              const isImported = importedIndices.has(index);
              const isImporting = importingIndices.has(index);
              const fitnessData = fitnessResults.get(index);
              const isCheckingFitness = checkingFitness.has(index);

              return (
                <div
                  key={`${result.name}-${index}`}
                  className="card-glass-premium p-5 rounded-xl transition-all"
                  style={{
                    borderColor: isImported
                      ? 'color-mix(in srgb, var(--green) 30%, var(--border))'
                      : 'color-mix(in srgb, var(--green) 20%, var(--border))',
                  }}
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-bold text-base mb-1"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                      >
                        {result.name}
                      </h3>
                      {result.category && (
                        <span
                          className="text-xs inline-block px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--green) 10%, transparent)',
                            color: 'var(--green)',
                          }}
                        >
                          {result.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleImportSingle(index)}
                        disabled={isImported || isImporting}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                        style={{
                          backgroundColor: isImported
                            ? 'color-mix(in srgb, var(--green) 15%, transparent)'
                            : 'var(--bg)',
                          color: isImported ? 'var(--green)' : 'var(--text-secondary)',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: isImported ? 'var(--green)' : 'var(--border)',
                          cursor: isImported ? 'default' : 'pointer',
                        }}
                      >
                        {isImporting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isImported ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <Download size={14} />
                        )}
                        {isImported ? 'Importiert' : isImporting ? '...' : 'Import to CRM'}
                      </button>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {/* Address */}
                    {result.address && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                          {result.address}
                        </span>
                      </div>
                    )}

                    {/* Phone */}
                    <div className="flex items-center gap-2">
                      <Phone size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span
                        className="text-xs"
                        style={{ color: result.phone ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                      >
                        {result.phone || 'Nicht verfügbar'}
                      </span>
                    </div>

                    {/* Website */}
                    <div className="flex items-center gap-2">
                      <Globe size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      {result.website ? (
                        <a
                          href={result.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs truncate flex items-center gap-1"
                          style={{ color: 'var(--green)' }}
                        >
                          {result.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Nicht verfügbar
                        </span>
                      )}
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2">
                      <Mail size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      {result.email ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={12} style={{ color: 'var(--green)' }} />
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {result.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Nicht gefunden
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rating & Fitness Check */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rating */}
                      <div className="flex items-center gap-1">
                        {result.rating !== null ? (
                          <>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={14}
                                style={{
                                  color:
                                    i < Math.round(result.rating!)
                                      ? 'var(--amber)'
                                      : 'var(--border)',
                                  fill:
                                    i < Math.round(result.rating!)
                                      ? 'var(--amber)'
                                      : 'none',
                                }}
                              />
                            ))}
                            <span
                              className="text-xs ml-1 font-medium"
                              style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
                            >
                              {result.rating}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Kein Rating
                          </span>
                        )}
                      </div>
                      {result.reviews !== null && (
                        <span
                          className="text-xs"
                          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                        >
                          ({result.reviews} Bewertungen)
                        </span>
                      )}
                    </div>

                    {/* Fitness Check Button */}
                    {result.website && (
                      <button
                        onClick={() => handleFitnessCheck(index)}
                        disabled={isCheckingFitness || !!fitnessData}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          backgroundColor: fitnessData
                            ? 'color-mix(in srgb, var(--green) 10%, transparent)'
                            : 'var(--bg)',
                          color: fitnessData ? 'var(--green)' : 'var(--text-secondary)',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: fitnessData ? 'var(--green)' : 'var(--border)',
                          cursor: isCheckingFitness || fitnessData ? 'default' : 'pointer',
                        }}
                      >
                        {isCheckingFitness ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Activity size={12} />
                        )}
                        {isCheckingFitness ? 'Prüfe...' : fitnessData ? 'Geprüft' : 'Fitness Check'}
                      </button>
                    )}
                  </div>

                  {/* Fitness Check Results */}
                  {fitnessData && (
                    <div
                      className="mt-4 pt-4 border-t"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                          FITNESS SCORE
                        </span>
                        <div
                          className="px-3 py-1 rounded-full text-sm font-bold"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${getScoreBadgeColor(fitnessData.score)} 15%, transparent)`,
                            color: getScoreBadgeColor(fitnessData.score),
                          }}
                        >
                          {fitnessData.score}/100
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* SSL */}
                        <div
                          className="px-3 py-2 rounded-lg flex items-center gap-2"
                          style={{
                            backgroundColor: fitnessData.ssl
                              ? 'color-mix(in srgb, var(--green) 10%, transparent)'
                              : 'color-mix(in srgb, var(--red) 10%, transparent)',
                          }}
                        >
                          <Shield
                            size={14}
                            style={{ color: fitnessData.ssl ? 'var(--green)' : 'var(--red)' }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: fitnessData.ssl ? 'var(--green)' : 'var(--red)' }}
                          >
                            SSL
                          </span>
                        </div>

                        {/* Mobile */}
                        <div
                          className="px-3 py-2 rounded-lg flex items-center gap-2"
                          style={{
                            backgroundColor: fitnessData.mobile
                              ? 'color-mix(in srgb, var(--green) 10%, transparent)'
                              : 'color-mix(in srgb, var(--red) 10%, transparent)',
                          }}
                        >
                          <Smartphone
                            size={14}
                            style={{ color: fitnessData.mobile ? 'var(--green)' : 'var(--red)' }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: fitnessData.mobile ? 'var(--green)' : 'var(--red)' }}
                          >
                            Mobile
                          </span>
                        </div>

                        {/* SEO */}
                        <div
                          className="px-3 py-2 rounded-lg flex items-center gap-2"
                          style={{
                            backgroundColor:
                              fitnessData.seo.metaTitle && fitnessData.seo.metaDescription
                                ? 'color-mix(in srgb, var(--green) 10%, transparent)'
                                : 'color-mix(in srgb, var(--amber) 10%, transparent)',
                          }}
                        >
                          <Search
                            size={14}
                            style={{
                              color:
                                fitnessData.seo.metaTitle && fitnessData.seo.metaDescription
                                  ? 'var(--green)'
                                  : 'var(--amber)',
                            }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{
                              color:
                                fitnessData.seo.metaTitle && fitnessData.seo.metaDescription
                                  ? 'var(--green)'
                                  : 'var(--amber)',
                            }}
                          >
                            SEO
                          </span>
                        </div>

                        {/* Performance */}
                        <div
                          className="px-3 py-2 rounded-lg flex items-center gap-2"
                          style={{
                            backgroundColor:
                              fitnessData.performance.loadTime < 3000
                                ? 'color-mix(in srgb, var(--green) 10%, transparent)'
                                : 'color-mix(in srgb, var(--amber) 10%, transparent)',
                          }}
                        >
                          <Zap
                            size={14}
                            style={{
                              color:
                                fitnessData.performance.loadTime < 3000 ? 'var(--green)' : 'var(--amber)',
                            }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{
                              color:
                                fitnessData.performance.loadTime < 3000 ? 'var(--green)' : 'var(--amber)',
                            }}
                          >
                            {(fitnessData.performance.loadTime / 1000).toFixed(1)}s
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div
          className="card-glass-premium flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ borderColor: 'color-mix(in srgb, var(--green) 20%, var(--border))' }}
        >
          <Search size={48} style={{ color: 'var(--green)', opacity: 0.5 }} />
          <p className="mt-4 text-sm font-medium" style={{ color: 'var(--text)' }}>
            Suchbegriff eingeben und Leads finden
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            z.B. &quot;Treuhand Zürich&quot; oder &quot;IT Dienstleistung Schweiz&quot;
          </p>
        </div>
      )}

      {/* Search History */}
      {history.length > 0 && (
        <div
          className="card-glass-premium p-5 rounded-xl"
          style={{ borderColor: 'color-mix(in srgb, var(--green) 20%, var(--border))' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-sm font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              SUCHVERLAUF (Letzte 5)
            </h2>
            <button
              onClick={() => setHistory([])}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <Trash2 size={12} />
              Leeren
            </button>
          </div>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div
                key={`${entry.query}-${i}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--bg)',
                  cursor: 'pointer',
                }}
                onClick={() => setQuery(entry.query)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)';
                }}
              >
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                  <Search size={14} className="shrink-0" style={{ color: 'var(--green)' }} />
                  <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                    {entry.query}
                  </span>
                  {entry.cached && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs shrink-0"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--blue) 15%, transparent)',
                        color: 'var(--blue)',
                      }}
                    >
                      cached
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                  <span
                    className="text-xs font-medium"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                  >
                    {entry.resultCount}
                  </span>
                  <span className="hidden sm:flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={11} />
                    {entry.timestamp.toLocaleTimeString('de-CH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
