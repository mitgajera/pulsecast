export function WalletAvatar({ address, size = "sm" }: { address: string; size?: "sm" | "lg" }) {
  let seed = 2166136261;
  for (const character of address) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const cells = Array.from({ length: 15 }, (_, index) => ((seed >>> (index % 24)) ^ Math.imul(index + 1, 2654435761)) >>> 0).map((value) => value % 3 !== 0);
  return <svg aria-hidden="true" className={`${size === "lg" ? "size-12" : "size-6"} shrink-0 border bg-muted text-primary`} viewBox="0 0 5 5"><rect fill="currentColor" height="5" opacity="0.12" width="5" />{Array.from({ length: 5 }, (_, row) => Array.from({ length: 3 }, (_, column) => cells[row * 3 + column] ? <g key={`${row}-${column}`}><rect fill="currentColor" height="1" width="1" x={column} y={row} />{column < 2 && <rect fill="currentColor" height="1" width="1" x={4 - column} y={row} />}</g> : null))}</svg>;
}
