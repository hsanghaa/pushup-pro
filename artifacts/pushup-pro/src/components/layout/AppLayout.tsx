import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      <main className={`flex-1 flex flex-col w-full max-w-md mx-auto relative ${showNav ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : ""}`}>
        {children}
      </main>
      {showNav && (
        <div className="w-full max-w-md mx-auto fixed bottom-0 left-1/2 -translate-x-1/2 z-50">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
