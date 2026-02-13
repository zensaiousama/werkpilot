'use client';

import { motion } from 'framer-motion';

const problems = [
  {
    title: 'Online mehr Kunden gewinnen',
    description:
      'Sie wissen, dass Sie online mehr Kunden gewinnen könnten — aber wer soll das machen?',
  },
  {
    title: 'Zeit für Ihr Kerngeschäft',
    description:
      'Administration frisst Ihre Zeit — statt dass Sie sich auf Kunden konzentrieren',
  },
  {
    title: 'Verlässliche Resultate',
    description:
      'Marketing-Agenturen sind teuer und liefern oft nicht was sie versprechen',
  },
];

export default function ProblemSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 style={{ fontFamily: 'var(--font-jakarta)' }}>Kennen Sie das?</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="card p-8"
            >
              <div
                className="w-16 h-16 rounded-full mb-6 flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-warm)', opacity: 0.1 }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
