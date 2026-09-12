"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshMarketsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      aria-busy={pending}
      className="min-h-11 border bg-background px-4 text-sm font-medium transition-colors duration-100 hover:bg-accent active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:text-muted-foreground"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      type="button"
    >
      {pending ? "Checking devnet…" : "Check for new round"}
    </button>
  );
}
