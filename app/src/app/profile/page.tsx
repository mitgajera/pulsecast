import type { Metadata } from "next";
import { AccountDashboard } from "@/features/account/account-dashboard";
import { AppHeader } from "@/features/brand/app-header";

export const metadata: Metadata = { title: "Account" };

export default function ProfilePage() {
  return <div className="min-h-screen"><AppHeader active="profile" /><main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8"><div className="mb-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Portfolio</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Your account</h1></div><AccountDashboard /></main></div>;
}
