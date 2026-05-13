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
import { Trophy, Users, Zap, Crown, UserPlus, Trash2, Flame, ChevronDown, ChevronUp, Gift, Copy, Check, MapPin, Star } from "lucide-react";
import { speakRivalGenerated } from "@/lib/rivalVoice";

interface PartnerStudio {
  id: string;
  name: string;
  type: string;
  emoji: string;
  tagline: string;
  normalPrice: number;
  offers: { platinum: string; gold: string; silver: string };
  accent: string;
}

const PARTNER_STUDIOS: PartnerStudio[] = [
  { id: "soulcycle", name: "SoulCycle", type: "Spin", emoji: "🚲", tagline: "High-energy indoor cycling in a candlelit studio.", normalPrice: 40, offers: { platinum: "FREE class ($40 value)", gold: "75% off — pay $10", silver: "50% off — pay $20" }, accent: "border-yellow-500/40 bg-yellow-500/5" },
  { id: "corepower", name: "CorePower Yoga", type: "Yoga", emoji: "🧘", tagline: "Hot yoga meets mindful strength training.", normalPrice: 30, offers: { platinum: "FREE drop-in ($30 value)", gold: "75% off — pay $8", silver: "50% off — pay $15" }, accent: "border-green-500/40 bg-green-500/5" },
  { id: "clubpilates", name: "Club Pilates", type: "Pilates", emoji: "🤸", tagline: "Reformer Pilates for every fitness level.", normalPrice: 35, offers: { platinum: "FREE intro class ($35 value)", gold: "75% off — pay $9", silver: "50% off — pay $18" }, accent: "border-pink-500/40 bg-pink-500/5" },
  { id: "orangetheory", name: "Orangetheory", type: "HIIT", emoji: "🔥", tagline: "Science-backed heart-rate interval training.", normalPrice: 28, offers: { platinum: "FREE first class ($28 value)", gold: "75% off — pay $7", silver: "50% off — pay $14" }, accent: "border-orange-500/40 bg-orange-500/5" },
  { id: "barrys", name: "Barry's", type: "Bootcamp", emoji: "💪", tagline: "The original bootcamp class. Treadmill + weights.", normalPrice: 38, offers: { platinum: "FREE class ($38 value)", gold: "75% off — pay $10", silver: "50% off — pay $19" }, accent: "border-red-500/40 bg-red-500/5" },
  { id: "barre3", name: "barre3", type: "Barre", emoji: "🩰", tagline: "Balance of strength, cardio, and mindfulness.", normalPrice: 25, offers: { platinum: "FREE drop-in ($25 value)", gold: "75% off — pay $6", silver: "50% off — pay $13" }, accent: "border-purple-500/40 bg-purple-500/5" },
];

