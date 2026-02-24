import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — Werkpilot',
  description:
    'Datenschutzerklärung von Werkpilot. Erfahren Sie, wie wir Ihre Daten schützen und verarbeiten gemäss Schweizer DSG und EU DSGVO.',
};

export default function DatenschutzPage() {
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
                Datenschutzerklärung
              </h1>
              <p
                className="text-lg"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Diese
                Datenschutzerklärung informiert Sie über die Art, den Umfang und die
                Zwecke der Verarbeitung personenbezogener Daten.
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
                {/* Introduction */}
                <div
                  className="card p-8"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <h2
                    className="text-xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Zusammenfassung
                  </h2>
                  <ul className="space-y-2 text-base" style={{ color: 'var(--color-text)' }}>
                    <li className="flex items-start gap-2">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="flex-shrink-0 mt-1"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                          fill="var(--color-success)"
                        />
                      </svg>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Ihre Daten bleiben in der Schweiz
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="flex-shrink-0 mt-1"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                          fill="var(--color-success)"
                        />
                      </svg>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Wir geben keine Daten an Dritte weiter
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="flex-shrink-0 mt-1"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                          fill="var(--color-success)"
                        />
                      </svg>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Sie haben jederzeit Zugriff auf Ihre Daten
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="flex-shrink-0 mt-1"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                          fill="var(--color-success)"
                        />
                      </svg>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Alle Daten werden verschlüsselt übertragen
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Responsible Party */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    1. Verantwortliche Stelle
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>
                      Verantwortlich für die Datenverarbeitung auf dieser Website ist:
                    </p>
                    <p>
                      <strong style={{ color: 'var(--color-text)' }}>Werkpilot</strong>
                      <br />
                      Schweiz
                      <br />
                      Email:{' '}
                      <a
                        href="mailto:datenschutz@werkpilot.ch"
                        className="hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        datenschutz@werkpilot.ch
                      </a>
                    </p>
                  </div>
                </div>

                {/* Data Collection */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    2. Erhebung und Speicherung personenbezogener Daten
                  </h2>
                  <div
                    className="space-y-4 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <div>
                      <h3
                        className="font-bold mb-2"
                        style={{ color: 'var(--color-text)' }}
                      >
                        2.1 Besuch unserer Website
                      </h3>
                      <p>
                        Bei jedem Zugriff auf unsere Website werden automatisch
                        folgende Informationen in Server-Logfiles gespeichert:
                      </p>
                      <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                        <li>IP-Adresse des anfragenden Rechners</li>
                        <li>Datum und Uhrzeit des Zugriffs</li>
                        <li>Name und URL der abgerufenen Datei</li>
                        <li>Website, von der aus der Zugriff erfolgt (Referrer-URL)</li>
                        <li>Verwendeter Browser und ggf. das Betriebssystem</li>
                      </ul>
                      <p className="mt-2">
                        Diese Daten werden ausschliesslich zur Sicherstellung eines
                        störungsfreien Betriebs der Seite verwendet und nach 7 Tagen
                        gelöscht.
                      </p>
                    </div>

                    <div>
                      <h3
                        className="font-bold mb-2"
                        style={{ color: 'var(--color-text)' }}
                      >
                        2.2 Kontaktformular
                      </h3>
                      <p>
                        Wenn Sie unser Kontaktformular nutzen, werden die von Ihnen
                        eingegebenen Daten (Name, Email, Unternehmen, Telefon,
                        Nachricht) gespeichert, um Ihre Anfrage zu bearbeiten. Diese
                        Daten werden nicht an Dritte weitergegeben.
                      </p>
                    </div>

                    <div>
                      <h3
                        className="font-bold mb-2"
                        style={{ color: 'var(--color-text)' }}
                      >
                        2.3 Fitness-Check
                      </h3>
                      <p>
                        Die im Fitness-Check eingegebenen Informationen werden
                        verwendet, um Ihnen eine personalisierte Empfehlung zu geben.
                        Sie können wählen, ob Sie diese Daten für spätere
                        Kontaktaufnahmen speichern möchten.
                      </p>
                    </div>

                    <div>
                      <h3
                        className="font-bold mb-2"
                        style={{ color: 'var(--color-text)' }}
                      >
                        2.4 Kundenportal
                      </h3>
                      <p>
                        Als Kunde speichern wir die zur Vertragsabwicklung notwendigen
                        Daten (Kontaktdaten, Rechnungsdaten, Nutzungsdaten). Diese
                        Daten werden für die Dauer der Geschäftsbeziehung plus
                        gesetzliche Aufbewahrungsfristen gespeichert.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Usage */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    3. Zweck der Datenverarbeitung
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>Wir verarbeiten Ihre Daten ausschliesslich für folgende Zwecke:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Bereitstellung und Optimierung unserer Website</li>
                      <li>Beantwortung von Anfragen</li>
                      <li>Vertragsabwicklung und Kundenservice</li>
                      <li>Erfüllung gesetzlicher Aufbewahrungspflichten</li>
                      <li>Analyse und Verbesserung unserer Dienstleistungen</li>
                    </ul>
                  </div>
                </div>

                {/* Cookies */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    4. Cookies und Tracking
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>
                      Unsere Website verwendet technisch notwendige Cookies, um die
                      Funktionalität der Website zu gewährleisten. Diese Cookies
                      speichern keine persönlichen Daten.
                    </p>
                    <p>
                      Wir verwenden keine Tracking-Tools von Drittanbietern und setzen
                      keine Werbe-Cookies ein.
                    </p>
                  </div>
                </div>

                {/* Data Security */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    5. Datensicherheit
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>
                      Wir treffen umfassende Sicherheitsmassnahmen, um Ihre Daten vor
                      unbefugtem Zugriff, Verlust oder Missbrauch zu schützen:
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>SSL/TLS-Verschlüsselung für alle Datenübertragungen</li>
                      <li>Server-Standort ausschliesslich in der Schweiz</li>
                      <li>Regelmässige Sicherheits-Audits</li>
                      <li>Zugriffsbeschränkungen und Authentifizierung</li>
                      <li>Verschlüsselte Datenspeicherung</li>
                      <li>Regelmässige Backups</li>
                    </ul>
                  </div>
                </div>

                {/* Data Sharing */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    6. Weitergabe von Daten
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>
                      Wir geben Ihre Daten nicht an Dritte weiter, ausser:
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Sie haben ausdrücklich eingewilligt</li>
                      <li>Es besteht eine gesetzliche Verpflichtung</li>
                      <li>Es ist zur Vertragserfüllung notwendig</li>
                    </ul>
                    <p className="mt-2">
                      Wir verkaufen Ihre Daten niemals und nutzen sie nicht für
                      Werbezwecke Dritter.
                    </p>
                  </div>
                </div>

                {/* Your Rights */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    7. Ihre Rechte
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>Sie haben jederzeit das Recht auf:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>
                        <strong style={{ color: 'var(--color-text)' }}>Auskunft:</strong>{' '}
                        Information über Ihre gespeicherten Daten
                      </li>
                      <li>
                        <strong style={{ color: 'var(--color-text)' }}>Berichtigung:</strong>{' '}
                        Korrektur falscher Daten
                      </li>
                      <li>
                        <strong style={{ color: 'var(--color-text)' }}>Löschung:</strong>{' '}
                        Entfernung Ihrer Daten (soweit keine gesetzlichen
                        Aufbewahrungspflichten bestehen)
                      </li>
                      <li>
                        <strong style={{ color: 'var(--color-text)' }}>
                          Einschränkung:
                        </strong>{' '}
                        Einschränkung der Datenverarbeitung
                      </li>
                      <li>
                        <strong style={{ color: 'var(--color-text)' }}>
                          Datenübertragbarkeit:
                        </strong>{' '}
                        Export Ihrer Daten in einem gängigen Format
                      </li>
                      <li>
                        <strong style={{ color: 'var(--color-text)' }}>Widerspruch:</strong>{' '}
                        Widerspruch gegen die Datenverarbeitung
                      </li>
                    </ul>
                    <p className="mt-4">
                      Zur Ausübung Ihrer Rechte kontaktieren Sie uns bitte unter:{' '}
                      <a
                        href="mailto:datenschutz@werkpilot.ch"
                        className="font-medium hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        datenschutz@werkpilot.ch
                      </a>
                    </p>
                  </div>
                </div>

                {/* Retention */}
                <div>
                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    8. Speicherdauer
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>Wir speichern Ihre Daten nur so lange wie notwendig:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Anfragen: Bis zur vollständigen Bearbeitung, dann Löschung</li>
                      <li>
                        Vertragsdaten: Dauer der Geschäftsbeziehung + 10 Jahre
                        (gesetzliche Aufbewahrungspflicht)
                      </li>
                      <li>Log-Daten: 7 Tage</li>
                      <li>
                        Marketing-Einwilligungen: Bis zum Widerruf oder Beendigung der
                        Geschäftsbeziehung
                      </li>
                    </ul>
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
                    9. Änderungen der Datenschutzerklärung
                  </h2>
                  <div
                    className="space-y-2 text-base"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <p>
                      Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um
                      sie an geänderte Rechtslagen oder Änderungen unserer
                      Dienstleistungen anzupassen. Es gilt die jeweils aktuelle, auf
                      unserer Website veröffentlichte Fassung.
                    </p>
                    <p>
                      <strong style={{ color: 'var(--color-text)' }}>
                        Stand:
                      </strong>{' '}
                      Februar 2026
                    </p>
                  </div>
                </div>

                {/* Contact CTA */}
                <div
                  className="card p-8"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <h3
                    className="text-xl font-bold mb-4"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Fragen zum Datenschutz?
                  </h3>
                  <p
                    className="text-base mb-4"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Bei Fragen zur Verarbeitung Ihrer Daten oder zur Ausübung Ihrer
                    Rechte kontaktieren Sie uns gerne direkt.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <a
                      href="mailto:datenschutz@werkpilot.ch"
                      className="btn btn-primary"
                    >
                      Email senden
                    </a>
                    <Link href="/kontakt" className="btn btn-secondary">
                      Kontaktformular
                    </Link>
                  </div>
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
