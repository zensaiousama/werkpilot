/**
 * Product Department - Documentation Updater Agent
 *
 * Keeps documentation in sync with the codebase and product changes.
 * Features: auto-detection of outdated docs, API documentation generation,
 * screenshot/diagram suggestions, multi-language support (DE/EN/FR),
 * documentation coverage scoring, broken link detection, and
 * version-specific documentation branching.
 *
 * Schedule: Daily outdated check, weekly coverage report, on-demand generation
 *
 * @module agents/product/docs-updater
 * @requires ../../shared/utils/claude-client
 * @requires ../../shared/utils/logger
 * @requires ../../shared/utils/airtable-client
 * @requires ../../shared/utils/email-client
 * @requires ../../shared/utils/config
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('docs-updater');

// --- Airtable Tables ---
const TABLES = {
  DOCS: 'Documentation',
  DOC_VERSIONS: 'Doc_Versions',
  DOC_COVERAGE: 'Doc_Coverage',
  DOC_LINKS: 'Doc_Links',
  DOC_TRANSLATIONS: 'Doc_Translations',
  API_DOCS: 'API_Documentation',
  FEATURES: 'Features',
  RELEASES: 'Releases',
  CHANGELOGS: 'Changelogs',
};

// --- Supported Languages ---
const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English', default: true },
  de: { name: 'German', nativeName: 'Deutsch', default: false },
  fr: { name: 'French', nativeName: 'Francais', default: false },
};

// --- Documentation Types ---
const DOC_TYPES = {
  api: 'API Reference',
  guide: 'User Guide',
  tutorial: 'Tutorial',
  reference: 'Technical Reference',
  faq: 'FAQ',
  changelog: 'Changelog',
  architecture: 'Architecture',
  runbook: 'Runbook/Operations',
  onboarding: 'Onboarding',
};

// --- Coverage Thresholds ---
const COVERAGE_THRESHOLDS = {
  excellent: 90,
  good: 75,
  acceptable: 60,
  poor: 40,
};

// ============================================================
// Auto-Detect Outdated Documentation
// ============================================================

/**
 * Scan documentation to identify pages that may be outdated based on
 * recent code changes, feature releases, and time since last update.
 *
 * @param {number} [staleDays=60] - Number of days after which docs are considered stale
 * @returns {Promise<Array>} Array of outdated documentation items with severity
 */
async function detectOutdatedDocs(staleDays = 60) {
  logger.info(`Scanning for outdated documentation (stale threshold: ${staleDays} days)`);

  try {
    // Get all documentation records
    const allDocs = await getRecords(TABLES.DOCS, '{Status} = "Published"', 200);

    if (allDocs.length === 0) {
      logger.info('No published documentation found');
      return [];
    }

    // Get recent changes for cross-reference
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const recentFeatures = await getRecords(
      TABLES.FEATURES,
      `AND(OR({Status} = "Shipped", {Status} = "Rolled Out"), {Shipped_Date} >= "${thirtyDaysAgo}")`,
      50
    );

    const recentReleases = await getRecords(
      TABLES.RELEASES,
      `AND({Status} = "Deployed", {Created_Date} >= "${thirtyDaysAgo}")`,
      10
    );

    const now = Date.now();
    const staleThreshold = staleDays * 24 * 60 * 60 * 1000;
    const outdatedDocs = [];

    for (const doc of allDocs) {
      const lastUpdated = doc.Last_Updated ? new Date(doc.Last_Updated).getTime() : 0;
      const daysSinceUpdate = Math.round((now - lastUpdated) / (1000 * 60 * 60 * 24));
      const isStale = (now - lastUpdated) > staleThreshold;

      // Check if doc covers components affected by recent changes
      const docComponent = (doc.Component || '').toLowerCase();
      const docFeature = (doc.Feature || '').toLowerCase();

      const affectedByChanges = recentFeatures.some((f) => {
        const featureName = (f.Name || f.Title || '').toLowerCase();
        const featureComponent = (f.Component || '').toLowerCase();
        return (
          docComponent && (featureComponent.includes(docComponent) || docComponent.includes(featureComponent)) ||
          docFeature && featureName.includes(docFeature)
        );
      });

      if (isStale || affectedByChanges) {
        outdatedDocs.push({
          id: doc.id,
          title: doc.Title || doc.Name,
          type: doc.Type || 'unknown',
          component: doc.Component || 'Unknown',
          lastUpdated: doc.Last_Updated || 'Never',
          daysSinceUpdate,
          isStale,
          affectedByChanges,
          severity: isStale && affectedByChanges ? 'critical' : affectedByChanges ? 'high' : 'medium',
          language: doc.Language || 'en',
          url: doc.URL || '',
        });
      }
    }

    // Use Claude to prioritize and add context
    if (outdatedDocs.length > 0) {
      const analysis = await generateJSON(
        `Analyze these outdated documentation items and provide prioritized recommendations.

Outdated docs:
${JSON.stringify(outdatedDocs.slice(0, 20), null, 2)}

Recent feature releases:
${JSON.stringify(recentFeatures.slice(0, 10).map((f) => ({ name: f.Name || f.Title, component: f.Component, shippedDate: f.Shipped_Date })), null, 2)}

Recent version releases:
${JSON.stringify(recentReleases.map((r) => ({ version: r.Version, date: r.Created_Date })), null, 2)}

Return JSON with:
- prioritized_docs: array of {
    title: doc title,
    priority: 1-based rank,
    severity: "critical" | "high" | "medium" | "low",
    reason: why this doc is outdated or needs updating,
    suggested_changes: array of specific changes to make,
    estimated_effort_hours: number,
    impact_if_not_updated: what happens if we skip this
  }
- summary: 2-3 sentence summary of the documentation health
- total_effort_hours: sum of all estimated efforts
- quick_wins: array of docs that can be updated in under 1 hour`,
        { model: config.models.fast, maxTokens: 2000 }
      );

      // Update doc records with staleness info
      for (const doc of outdatedDocs) {
        try {
          await updateRecord(TABLES.DOCS, doc.id, {
            Needs_Update: true,
            Staleness_Severity: doc.severity,
            Days_Since_Update: doc.daysSinceUpdate,
            Staleness_Check_Date: new Date().toISOString().split('T')[0],
          });
        } catch (err) {
          logger.warn(`Failed to update staleness for: ${doc.title}`, { error: err.message });
        }
      }

      logger.info(
        `Found ${outdatedDocs.length} outdated docs | ${outdatedDocs.filter((d) => d.severity === 'critical').length} critical | ${outdatedDocs.filter((d) => d.severity === 'high').length} high`
      );

      return analysis.prioritized_docs || outdatedDocs;
    }

    logger.info('All documentation is up to date');
    return [];
  } catch (err) {
    logger.error('Failed to detect outdated documentation', { error: err.message });
    return [];
  }
}

