"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6"><section className="w-full border bg-card p-6"><p className="text-xs font-medium uppercase tracking-[0.14em] text-destructive">Market unavailable</p><h1 className="mt-2 text-2xl font-semibold">The live round could not load.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your funds and predictions are unaffected. Try loading the latest market state again.</p><button className="mt-6 min-h-11 bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={reset} type="button">Try again</button></section></main>;
}
