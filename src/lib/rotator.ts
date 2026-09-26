/** Campaign rotator link selection. Modes: sequential (cookie counter), random, weighted (inverse of clicks so less-served links catch up). */
export function pickRotatorIndex(mode: string, links: { clicks: number }[], counter: number): number {
  if (!links.length) return -1;
  if (mode === "random") return Math.floor(Math.random() * links.length);
  if (mode === "weighted") {
    const weights = links.map((l) => 1 / (l.clicks + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  }
  return ((counter % links.length) + links.length) % links.length;
}
