import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth, RedirectToSignIn } from "@clerk/react";
import { shadcn } from "@clerk/themes";

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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "hsl(195 100% 50%)",
    colorForeground: "hsl(210 40% 96%)",
    colorMutedForeground: "hsl(215 20% 55%)",
    colorDanger: "hsl(0 72% 51%)",
    colorBackground: "hsl(220 18% 10%)",
    colorInput: "hsl(220 15% 16%)",
    colorInputForeground: "hsl(210 40% 96%)",
    colorNeutral: "hsl(215 20% 30%)",
    fontFamily: "'Bricolage Grotesque', 'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(220,18%,10%)] border border-[hsl(215,20%,20%)] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(210,40%,96%)] font-bold",
    headerSubtitle: "text-[hsl(215,20%,55%)]",
    socialButtonsBlockButtonText: "text-[hsl(210,40%,96%)] font-medium",
    socialButtonsBlockButton: "border-[hsl(215,20%,25%)] bg-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,20%)]",
    formFieldLabel: "text-[hsl(210,40%,96%)]",
    formFieldInput: "bg-[hsl(220,15%,16%)] border-[hsl(215,20%,25%)] text-[hsl(210,40%,96%)]",
    formButtonPrimary: "bg-[hsl(195,100%,50%)] text-black font-bold hover:bg-[hsl(195,100%,45%)]",
    footerActionLink: "text-[hsl(195,100%,50%)] hover:text-[hsl(195,100%,60%)]",
    footerActionText: "text-[hsl(215,20%,55%)]",
    dividerText: "text-[hsl(215,20%,55%)]",
    dividerLine: "bg-[hsl(215,20%,25%)]",
    identityPreviewEditButton: "text-[hsl(195,100%,50%)]",
    formFieldSuccessText: "text-[hsl(120,60%,50%)]",
    alertText: "text-[hsl(210,40%,96%)]",
    alert: "bg-[hsl(220,15%,16%)] border-[hsl(215,20%,25%)]",
    logoBox: "flex justify-center pt-2",
    logoImage: "h-12 w-auto",
    otpCodeFieldInput: "bg-[hsl(220,15%,16%)] border-[hsl(215,20%,25%)] text-[hsl(210,40%,96%)]",
    formFieldRow: "gap-2",
    main: "gap-4",
    footerAction: "border-t border-[hsl(215,20%,20%)]",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== uid) {
        qc.clear();
      }
      prevUserIdRef.current = uid;
    });
    return unsub;
  }, [addListener, qc]);

  return null;
}

const devAuthBypass = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

function ProtectedRoutes() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!devAuthBypass) {
    if (!isLoaded) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      );
    }

    if (!isSignedIn) {
      return <RedirectToSignIn />;
    }
  }

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
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to continue training",
          },
        },
        signUp: {
          start: {
            title: "Join PushUp Pro",
            subtitle: "Start tracking every rep",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
