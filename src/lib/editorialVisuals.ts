const GENERIC_SPORTS_VISUAL = "/media/sports/generic.svg";

const SPORTS_VISUALS: Readonly<Record<string, string>> = {
  basketball: "/media/sports/basketball.svg",
  football: "/media/sports/football.svg",
  tennis: "/media/sports/tennis.svg",
};

export function getSportsFallbackVisual(tag: string) {
  return SPORTS_VISUALS[tag.trim().toLowerCase()] ?? GENERIC_SPORTS_VISUAL;
}
