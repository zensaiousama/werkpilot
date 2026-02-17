/**
 * Test Marketing Agents Integration
 *
 * Quick tests to verify the upgraded marketing agents work correctly.
 * Run with: node test-marketing-agents.js
 */

const contentEngine = require('./content-engine');
const seoOptimizer = require('./seo-optimizer');
const socialMedia = require('./social-media');

async function testContentEngine() {
  console.log('\n═══ Testing Content Engine (Agent 12) ═══\n');

  try {
    // Test image alt-text generation
    console.log('1. Testing image alt-text generation...');
    const altTexts = await contentEngine.generateImageAltText({
      title: 'SEO für KMU Schweiz',
      industry: 'general',
      target_keyword: 'seo kmu schweiz',
    }, 3);
    console.log(`✓ Generated ${altTexts.length} alt-text suggestions`);
    console.log(`  Example: "${altTexts[0]?.alt}"`);

    // Test internal linking suggestions
    console.log('\n2. Testing internal link suggestions...');
    const mockExistingArticles = [
      { title: 'Google My Business optimieren', slug: 'google-my-business', keywords: 'lokales seo, google maps' },
      { title: 'Content Marketing für KMU', slug: 'content-marketing-kmu', keywords: 'content, blog' },
    ];
    const linkSuggestions = await contentEngine.generateInternalLinkSuggestions(
      'SEO für KMU ist wichtig für lokale Sichtbarkeit. Google My Business spielt dabei eine zentrale Rolle...',
      mockExistingArticles,
      'seo kmu schweiz'
    );
    console.log(`✓ Generated ${linkSuggestions.length} internal link suggestions`);
    if (linkSuggestions.length > 0) {
      console.log(`  Example: "${linkSuggestions[0]?.anchor_text}" → /${linkSuggestions[0]?.target_slug}`);
    }

    console.log('\n✓ Content Engine tests passed!\n');
  } catch (error) {
    console.error('✗ Content Engine test failed:', error.message);
  }
}

async function testSEOOptimizer() {
  console.log('\n═══ Testing SEO Optimizer (Agent 13) ═══\n');

  try {
    // Test keyword density analysis
    console.log('1. Testing keyword density analysis...');
    const mockContent = `
      SEO für KMU Schweiz ist entscheidend für online Erfolg. Lokales SEO hilft Schweizer KMU,
      in ihrer Region gefunden zu werden. Mit der richtigen SEO-Strategie können KMU ihre
      Sichtbarkeit massiv steigern. SEO umfasst On-Page-Optimierung, technisches SEO und
      Content-Marketing. Für Schweizer KMU ist lokales SEO besonders wichtig.
    `;
    const density = await seoOptimizer.analyzeKeywordDensity(mockContent, [
      'seo kmu schweiz',
      'lokales seo',
      'kmu',
    ]);
    console.log(`✓ Analyzed ${Object.keys(density.keywords).length} keywords`);
    console.log(`  Total words: ${density.total_words}`);
    console.log(`  "seo kmu schweiz": ${density.keywords['seo kmu schweiz']?.density}% (${density.keywords['seo kmu schweiz']?.status})`);

    // Test Swiss SEO analysis
    console.log('\n2. Testing Swiss SEO analysis...');
    const swissSEO = await seoOptimizer.analyzeSwissSEO('https://werkpilot.ch');
    console.log(`✓ Swiss SEO analysis complete`);
    console.log(`  Priority actions: ${swissSEO.priority_actions?.length || 0}`);
    if (swissSEO.priority_actions && swissSEO.priority_actions.length > 0) {
      console.log(`  Top action: ${swissSEO.priority_actions[0]}`);
    }

    // Test page speed insights
    console.log('\n3. Testing page speed insights...');
    const speedInsights = await seoOptimizer.generatePageSpeedInsights('https://werkpilot.ch');
    console.log(`✓ Page speed analysis complete`);
    console.log(`  Performance score: ${speedInsights.metrics?.performance_score}/100`);
    console.log(`  Overall grade: ${speedInsights.overall_grade}`);
    console.log(`  Recommendations: ${speedInsights.recommendations?.length || 0}`);

    console.log('\n✓ SEO Optimizer tests passed!\n');
  } catch (error) {
    console.error('✗ SEO Optimizer test failed:', error.message);
  }
}

async function testSocialMedia() {
  console.log('\n═══ Testing Social Media (Agent 14) ═══\n');

  try {
    // Test platform adaptation
    console.log('1. Testing platform-specific content adaptation...');
    const variants = await socialMedia.adaptContentForPlatforms(
      'Neue Studie zeigt: 73% der Schweizer KMU haben noch keine optimierte Website. Wie steht es um Ihre digitale Präsenz?',
      {
        topic: 'KMU Digitalisierung Schweiz',
        industry: 'general',
        targetAudience: 'Swiss business owners',
        cta: 'Jetzt Fitness-Check machen',
        url: 'https://werkpilot.ch/fitness-check',
        language: 'de',
      }
    );
    console.log(`✓ Generated variants for ${Object.keys(variants).filter(k => !k.includes('strategy')).length} platforms`);
    console.log(`  LinkedIn: ${variants.linkedin?.char_count} chars, ${variants.linkedin?.hashtags?.length} hashtags`);
    console.log(`  Instagram: ${variants.instagram?.char_count} chars, ${variants.instagram?.hashtags?.length} hashtags`);
    console.log(`  Twitter: ${variants.twitter?.char_count} chars`);

    // Test Swiss hashtag generation
    console.log('\n2. Testing Swiss hashtag optimization...');
    const hashtags = await socialMedia.generateSwissHashtags(
      'Digitalisierung KMU',
      'instagram',
      'general',
      'de'
    );
    console.log(`✓ Generated ${hashtags.hashtags?.length || 0} optimized hashtags`);
    console.log(`  Primary tags: ${hashtags.primary_tags?.join(', ')}`);

    // Test posting schedule
    console.log('\n3. Testing posting schedule generation...');
    const schedule = socialMedia.generatePostingSchedule(7, ['linkedin', 'instagram', 'twitter']);
    console.log(`✓ Generated ${schedule.length} scheduled posts`);
    console.log(`  Example: ${schedule[0]?.day} ${schedule[0]?.time} on ${schedule[0]?.platform}`);

    // Test A/B variants
    console.log('\n4. Testing A/B variant generation...');
    const abTest = await socialMedia.generateABVariants(
      { text: 'Ihre Website kostet Sie Kunden. Hier ist warum.', hashtags: ['#swissKMU'] },
      'linkedin',
      'hook'
    );
    console.log(`✓ Generated ${abTest.variants?.length || 0} A/B test variants`);
    console.log(`  Test hypothesis: ${abTest.test_hypothesis}`);
    if (abTest.variants && abTest.variants.length > 0) {
      console.log(`  Variant A: ${abTest.variants[0]?.name}`);
      console.log(`  Variant B: ${abTest.variants[1]?.name}`);
    }

    console.log('\n✓ Social Media tests passed!\n');
  } catch (error) {
    console.error('✗ Social Media test failed:', error.message);
  }
}

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Marketing Agents Integration Test Suite                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await testContentEngine();
  await testSEOOptimizer();
  await testSocialMedia();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   All Tests Complete!                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Next steps:');
  console.log('1. Start agents: node content-engine.js (or seo-optimizer.js, social-media.js)');
  console.log('2. Check output/ directory for generated content');
  console.log('3. Review Airtable for stored records');
  console.log('4. Monitor dashboard for real-time metrics\n');
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };
