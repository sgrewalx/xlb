interface SectionHeaderProps {
  eyebrow: string;
  title?: string;
  description?: string;
  updatedAt?: string;
}

function formatTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  updatedAt,
}: SectionHeaderProps) {
  const formatted = formatTimestamp(updatedAt);

  return (
    <div className="section-header">
      <div>
        <p className="section-eyebrow">{eyebrow}</p>
        {title ? <h2>{title}</h2> : null}
      </div>
      {description || formatted ? (
        <div className="section-meta">
          {description ? <p>{description}</p> : null}
          {formatted ? <span>Updated {formatted}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
