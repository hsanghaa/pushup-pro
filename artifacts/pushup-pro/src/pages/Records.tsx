import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import {
  useGetUserStats,
  useGetUserWorkouts,
  getGetUserStatsQueryKey,
  getGetUserWorkoutsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Flame, TrendingUp, Zap, Dumbbell, Calendar } from "lucide-react";

function computeBestDay(workouts: Array<{ date: string; totalReps: number }>) {
  const byDay: Record<string, number> = {};
  for (const w of workouts) {
    byDay[w.date] = (byDay[w.date] ?? 0) + w.totalReps;
  }
  const entries = Object.entries(byDay);
  if (!entries.length) return { date: null, reps: 0 };
  const [date, reps] = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return { date, reps };
}

function computeBestWeek(workouts: Array<{ date: string; totalReps: number }>) {
  const byWeek: Record<string, number> = {};
  for (const w of workouts) {
    const d = new Date(w.date);
    const day = d.getDay(); // 0 = Sun
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - day);
    const key = weekStart.toISOString().split("T")[0];
    byWeek[key] = (byWeek[key] ?? 0) + w.totalReps;
  }
  const entries = Object.entries(byWeek);
  if (!entries.length) return { weekOf: null, reps: 0 };
  const [weekOf, reps] = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return { weekOf, reps };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface RecordCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  loading?: boolean;
}

function RecordCard({ icon, label, value, sub, highlight, loading }: RecordCardProps) {
  return (
    <div className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${highlight ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${highlight ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <p className={`text-2xl font-display font-black leading-tight ${highlight ? "text-primary" : "text-foreground"}`}>
            {value}
          </p>
        )}
        {sub && !loading && <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export default function Records() {
  const userId = useRequireAuth();

  const { data: stats, isLoading: statsLoading } = useGetUserStats(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserStatsQueryKey(userId!) },
  });

  const { data: workouts, isLoading: workoutsLoading } = useGetUserWorkouts(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserWorkoutsQueryKey(userId!) },
  });

  if (!userId) return null;

  const loading = statsLoading || workoutsLoading;
  const bestDay = workouts ? computeBestDay(workouts) : { date: null, reps: 0 };
  const bestWeek = workouts ? computeBestWeek(workouts) : { weekOf: null, reps: 0 };
  const totalWorkouts = workouts?.length ?? 0;

  const hasAnyRecord = (stats?.totalPushups ?? 0) > 0;

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-5">
        <header className="pt-4">
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Records</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Your personal bests</p>
        </header>

        {!loading && !hasAnyRecord && (
          <div className="text-center py-14 space-y-3">
            <Trophy className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
            <p className="text-muted-foreground font-mono text-sm">No records yet.</p>
            <p className="text-muted-foreground/60 font-mono text-xs">Complete your first workout to start tracking records.</p>
          </div>
        )}

        {/* Top record — best single set */}
        {(hasAnyRecord || loading) && (
          <div className={`rounded-2xl p-5 border ${loading ? "bg-card border-border" : "bg-primary/10 border-primary/30"}`}>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Personal Best</span>
            </div>
            {loading ? (
              <Skeleton className="h-16 w-28 mt-2" />
            ) : (
              <>
                <div
                  className="text-7xl font-display font-black text-primary leading-none"
                  style={{ textShadow: "0 0 30px rgba(212,255,0,0.25)" }}
                >
                  {stats?.bestSet ?? 0}
                </div>
                <p className="text-sm font-mono text-muted-foreground mt-1">push-ups in one session</p>
              </>
            )}
          </div>
        )}

        {/* Grid of records */}
        {(hasAnyRecord || loading) && (
          <div className="space-y-3">
            <RecordCard
              icon={<Flame className="w-5 h-5" />}
              label="Longest Streak"
              value={loading ? "" : `${stats?.currentStreak ?? 0} days`}
              sub="consecutive days with a workout"
              highlight={(stats?.currentStreak ?? 0) > 0}
              loading={loading}
            />
            <RecordCard
              icon={<Calendar className="w-5 h-5" />}
              label="Best Day"
              value={loading ? "" : `${bestDay.reps} reps`}
              sub={bestDay.date ? formatDate(bestDay.date) : "No workouts yet"}
              highlight={bestDay.reps > 0}
              loading={loading}
            />
            <RecordCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Best Week"
              value={loading ? "" : `${bestWeek.reps} reps`}
              sub={bestWeek.weekOf ? `Week of ${formatDate(bestWeek.weekOf)}` : "No workouts yet"}
              highlight={bestWeek.reps > 0}
              loading={loading}
            />
            <RecordCard
              icon={<Zap className="w-5 h-5" />}
              label="All-Time Total"
              value={loading ? "" : `${stats?.totalPushups ?? 0}`}
              sub="push-ups across all sessions"
              loading={loading}
            />
            <RecordCard
              icon={<Dumbbell className="w-5 h-5" />}
              label="Total Workouts"
              value={loading ? "" : totalWorkouts}
              sub="sessions completed"
              loading={loading}
            />
          </div>
        )}

        {/* Progress score */}
        {(hasAnyRecord || loading) && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progress Score</p>
              <p className="text-2xl font-display font-black text-foreground">
                {loading ? <Skeleton className="h-7 w-16 inline-block" /> : stats?.progressScore ?? 0}
              </p>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              Points = weekly reps + streak bonus (10/day) + personal best bonus. Complete more workouts to increase your score.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
