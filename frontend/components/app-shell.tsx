import type { ReactNode } from "react";

import { Nav } from "./nav";
import { SiteFooter } from "./site-footer";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-black bg-[radial-gradient(circle_at_top,rgba(142,255,54,0.08)_0%,rgba(5,5,5,0.4)_38%,#000000_75%)] text-white">
      <div className="shell flex flex-col gap-8 py-10">
        <Nav />
        {children}
      </div>
      <SiteFooter />
    </main>
  );
}
