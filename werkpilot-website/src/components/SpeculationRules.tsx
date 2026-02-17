export default function SpeculationRules() {
  const rules = {
    prerender: [
      {
        where: {
          and: [
            { href_matches: '/*' },
            { not: { href_matches: '/api/*' } },
            { not: { href_matches: '/_next/*' } },
            { not: { selector_matches: '[rel=nofollow]' } },
          ],
        },
        eagerness: 'moderate',
      },
    ],
    prefetch: [
      {
        where: {
          and: [
            { href_matches: '/*' },
            { not: { href_matches: '/api/*' } },
          ],
        },
        eagerness: 'moderate',
      },
    ],
  };

  return (
    <script
      type="speculationrules"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }}
    />
  );
}
