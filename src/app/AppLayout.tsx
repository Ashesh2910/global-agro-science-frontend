import type { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <main id="main-content" className="app-layout__main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
