import AnimatedSection from '@/components/AnimatedSection';

const competitors = [
  { name: 'Freelancer', time: '1-2 Wochen', cost: 'CHF 80-150/h', quality: 'Variabel', support: 'Limitiert' },
  { name: 'Intern', time: '3-6 Monate', cost: 'CHF 7\'000+/Mo', quality: 'Abhängig', support: 'Bürozeiten' },
  { name: 'Agentur', time: '2-4 Wochen', cost: 'CHF 5\'000+/Mo', quality: 'Hoch', support: 'Bürozeiten' },
  { name: 'Werkpilot', time: '48 Stunden', cost: 'Ab CHF 1\'500/Mo', quality: 'Premium', support: '24/7', highlight: true },
];

export default function CompetitorComparison() {
  return (
    <AnimatedSection className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: '600px' }}>
        <thead>
          <tr>
            <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Option</th>
            <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Startzeit</th>
            <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Kosten</th>
            <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Qualität</th>
            <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Support</th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((c) => (
            <tr
              key={c.name}
              className="border-t"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: c.highlight ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
              }}
            >
              <td className="p-3 font-bold" style={{ color: c.highlight ? '#2563EB' : 'var(--color-text)', fontFamily: 'var(--font-jakarta)' }}>{c.name}</td>
              <td className="p-3" style={{ color: c.highlight ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{c.time}</td>
              <td className="p-3" style={{ color: c.highlight ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{c.cost}</td>
              <td className="p-3" style={{ color: c.highlight ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{c.quality}</td>
              <td className="p-3" style={{ color: c.highlight ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{c.support}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AnimatedSection>
  );
}
