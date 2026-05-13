import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import { useGetUserBadges, getGetUserBadgesQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Lock, CheckCircle } from "lucide-react";

const BADGE_ICONS: Record<string, string> = {
  first_workout: "01",
  total_100: "100",
  total_500: "500",
  total_1000: "1K",
  streak_3: "3D",
  streak_7: "7D",
  personal_best: "PB",
  challenge_champion: "CC",
  morning_grinder: "MG",
  athlete_mode: "AM",
};

export default function Badges() {
  const userId = useRequireAuth();

  const { data: badges, isLoading } = useGetUserBadges(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserBadgesQueryKey(userId!) },
  });

  if (!userId) return null;

  const earnedCount = badges?.filter(b => b.earned).length ?? 0;
  const totalCount = badges?.length ?? 0;

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-6">
        <header className="pt-4">
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Badges</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">
            {earnedCount} / {totalCount} earned
          </p>
        </header>

        {/* Earned Badges */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Earned</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : badges?.filter(b => b.earned).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No badges yet. Complete your first workout to start earning!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badges?.filter(b => b.earned).map(badge => (
                <div key={badge.id} className="bg-card border border-primary/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 relative">
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(212,255,0,0.1)]">
                    <span className="text-lg font-display font-black text-primary">
                      {BADGE_ICONS[badge.id] ?? "?"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">{badge.name}</p>
                    {badge.earnedDate && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {new Date(badge.earnedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{badge.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Locked Badges */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Locked</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badges?.filter(b => !b.earned).map(badge => (
                <div key={badge.id} className="bg-card/50 border border-border rounded-xl p-4 flex flex-col items-center text-center gap-2 opacity-60">
                  <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground leading-tight">{badge.name}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{badge.requirement}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
