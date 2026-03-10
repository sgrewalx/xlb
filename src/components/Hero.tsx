interface HeroProps {
  newsCount: number;
  sportsCount: number;
  modulesCount: number;
  visualsCount: number;
}

export function Hero({
  newsCount,
  sportsCount,
  modulesCount,
  visualsCount,
}: HeroProps) {
  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <div className="hero-badge">Live curiosity dashboard</div>
        <h1>XLB</h1>
        <p className="hero-tagline">Always something next.</p>
        <p className="hero-body">
          Five minutes. Stay informed. Stay entertained. The homepage is built as
          a lightweight ambient dashboard fed by static JSON and safe reviewed
          modules.
        </p>
        <div className="hero-actions">
          <a href="#news">See today’s top 3</a>
          <a href="#live-world" className="button-secondary">
            Explore world motion
          </a>
        </div>
      </div>
      <div className="hero-stack">
        <article className="hero-card hero-card-primary">
          <span>Now loading</span>
          <strong>{newsCount + sportsCount}</strong>
          <p>signal cards across news and sports</p>
        </article>
        <article className="hero-card">
          <span>Live world</span>
          <strong>{modulesCount}</strong>
          <p>pluggable modules ready for safe upgrades</p>
        </article>
        <article className="hero-card">
          <span>Visual feed</span>
          <strong>{visualsCount}</strong>
          <p>reviewed aesthetic tiles with no user uploads</p>
        </article>
      </div>
    </section>
  );
}
