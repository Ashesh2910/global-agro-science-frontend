import type { ReactNode } from "react";

type GlobalProvidersProps = {
  children: ReactNode;
};

export function GlobalProviders({ children }: GlobalProvidersProps) {
  return children;
}
