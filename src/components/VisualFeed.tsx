import { CSSProperties, useState } from "react";

interface PosterSeries {
  id: string;
  title: string;
  label: string;
  caption: string;
  palettes: Array<{
    primary: string;
    secondary: string;
    glow: string;
    angle: string;
  }>;
}

const POSTER_SERIES: PosterSeries[] = [
  {
    id: "night-grid",
    title: "Night Grid",
    label: "City pulse",
    caption: "Procedural density and streetlight drift.",
    palettes: [
      { primary: "#59f0d0", secondary: "#0a1f3a", glow: "#5ea0ff", angle: "135deg" },
      { primary: "#ffd86b", secondary: "#1c1037", glow: "#ff7e56", angle: "155deg" },
      { primary: "#9af3ff", secondary: "#07111f", glow: "#7cf6d4", angle: "125deg" },
    ],
  },
  {
    id: "tidal-form",
    title: "Tidal Form",
    label: "Coastline",
    caption: "Wave geometry, horizon fade, no source feed required.",
    palettes: [
      { primary: "#8ed8ff", secondary: "#08172a", glow: "#7cf6d4", angle: "160deg" },
      { primary: "#f6c28b", secondary: "#271423", glow: "#ffd0c0", angle: "145deg" },
      { primary: "#b1c8ff", secondary: "#111a3b", glow: "#5ea0ff", angle: "130deg" },
    ],
  },
  {
    id: "editorial-run",
    title: "Editorial Run",
    label: "Studio motion",
    caption: "Typography-led poster studies generated from local parameters.",
    palettes: [
      { primary: "#ffffff", secondary: "#0a0d16", glow: "#ff7e56", angle: "140deg" },
      { primary: "#eef6ff", secondary: "#17112b", glow: "#5ea0ff", angle: "120deg" },
      { primary: "#ffe7d8", secondary: "#1c1620", glow: "#7cf6d4", angle: "150deg" },
    ],
  },
];

function getPosterStyle(seriesIndex: number, paletteIndex: number) {
  const palette = POSTER_SERIES[seriesIndex].palettes[paletteIndex];

  return {
    "--poster-primary": palette.primary,
    "--poster-secondary": palette.secondary,
    "--poster-glow": palette.glow,
    "--poster-angle": palette.angle,
  } as CSSProperties;
}

export function VisualFeed() {
  const [variantSeed, setVariantSeed] = useState(0);

  return (
    <section id="visuals" className="section-block">
      <div className="games-header gallery-header">
        <p className="section-eyebrow">Gallery</p>
        <p className="games-mode-label">Poster Lab</p>
      </div>
      <div className="gallery-grid">
        {POSTER_SERIES.map((series, index) => {
          const paletteIndex = (variantSeed + index) % series.palettes.length;

          return (
            <article className="card gallery-card" key={series.id}>
              <div className="gallery-poster" style={getPosterStyle(index, paletteIndex)}>
                <div className="gallery-poster-frame">
                  <span>{series.label}</span>
                  <strong>{series.title}</strong>
                  <small>XLB / poster lab / {String(paletteIndex + 1).padStart(2, "0")}</small>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="gallery-actions">
        <button
          className="ghost-button"
          onClick={() => setVariantSeed((current) => (current + 1) % 3)}
          type="button"
        >
          Shuffle set
        </button>
      </div>
    </section>
  );
}
