import Link from "next/link";
import { APP_ENTRY_PATH } from "@/lib/landing/cta";
import { landingContent } from "@/lib/landing/content";
import styles from "./landing.module.css";

const WAVE_HEIGHTS = [38, 62, 48, 78, 54, 88, 42, 70, 36, 58] as const;

export function LandingPage() {
  const {
    eyebrow,
    headlineHighlight,
    headlineRest,
    subheadline,
    ctaLabel,
    features,
    stats,
    footer,
  } = landingContent;

  const revealDelays = [
    styles.revealDelay1,
    styles.revealDelay2,
    styles.revealDelay3,
    styles.revealDelay4,
  ] as const;

  return (
    <div className={styles.page}>
      <div className={`${styles.orb} ${styles.orbOne}`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orbTwo}`} aria-hidden="true" />
      <div className={styles.gridOverlay} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={`${styles.nav} ${styles.reveal}`}>
          <div className={styles.logo}>
            <span className={styles.logoMark} aria-hidden="true">
              ☎
            </span>
            <span>Simulador de Llamadas</span>
          </div>
        </header>

        <section className={styles.hero}>
          <div>
            <p className={`${styles.eyebrow} ${styles.reveal} ${styles.revealDelay1}`}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              {eyebrow}
            </p>

            <h1 className={`${styles.headline} ${styles.reveal} ${styles.revealDelay2}`}>
              <span className={styles.headlineAccent}>{headlineHighlight}</span>{" "}
              {headlineRest}
            </h1>

            <p className={`${styles.subheadline} ${styles.reveal} ${styles.revealDelay3}`}>
              {subheadline}
            </p>

            <div className={`${styles.ctaRow} ${styles.reveal} ${styles.revealDelay4}`}>
              <Link href={APP_ENTRY_PATH} className={styles.cta}>
                {ctaLabel}
                <span aria-hidden="true">→</span>
              </Link>
              <span className={styles.ctaHint}>Sin instalación · demo en el navegador</span>
            </div>
          </div>

          <div
            className={`${styles.preview} ${styles.reveal} ${styles.revealDelay3}`}
            aria-hidden="true"
          >
            <div className={styles.previewGlow} />
            <div className={styles.previewHeader}>
              <div className={styles.previewDots}>
                <span />
                <span />
                <span />
              </div>
              <span className={styles.previewStatus}>Llamada en vivo · Ronda 3</span>
            </div>

            <div className={styles.waveform}>
              {WAVE_HEIGHTS.map((height, index) => (
                <span
                  key={height}
                  className={styles.waveBar}
                  style={{
                    height: `${height}%`,
                    animationDelay: `${index * 0.08}s`,
                  }}
                />
              ))}
            </div>

            <div className={styles.transcript}>
              <div className={`${styles.bubble} ${styles.bubbleClient}`}>
                No tengo tiempo para otra demo genérica. ¿Qué miden exactamente?
              </div>
              <div className={`${styles.bubble} ${styles.bubbleYou}`}>
                Entiendo. En su sector medimos visitas a caseta y costo por lead
                calificado, no vanity metrics.
              </div>
            </div>
          </div>
        </section>

        <section className={styles.features} aria-label="Características">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`${styles.featureCard} ${styles.reveal} ${revealDelays[index] ?? styles.revealDelay4}`}
            >
              <h2 className={styles.featureTitle}>{feature.title}</h2>
              <p className={styles.featureDescription}>{feature.description}</p>
            </article>
          ))}
        </section>

        <div className={styles.stats} aria-label="Métricas del simulador">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        <footer className={styles.footer}>{footer}</footer>
      </div>
    </div>
  );
}
