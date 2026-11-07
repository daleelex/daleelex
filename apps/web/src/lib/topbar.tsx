import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const TopBarSlotContext = createContext<HTMLElement | null>(null);

export const TopBarSlotProvider = TopBarSlotContext.Provider;

// Pages own their own actions ("Register service", "Add team") without owning a
// topbar of their own — they portal them into the one slot the shell renders.
export function TopBarActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
}
