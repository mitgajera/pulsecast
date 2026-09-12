import Link from "next/link";

import { AuthControl } from "@/features/auth/auth-control";

import { BrandMark } from "./brand-mark";

export function AppHeader({ active }: { active: "market" | "profile" }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5 sm:gap-8">
          <Link className="flex min-h-11 shrink-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" href="/">
            <BrandMark className="size-7" />
            <span><span className="block text-sm font-semibold tracking-tight">PulseCast</span><span className="hidden text-[11px] text-muted-foreground sm:block">Precision markets</span></span>
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
            <HeaderLink active={active === "market"} href="/">Market</HeaderLink>
            <HeaderLink active={active === "profile"} href="/profile">Portfolio</HeaderLink>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden min-h-8 items-center border px-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-chart-4 sm:flex"><span className="mr-2 size-1.5 rounded-full bg-chart-4" aria-hidden="true" />Devnet</span>
          <AuthControl />
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) {
  return <Link aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center border-b px-3 text-sm transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} href={href}>{children}</Link>;
}
