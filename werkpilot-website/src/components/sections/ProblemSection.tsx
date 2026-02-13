const problems = [
  {
    title: '3 verpasste Anfragen pro Tag',
    description:
      'Ohne aktives Online-Marketing gehen täglich durchschnittlich 3 qualifizierte Anfragen an Ihre Konkurrenz — das sind über 90 verlorene Kunden pro Monat.',
  },
  {
    title: "20 Stunden verschwendet pro Woche",
    description:
      "Administrative Aufgaben fressen Ihre wertvollste Ressource: Ihre Zeit. Das sind über 1'000 Stunden pro Jahr, die Sie in Ihr Kerngeschäft investieren könnten.",
  },
  {
    title: "CHF 15'000 verschenktes Potenzial",
    description:
      "Schweizer KMUs ohne automatisiertes Marketing verlieren durchschnittlich CHF 15'000 pro Monat an potenziellem Umsatz.",
  },
];

export default function ProblemSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 style={{ fontFamily: 'var(--font-jakarta)' }}>Was Sie gerade verpassen</h2>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-text-secondary)', maxWidth: '640px', margin: '1rem auto 0' }}
          >
            Jeden Tag ohne optimierte Online-Präsenz kostet Sie bares Geld
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {problems.map((problem, index) => (
            <div key={index} className="card p-8">
              <div
                className="w-16 h-16 rounded-full mb-6 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(212, 118, 10, 0.1)' }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 3l4 4m0 0l4 4m-4-4l4-4M7 7l-4 4m14-8v10m0 0l-3-3m3 3l3-3M21 21H3"
                    stroke="var(--color-warm)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3
                className="mb-4"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                {problem.title}
              </h3>
              <p style={{ color: 'var(--color-text-secondary)' }}>{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
