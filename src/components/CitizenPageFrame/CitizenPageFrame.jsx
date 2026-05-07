import styles from './CitizenPageFrame.module.css';

export default function CitizenPageFrame({
  title,
  subtitle,
  icon: Icon,
  badge,
  tabs,
  activeTab,
  onTabChange,
  heroTitle,
  heroText,
  primaryAction,
  secondaryAction,
  stats = [],
  cards = [],
  sections = [],
  children,
}) {
  return (
    <div className={styles.page}>
      <div className={styles.stickyBar}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.pageTitle}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {badge && <span className={styles.badge}>{badge}</span>}
        </div>

        {tabs?.length > 0 && (
          <div className={styles.tabs} role="tablist">
            {tabs.map(tab => {
              const key = typeof tab === 'string' ? tab : tab.key;
              const label = typeof tab === 'string' ? tab : tab.label;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeTab === key}
                  className={`${styles.tabBtn} ${activeTab === key ? styles.active : ''}`}
                  onClick={() => onTabChange?.(key)}
                >
                  <span className={styles.tabLabel}>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <section className={styles.hero}>
          {Icon && (
            <div className={styles.heroIcon}>
              <Icon size={30} weight="duotone" />
            </div>
          )}
          <div className={styles.heroCopy}>
            <h2>{heroTitle}</h2>
            <p>{heroText}</p>
            {(primaryAction || secondaryAction) && (
              <div className={styles.actions}>
                {primaryAction && <button className={styles.primaryAction}>{primaryAction}</button>}
                {secondaryAction && <button className={styles.secondaryAction}>{secondaryAction}</button>}
              </div>
            )}
          </div>
        </section>

        {stats.length > 0 && (
          <section className={styles.statsGrid}>
            {stats.map(({ label, value, tone = 'blue' }) => (
              <div key={label} className={`${styles.statCard} ${styles[tone] ?? ''}`}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>
        )}

        {cards.length > 0 && (
          <section className={styles.cardGrid}>
            {cards.map(({ title: cardTitle, body, meta, icon: CardIcon }) => (
              <article key={cardTitle} className={styles.infoCard}>
                {CardIcon && <CardIcon size={20} weight="fill" color="var(--brand)" />}
                <div>
                  <h3>{cardTitle}</h3>
                  <p>{body}</p>
                  {meta && <span>{meta}</span>}
                </div>
              </article>
            ))}
          </section>
        )}

        {sections.length > 0 && sections.map((section) => (
          <section key={section.title} className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <div>
                <h3>{section.title}</h3>
                {section.description && <p>{section.description}</p>}
              </div>
              {section.badge && <span className={styles.sectionBadge}>{section.badge}</span>}
            </div>

            <div
              className={styles.sectionGrid}
              style={{ '--section-columns': section.columns ?? 2 }}
            >
              {(section.cards ?? []).map((card) => (
                <article key={card.title} className={styles.sectionCard}>
                  {card.kicker && <div className={styles.sectionKicker}>{card.kicker}</div>}
                  <div className={styles.sectionTop}>
                    <div>
                      <h4>{card.title}</h4>
                      {card.body && <p>{card.body}</p>}
                    </div>
                    {card.value && (
                      <div className={`${styles.sectionValue} ${card.tone ? styles[card.tone] ?? '' : ''}`}>
                        {card.value}
                      </div>
                    )}
                  </div>

                  {Array.isArray(card.rows) && card.rows.length > 0 && (
                    <div className={styles.sectionRows}>
                      {card.rows.map((row) => (
                        <div key={`${card.title}-${row.label}`} className={styles.sectionRow}>
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(card.bullets) && card.bullets.length > 0 && (
                    <ul className={styles.sectionBullets}>
                      {card.bullets.map((bullet) => <li key={`${card.title}-${bullet}`}>{bullet}</li>)}
                    </ul>
                  )}

                  {card.meta && <span className={styles.sectionMeta}>{card.meta}</span>}
                </article>
              ))}
            </div>
          </section>
        ))}

        {children}
      </div>
    </div>
  );
}
