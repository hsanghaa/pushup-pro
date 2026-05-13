import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import {
  useGetCurrentChallenge,
  useGetChallengeLeaderboard,
  useJoinChallenge,
  useGetUserRivals,
  useGenerateRival,
  useDeleteRival,
  useGetUserStats,
  getGetCurrentChallengeQueryKey,
  getGetChallengeLeaderboardQueryKey,
  getGetUserRivalsQueryKey,
  getGetUserStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, Zap, Crown, UserPlus, Trash2, Flame, ChevronDown, ChevronUp } from "lucide-react";

const RANK_COLORS = ["text-primary", "text-gray-300", "text-amber-600"];
const FITNESS_LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Inter.",
  advanced: "Advanced",
  athlete: "Athlete",
};

const PERSONALITY_LABELS: Record<string, string> = {
  machine: "The Machine",
  grinder: "The Grinder",
  competitor: "The Competitor",
  comeback_kid: "The Comeback Kid",
  underdog: "The Underdog",
  consistent: "The Consistent",
  weekend_warrior: "Weekend Warrior",
};

const PERSONALITY_TAGLINES: Record<string, string> = {
  machine: "Never misses a day. Relentless consistency.",
  grinder: "High volume every session. Doesn't stop.",
  competitor: "Tracks your stats and pushes just past you.",
  comeback_kid: "Takes days off but surges back stronger.",
  underdog: "Just starting out — improving every week.",
  consistent: "5 days a week, no excuses, no drama.",
  weekend_warrior: "Goes hard on weekends, quiet midweek.",
};

const STYLE_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "machine", label: "Machine — ultra consistent" },
  { value: "grinder", label: "Grinder — high volume" },
  { value: "competitor", label: "Competitor — tracks you closely" },
  { value: "comeback_kid", label: "Comeback Kid — surges after rest" },
  { value: "underdog", label: "Underdog — improving each week" },
];

export default function Challenges() {
  const userId = useRequireAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"challenge" | "rivals">("challenge");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("random");

  const { data: challenge, isLoading: challengeLoading } = useGetCurrentChallenge();
  const { data: leaderboard, isLoading: lbLoading } = useGetChallengeLeaderboard();
  const joinChallenge = useJoinChallenge();

  const { data: rivals, isLoading: rivalsLoading } = useGetUserRivals(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserRivalsQueryKey(userId!) },
  });
  const { data: stats } = useGetUserStats(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserStatsQueryKey(userId!) },
  });
  const generateRival = useGenerateRival();
  const deleteRival = useDeleteRival();

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

  const handleGenerateRival = () => {
    if (!userId) return;
    generateRival.mutate(
      { userId, data: { style: selectedStyle as "machine" | "grinder" | "competitor" | "comeback_kid" | "underdog" | "random" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserRivalsQueryKey(userId) });
          setShowStylePicker(false);
        },
      }
    );
  };

  const handleDeleteRival = (rivalId: number) => {
    deleteRival.mutate({ rivalId }, {
      onSuccess: () => {
        if (userId) queryClient.invalidateQueries({ queryKey: getGetUserRivalsQueryKey(userId) });
      }
    });
  };

  if (!userId) return null;

  const myWeekly = stats?.weeklyTotal ?? 0;

  return (
    <AppLayout>
      <div className="pb-24">
        {/* Header + Tabs */}
        <div className="p-4 pt-8 space-y-4">
          <header>
            <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Compete</h1>
            <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Challenge yourself and your rivals</p>
          </header>

          <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
            <button
              onClick={() => setActiveTab("challenge")}
              className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "challenge" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Weekly Challenge
            </button>
            <button
              onClick={() => setActiveTab("rivals")}
              className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors relative ${
                activeTab === "rivals" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Rivals
              {rivals && rivals.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {rivals.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── CHALLENGE TAB ── */}
        {activeTab === "challenge" && (
          <div className="px-4 space-y-6">
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
        )}

        {/* ── RIVALS TAB ── */}
        {activeTab === "rivals" && (
          <div className="px-4 space-y-5">
            {/* Add Rival CTA */}
            <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Add AI Rival</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                Generate an AI-powered rival persona. They'll compete against you on the weekly leaderboard and push you to train harder.
              </p>

              <button
                onClick={() => setShowStylePicker(!showStylePicker)}
                className="flex items-center justify-between w-full h-10 px-3 rounded-lg bg-background border border-border text-sm text-left"
              >
                <span className="font-mono text-sm">{STYLE_OPTIONS.find(s => s.value === selectedStyle)?.label ?? "Random"}</span>
                {showStylePicker ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showStylePicker && (
                <div className="bg-background border border-border rounded-lg overflow-hidden">
                  {STYLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSelectedStyle(opt.value); setShowStylePicker(false); }}
                      className={`w-full px-3 py-2.5 text-left text-sm font-mono hover:bg-muted transition-colors ${selectedStyle === opt.value ? "text-primary" : "text-foreground"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <Button
                onClick={handleGenerateRival}
                disabled={generateRival.isPending}
                className="w-full bg-primary text-primary-foreground font-display uppercase tracking-widest"
              >
                {generateRival.isPending ? "Generating..." : "Generate Rival"}
              </Button>

              {generateRival.isError && (
                <p className="text-xs font-mono text-red-400">All rival personas have been added already.</p>
              )}
            </div>

            {/* Rivals List */}
            {rivalsLoading ? (
              Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
            ) : !rivals?.length ? (
              <div className="text-center py-12 space-y-2">
                <div className="text-4xl">🤖</div>
                <p className="text-muted-foreground font-mono text-sm">No rivals yet.</p>
                <p className="text-muted-foreground/60 font-mono text-xs">Generate one above to start competing.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Rivals — This Week</h2>
                  <p className="text-[11px] font-mono text-muted-foreground">Your weekly total: <span className="text-primary font-bold">{myWeekly}</span></p>
                </div>

                {rivals.map(rival => {
                  const ahead = rival.weeklyReps > myWeekly;
                  const diff = Math.abs(rival.weeklyReps - myWeekly);
                  return (
                    <div
                      key={rival.id}
                      className={`bg-card border rounded-xl p-4 space-y-3 ${ahead ? "border-red-500/30" : "border-primary/30"}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl leading-none">{rival.avatarEmoji}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base">{rival.name}</span>
                              {ahead
                                ? <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">+{diff} ahead</span>
                                : <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">You're +{diff} ahead</span>
                              }
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              {PERSONALITY_LABELS[rival.personality] ?? rival.personality}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground/70 mt-0.5">
                              {PERSONALITY_TAGLINES[rival.personality] ?? ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteRival(rival.id)}
                          className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                          title="Remove rival"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-background rounded-lg p-2 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Weekly</p>
                          <p className={`text-xl font-display font-black ${ahead ? "text-red-400" : "text-primary"}`}>{rival.weeklyReps}</p>
                        </div>
                        <div className="bg-background rounded-lg p-2 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Streak</p>
                          <div className="flex items-center justify-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-orange-400" />
                            <p className="text-xl font-display font-black">{rival.currentStreak}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span>You vs {rival.name.split(" ")[0]}</span>
                          <span>{myWeekly} vs {rival.weeklyReps}</span>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                          {(myWeekly + rival.weeklyReps) > 0 ? (
                            <>
                              <div
                                className="bg-primary h-full transition-all"
                                style={{ width: `${Math.round((myWeekly / (myWeekly + rival.weeklyReps)) * 100)}%` }}
                              />
                              <div className="bg-muted-foreground/30 h-full flex-1" />
                            </>
                          ) : (
                            <div className="bg-muted h-full w-full" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