const TIER_CONFIG = {
  platinum: { label: "Platinum", minRank: 1, maxRank: 3, color: "text-cyan-300", bg: "bg-cyan-500/10 border-cyan-500/30", stars: 3 },
  gold:     { label: "Gold",     minRank: 4, maxRank: 5, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", stars: 2 },
  silver:   { label: "Silver",   minRank: 6, maxRank: 10, color: "text-gray-300", bg: "bg-gray-500/10 border-gray-500/30", stars: 1 },
} as const;

type Tier = keyof typeof TIER_CONFIG;

function getTier(rank: number | null): Tier | null {
  if (!rank) return null;
  if (rank <= 3) return "platinum";
  if (rank <= 5) return "gold";
  if (rank <= 10) return "silver";
  return null;
}

function makeCoupon(studioId: string, tier: Tier): string {
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PUSHPRO-${tier.toUpperCase()}-${studioId.toUpperCase().slice(0, 4)}-${code}`;
}

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
  const [activeTab, setActiveTab] = useState<"challenge" | "rivals" | "rewards">("challenge");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("random");
  const [claimedCoupons, setClaimedCoupons] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetUserRivalsQueryKey(userId) });
          setShowStylePicker(false);
          speakRivalGenerated(data.personality, data.name);
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
            <button
              onClick={() => setActiveTab("rewards")}
              className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors relative ${
                activeTab === "rewards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rewards
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center">✦</span>
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

        {/* ── REWARDS TAB ── */}
        {activeTab === "rewards" && (() => {
          const myRank = leaderboard ? leaderboard.findIndex(e => e.userId === userId) + 1 : null;
          const effectiveRank = myRank && myRank > 0 ? myRank : null;
          const tier = getTier(effectiveRank);
          const tierCfg = tier ? TIER_CONFIG[tier] : null;

          const handleClaim = (studioId: string) => {
            if (!tier || claimedCoupons[studioId]) return;
            const code = makeCoupon(studioId, tier);
            setClaimedCoupons(prev => ({ ...prev, [studioId]: code }));
          };

          const handleCopy = (studioId: string) => {
            const code = claimedCoupons[studioId];
            if (!code) return;
            navigator.clipboard.writeText(code);
            setCopiedId(studioId);
            setTimeout(() => setCopiedId(null), 2000);
          };

          return (
            <div className="px-4 space-y-5">
              {/* How it works */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Local Partner Rewards</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Finish in the <strong className="text-foreground">top 10</strong> of the weekly leaderboard and unlock
                  real discounts at fitness studios near you. The higher you rank, the bigger the reward.
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(["platinum", "gold", "silver"] as Tier[]).map(t => {
                    const cfg = TIER_CONFIG[t];
                    return (
                      <div key={t} className={`rounded-lg border p-2 ${cfg.bg}`}>
                        <div className="flex justify-center gap-0.5 mb-1">
                          {Array.from({ length: cfg.stars }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 fill-current ${cfg.color}`} />
                          ))}
                        </div>
                        <div className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</div>
                        <div className="text-[10px] text-muted-foreground">Top {cfg.maxRank}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rank status */}
              {lbLoading ? (
                <Skeleton className="h-20 w-full rounded-xl" />
              ) : !isParticipating ? (
                <div className="bg-card border border-dashed border-border rounded-xl p-5 text-center space-y-2">
                  <Trophy className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-bold">Join the Weekly Challenge first</p>
                  <p className="text-xs text-muted-foreground">Compete on the leaderboard to qualify for local rewards.</p>
                  <Button size="sm" className="mt-2" onClick={() => setActiveTab("challenge")}>
                    Go to Challenge
                  </Button>
                </div>
              ) : tier ? (
                <div className={`rounded-xl border p-4 space-y-1 ${tierCfg!.bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: tierCfg!.stars }).map((_, i) => (
                            <Star key={i} className={`w-4 h-4 fill-current ${tierCfg!.color}`} />
                          ))}
                        </div>
                        <span className={`text-sm font-bold ${tierCfg!.color}`}>{tierCfg!.label} Member</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">You're ranked <strong className="text-foreground">#{effectiveRank}</strong> this week — rewards unlocked!</p>
                    </div>
                    <div className={`text-3xl font-display font-black ${tierCfg!.color}`}>#{effectiveRank}</div>
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-justify gap-3">
                    <div className="text-3xl font-display font-black text-muted-foreground">#{effectiveRank}</div>
                    <div>
                      <p className="text-sm font-bold">Not yet qualifying</p>
                      <p className="text-xs text-muted-foreground">Reach <strong className="text-foreground">top 10</strong> on the leaderboard to unlock studio discounts.</p>
                    </div>
                  </div>
                  <Progress value={Math.min(100, ((11 - (effectiveRank ?? 11)) / 10) * 100)} className="h-1.5" />
                </div>
              )}

              {/* Studio cards */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Partner Studios Near You</span>
                </div>
                <div className="space-y-3">
                  {PARTNER_STUDIOS.map(studio => {
                    const coupon = claimedCoupons[studio.id];
                    const isCopied = copiedId === studio.id;
                    const offerText = tier ? studio.offers[tier] : null;
                    const locked = !tier;

                    return (
                      <div key={studio.id} className={`border rounded-xl p-4 space-y-3 transition-all ${locked ? "border-border bg-card opacity-60" : studio.accent}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="text-2xl">{studio.emoji}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{studio.name}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{studio.type}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{studio.tagline}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs">
                            {offerText ? (
                              <span className="text-primary font-bold">{offerText}</span>
                            ) : (
                              <span className="text-muted-foreground">Normally ${studio.normalPrice}/class</span>
                            )}
                          </div>
                          {!locked && (
                            coupon ? (
                              <button
                                onClick={() => handleCopy(studio.id)}
                                className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 border border-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-colors min-w-0"
                              >
                                <span className="truncate max-w-[120px]">{coupon}</span>
                                {isCopied ? <Check className="w-3 h-3 text-green-400 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                              </button>
                            ) : (
                              <Button size="sm" className="text-xs h-8 shrink-0" onClick={() => handleClaim(studio.id)}>
                                Claim Reward
                              </Button>
                            )
                          )}
                          {locked && (
                            <span className="text-[10px] text-muted-foreground">Rank top 10 to unlock</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center pb-2">
                Rewards are issued weekly. Coupons valid at participating locations only. This is a preview of a live partnership program.
              </p>
            </div>
          );
        })()}
      </div>
    </AppLayout>
  );
}
