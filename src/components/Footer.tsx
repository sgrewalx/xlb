import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-brand">XLB</p>
        <p className="muted">
          A little bit of everything. Nothing overwhelming. Just take it easy.
        </p>
      </div>
      <nav className="footer-links" aria-label="Footer">
        <Link to="/about">About</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/advertise">Advertise</Link>
      </nav>
    </footer>
  );
}
