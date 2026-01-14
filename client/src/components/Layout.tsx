import { Link, useLocation } from "wouter";
import { useNotifications, useMarkAllNotificationsRead } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  History, 
  Bell,
  Menu,
  CheckCheck,
  Network,
  LogOut,
  User,
  Shield,
  ClipboardList,
  FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import sahihLogoPath from "@assets/sahih_logo-1.png";
import { BuddySidebarWidget } from "@/components/BuddyAvatar";

interface LayoutProps {
  children: React.ReactNode;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  onLogout?: () => void;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  canAccess?: (user: { role: string; email: string }) => boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/tasks", label: "My Tasks", icon: ClipboardList },
  { href: "/user-records", label: "My Records", icon: FolderOpen },
  { href: "/users", label: "Users", icon: Users },
  { 
    href: "/hr", 
    label: "HR dept", 
    icon: Network,
    canAccess: (user) => user.role === 'admin' || user.email === 'hr@sahihcertify.com'
  },
  { href: "/audit-log", label: "Audit Log", icon: History, adminOnly: true },
];

export function Layout({ children, user, onLogout }: LayoutProps) {
  const [location] = useLocation();
  const { data: notifications } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-5 border-b border-[#C78A5F]/30 bg-white">
        <div className="flex flex-col items-center gap-2">
          <img 
            src={sahihLogoPath} 
            alt="Sahih Certifications" 
            className="h-60 w-auto object-contain"
          />
          <div className="text-center">
            <span className="font-bold text-lg tracking-tight text-[#7A0C1A]">Sahih Hub</span>
            <p className="text-[10px] text-[#520812] uppercase tracking-widest font-medium">Digital Compliance</p>
          </div>
        </div>
      </div>
      
      <nav className="p-3 space-y-1 flex-1">
        {navItems
          .filter((item) => {
            if (item.adminOnly && user?.role !== 'admin') return false;
            if (item.canAccess && (!user || !item.canAccess(user))) return false;
            return true;
          })
          .map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm" 
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
      </nav>

      <BuddySidebarWidget />

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-center gap-2 text-[10px] text-sidebar-foreground/60">
          <Shield className="w-3 h-3" />
          <span>ISO 17021 Compliant</span>
        </div>
        <div className="text-[10px] text-sidebar-foreground/40 text-center mt-1">
          Doha, Qatar
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 z-50 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-20 bg-card border-b border-border sticky top-0 z-40 px-4 lg:px-6 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <img src={sahihLogoPath} alt="Logo" className="h-8 w-8 object-contain" />
              <span className="font-bold text-primary">Sahih-Hub</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="h-12 w-1.5 bg-primary rounded-full"></div>
            <div>
              <span className="text-2xl font-bold text-foreground">Sahih Hub - Management System</span>
              <p className="text-base text-muted-foreground">Document Control & Compliance</p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <Badge 
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="font-semibold text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => markAllRead.mutate()}
                      className="text-xs h-7"
                    >
                      <CheckCheck className="w-3 h-3 mr-1" />
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-auto">
                  {notifications && notifications.length > 0 ? (
                    notifications.slice(0, 10).map((notification) => (
                      <DropdownMenuItem 
                        key={notification.id} 
                        className={cn(
                          "flex flex-col items-start py-3 cursor-pointer",
                          !notification.isRead && "bg-accent"
                        )}
                      >
                        <span className="font-medium text-sm">{notification.title}</span>
                        <span className="text-xs text-muted-foreground line-clamp-2">{notification.message}</span>
                        <span className="text-xs text-muted-foreground/60 mt-1">
                          {notification.createdAt 
                            ? format(new Date(notification.createdAt), "MMM d, h:mm a")
                            : ""
                          }
                        </span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No notifications
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 px-3" data-testid="button-user-menu">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-semibold leading-none">{user.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{user.role.replace('_', ' ')}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-3 border-b bg-accent/50">
                    <p className="font-semibold text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <Badge className="mt-2 text-[10px] bg-primary">
                      {user.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onLogout}
                    className="text-destructive cursor-pointer"
                    data-testid="button-logout"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
