import type { Metadata } from "next";
import { AccountDashboard } from "@/features/account/account-dashboard";
import { AppFooter } from "@/features/brand/app-footer";
import { AppHeader } from "@/features/brand/app-header";

export const metadata: Metadata = { title: "Account" };

export default function ProfilePage() {
  return <div className="flex h-dvh flex-col overflow-hidden"><AppHeader active="profile" /><main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8"><div className="mb-3 shrink-0"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Portfolio</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Your account</h1></div><AccountDashboard /></main><AppFooter /></div>;
}
