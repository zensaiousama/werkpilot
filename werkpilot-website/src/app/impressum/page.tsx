import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Impressum — Werkpilot',
  description:
    'Impressum und rechtliche Informationen zu Werkpilot, dem virtuellen Backoffice für Schweizer KMUs.',
};

export default function ImpressumPage() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        {/* Hero Section */}
        <section
          className="pt-32 pb-20"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h1
                className="text-5xl md:text-6xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Impressum
              </h1>
              <p
                className="text-lg"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Angaben gemäß Schweizer Recht
              </p>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="space-y-12">
                {/* Company Info */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Angaben zum Unternehmen
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <p>
                      <strong>Firmenname:</strong> Werkpilot
                    </p>
                    <p>
                      <strong>Rechtsform:</strong> Einzelfirma
                    </p>
                    <p>
                      <strong>Land:</strong> Schweiz
                    </p>
                    <p>
                      <strong>Handelsregister:</strong> Eingetragen im Handelsregister
                    </p>
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Kontakt
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <p>
                      <strong>Email:</strong>{' '}
                      <a
                        href="mailto:info@werkpilot.ch"
                        className="hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        info@werkpilot.ch
                      </a>
                    </p>
                    <p>
                      <strong>Telefon:</strong>{' '}
                      <a
                        href="tel:+41445555000"
                        className="hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        +41 44 555 50 00
                      </a>
                    </p>
                    <p>
                      <strong>Website:</strong>{' '}
                      <a
                        href="https://werkpilot.ch"
                        className="hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        werkpilot.ch
                      </a>
                    </p>
                  </div>
                </div>

                {/* Responsible */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Verantwortlich für den Inhalt
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <p>
                      Verantwortlich für den Inhalt dieser Website gemäß Schweizer
                      Recht ist Werkpilot.
                    </p>
                    <p>
                      Bei Fragen oder Anmerkungen zum Inhalt kontaktieren Sie uns
                      bitte unter:{' '}
                      <a
                        href="mailto:info@werkpilot.ch"
                        className="hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        info@werkpilot.ch
                      </a>
                    </p>
                  </div>
                </div>

                {/* MWST */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Mehrwertsteuer
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <p>
                      <strong>MWST-Nummer:</strong> CHE-XXX.XXX.XXX MWST
                    </p>
                    <p>
                      Alle Preise verstehen sich inklusive der gesetzlichen
                      Mehrwertsteuer.
                    </p>
                  </div>
                </div>

                {/* Disclaimer */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Haftungsausschluss
                  </h2>
                  <div
                    className="space-y-4 text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <div>
                      <h3
                        className="font-bold mb-2"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        Inhalt des Onlineangebotes
                      </h3>
                      <p style={{ color: 'var(--color-text-secondary)' }}>
                        Der Autor übernimmt keinerlei Gewähr für die Aktualität,
                        Korrektheit, Vollständigkeit oder Qualität der
                        bereitgestellten Informationen. Haftungsansprüche gegen den
                        Autor, die sich auf Schäden materieller oder ideeller Art
                        beziehen, welche durch die Nutzung oder Nichtnutzung der
                        dargebotenen Informationen bzw. durch die Nutzung fehlerhafter
                        und unvollständiger Informationen verursacht wurden, sind
                        grundsätzlich ausgeschlossen.
                      </p>
                    </div>

                    <div>
                      <h3
                        className="font-bold mb-2"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        Verweise und Links
                      </h3>
                      <p style={{ color: 'var(--color-text-secondary)' }}>
                        Bei direkten oder indirekten Verweisen auf fremde Webseiten
                        (&ldquo;Hyperlinks&rdquo;), die außerhalb des Verantwortungsbereiches des
                        Autors liegen, würde eine Haftungsverpflichtung ausschließlich
                        in dem Fall in Kraft treten, in dem der Autor von den Inhalten
                        Kenntnis hat und es ihm technisch möglich und zumutbar wäre,
                        die Nutzung im Falle rechtswidriger Inhalte zu verhindern.
                      </p>
                    </div>

                    <div>
                      <h3
                        className="font-bold mb-2"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        Urheber- und Kennzeichenrecht
                      </h3>
                      <p style={{ color: 'var(--color-text-secondary)' }}>
                        Der Autor ist bestrebt, in allen Publikationen die
                        Urheberrechte der verwendeten Grafiken, Tondokumente,
                        Videosequenzen und Texte zu beachten, von ihm selbst erstellte
                        Grafiken, Tondokumente, Videosequenzen und Texte zu nutzen
                        oder auf lizenzfreie Grafiken, Tondokumente, Videosequenzen
                        und Texte zurückzugreifen. Alle innerhalb des Internetangebotes
                        genannten und ggf. durch Dritte geschützten Marken- und
                        Warenzeichen unterliegen uneingeschränkt den Bestimmungen des
                        jeweils gültigen Kennzeichenrechts.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Protection */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Datenschutz
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      Informationen zum Datenschutz finden Sie in unserer{' '}
                      <Link
                        href="/datenschutz"
                        className="font-medium hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        Datenschutzerklärung
                      </Link>
                      .
                    </p>
                  </div>
                </div>

                {/* Changes */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Änderungen
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      Wir behalten uns das Recht vor, diese Angaben jederzeit ohne
                      vorherige Ankündigung zu ändern. Es gilt die jeweils aktuelle,
                      auf unserer Website publizierte Fassung.
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      <strong>Letzte Aktualisierung:</strong> Februar 2026
                    </p>
                  </div>
                </div>

                {/* Contact CTA */}
                <div
                  className="card p-8 mt-8"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <h3
                    className="text-xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Fragen?
                  </h3>
                  <p
                    className="text-base mb-4"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Bei Fragen zu diesem Impressum oder anderen rechtlichen Themen
                    kontaktieren Sie uns gerne.
                  </p>
                  <Link
                    href="/kontakt"
                    className="inline-flex items-center gap-2 font-medium hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    Kontakt aufnehmen →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
