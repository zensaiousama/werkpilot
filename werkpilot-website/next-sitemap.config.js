/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://werkpilot.ch',
  generateRobotsTxt: true,
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 5000,
  exclude: [],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
  },
};
