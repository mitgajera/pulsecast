import { chartPoints } from "./fixtures";

const width = 900;
const height = 330;
const padding = 26;

function buildPath(points: number[]) {
  const min = Math.min(...points) - 8;
  const max = Math.max(...points) + 8;
  return points
    .map((value, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / (max - min)) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function PriceChartShell() {
  const path = buildPath(chartPoints);

  return (
    <div className="relative min-h-[280px] overflow-hidden border-x border-b bg-card sm:min-h-[360px]">
      <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-4 sm:inset-x-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">BTC / USD</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">$112,907.00</p>
          <p className="mt-1 text-xs text-chart-3">+$64.82 this round</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Fixture feed</p>
          <p className="mt-1 font-mono tabular-nums">100ms cadence</p>
        </div>
      </div>
      <svg
        aria-labelledby="price-chart-title price-chart-description"
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id="price-chart-title">Bitcoin price during the current round</title>
        <desc id="price-chart-description">A preview line rising from 112,790 to 112,907 dollars.</desc>
        {[90, 150, 210, 270].map((y) => (
          <line key={y} stroke="var(--border)" strokeWidth="1" x1="0" x2={width} y1={y} y2={y} />
        ))}
        <line
          stroke="var(--muted-foreground)"
          strokeDasharray="5 7"
          strokeOpacity="0.5"
          x1="600"
          x2="600"
          y1="0"
          y2={height}
        />
        <path d={path} fill="none" stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        <circle cx="874" cy="45" fill="var(--background)" r="5" stroke="var(--primary)" strokeWidth="3" />
      </svg>
      <div className="absolute bottom-3 left-[66.666%] -translate-x-1/2 bg-card px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Betting lock
      </div>
    </div>
  );
}