// ============================================================
// API Documentation Generation
// ============================================================

/**
 * Generate or update API documentation from endpoint definitions,
 * code comments, and usage examples.
 *
 * @param {Array} endpoints - Array of API endpoint definitions
 * @param {Object} [options] - Generation options
 * @param {string} [options.format='openapi'] - Output format: 'openapi' | 'markdown' | 'html'
 * @param {string} [options.version] - API version
 * @returns {Promise<Object>} Generated API documentation
 */
async function generateAPIDocumentation(endpoints, { format = 'openapi', version = '1.0.0' } = {}) {
  logger.info(`Generating API documentation for ${endpoints.length} endpoints (format: ${format})`);

  try {
    // If no endpoints provided, try loading from Airtable
    if (!endpoints || endpoints.length === 0) {
      endpoints = await getRecords(TABLES.API_DOCS, '{Status} = "Active"', 100);
    }

    if (endpoints.length === 0) {
      logger.info('No API endpoints to document');
      return { documentation: null, endpointCount: 0 };
    }

    const endpointData = endpoints.map((ep) => ({
      method: ep.Method || ep.method || 'GET',
      path: ep.Path || ep.path || '/',
      description: ep.Description || ep.description || '',
      parameters: ep.Parameters || ep.parameters || [],
      requestBody: ep.Request_Body || ep.requestBody || null,
      responseExample: ep.Response_Example || ep.responseExample || null,
      authentication: ep.Authentication || ep.authentication || 'required',
      rateLimit: ep.Rate_Limit || ep.rateLimit || 'standard',
      deprecated: ep.Deprecated || ep.deprecated || false,
      version: ep.Version || ep.version || version,
    }));

    const documentation = await generateJSON(
      `Generate comprehensive API documentation for these endpoints.

API Version: ${version}
Base URL: ${config.website?.url || 'https://api.werkpilot.ch'}/api/v1
Format: ${format}

Endpoints:
${JSON.stringify(endpointData, null, 2)}

${format === 'openapi' ? `Return a valid OpenAPI 3.0 specification as JSON.` : ''}
${format === 'markdown' ? `Return JSON with a "markdown" field containing full markdown documentation.` : ''}
${format === 'html' ? `Return JSON with an "html" field containing styled HTML documentation.` : ''}

For each endpoint include:
1. Clear description of what it does
2. All parameters with types, constraints, and examples
3. Request body schema with examples (for POST/PUT/PATCH)
4. Response schema with examples for success and error cases
5. Authentication requirements
6. Rate limiting info
7. Common error codes and their meanings
8. curl example
9. Code examples (JavaScript/Python)

Also include:
- authentication_guide: how to authenticate with the API
- rate_limiting_guide: rate limiting policies
- error_handling_guide: standard error response format
- changelog: recent API changes
- deprecation_notices: any deprecated endpoints with migration guides`,
      { model: config.models.standard, maxTokens: 4096 }
    );

    // Save documentation
    const docsDir = path.join(__dirname, 'api-docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const fileExtension = format === 'openapi' ? 'json' : format === 'markdown' ? 'md' : 'html';
    const docPath = path.join(docsDir, `api-v${version}.${fileExtension}`);

    if (format === 'openapi') {
      fs.writeFileSync(docPath, JSON.stringify(documentation, null, 2));
    } else if (format === 'markdown') {
      fs.writeFileSync(docPath, documentation.markdown || JSON.stringify(documentation, null, 2));
    } else {
      fs.writeFileSync(docPath, documentation.html || JSON.stringify(documentation, null, 2));
    }

    logger.info(`API documentation generated: ${docPath} | ${endpoints.length} endpoints`);

    // Update Airtable
    try {
      await createRecord(TABLES.API_DOCS, {
        Version: version,
        Format: format,
        Endpoint_Count: endpoints.length,
        File_Path: docPath,
        Generated_Date: new Date().toISOString(),
        Status: 'Current',
      });
    } catch (err) {
      logger.warn('Failed to save API doc record', { error: err.message });
    }

    return { documentation, endpointCount: endpoints.length, path: docPath };
  } catch (err) {
    logger.error('Failed to generate API documentation', { error: err.message });
    return { documentation: null, endpointCount: 0 };
  }
}

// ============================================================
// Screenshot/Diagram Suggestions
// ============================================================

/**
 * Analyze documentation and suggest where screenshots, diagrams,
 * or visual aids would improve clarity and understanding.
 *
 * @param {string} [docFilter] - Optional Airtable filter for specific docs
 * @returns {Promise<Array>} Array of visual aid suggestions
 */
async function suggestVisualAids(docFilter) {
  logger.info('Analyzing documentation for visual aid opportunities');

  try {
    const filter = docFilter || '{Status} = "Published"';
    const docs = await getRecords(TABLES.DOCS, filter, 50);

    if (docs.length === 0) {
      logger.info('No documentation to analyze for visual aids');
      return [];
    }

    const suggestions = [];

    // Process in batches of 5
    for (let i = 0; i < docs.length; i += 5) {
      const batch = docs.slice(i, i + 5);

      const batchData = batch.map((d) => ({
        id: d.id,
        title: d.Title || d.Name,
        type: d.Type || 'unknown',
        content_excerpt: (d.Content || d.Description || '').substring(0, 500),
        has_images: d.Image_Count || 0,
        has_diagrams: d.Diagram_Count || 0,
        word_count: d.Word_Count || 0,
      }));

      const analysis = await generateJSON(
        `Analyze these documentation pages and suggest where visual aids (screenshots, diagrams, flowcharts, tables) would improve understanding.

Documentation pages:
${JSON.stringify(batchData, null, 2)}

For each page that needs visual aids, provide suggestions.
Return JSON array of suggestions, each with:
- doc_id: documentation record id
- doc_title: page title
- suggestions: array of {
    type: "screenshot" | "flowchart" | "architecture_diagram" | "sequence_diagram" | "table" | "comparison_chart" | "infographic" | "code_snippet" | "gif_animation",
    description: what the visual should show,
    placement: where in the doc it should go (e.g., "after step 3", "in the overview section"),
    priority: "high" | "medium" | "low",
    alt_text_suggestion: suggested alt text for accessibility,
    tool_recommendation: recommended tool to create it (e.g., "Mermaid", "Excalidraw", "Screenshot tool")
  }
- current_visual_score: 0-100 (how well the current page uses visuals)
- impact_of_adding_visuals: "high" | "medium" | "low"`,
        { model: config.models.fast, maxTokens: 2000 }
      );

      const results = Array.isArray(analysis) ? analysis : [analysis];
      suggestions.push(...results.filter((s) => s.suggestions && s.suggestions.length > 0));
    }

    // Update docs with visual aid suggestions
    for (const suggestion of suggestions) {
      try {
        if (suggestion.doc_id) {
          await updateRecord(TABLES.DOCS, suggestion.doc_id, {
            Visual_Aid_Suggestions: JSON.stringify(suggestion.suggestions || []),
            Visual_Score: suggestion.current_visual_score || 0,
            Needs_Visuals: true,
          });
        }
      } catch (err) {
        logger.warn(`Failed to update visual suggestions for: ${suggestion.doc_title}`, {
          error: err.message,
        });
      }
    }

    const totalSuggestions = suggestions.reduce(
      (sum, s) => sum + (s.suggestions || []).length,
      0
    );

    logger.info(
      `Visual aid analysis: ${suggestions.length} docs need visuals | ${totalSuggestions} total suggestions`
    );

    return suggestions;
  } catch (err) {
    logger.error('Failed to suggest visual aids', { error: err.message });
    return [];
  }
}

// ============================================================
// Multi-Language Documentation Support
// ============================================================

/**
 * Translate documentation into supported languages (DE/EN/FR).
 * Maintains translation status and identifies untranslated content.
 *
 * @param {Object} [options] - Translation options
 * @param {string} [options.targetLanguage] - Specific language to translate to
 * @param {string} [options.docFilter] - Airtable filter for specific docs
 * @returns {Promise<Object>} Translation results with counts per language
 */
async function translateDocumentation({ targetLanguage, docFilter } = {}) {
  logger.info(
    `Translating documentation${targetLanguage ? ` to ${targetLanguage}` : ' to all supported languages'}`
  );

  try {
    const filter = docFilter || 'AND({Status} = "Published", {Language} = "en")';
    const sourceDocs = await getRecords(TABLES.DOCS, filter, 50);

    if (sourceDocs.length === 0) {
      logger.info('No documentation to translate');
      return { translated: 0, skipped: 0, languages: {} };
    }

    const targetLangs = targetLanguage
      ? [targetLanguage]
      : Object.keys(SUPPORTED_LANGUAGES).filter((l) => l !== 'en');

    const results = {
      translated: 0,
      skipped: 0,
      failed: 0,
      languages: {},
    };

    for (const lang of targetLangs) {
      const langInfo = SUPPORTED_LANGUAGES[lang];
      if (!langInfo) {
        logger.warn(`Unsupported language: ${lang}`);
        continue;
      }

      results.languages[lang] = { translated: 0, skipped: 0, failed: 0 };

      for (const doc of sourceDocs) {
        try {
          // Check if translation already exists and is current
          const existingTranslation = await getRecords(
            TABLES.DOC_TRANSLATIONS,
            `AND({Source_Doc} = "${doc.id}", {Language} = "${lang}")`,
            1
          );

          const sourceUpdated = doc.Last_Updated
            ? new Date(doc.Last_Updated).getTime()
            : 0;
          const translationDate = existingTranslation.length > 0 && existingTranslation[0].Translated_Date
            ? new Date(existingTranslation[0].Translated_Date).getTime()
            : 0;

          if (existingTranslation.length > 0 && translationDate >= sourceUpdated) {
            results.skipped++;
            results.languages[lang].skipped++;
            continue;
          }

          // Translate the content
          const content = doc.Content || doc.Description || '';
          if (!content) {
            results.skipped++;
            results.languages[lang].skipped++;
            continue;
          }

          const translation = await generateJSON(
            `Translate this documentation from English to ${langInfo.name} (${langInfo.nativeName}).

Original (English):
Title: ${doc.Title || doc.Name}
Content:
${content.substring(0, 4000)}

Rules:
1. Maintain all technical terms in English (API names, code snippets, parameter names)
2. Translate user-facing text naturally - not word-by-word
3. Keep all markdown formatting intact
4. Preserve code blocks and examples unchanged
5. Adapt any cultural references or idioms
6. Use formal/professional tone (Sie-Form for German)
7. Keep URLs and links unchanged

Return JSON with:
- title: translated title
- content: translated content (full markdown)
- language: "${lang}"
- translation_notes: array of decisions/notes about the translation
- untranslatable_terms: array of technical terms kept in English
- quality_confidence: 0-100 (self-assessed translation quality)`,
            { model: config.models.standard, maxTokens: 4096 }
          );

          // Save translation
          if (existingTranslation.length > 0) {
            await updateRecord(TABLES.DOC_TRANSLATIONS, existingTranslation[0].id, {
              Title: translation.title,
              Content: translation.content,
              Translation_Notes: JSON.stringify(translation.translation_notes || []),
              Quality_Confidence: translation.quality_confidence || 0,
              Translated_Date: new Date().toISOString(),
              Source_Version: doc.Last_Updated || new Date().toISOString(),
            });
          } else {
            await createRecord(TABLES.DOC_TRANSLATIONS, {
              Source_Doc: doc.id,
              Source_Title: doc.Title || doc.Name,
              Title: translation.title,
              Content: translation.content,
              Language: lang,
              Translation_Notes: JSON.stringify(translation.translation_notes || []),
              Quality_Confidence: translation.quality_confidence || 0,
              Translated_Date: new Date().toISOString(),
              Source_Version: doc.Last_Updated || new Date().toISOString(),
              Status: 'Draft',
            });
          }

          results.translated++;
          results.languages[lang].translated++;

          logger.info(
            `Translated: "${doc.Title || doc.Name}" -> ${lang} | confidence=${translation.quality_confidence}%`
          );
        } catch (err) {
          results.failed++;
          results.languages[lang].failed++;
          logger.warn(`Failed to translate "${doc.Title || doc.Name}" to ${lang}`, {
            error: err.message,
          });
        }
      }
    }

    logger.info(
      `Translation complete: ${results.translated} translated | ${results.skipped} skipped | ${results.failed} failed`
    );

    return results;
  } catch (err) {
    logger.error('Failed to translate documentation', { error: err.message });
    return { translated: 0, skipped: 0, failed: 0, languages: {} };
  }
}

// ============================================================
// Documentation Coverage Scoring
// ============================================================

/**
 * Calculate documentation coverage scores across features, APIs,
 * and components. Identifies gaps where documentation is missing.
 *
 * @returns {Promise<Object>} Coverage report with scores and gaps
 */
async function calculateDocCoverage() {
  logger.info('Calculating documentation coverage scores');

  try {
    // Get all features and check if they have documentation
    const features = await getRecords(
      TABLES.FEATURES,
      'AND(OR({Status} = "Shipped", {Status} = "Rolled Out"), {Status} != "Archived")',
      100
    );

    const docs = await getRecords(TABLES.DOCS, '{Status} = "Published"', 200);
    const apiDocs = await getRecords(TABLES.API_DOCS, '{Status} = "Current"', 100);

    // Map docs by component/feature
    const docsByComponent = {};
    const docsByFeature = {};
    for (const doc of docs) {
      const component = doc.Component || 'Unknown';
      const feature = doc.Feature || '';
      if (!docsByComponent[component]) docsByComponent[component] = [];
      docsByComponent[component].push(doc);
      if (feature) {
        if (!docsByFeature[feature]) docsByFeature[feature] = [];
        docsByFeature[feature].push(doc);
      }
    }

    // Calculate per-feature coverage
    const featureCoverage = [];
    const undocumentedFeatures = [];

    for (const feature of features) {
      const featureName = feature.Name || feature.Title;
      const featureDocs = docsByFeature[featureName] || [];

      const hasUserGuide = featureDocs.some((d) => d.Type === 'guide');
      const hasApiDoc = featureDocs.some((d) => d.Type === 'api');
      const hasTutorial = featureDocs.some((d) => d.Type === 'tutorial');
      const hasFaq = featureDocs.some((d) => d.Type === 'faq');

      const coverageItems = [
        { name: 'User Guide', covered: hasUserGuide, weight: 3 },
        { name: 'API Documentation', covered: hasApiDoc, weight: 2 },
        { name: 'Tutorial', covered: hasTutorial, weight: 2 },
        { name: 'FAQ', covered: hasFaq, weight: 1 },
      ];

      const totalWeight = coverageItems.reduce((sum, item) => sum + item.weight, 0);
      const coveredWeight = coverageItems
        .filter((item) => item.covered)
        .reduce((sum, item) => sum + item.weight, 0);
      const score = Math.round((coveredWeight / totalWeight) * 100);

      featureCoverage.push({
        feature: featureName,
        score,
        items: coverageItems,
        docCount: featureDocs.length,
      });

      if (score === 0) {
        undocumentedFeatures.push(featureName);
      }
    }

    // Calculate translation coverage
    const translationCoverage = {};
    for (const lang of Object.keys(SUPPORTED_LANGUAGES)) {
      if (lang === 'en') continue;
      const translations = await getRecords(
        TABLES.DOC_TRANSLATIONS,
        `{Language} = "${lang}"`,
        200
      );
      translationCoverage[lang] = {
        translated: translations.length,
        total: docs.length,
        percentage: docs.length > 0
          ? Math.round((translations.length / docs.length) * 100)
          : 0,
      };
    }

    // Overall scores
    const overallFeatureScore =
      featureCoverage.length > 0
        ? Math.round(featureCoverage.reduce((sum, f) => sum + f.score, 0) / featureCoverage.length)
        : 0;

    const overallApiScore =
      features.length > 0
        ? Math.round((apiDocs.length / Math.max(features.length, 1)) * 100)
        : 0;

    // Use Claude for gap analysis
    const gapAnalysis = await generateJSON(
      `Analyze documentation coverage and provide a gap report.

Overall feature documentation score: ${overallFeatureScore}%
API documentation coverage: ${overallApiScore}%

Undocumented features:
${JSON.stringify(undocumentedFeatures, null, 2)}

Feature coverage details:
${JSON.stringify(featureCoverage.filter((f) => f.score < 100).slice(0, 15), null, 2)}

Translation coverage:
${JSON.stringify(translationCoverage, null, 2)}

Return JSON with:
- overall_grade: "A" | "B" | "C" | "D" | "F" (based on overall coverage)
- overall_score: 0-100
- summary: 2-3 sentence assessment
- critical_gaps: array of { feature_or_area, missing_doc_type, impact, priority }
- quick_wins: array of docs that would have highest impact if created
- translation_priorities: array of { language, priority_docs: [doc names] }
- improvement_roadmap: array of { phase, actions, expected_coverage_improvement }
- estimated_total_effort_hours: hours to reach 90% coverage`,
      { model: config.models.fast, maxTokens: 1500 }
    );

    // Save coverage report
    const report = {
      date: new Date().toISOString(),
      overallFeatureScore,
      overallApiScore,
      translationCoverage,
      featureCoverage,
      undocumentedFeatures,
      ...gapAnalysis,
    };

    try {
      await createRecord(TABLES.DOC_COVERAGE, {
        Date: new Date().toISOString().split('T')[0],
        Overall_Score: gapAnalysis.overall_score || overallFeatureScore,
        Grade: gapAnalysis.overall_grade || 'N/A',
        Feature_Coverage: overallFeatureScore,
        API_Coverage: overallApiScore,
        Undocumented_Features: undocumentedFeatures.length,
        Summary: gapAnalysis.summary,
        Critical_Gaps: JSON.stringify(gapAnalysis.critical_gaps || []),
      });
    } catch (err) {
      logger.warn('Failed to save coverage report', { error: err.message });
    }

    // Save report locally
    const reportPath = path.join(__dirname, 'doc-coverage-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    logger.info(
      `Documentation coverage: ${gapAnalysis.overall_grade || 'N/A'} (${overallFeatureScore}% features, ${overallApiScore}% API) | ${undocumentedFeatures.length} undocumented features`
    );

    return report;
  } catch (err) {
    logger.error('Failed to calculate documentation coverage', { error: err.message });
    return { overallFeatureScore: 0, overallApiScore: 0, featureCoverage: [], undocumentedFeatures: [] };
  }
}

// ============================================================
// Broken Link Detection
// ============================================================

/**
 * Scan documentation for broken links (both internal and external).
 *
 * @param {Object} [options] - Scan options
 * @param {number} [options.timeoutMs=10000] - Request timeout per link
 * @param {number} [options.concurrency=5] - Max concurrent checks
 * @returns {Promise<Object>} Broken link report with details
 */
async function detectBrokenLinks({ timeoutMs = 10000, concurrency = 5 } = {}) {
  logger.info('Scanning documentation for broken links');

  try {
    const docs = await getRecords(TABLES.DOCS, '{Status} = "Published"', 200);

    if (docs.length === 0) {
      logger.info('No published documentation to scan');
      return { totalLinks: 0, broken: [], healthy: 0 };
    }

    // Extract links from documentation content
    const allLinks = [];
    const urlRegex = /https?:\/\/[^\s\)<>"']+/g;

    for (const doc of docs) {
      const content = doc.Content || doc.Description || '';
      const matches = content.match(urlRegex) || [];

      for (const url of matches) {
        // Clean up URL (remove trailing punctuation)
        const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
        allLinks.push({
          url: cleanUrl,
          docId: doc.id,
          docTitle: doc.Title || doc.Name,
        });
      }
    }

    // Deduplicate URLs
    const uniqueUrls = new Map();
    for (const link of allLinks) {
      if (!uniqueUrls.has(link.url)) {
        uniqueUrls.set(link.url, []);
      }
      uniqueUrls.get(link.url).push({ docId: link.docId, docTitle: link.docTitle });
    }

    logger.info(`Found ${uniqueUrls.size} unique URLs across ${docs.length} docs`);

    const broken = [];
    const redirects = [];
    let healthy = 0;
    let checked = 0;

    // Check links in batches
    const urlEntries = Array.from(uniqueUrls.entries());

    for (let i = 0; i < urlEntries.length; i += concurrency) {
      const batch = urlEntries.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async ([url, docRefs]) => {
          try {
            const result = await checkUrl(url, timeoutMs);
            return { url, docRefs, ...result };
          } catch (err) {
            return { url, docRefs, status: 0, ok: false, error: err.message };
          }
        })
      );

      for (const result of batchResults) {
        checked++;
        if (result.status === 'fulfilled') {
          const { url, docRefs, status, ok, error, redirectUrl } = result.value;

          if (!ok) {
            broken.push({
              url,
              status,
              error: error || `HTTP ${status}`,
              foundIn: docRefs.map((r) => r.docTitle),
              docIds: docRefs.map((r) => r.docId),
            });
          } else if (redirectUrl) {
            redirects.push({
              url,
              redirectUrl,
              foundIn: docRefs.map((r) => r.docTitle),
            });
            healthy++;
          } else {
            healthy++;
          }
        } else {
          broken.push({
            url: batch[batchResults.indexOf(result)]?.[0] || 'unknown',
            status: 0,
            error: result.reason?.message || 'Check failed',
            foundIn: [],
          });
        }
      }
    }

    // Save broken links
    for (const link of broken) {
      try {
        await createRecord(TABLES.DOC_LINKS, {
          URL: link.url,
          Status: 'Broken',
          HTTP_Status: link.status,
          Error: link.error,
          Found_In: link.foundIn.join(', '),
          Detected_Date: new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        logger.warn(`Failed to save broken link: ${link.url}`, { error: err.message });
      }
    }

    logger.info(
      `Link scan complete: ${checked} checked | ${healthy} healthy | ${broken.length} broken | ${redirects.length} redirects`
    );

    return {
      totalLinks: uniqueUrls.size,
      checked,
      healthy,
      broken,
      redirects,
      brokenRate: uniqueUrls.size > 0
        ? Math.round((broken.length / uniqueUrls.size) * 100)
        : 0,
    };
  } catch (err) {
    logger.error('Failed to detect broken links', { error: err.message });
    return { totalLinks: 0, broken: [], healthy: 0 };
  }
}

/**
 * Check if a URL is accessible.
 *
 * @param {string} url - URL to check
 * @param {number} timeoutMs - Request timeout in milliseconds
 * @returns {Promise<Object>} Check result with status and ok flag
 */
function checkUrl(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(
        url,
        {
          method: 'HEAD',
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'Werkpilot-DocsChecker/1.0',
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          const isRedirect = status >= 300 && status < 400;
          const isOk = (status >= 200 && status < 300) || isRedirect;

          resolve({
            status,
            ok: isOk,
            redirectUrl: isRedirect ? res.headers.location : null,
          });
        }
      );

      req.on('error', (err) => {
        resolve({ status: 0, ok: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 0, ok: false, error: 'Timeout' });
      });

      req.end();
    } catch (err) {
      resolve({ status: 0, ok: false, error: err.message });
    }
  });
}

