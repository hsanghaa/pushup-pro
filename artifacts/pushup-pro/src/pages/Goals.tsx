import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import {
  useGetUserGoals,
  useGetGoalRecommendations,
  useGetUserStats,
  useCreateGoal,
  useUpdateGoal,
  getGetUserGoalsQueryKey,
  getGetGoalRecommendationsQueryKey,
  getGetUserStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Target, Sparkles, Plus } from "lucide-react";

const GOAL_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  streak: "Streak",
  challenge: "Challenge",
  personal_best: "Personal Best",
};

export default function Goals() {
  const userId = useRequireAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newGoalType, setNewGoalType] = useState("daily");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [accepting, setAccepting] = useState(false);

  const { data: goals, isLoading: goalsLoading } = useGetUserGoals(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserGoalsQueryKey(userId!) },
  });
  const { data: recommendations, isLoading: recLoading } = useGetGoalRecommendations(userId!, {
    query: { enabled: !!userId, queryKey: getGetGoalRecommendationsQueryKey(userId!) },
  });
  const { data: stats } = useGetUserStats(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserStatsQueryKey(userId!) },
  });
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const getProgress = (goal: { type: string; targetReps: number; completed: boolean }) => {
    if (!stats) return 0;
    if (goal.completed) return 100;
    let current = 0;
    if (goal.type === "daily") current = stats.todayReps;
    else if (goal.type === "weekly") current = stats.weeklyTotal;
    else if (goal.type === "streak") current = stats.currentStreak;
    else if (goal.type === "personal_best") current = stats.bestSet;
    return Math.min(100, Math.round((current / goal.targetReps) * 100));
  };

  const getCurrentValue = (type: string) => {
    if (!stats) return 0;
    if (type === "daily") return stats.todayReps;
    if (type === "weekly") return stats.weeklyTotal;
    if (type === "streak") return stats.currentStreak;
    if (type === "personal_best") return stats.bestSet;
    return 0;
  };

  const handleCreate = () => {
    if (!userId || !newGoalTarget) return;
    createGoal.mutate({
      userId,
      data: { type: newGoalType as "daily" | "weekly" | "streak" | "challenge" | "personal_best", targetReps: parseInt(newGoalTarget, 10) }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUserGoalsQueryKey(userId) });
        setShowAdd(false);
        setNewGoalTarget("");
      }
    });
  };

  const handleComplete = (goalId: number) => {
    updateGoal.mutate({ goalId, data: { completed: true } }, {
      onSuccess: () => {
        if (userId) queryClient.invalidateQueries({ queryKey: getGetUserGoalsQueryKey(userId) });
      }
    });
  };

  const handleAcceptRecommendation = async () => {
    if (!recommendations || !userId) return;
    setAccepting(true);
    try {
      await createGoal.mutateAsync({
        userId,
        data: { type: "weekly", targetReps: recommendations.weeklyGoal, aiGenerated: true }
      });
      await createGoal.mutateAsync({
        userId,
        data: { type: "daily", targetReps: recommendations.dailyGoal, aiGenerated: true }
      });
      queryClient.invalidateQueries({ queryKey: getGetUserGoalsQueryKey(userId) });
    } catch {
      // silent — user can retry
    } finally {
      setAccepting(false);
    }
  };

  if (!userId) return null;

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-6">
        <header className="pt-4">
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight text-foreground">Goals</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Set targets. Hit them.</p>
        </header>

        {/* AI Recommendations */}
        {recLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : recommendations && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Recommendation</span>
            </div>
            <p className="text-sm text-foreground font-medium leading-snug">{recommendations.message}</p>
            <div className="flex gap-2 text-xs font-mono text-muted-foreground">
              <span className="bg-card border border-border px-2 py-1 rounded">Daily: {recommendations.dailyGoal} reps</span>
              <span className="bg-card border border-border px-2 py-1 rounded">Weekly: {recommendations.weeklyGoal} reps</span>
            </div>
            <Button
              size="sm"
              onClick={handleAcceptRecommendation}
              disabled={accepting}
              className="bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider"
            >
              {accepting ? "Saving..." : "Accept Goals"}
            </Button>
          </div>
        )}

        {/* Active Goals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Goals</h2>
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80">
              <Plus className="w-3 h-3" /> Add Goal
            </button>
          </div>

          {showAdd && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <select
                value={newGoalType}
                onChange={e => setNewGoalType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
              >
                {Object.entries(GOAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Input
                type="number"
                value={newGoalTarget}
                onChange={e => setNewGoalTarget(e.target.value)}
                placeholder="Target reps"
                className="h-10 bg-background border-border"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={createGoal.isPending} className="flex-1 bg-primary text-primary-foreground text-xs uppercase">
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="flex-1 text-xs uppercase">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {goalsLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : goals?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground font-mono text-sm">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No goals yet. Accept the AI recommendation or add one.
            </div>
          ) : (
            goals?.map(goal => {
              const progress = getProgress(goal);
              const current = getCurrentValue(goal.type);
              return (
                <div key={goal.id} className={`bg-card border rounded-xl p-4 space-y-3 ${goal.completed ? "border-primary/30 opacity-70" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {goal.completed ? <CheckCircle className="w-4 h-4 text-primary" /> : <Target className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-bold uppercase tracking-wide">{GOAL_LABELS[goal.type] ?? goal.type}</span>
                      {goal.aiGenerated && <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">AI</span>}
                    </div>
                    {!goal.completed && (
                      <button
                        onClick={() => handleComplete(goal.id)}
                        disabled={updateGoal.isPending}
                        className="text-[10px] font-mono text-muted-foreground hover:text-primary uppercase tracking-wider disabled:opacity-50"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-muted-foreground">
                      <span>{current} / {goal.targetReps} {goal.type === "streak" ? "days" : "reps"}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-secondary" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
