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
  UserCog,
  LogOut,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import sahihLogoPath from "@assets/sahih_logo-1.png";

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

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/users", label: "Users", icon: Users },
  { href: "/employees", label: "HR - Employees", icon: UserCog },
  { href: "/audit-log", label: "Audit Log", icon: History },
];

export function Layout({ children, user, onLogout }: LayoutProps) {
  const [location] = useLocation();
  const { data: notifications } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-4 border-b border-slate-700">
        <div className="flex flex-col items-center gap-2">
          <img 
            src={sahihLogoPath} 
            alt="Sahih Certifications" 
            className="h-12 object-contain brightness-0 invert"
            data-testid="img-sidebar-logo"
          />
          <p className="text-xs text-slate-400 text-center">QMS Dashboard</p>
        </div>
      </div>
      
      <nav className="p-4 space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 text-center">
          ISO 17021 Compliant<br />
          Doha, Qatar
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-20 bg-white border-b sticky top-0 z-40 px-4 lg:px-6 flex items-center gap-4">
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
          </div>

          {/* Centered Logo - 3x larger */}
          <div className="flex-1 flex justify-center">
            <img 
              src={sahihLogoPath} 
              alt="Sahih Certifications" 
              className="h-16 object-contain"
              data-testid="img-header-logo"
            />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      variant="destructive"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="font-semibold">Notifications</span>
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
                          !notification.isRead && "bg-blue-50"
                        )}
                      >
                        <span className="font-medium text-sm">{notification.title}</span>
                        <span className="text-xs text-slate-500 line-clamp-2">{notification.message}</span>
                        <span className="text-xs text-slate-400 mt-1">
                          {notification.createdAt 
                            ? format(new Date(notification.createdAt), "MMM d, h:mm a")
                            : ""
                          }
                        </span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-500 text-sm">
                      No notifications
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-user-menu">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b">
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">
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
