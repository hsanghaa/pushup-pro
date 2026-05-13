import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetVariations, GetVariationsParams } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";

const LEVEL_COLORS: Record<string, string> = {
  beginner: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  intermediate: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  advanced: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  athlete: "text-primary bg-primary/10 border-primary/20",
};

const LEVELS = ["beginner", "intermediate", "advanced", "athlete"] as const;

export default function Library() {
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params: GetVariationsParams | undefined = activeLevel
    ? { level: activeLevel as GetVariationsParams["level"] }
    : undefined;
  const { data: variations, isLoading } = useGetVariations(params);

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-5">
        <header className="pt-4">
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Library</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Push-up variation library</p>
        </header>

        {/* Level Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveLevel(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-colors ${!activeLevel ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
          >
            All
          </button>
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setActiveLevel(l => l === level ? null : level)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-colors ${activeLevel === level ? `${LEVEL_COLORS[level]} border-current` : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Variations */}
        <div className="space-y-3">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          ) : variations?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground font-mono text-sm">No variations found.</div>
          ) : (
            variations?.map(v => (
              <div
                key={v.id}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(e => e === v.id ? null : v.id)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold truncate">{v.name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${LEVEL_COLORS[v.level]}`}>
                        {v.level}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{v.musclesWorked}</p>
                  </div>
                  {expanded === v.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </button>

                {expanded === v.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    <p className="text-sm text-foreground leading-relaxed">{v.description}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-background rounded-lg p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Suggested</p>
                        <p className="text-xs font-mono">{v.suggestedReps}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Muscles</p>
                        <p className="text-xs font-mono">{v.musclesWorked}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                      <Shield className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-300/80 font-mono leading-relaxed">{v.safetyNote}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
