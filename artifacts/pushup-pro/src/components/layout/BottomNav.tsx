import { Link, useLocation } from "wouter";
import { Home, Trophy, Target, Medal, User } from "lucide-react";

export function BottomNav() {
  const [location] = useLocation();

  const links = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/goals", icon: Target, label: "Goals" },
    { href: "/challenges", icon: Trophy, label: "Compete" },
    { href: "/records", icon: Medal, label: "Records" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-safe z-50">
      <nav className="flex items-center justify-around px-2 h-16">
        {links.map(({ href, icon: Icon, label }) => {
          const isActive = location === href || location.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center gap-1 min-w-0">
              <div
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
