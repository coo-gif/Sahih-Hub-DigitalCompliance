import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  History,
  UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/documents", label: "Docs", icon: FileText },
  { href: "/users", label: "Users", icon: Users },
  { href: "/employees", label: "HR", icon: UserCog },
  { href: "/audit-log", label: "Audit", icon: History },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav 
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[56px]",
                  isActive 
                    ? "text-[#7A0C1A] bg-[#F3E3D0]" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
