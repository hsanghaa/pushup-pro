import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth, clearUserId } from "@/lib/auth";
import {
  useGetUser,
  useGetUserStats,
  useUpdateUser,
  getGetUserQueryKey,
  getGetUserStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, User } from "lucide-react";

const GOAL_LABELS: Record<string, string> = {
  build_strength: "Build Strength",
  improve_consistency: "Improve Consistency",
  hit_100_daily: "Hit 100 Daily",
  compete_friends: "Compete with Friends",
  train_like_athlete: "Train like an Athlete",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  athlete: "Athlete",
};

export default function Profile() {
  const userId = useRequireAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: user, isLoading: userLoading } = useGetUser(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId!) },
  });
  const { data: stats } = useGetUserStats(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserStatsQueryKey(userId!) },
  });
  const updateUser = useUpdateUser();

  const startEdit = () => {
    setName(user?.name ?? "");
    setFitnessLevel(user?.fitnessLevel ?? "beginner");
    setEditing(true);
    setSaved(false);
  };

  const handleSave = () => {
    if (!userId) return;
    updateUser.mutate({ userId, data: { name, fitnessLevel: fitnessLevel as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const handleReset = () => {
    if (!window.confirm("Reset all progress? This will clear your user ID from this device.")) return;
    clearUserId();
    setLocation("/");
  };

  if (!userId) return null;

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-6">
        <header className="pt-4">
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Profile</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Your account</p>
        </header>

        {/* Profile Card */}
        {userLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : user && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  {saved && <div className="flex items-center gap-1 text-primary text-xs font-mono mb-0.5"><CheckCircle className="w-3 h-3" /> Saved</div>}
                  <p className="font-display font-bold text-xl">{user.name}</p>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{LEVEL_LABELS[user.fitnessLevel]}</p>
                </div>
              </div>
              {!editing && (
                <Button size="sm" variant="outline" onClick={startEdit} className="text-xs font-mono uppercase tracking-wider">
                  Edit
                </Button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3 pt-2 border-t border-border">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="h-10 bg-background" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Fitness Level</label>
                  <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEVEL_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={updateUser.isPending} className="flex-1 bg-primary text-primary-foreground text-xs uppercase">
                    {updateUser.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="flex-1 text-xs uppercase">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-border text-sm font-mono text-muted-foreground">
                <div className="flex justify-between">
                  <span>Main goal</span>
                  <span className="text-foreground">{GOAL_LABELS[user.mainGoal] ?? user.mainGoal}</span>
                </div>
                {user.reminderPreference && (
                  <div className="flex justify-between">
                    <span>Reminders</span>
                    <span className="text-foreground capitalize">{user.reminderPreference}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total</p>
              <p className="text-2xl font-display font-black text-primary">{stats.totalPushups}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Streak</p>
              <p className="text-2xl font-display font-black">{stats.currentStreak}d</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Best</p>
              <p className="text-2xl font-display font-black">{stats.bestSet}</p>
            </div>
          </div>
        )}

        {/* Safety Disclaimer */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Safety Disclaimer</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed font-mono">
            PushUp Pro provides general fitness guidance and progress tracking. It is not medical advice. Stop exercising if you feel pain, dizziness, or discomfort. Consult a healthcare professional before beginning a new exercise program.
          </p>
        </div>

        {/* Reset */}
        <div className="border-t border-border pt-4">
          <Button
            onClick={handleReset}
            variant="destructive"
            size="sm"
            className="w-full text-xs font-mono uppercase tracking-wider"
          >
            Reset Progress
          </Button>
          <p className="text-[10px] text-muted-foreground font-mono text-center mt-2">
            This clears your session from this device only.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
