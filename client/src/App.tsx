import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import NewDocument from "@/pages/NewDocument";
import EditDocument from "@/pages/EditDocument";
import Users from "@/pages/Users";
import Employees from "@/pages/Employees";
import HROrganogram from "@/pages/HROrganogram";
import AuditLog from "@/pages/AuditLog";
import MyTasks from "@/pages/MyTasks";
import UserRecords from "@/pages/UserRecords";
import PerformanceReports from "@/pages/PerformanceReports";
import BugReports from "@/pages/BugReports";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { HubEebiChat } from "@/components/HubEebiChat";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

function AuthenticatedRouter({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <>
      <Layout user={user} onLogout={onLogout}>
        <div className="pb-16 lg:pb-0">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/documents" component={Documents} />
            <Route path="/documents/new" component={NewDocument} />
            <Route path="/documents/:id/edit" component={EditDocument} />
            <Route path="/users" component={Users} />
            <Route path="/hr" component={HROrganogram} />
            <Route path="/employees" component={Employees} />
            <Route path="/tasks" component={MyTasks} />
            <Route path="/user-records" component={UserRecords} />
            <Route path="/performance-reports" component={PerformanceReports} />
            <Route path="/bug-reports" component={BugReports} />
            <Route path="/audit-log" component={AuditLog} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </Layout>
      <MobileBottomNav />
      <PWAInstallPrompt />
      <HubEebiChat />
    </>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = async () => {
    await checkAuth();
  };

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      setUser(null);
      queryClient.clear();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {user ? (
          <AuthenticatedRouter user={user} onLogout={handleLogout} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
