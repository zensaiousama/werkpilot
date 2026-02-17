import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const { url, leadId } = await req.json();

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  try {
    // Analyze website
    const results = await analyzeWebsite(url);

    // Update lead if provided
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          fitnessScore: results.score,
          status: 'Fitness Check',
        },
      });
      await prisma.activity.create({
        data: {
          leadId,
          type: 'fitness_check',
          details: `Fitness Score: ${results.score}/100 — ${url}`,
        },
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed', details: String(err) }, { status: 500 });
  }
}

async function analyzeWebsite(url: string) {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

  const checks: Record<string, { score: number; details: string }> = {};
  let totalScore = 0;

  try {
    const response = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Werkpilot-FitnessCheck/1.0' },
    });

    const html = await response.text();
    const lowerHtml = html.toLowerCase();

    // SSL
    checks.ssl = {
      score: normalizedUrl.startsWith('https') ? 10 : 0,
      details: normalizedUrl.startsWith('https') ? 'SSL aktiv' : 'Kein SSL-Zertifikat',
    };

    // Meta tags
    const hasTitle = /<title[^>]*>.+<\/title>/i.test(html);
    const hasDescription = /meta\s+name=["']description["']/i.test(html);
    checks.seo = {
      score: (hasTitle ? 5 : 0) + (hasDescription ? 5 : 0),
      details: `Title: ${hasTitle ? 'Ja' : 'Nein'}, Description: ${hasDescription ? 'Ja' : 'Nein'}`,
    };

    // Mobile viewport
    const hasViewport = /meta\s+name=["']viewport["']/i.test(html);
    checks.mobile = {
      score: hasViewport ? 10 : 0,
      details: hasViewport ? 'Mobile-optimiert' : 'Nicht mobile-optimiert',
    };

    // Social media links
    const hasSocial = /linkedin|facebook|instagram|twitter|xing/i.test(html);
    checks.social = {
      score: hasSocial ? 10 : 0,
      details: hasSocial ? 'Social-Media-Links vorhanden' : 'Keine Social-Media-Links',
    };

    // Blog/News section
    const hasBlog = /\/blog|\/news|\/aktuelles|\/magazin/i.test(html);
    checks.blog = {
      score: hasBlog ? 10 : 0,
      details: hasBlog ? 'Blog/News vorhanden' : 'Kein Blog/News',
    };

    // Contact form
    const hasForm = /<form/i.test(html) || /kontakt|contact/i.test(lowerHtml);
    checks.contactForm = {
      score: hasForm ? 10 : 0,
      details: hasForm ? 'Kontaktformular vorhanden' : 'Kein Kontaktformular',
    };

    // Multi-language
    const hasMultiLang = /hreflang|\/de\/|\/fr\/|\/it\/|\/en\//i.test(html);
    checks.multiLanguage = {
      score: hasMultiLang ? 10 : 0,
      details: hasMultiLang ? 'Mehrsprachig' : 'Einsprachig',
    };

    // CTA clarity
    const hasCTA = /jetzt|buchen|anfragen|kontakt|termin|offerte|gratis/i.test(lowerHtml);
    checks.cta = {
      score: hasCTA ? 10 : 0,
      details: hasCTA ? 'Call-to-Action vorhanden' : 'Kein klarer CTA',
    };

    // Page speed (basic: response time)
    checks.speed = {
      score: response.ok ? 10 : 0,
      details: response.ok ? 'Seite erreichbar' : 'Seite nicht erreichbar',
    };

    // Impressum (Swiss legal requirement)
    const hasImpressum = /impressum|imprint/i.test(lowerHtml);
    checks.impressum = {
      score: hasImpressum ? 10 : 0,
      details: hasImpressum ? 'Impressum vorhanden' : 'Kein Impressum',
    };

    totalScore = Object.values(checks).reduce((sum, c) => sum + c.score, 0);
  } catch {
    // Website not reachable
    totalScore = 0;
    checks.reachability = { score: 0, details: 'Website nicht erreichbar' };
  }

  return {
    url: normalizedUrl,
    score: totalScore,
    maxScore: 100,
    checks,
    analyzedAt: new Date().toISOString(),
  };
}
