'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '1',
    title: 'Gratis Analyse',
    description:
      'Wir analysieren Ihre Online-Präsenz und zeigen Ihnen konkret wo Sie Kunden verlieren',
  },
  {
    number: '2',
    title: 'Massgeschneiderter Plan',
    description:
      'Sie wählen was Sie brauchen: Kunden gewinnen, Effizienz, oder Wachstum',
  },
  {
    number: '3',
    title: 'Wir legen los',
    description:
      'Innerhalb von 48h arbeitet Ihr Werkpilot-Team für Sie — messbar und transparent',
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="section"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 style={{ fontFamily: 'var(--font-jakarta)' }}>So funktioniert&apos;s</h2>
          <p
            className="text-xl mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            In 3 einfachen Schritten zu Ihrem virtuellen Backoffice
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="flex flex-col md:flex-row gap-8 mb-12 items-start"
            >
              <div
                className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                  fontFamily: 'var(--font-jakarta)',
                }}
              >
                {step.number}
              </div>
              <div className="flex-1 pt-2">
                <h3
                  className="mb-3"
                  style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                >
                  {step.title}
                </h3>
                <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
