import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Workout from "@/pages/Workout";
import Goals from "@/pages/Goals";
import Challenges from "@/pages/Challenges";
import Badges from "@/pages/Badges";
import Library from "@/pages/Library";
import Profile from "@/pages/Profile";
import Records from "@/pages/Records";
import ChallengeInvite from "@/pages/ChallengeInvite";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/workout" component={Workout} />
      <Route path="/goals" component={Goals} />
      <Route path="/challenges" component={Challenges} />
      <Route path="/badges" component={Badges} />
      <Route path="/library" component={Library} />
      <Route path="/profile" component={Profile} />
      <Route path="/records" component={Records} />
      <Route path="/challenge" component={ChallengeInvite} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