// ============================================================
// Version-Specific Documentation Branching
// ============================================================

/**
 * Manage version-specific documentation branches.
 * Creates snapshots of documentation for specific product versions
 * and manages which version is "current".
 *
 * @param {string} version - Product version to branch docs for
 * @param {Object} [options] - Branching options
 * @param {boolean} [options.makeDefault=false] - Make this the default version
 * @returns {Promise<Object>} Branch creation results
 */
async function branchDocumentation(version, { makeDefault = false } = {}) {
  logger.info(`Creating documentation branch for version ${version}`);

  try {
    // Get current published docs
    const currentDocs = await getRecords(TABLES.DOCS, '{Status} = "Published"', 200);

    if (currentDocs.length === 0) {
      logger.info('No documentation to branch');
      return { branched: 0, version };
    }

    // Check if this version branch already exists
    const existingBranch = await getRecords(
      TABLES.DOC_VERSIONS,
      `{Version} = "${version}"`,
      1
    );

    if (existingBranch.length > 0) {
      logger.warn(`Documentation branch for ${version} already exists`);
      return { branched: 0, version, alreadyExists: true };
    }

    // Create version branch record
    await createRecord(TABLES.DOC_VERSIONS, {
      Version: version,
      Doc_Count: currentDocs.length,
      Is_Default: makeDefault,
      Created_Date: new Date().toISOString(),
      Status: 'Active',
    });

    // Snapshot each document for this version
    let branched = 0;
    for (const doc of currentDocs) {
      try {
        await createRecord(TABLES.DOCS, {
          Title: doc.Title || doc.Name,
          Content: doc.Content || '',
          Description: doc.Description || '',
          Component: doc.Component || '',
          Feature: doc.Feature || '',
          Type: doc.Type || 'guide',
          Language: doc.Language || 'en',
          Version: version,
          Source_Doc: doc.id,
          Status: 'Published',
          Last_Updated: new Date().toISOString(),
          Version_Branch: true,
        });
        branched++;
      } catch (err) {
        logger.warn(`Failed to branch doc: ${doc.Title || doc.Name}`, {
          error: err.message,
        });
      }
    }

    // If makeDefault, update previous default version
    if (makeDefault) {
      try {
        const previousDefaults = await getRecords(
          TABLES.DOC_VERSIONS,
          `AND({Is_Default} = TRUE(), {Version} != "${version}")`,
          10
        );
        for (const prev of previousDefaults) {
          await updateRecord(TABLES.DOC_VERSIONS, prev.id, { Is_Default: false });
        }
      } catch (err) {
        logger.warn('Failed to update previous default version', { error: err.message });
      }
    }

    // Save branch manifest locally
    const branchDir = path.join(__dirname, 'doc-versions');
    if (!fs.existsSync(branchDir)) {
      fs.mkdirSync(branchDir, { recursive: true });
    }
    const manifestPath = path.join(branchDir, `${version}-manifest.json`);
    const manifest = {
      version,
      created: new Date().toISOString(),
      isDefault: makeDefault,
      docCount: branched,
      documents: currentDocs.map((d) => ({
        title: d.Title || d.Name,
        type: d.Type,
        component: d.Component,
        language: d.Language || 'en',
      })),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    logger.info(
      `Documentation branched for v${version}: ${branched} docs | default=${makeDefault}`
    );

    return { branched, version, makeDefault };
  } catch (err) {
    logger.error(`Failed to branch documentation for ${version}`, { error: err.message });
    return { branched: 0, version };
  }
}

// ============================================================
// Main Execution Flows
// ============================================================

/**
 * Run the daily documentation health check.
 * Detects outdated docs and broken links.
 *
 * @returns {Promise<Object>} Daily check results
 */
async function runDailyCheck() {
  logger.info('=== Docs Updater Daily Check ===');
  const startTime = Date.now();

  try {
    const outdated = await detectOutdatedDocs();
    const links = await detectBrokenLinks();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = {
      outdatedDocs: outdated.length,
      brokenLinks: links.broken?.length || 0,
      duration: `${duration}s`,
    };

    logger.info(`Daily check complete in ${duration}s`, summary);
    return summary;
  } catch (err) {
    logger.error('Daily check failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Run the weekly documentation coverage report.
 * Calculates coverage, suggests visual aids, and sends report.
 *
 * @returns {Promise<Object>} Weekly report results
 */
async function runWeeklyCoverageReport() {
  logger.info('=== Docs Updater Weekly Coverage Report ===');
  const startTime = Date.now();

  try {
    const coverage = await calculateDocCoverage();
    const visuals = await suggestVisualAids();

    // Send coverage report
    await sendCEOEmail({
      subject: `Documentation Coverage: ${coverage.overall_grade || 'N/A'} (${coverage.overallFeatureScore || 0}%)`,
      html: `
        <h1>Documentation Coverage Report</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <div style="background: ${(coverage.overallFeatureScore || 0) >= 75 ? '#e8f5e9' : (coverage.overallFeatureScore || 0) >= 50 ? '#fff8e1' : '#ffebee'}; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold;">${coverage.overall_grade || 'N/A'}</div>
              <div>Grade</div>
            </div>
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold;">${coverage.overallFeatureScore || 0}%</div>
              <div>Feature Coverage</div>
            </div>
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold;">${coverage.overallApiScore || 0}%</div>
              <div>API Coverage</div>
            </div>
          </div>

          <p>${coverage.summary || ''}</p>

          ${(coverage.undocumentedFeatures || []).length > 0
            ? `<h3>Undocumented Features (${coverage.undocumentedFeatures.length})</h3>
              <ul>${coverage.undocumentedFeatures.slice(0, 10).map((f) => `<li>${f}</li>`).join('')}</ul>`
            : '<p style="color: #2e7d32;">All features have documentation.</p>'}

          ${(coverage.critical_gaps || []).length > 0
            ? `<h3 style="color: #d32f2f;">Critical Gaps</h3>
              <ul>${coverage.critical_gaps.slice(0, 5).map((g) => `<li><strong>${g.feature_or_area}</strong>: Missing ${g.missing_doc_type} (${g.priority})</li>`).join('')}</ul>`
            : ''}

          <h3>Translation Coverage</h3>
          ${Object.entries(coverage.translationCoverage || {}).map(([lang, data]) =>
            `<div>${SUPPORTED_LANGUAGES[lang]?.name || lang}: ${data.translated}/${data.total} (${data.percentage}%)</div>`
          ).join('')}

          <h3>Visual Aids Needed</h3>
          <p>${visuals.length} documentation pages need visual improvements.</p>

          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Docs Updater Agent</p>
        </div>
      `,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Weekly coverage report complete in ${duration}s`);

    return {
      coverage,
      visualSuggestions: visuals.length,
      duration: `${duration}s`,
    };
  } catch (err) {
    logger.error('Weekly coverage report failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Main execute function - entry point for the agent.
 *
 * @param {Object} [options] - Execution options
 * @param {string} [options.workflow='daily'] - 'daily' | 'coverage' | 'translate' | 'api' | 'branch' | 'links' | 'all'
 * @param {string} [options.targetLanguage] - Target language for translation
 * @param {Array} [options.endpoints] - API endpoints for documentation
 * @param {string} [options.version] - Version for branching
 * @param {string} [options.format] - Output format for API docs
 * @returns {Promise<Object>} Execution results
 */
async function execute({
  workflow = 'daily',
  targetLanguage,
  endpoints,
  version,
  format = 'openapi',
  makeDefault = false,
} = {}) {
  logger.info(`Docs Updater executing workflow: ${workflow}`);

  const results = {};

  try {
    switch (workflow) {
      case 'daily':
        results.daily = await runDailyCheck();
        break;
      case 'coverage':
        results.coverage = await runWeeklyCoverageReport();
        break;
      case 'translate':
        results.translation = await translateDocumentation({ targetLanguage });
        break;
      case 'api':
        results.apiDocs = await generateAPIDocumentation(endpoints || [], { format, version });
        break;
      case 'branch':
        if (!version) throw new Error('Version is required for documentation branching');
        results.branch = await branchDocumentation(version, { makeDefault });
        break;
      case 'links':
        results.links = await detectBrokenLinks();
        break;
      case 'visuals':
        results.visuals = await suggestVisualAids();
        break;
      case 'outdated':
        results.outdated = await detectOutdatedDocs();
        break;
      case 'all':
        results.daily = await runDailyCheck();
        results.coverage = await calculateDocCoverage();
        results.translation = await translateDocumentation({ targetLanguage });
        results.visuals = await suggestVisualAids();
        break;
      default:
        logger.warn(`Unknown workflow: ${workflow}, running daily check`);
        results.daily = await runDailyCheck();
    }

    logger.info('Docs Updater execution complete', { workflow });
    return results;
  } catch (err) {
    logger.error('Docs Updater execution failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Daily at 05:00 - detect outdated docs and broken links
cron.schedule('0 5 * * *', () => {
  runDailyCheck().catch((err) =>
    logger.error('Cron daily check failed', { error: err.message })
  );
});

// Weekly on Fridays at 10:00 - coverage report
cron.schedule('0 10 * * 5', () => {
  runWeeklyCoverageReport().catch((err) =>
    logger.error('Cron weekly coverage report failed', { error: err.message })
  );
});

// Weekly on Sundays at 03:00 - translate documentation
cron.schedule('0 3 * * 0', () => {
  translateDocumentation().catch((err) =>
    logger.error('Cron translation failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Main entry point
  execute,

  // Workflow runners
  runDailyCheck,
  runWeeklyCoverageReport,

  // Core functions
  detectOutdatedDocs,
  generateAPIDocumentation,
  suggestVisualAids,
  translateDocumentation,
  calculateDocCoverage,
  detectBrokenLinks,
  branchDocumentation,

  // Utilities
  checkUrl,

  // Constants
  SUPPORTED_LANGUAGES,
  DOC_TYPES,
  COVERAGE_THRESHOLDS,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Docs Updater Agent starting (direct execution)');
  execute()
    .then((results) => logger.info('Docs Updater Agent initial run complete', results))
    .catch((err) => {
      logger.error('Docs Updater Agent failed', { error: err.message });
      process.exit(1);
    });
}
