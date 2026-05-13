import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import {
  useGetCurrentChallenge,
  useGetChallengeLeaderboard,
  useJoinChallenge,
  getGetCurrentChallengeQueryKey,
  getGetChallengeLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, Zap, Crown } from "lucide-react";

const RANK_COLORS = ["text-primary", "text-gray-300", "text-amber-600"];
const FITNESS_LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Inter.",
  advanced: "Advanced",
  athlete: "Athlete",
};

export default function Challenges() {
  const userId = useRequireAuth();
  const queryClient = useQueryClient();

  const { data: challenge, isLoading: challengeLoading } = useGetCurrentChallenge();
  const { data: leaderboard, isLoading: lbLoading } = useGetChallengeLeaderboard();
  const joinChallenge = useJoinChallenge();

  const userEntry = leaderboard?.find(e => e.userId === userId);
  const isParticipating = !!userEntry;

  const handleJoin = () => {
    if (!userId) return;
    joinChallenge.mutate({ data: { userId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentChallengeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetChallengeLeaderboardQueryKey() });
      }
    });
  };

  if (!userId) return null;

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-6">
        <header className="pt-4">
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Compete</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Weekly challenge</p>
        </header>

        {/* Challenge Card */}
        {challengeLoading ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : challenge && (
          <div className="bg-card border border-primary/20 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Weekly Challenge</span>
                </div>
                <h2 className="text-xl font-display font-bold leading-snug">{challenge.name}</h2>
                {challenge.description && <p className="text-sm text-muted-foreground mt-1 font-mono">{challenge.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{challenge.participantCount} competing</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-primary" />
                <span>Target: {challenge.target} push-ups</span>
              </div>
            </div>

            {userEntry && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Your progress</span>
                  <span>{userEntry.weeklyReps} / {challenge.target}</span>
                </div>
                <Progress value={Math.min(100, Math.round((userEntry.weeklyReps / challenge.target) * 100))} className="h-2" />
              </div>
            )}

            {!isParticipating && (
              <Button
                onClick={handleJoin}
                disabled={joinChallenge.isPending}
                className="w-full bg-primary text-primary-foreground font-display uppercase tracking-widest"
              >
                {joinChallenge.isPending ? "Joining..." : "Join Challenge"}
              </Button>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leaderboard</h2>

          {lbLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
          ) : !leaderboard?.length ? (
            <div className="text-center py-10 text-muted-foreground font-mono text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No participants yet. Be the first to join!
            </div>
          ) : (
            leaderboard.map(entry => {
              const isUser = entry.userId === userId;
              const rankColor = RANK_COLORS[entry.rank - 1] ?? "text-muted-foreground";
              return (
                <div
                  key={entry.userId}
                  className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${isUser ? "border-primary/40 bg-primary/5" : "border-border"}`}
                >
                  <div className={`text-2xl font-display font-black w-8 text-center ${rankColor}`}>
                    {entry.rank === 1 ? <Crown className="w-6 h-6 text-primary" /> : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{entry.name}</span>
                      {isUser && <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>}
                    </div>
                    {entry.fitnessLevel && (
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                        {FITNESS_LEVEL_LABELS[entry.fitnessLevel] ?? entry.fitnessLevel}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-display font-black text-primary">{entry.weeklyReps}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{entry.progressScore} pts</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Score explanation */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How Scores Work</p>
          <div className="space-y-1 text-xs font-mono text-muted-foreground">
            <p>1 push-up = 1 point</p>
            <p>Daily streak bonus = +10 pts/day</p>
            <p>New personal best = +25 pts</p>
            <p>Daily challenge = +20 pts</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
