/** Dependency-free equirectangular scatter of click coordinates. */
export function WorldDots({ points, height = 260 }: { points: [number, number][]; height?: number }) {
  if (!points.length) return <p className="text-sm text-muted">No geo coordinates recorded yet.</p>;
  return (
    <svg viewBox="0 0 360 180" className="w-full rounded-lg bg-bg border border-border" style={{ maxHeight: height }} role="img" aria-label="Click locations">
      {[30, 60, 90, 120, 150].map((y) => <line key={"h" + y} x1={0} x2={360} y1={y} y2={y} stroke="var(--border)" strokeWidth={0.5} />)}
      {[60, 120, 180, 240, 300].map((x) => <line key={"v" + x} y1={0} y2={180} x1={x} x2={x} stroke="var(--border)" strokeWidth={0.5} />)}
      <line x1={0} x2={360} y1={90} y2={90} stroke="var(--muted)" strokeOpacity={0.4} strokeWidth={0.6} />
      {points.map(([lat, lng], i) => <circle key={i} cx={lng + 180} cy={90 - lat} r={1.6} fill="var(--primary)" fillOpacity={0.55} />)}
    </svg>
  );
}
