import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { Zap } from "lucide-react";

export default function Home() {
  return (
    <AppLayout showNav={false}>
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center bg-card/50">
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full gap-8">
          <div className="w-24 h-24 bg-primary rounded-2xl flex items-center justify-center rotate-3 shadow-[0_0_40px_rgba(212,255,0,0.3)]">
            <Zap className="w-12 h-12 text-primary-foreground -rotate-3" fill="currentColor" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-display font-bold uppercase tracking-tight leading-none">
              PushUp <br /><span className="text-primary">Pro</span>
            </h1>
            <p className="text-muted-foreground text-lg font-medium">
              The camera-powered coach that counts every rep. 
            </p>
          </div>

          <div className="w-full space-y-4 mt-8">
            <Link href="/onboarding" className="w-full">
              <Button size="lg" className="w-full h-14 text-lg font-display uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              No equipment needed
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
