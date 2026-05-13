import { useRequireAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useGetUserStats,
  useGetCoachMessage,
  useGetUserRivals,
  getGetUserStatsQueryKey,
  getGetCoachMessageQueryKey,
  getGetUserRivalsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useStreakNotification } from "@/hooks/useStreakNotification";

export default function Dashboard() {
  const userId = useRequireAuth();

  const { data: stats, isLoading: statsLoading } = useGetUserStats(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserStatsQueryKey(userId!) }
  });

  const { data: message, isLoading: msgLoading } = useGetCoachMessage(userId!, {
    query: { enabled: !!userId, queryKey: getGetCoachMessageQueryKey(userId!) }
  });

  const { data: rivals } = useGetUserRivals(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserRivalsQueryKey(userId!) }
  });

  const topRival = rivals?.sort((a, b) => b.weeklyReps - a.weeklyReps)[0];

  useStreakNotification(stats?.todayReps, stats?.currentStreak, topRival?.name);

  if (!userId) return null;

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-6">
        <header className="flex justify-between items-end pt-4">
          <div>
            <h1 className="text-3xl font-display font-bold uppercase tracking-tight text-primary">Dashboard</h1>
            <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Let's get to work</p>
          </div>
        </header>

        {msgLoading ? (
          <Skeleton className="h-16 w-full rounded-lg bg-card" />
        ) : message ? (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
            <p className="text-sm font-medium text-primary font-mono">{message.message}</p>
          </div>
        ) : null}

        {/* Rival alert — show if a rival is beating you today */}
        {topRival && (topRival.weeklyReps > (stats?.weeklyTotal ?? 0)) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3">
            <span className="text-2xl">{topRival.avatarEmoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Rival Alert</p>
              <p className="text-sm font-mono text-foreground truncate">
                {topRival.name} is ahead — {topRival.weeklyReps} vs your {stats?.weeklyTotal ?? 0} this week
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Today</span>
            {statsLoading ? <Skeleton className="h-8 w-16 mt-2 bg-muted" /> : <span className="text-4xl font-display font-bold mt-1">{stats?.todayReps || 0}</span>}
          </div>
          <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Weekly</span>
            {statsLoading ? <Skeleton className="h-8 w-16 mt-2 bg-muted" /> : <span className="text-4xl font-display font-bold mt-1 text-primary">{stats?.weeklyTotal || 0}</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border p-3 rounded-lg text-center">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Streak</span>
            <span className="block text-2xl font-display font-bold">{stats?.currentStreak || 0}</span>
          </div>
          <div className="bg-card border border-border p-3 rounded-lg text-center">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Best Set</span>
            <span className="block text-2xl font-display font-bold">{stats?.bestSet || 0}</span>
          </div>
          <div className="bg-card border border-border p-3 rounded-lg text-center">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Total</span>
            <span className="block text-2xl font-display font-bold">{stats?.totalPushups || 0}</span>
          </div>
        </div>

        <div className="pt-4">
          <Link href="/workout" className="w-full block">
            <Button size="lg" className="w-full h-16 text-xl font-display uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(212,255,0,0.15)]">
              Start Workout
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
