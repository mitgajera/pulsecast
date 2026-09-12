const GRADIENT_PALETTES = [
  ["#f08eb8", "#cb2fbe", "#ff4f83"],
  ["#8196bc", "#c9e86b", "#ffd870"],
  ["#2867ad", "#d92ca8", "#f04b92"],
  ["#c9afe8", "#f1a33f", "#7892ad"],
  ["#5830d5", "#a65cda", "#efb7d7"],
] as const;

function addressSeed(address: string) {
  let seed = 2166136261;
  for (const character of address) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  return seed;
}

export function WalletAvatar({ address, size = "sm" }: { address: string; size?: "sm" | "lg" }) {
  const seed = addressSeed(address);
  const palette = GRADIENT_PALETTES[seed % GRADIENT_PALETTES.length] ?? GRADIENT_PALETTES[0];
  const angle = seed % 360;
  const glowX = 20 + ((seed >>> 8) % 61);
  const glowY = 20 + ((seed >>> 16) % 61);

  return (
    <span
      aria-hidden="true"
      className={`${size === "lg" ? "size-12" : "size-8"} shrink-0 rounded-full ring-1 ring-white/15`}
      style={{
        background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${palette[0]} 0%, transparent 56%), linear-gradient(${angle}deg, ${palette[1]} 8%, ${palette[2]} 92%)`,
      }}
    />
  );
}
