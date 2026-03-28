import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-brand">XLB</p>
        <p className="muted">
          Source-backed live events for a curiosity-driven internet.
        </p>
      </div>
      <nav className="footer-links" aria-label="Footer">
        <Link to="/live">Live</Link>
        <Link to="/live/space">Space</Link>
        <Link to="/live/earth">Earth</Link>
        <Link to="/games">Games</Link>
        <Link to="/gallery">Gallery</Link>
        <Link to="/sports">Sports</Link>
        <Link to="/news">News</Link>
        <Link to="/about">About</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/advertise">Advertise</Link>
      </nav>
    </footer>
  );
}
