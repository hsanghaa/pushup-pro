import { useLocation } from "wouter";
import { getUserId } from "@/lib/auth";
import { Dumbbell, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChallengeInvite() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const challengerName = params.get("name") ?? "A PushUp Pro athlete";
  const firstName = challengerName.split(" ")[0];

  const alreadyLoggedIn = !!getUserId();

  const handleAccept = () => {
    setLocation(alreadyLoggedIn ? "/dashboard" : "/onboarding");
  };

  return (
    <div className="min-h-[100dvh] bg-[hsl(0_0%_4%)] flex flex-col items-center justify-center p-6 text-center">
      {/* Glow blob */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "hsl(195 100% 50%)" }}
      />

      <div className="relative z-10 max-w-sm w-full space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">PushUp Pro</span>
        </div>

        {/* Challenge headline */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
              <Flame className="w-3.5 h-3.5" /> You've Been Challenged
            </span>
          </div>
          <h1 className="text-4xl font-display font-black uppercase tracking-tight leading-none text-white">
            {firstName} wants<br />to battle you
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {challengerName} thinks they're a better athlete than you. Prove them wrong — download PushUp Pro and get your reps in.
          </p>
        </div>

        {/* Stakes */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "💪", label: "Rep Tracking", sub: "Camera-powered" },
            { icon: "🏆", label: "Leaderboard", sub: "Weekly ranking" },
            { icon: "🎯", label: "AI Coach", sub: "Real-time form" },
          ].map(item => (
            <div key={item.label} className="bg-card border border-border rounded-xl p-3">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-[11px] font-bold text-foreground leading-tight">{item.label}</div>
              <div className="text-[10px] text-muted-foreground">{item.sub}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Button
            className="w-full h-14 text-base font-bold uppercase tracking-wider"
            onClick={handleAccept}
          >
            <Trophy className="w-5 h-5 mr-2" />
            Accept the Challenge
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Free to use. No account required to start.
          </p>
        </div>
      </div>
    </div>
  );
}
