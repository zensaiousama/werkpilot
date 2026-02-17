/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://werkpilot.ch',
  generateRobotsTxt: true,
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 5000,
  exclude: ['/api/*'],
  transform: async (config, path) => {
    // Higher priority for main pages
    const highPriority = ['/', '/fitness-check', '/dienstleistungen', '/preise'];
    const medPriority = ['/ueber-uns', '/kontakt', '/blog'];

    return {
      loc: path,
      changefreq: config.changefreq,
      priority: highPriority.includes(path) ? 1.0 : medPriority.includes(path) ? 0.8 : config.priority,
      lastmod: new Date().toISOString(),
    };
  },
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    additionalSitemaps: [],
  },
};
