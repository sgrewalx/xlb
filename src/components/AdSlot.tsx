interface AdSlotProps {
  label: string;
  variant?: "banner" | "inline";
}

export function AdSlot({ label, variant = "inline" }: AdSlotProps) {
  return (
    <aside className={`ad-slot ad-slot-${variant}`}>
      <span>Reserved</span>
      <strong>{label}</strong>
      <p>Clean sponsor surface for future direct-sold placements.</p>
    </aside>
  );
}
