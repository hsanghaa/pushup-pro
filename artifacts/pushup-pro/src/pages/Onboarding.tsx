import { useState as useReactState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateUser } from "@workspace/api-client-react";
import { setUserId } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserInputFitnessLevel, UserInputMainGoal } from "@workspace/api-client-react";

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { userId: clerkUserId } = useAuth();
  const [step, setStep] = useReactState(1);
  const [name, setName] = useReactState("");
  const [fitnessLevel, setFitnessLevel] = useReactState<UserInputFitnessLevel>("beginner");
  const [maxPushups, setMaxPushups] = useReactState("10");
  const [mainGoal, setMainGoal] = useReactState<UserInputMainGoal>("build_strength");
  const [weeklyAvailabilityDays, setWeeklyAvailabilityDays] = useReactState(3);

  const createUser = useCreateUser();

  const handleComplete = () => {
    createUser.mutate({
      data: {
        ...(clerkUserId ? { clerkId: clerkUserId } : {}),
        name,
        fitnessLevel,
        currentMaxPushups: parseInt(maxPushups, 10),
        mainGoal,
        weeklyAvailabilityDays,
      }
    }, {
      onSuccess: (user) => {
        setUserId(user.id);
        setLocation("/dashboard");
      }
    });
  };

  return (
    <AppLayout showNav={false}>
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center">
        <h1 className="text-3xl font-display font-bold uppercase mb-2">Setup Your Profile</h1>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-8">Step {step} of 4</p>

        {step === 1 && (
          <div className="w-full space-y-4 max-w-sm">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider mb-2 block text-left">What's your name?</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Coach Carter" className="h-14 text-lg border-primary/20 bg-card focus-visible:border-primary" />
            </div>
            <Button onClick={() => setStep(2)} disabled={!name} className="w-full h-14 text-lg font-display uppercase">Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="w-full space-y-4 max-w-sm">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider mb-2 block text-left">Fitness Level</label>
              <Select value={fitnessLevel} onValueChange={(v) => setFitnessLevel(v as UserInputFitnessLevel)}>
                <SelectTrigger className="h-14 text-lg bg-card">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="athlete">Athlete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-bold uppercase tracking-wider mb-2 block text-left">Max Push-ups in one set</label>
              <Input type="number" value={maxPushups} onChange={e => setMaxPushups(e.target.value)} className="h-14 text-lg bg-card" />
            </div>
            <Button onClick={() => setStep(3)} className="w-full h-14 text-lg font-display uppercase">Next</Button>
          </div>
        )}

        {step === 3 && (
          <div className="w-full space-y-4 max-w-sm">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider mb-2 block text-left">Main Goal</label>
              <Select value={mainGoal} onValueChange={(v) => setMainGoal(v as UserInputMainGoal)}>
                <SelectTrigger className="h-14 text-lg bg-card">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="build_strength">Build Strength</SelectItem>
                  <SelectItem value="improve_consistency">Improve Consistency</SelectItem>
                  <SelectItem value="hit_100_daily">Hit 100 Daily</SelectItem>
                  <SelectItem value="compete_friends">Compete with Friends</SelectItem>
                  <SelectItem value="train_like_athlete">Train like an Athlete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setStep(4)} className="w-full h-14 text-lg font-display uppercase">Next</Button>
          </div>
        )}

        {step === 4 && (
          <div className="w-full space-y-6 max-w-sm">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider mb-1 block text-left">Weekly Availability</label>
              <p className="text-xs font-mono text-muted-foreground text-left mb-3">How many days per week can you train?</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setWeeklyAvailabilityDays(d)}
                    className={`h-12 rounded-lg text-sm font-bold border transition-colors ${
                      weeklyAvailabilityDays === d
                        ? "bg-primary text-black border-primary"
                        : "bg-card border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs font-mono text-primary mt-2 text-left">
                {weeklyAvailabilityDays === 1 ? "1 day — rest is recovery too." :
                 weeklyAvailabilityDays <= 3 ? `${weeklyAvailabilityDays} days — solid start.` :
                 weeklyAvailabilityDays <= 5 ? `${weeklyAvailabilityDays} days — great consistency.` :
                 weeklyAvailabilityDays <= 6 ? `${weeklyAvailabilityDays} days — elite commitment.` :
                 "Every day — athlete mode."}
              </p>
            </div>
            <Button onClick={handleComplete} disabled={createUser.isPending} className="w-full h-14 text-lg font-display uppercase bg-primary text-primary-foreground">
              {createUser.isPending ? "Setting up..." : "Start Training"}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
