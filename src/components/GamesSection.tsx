import { startTransition, useEffect, useMemo, useState } from "react";
import { SectionHeader } from "./SectionHeader";

const TILE_COUNT = 9;

function nextTile(excluding?: number) {
  let value = Math.floor(Math.random() * TILE_COUNT);

  while (value === excluding) {
    value = Math.floor(Math.random() * TILE_COUNT);
  }

  return value;
}

export default function GamesSection() {
  const [sequence, setSequence] = useState<number[]>([nextTile()]);
  const [progress, setProgress] = useState(0);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [isShowing, setIsShowing] = useState(true);
  const [status, setStatus] = useState("Watch the pattern.");
  const [best, setBest] = useState(1);

  useEffect(() => {
    setIsShowing(true);
    setProgress(0);
    setStatus("Watch the pattern.");

    const timeouts: number[] = [];

    sequence.forEach((tile, index) => {
      timeouts.push(
        window.setTimeout(() => setFlashIndex(tile), 500 + index * 650),
      );
      timeouts.push(
        window.setTimeout(() => setFlashIndex(null), 880 + index * 650),
      );
    });

    timeouts.push(
      window.setTimeout(() => {
        setIsShowing(false);
        setStatus("Repeat the pattern.");
      }, 550 + sequence.length * 650),
    );

    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [sequence]);

  const tiles = useMemo(() => Array.from({ length: TILE_COUNT }, (_, i) => i), []);

  function resetGame() {
    startTransition(() => {
      setSequence([nextTile()]);
      setProgress(0);
      setIsShowing(true);
      setStatus("Watch the pattern.");
    });
  }

  function handleTilePress(tile: number) {
    if (isShowing) {
      return;
    }

    setFlashIndex(tile);
    window.setTimeout(() => setFlashIndex(null), 220);

    if (tile !== sequence[progress]) {
      setBest((current) => Math.max(current, sequence.length));
      setStatus("Missed. Pattern reset.");
      startTransition(() => setSequence([nextTile(tile)]));
      return;
    }

    if (progress === sequence.length - 1) {
      const nextLength = sequence.length + 1;
      setBest((current) => Math.max(current, nextLength));
      setStatus("Clean round. Next pattern.");
      startTransition(() =>
        setSequence((current) => [
          ...current,
          nextTile(current[current.length - 1]),
        ]),
      );
      return;
    }

    setProgress((current) => current + 1);
  }

  return (
    <section id="games" className="section-block">
      <SectionHeader
        eyebrow="Play"
        title="Micro games"
        description="Optional, modular, low-friction play. The MVP ships one local puzzle and room for more."
      />
      <div className="games-grid">
        <article className="card game-card">
          <div className="card-chip-row">
            <span className="chip">Signal Flip</span>
            <span className="muted">Best round {best}</span>
          </div>
          <h3>Repeat the glowing pattern.</h3>
          <p>{status}</p>
          <div className="game-board">
            {tiles.map((tile) => (
              <button
                className={`game-tile ${flashIndex === tile ? "is-active" : ""}`}
                key={tile}
                onClick={() => handleTilePress(tile)}
                type="button"
                aria-label={`Tile ${tile + 1}`}
              />
            ))}
          </div>
          <button className="ghost-button" onClick={resetGame} type="button">
            Reset
          </button>
        </article>

        <article className="card game-card game-card-secondary">
          <span className="chip">Future modules</span>
          <h3>Reserved slots for chess, go, and daily puzzles.</h3>
          <p>
            Each game can be toggled from a manifest later without changing the
            homepage structure.
          </p>
          <ul className="future-list">
            <li>Static wasm or iframe-safe chess board</li>
            <li>Curated daily puzzle manifest</li>
            <li>Feature flags for regional or sponsor-led games</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
