import { useDashboardStats, useComplianceAlerts, useRecentActivity } from "@/hooks/use-dashboard";
import { useMyTasks, useCompleteTask } from "@/hooks/use-tasks";
import { useUsers } from "@/hooks/use-users";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
  ClipboardList,
  FileCheck,
  FilePen,
  FileSignature,
  LayoutDashboard,
  Activity,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Sun,
  Moon,
  CloudSun,
  Target,
  Award,
  BarChart3,
  RefreshCw
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useState, useEffect, useMemo, useId } from "react";
import type { MyTask } from "@/hooks/use-tasks";

const motivationalQuotes = [
  { quote: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { quote: "Excellence is not a destination but a continuous journey.", author: "Brian Tracy" },
  { quote: "The quality of our work reflects the quality of ourselves.", author: "Unknown" },
  { quote: "Standards are not made to be broken, but to be exceeded.", author: "ISO Philosophy" },
  { quote: "Compliance today means confidence tomorrow.", author: "Quality Wisdom" },
  { quote: "Every document tells a story of excellence.", author: "QMS Principles" },
  { quote: "Precision in process, perfection in outcome.", author: "ISO 17021" },
  { quote: "Your commitment to quality is your signature of excellence.", author: "Unknown" },
];

const getTimeGreeting = (): { greeting: string; icon: JSX.Element; period: string } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { greeting: "Good Morning", icon: <Sun className="w-6 h-6 text-amber-500" />, period: "morning" };
  } else if (hour >= 12 && hour < 17) {
    return { greeting: "Good Afternoon", icon: <CloudSun className="w-6 h-6 text-orange-500" />, period: "afternoon" };
  } else if (hour >= 17 && hour < 21) {
    return { greeting: "Good Evening", icon: <CloudSun className="w-6 h-6 text-purple-500" />, period: "evening" };
  } else {
    return { greeting: "Good Night", icon: <Moon className="w-6 h-6 text-indigo-400" />, period: "night" };
  }
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useComplianceAlerts();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: myTasks, isLoading: tasksLoading } = useMyTasks();
  const { data: allUsers } = useUsers();
  const completeTaskMutation = useCompleteTask();
  const { toast } = useToast();

  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskComments, setTaskComments] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return motivationalQuotes[dayOfYear % motivationalQuotes.length];
  }, []);

  const timeInfo = useMemo(() => getTimeGreeting(), [currentTime]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const complianceScore = useMemo(() => {
    if (!stats?.totalDocuments) return 0;
    return Math.round(((stats.approvedDocuments || 0) / stats.totalDocuments) * 100);
  }, [stats]);

  const gradientId = useId();
  
  const tickerItems = useMemo(() => {
    if (!activity?.length) return [];
    return [...activity, ...activity];
  }, [activity]);

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'prepare':
        return <FilePen className="w-4 h-4 text-blue-600" />;
      case 'review':
        return <FileCheck className="w-4 h-4 text-amber-600" />;
      case 'approve':
        return <FileSignature className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTaskBadgeColor = (taskType: string) => {
    switch (taskType) {
      case 'prepare':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-amber-100 text-amber-800';
      case 'approve':
        return 'bg-green-100 text-green-800';
      default:
        return '';
    }
  };

  const handleOpenTask = (task: MyTask) => {
    setSelectedTask(task);
    setTaskComments("");
    setShowTaskDialog(true);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    
    try {
      await completeTaskMutation.mutateAsync({
        documentId: selectedTask.documentId,
        taskType: selectedTask.taskType,
        comments: taskComments || undefined,
      });
      
      toast({
        title: "Task Completed",
        description: `Successfully completed ${selectedTask.taskType} task for ${selectedTask.documentCode}`,
      });
      
      setShowTaskDialog(false);
      setSelectedTask(null);
      setTaskComments("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-semibold" data-testid="text-error-title">Failed to load dashboard</h2>
        <p className="text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
      </div>
    );
  }

  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6 pb-8">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(139, 0, 0, 0.1); }
          50% { box-shadow: 0 0 40px rgba(139, 0, 0, 0.2); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .glass-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.18);
        }
        .stat-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .stat-card:hover {
          transform: translateY(-4px);
        }
        .progress-ring {
          transition: stroke-dashoffset 1s ease-in-out;
        }
        .ticker-scroll {
          animation: ticker 30s linear infinite;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-card:hover { transform: none; }
          .glass-card { animation: none !important; }
          .ticker-scroll { animation: none; }
          .progress-ring { transition: none; }
          .animate-pulse, .animate-ping { animation: none; }
        }
      `}</style>

      {/* Hero Section with Dynamic Greeting */}
      <div 
        className="relative overflow-hidden rounded-2xl p-6 lg:p-8"
        style={{
          background: 'linear-gradient(135deg, #8B0000 0%, #5c0000 50%, #3a0000 100%)',
        }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-300 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {timeInfo.icon}
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white" data-testid="text-greeting">
                  {timeInfo.greeting}!
                </h1>
                <p className="text-white/70 text-sm">
                  {format(currentTime, "EEEE, MMMM d, yyyy")} • {format(currentTime, "h:mm a")}
                </p>
              </div>
            </div>
            
            <div className="max-w-lg">
              <p className="text-white/90 italic text-lg" data-testid="text-quote">
                "{dailyQuote.quote}"
              </p>
              <p className="text-amber-300/80 text-sm mt-1">— {dailyQuote.author}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div 
              className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ animation: 'float 3s ease-in-out infinite' }}
            >
              <div className="p-2 rounded-lg bg-white/20">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs">Today's Focus</p>
                <p className="text-white font-semibold" data-testid="text-focus">
                  {(myTasks?.length || 0) > 0 ? `${myTasks?.length} Tasks Pending` : 'All Clear!'}
                </p>
              </div>
            </div>
            
            <div 
              className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ animation: 'float 3s ease-in-out infinite 0.5s' }}
            >
              <div className="p-2 rounded-lg bg-white/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs">Compliance Score</p>
                <p className="text-white font-semibold" data-testid="text-score">{complianceScore}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex" data-testid="tabs-dashboard-nav">
          <TabsTrigger 
            value="dashboard" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2"
            data-testid="tab-dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger 
            value="compliance" 
            onClick={() => document.getElementById('compliance-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2"
            data-testid="tab-compliance"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger 
            value="documents" 
            onClick={() => navigate("/documents")}
            className="flex items-center gap-2"
            data-testid="tab-new-document"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            onClick={() => navigate("/users")}
            className="flex items-center gap-2"
            data-testid="tab-manage-users"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          data-testid="card-total-documents"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => navigate("/documents")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <TrendingUp className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-total-documents" style={{ animation: 'countUp 0.5s ease-out' }}>
                  {stats?.totalDocuments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <div className="mt-2 flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">{stats?.approvedDocuments || 0} approved</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          data-testid="card-pending-approvals"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => navigate("/documents")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              {(stats?.pendingApprovals || 0) > 0 && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-amber-600" data-testid="text-pending-approvals" style={{ animation: 'countUp 0.5s ease-out 0.1s backwards' }}>
                  {stats?.pendingApprovals || 0}
                </div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">Awaiting review</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          data-testid="card-expiring-soon"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => document.getElementById('compliance-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-yellow-600" data-testid="text-expiring-documents" style={{ animation: 'countUp 0.5s ease-out 0.2s backwards' }}>
                  {stats?.expiringDocuments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs border-yellow-200 text-yellow-700">Within 30 days</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          data-testid="card-non-compliant"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => document.getElementById('compliance-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              {(stats?.nonCompliantDocuments || 0) > 0 && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-red-600" data-testid="text-non-compliant" style={{ animation: 'countUp 0.5s ease-out 0.3s backwards' }}>
                  {stats?.nonCompliantDocuments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Non-Compliant</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs border-red-200 text-red-700">Overdue review</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Health & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compliance Score Ring */}
        <Card className="lg:col-span-1" data-testid="card-compliance-ring">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted/20"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke={`url(#${gradientId})`}
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  className="progress-ring"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - complianceScore / 100)}`}
                />
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8B0000" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold" data-testid="text-compliance-ring-value">{complianceScore}%</span>
                <span className="text-sm text-muted-foreground">Compliant</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <h3 className="font-semibold">Compliance Health</h3>
              <p className="text-sm text-muted-foreground">
                {complianceScore >= 90 ? "Excellent" : complianceScore >= 70 ? "Good" : complianceScore >= 50 ? "Needs Improvement" : "Critical"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Cards */}
        <Card className="lg:col-span-2" data-testid="card-quick-stats">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Quick Insights
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 cursor-pointer hover-elevate transition-all"
                onClick={() => navigate("/users")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Active Users</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">{stats?.pendingInductions || 0} pending induction</p>
              </div>
              
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 cursor-pointer hover-elevate transition-all"
                onClick={() => navigate("/documents")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Approved</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{stats?.approvedDocuments || 0}</p>
                <p className="text-xs text-muted-foreground">Documents approved</p>
              </div>
              
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 cursor-pointer hover-elevate transition-all"
                onClick={() => navigate("/documents")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium">Success Rate</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">{complianceScore}%</p>
                <p className="text-xs text-muted-foreground">Document approval rate</p>
              </div>
              
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 cursor-pointer hover-elevate transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium">Active Tasks</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{myTasks?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Pending your action</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Activity Ticker */}
      {tickerItems.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-muted/30 border" data-testid="activity-ticker">
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-medium">Live Activity Feed</span>
          </div>
          <div className="relative h-10 overflow-hidden">
            <div className="ticker-scroll flex items-center gap-8 absolute whitespace-nowrap py-2 px-4">
              {tickerItems.map((log, idx) => (
                <span key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  <span className="font-medium">{log.action.replace('_', ' ')}</span>
                  <span>on {log.entityType}</span>
                  <span className="text-xs opacity-70">
                    {log.createdAt ? format(new Date(log.createdAt), 'h:mm a') : ''}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div id="compliance-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Alerts */}
        <Card data-testid="card-compliance-alerts">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <CardTitle>Compliance Alerts</CardTitle>
                  <CardDescription>Documents requiring attention</CardDescription>
                </div>
              </div>
              <Link href="/documents">
                <Button variant="ghost" size="sm" data-testid="link-view-all-documents">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Skeleton className="h-4 w-4" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                ))
              ) : alerts && alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert, idx) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer ${
                      alert.alertLevel === 'red' 
                        ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50' 
                        : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/50'
                    }`}
                    style={{ animation: `slideIn 0.3s ease-out ${idx * 0.1}s backwards` }}
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {alert.alertLevel === 'red' ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        )}
                        <div>
                          <p className="font-medium text-sm" data-testid={`text-alert-code-${alert.id}`}>{alert.documentCode}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={alert.alertLevel === 'red' ? 'destructive' : 'secondary'}
                        data-testid={`badge-alert-${alert.id}`}
                      >
                        {alert.daysUntilExpiry < 0 
                          ? `${Math.abs(alert.daysUntilExpiry)}d overdue`
                          : `${alert.daysUntilExpiry}d left`
                        }
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-alerts">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-3 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="font-medium">All documents are compliant</p>
                  <p className="text-sm">Great job maintaining standards!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-testid="card-recent-activity">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Audit trail of recent actions</CardDescription>
                </div>
              </div>
              <Link href="/audit-log">
                <Button variant="ghost" size="sm" data-testid="link-view-all-activity">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : activity && activity.length > 0 ? (
                activity.slice(0, 5).map((log, idx) => (
                  <div 
                    key={log.id} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    style={{ animation: `slideIn 0.3s ease-out ${idx * 0.1}s backwards` }}
                    data-testid={`activity-${log.id}`}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-activity-action-${log.id}`}>
                        {log.action.replace('_', ' ')} on {log.entityType}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-activity-time-${log.id}`}>
                        {log.createdAt ? format(new Date(log.createdAt), 'MMM d, h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activity">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Tasks Section */}
      <Card data-testid="card-my-tasks">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>My Tasks</CardTitle>
                <CardDescription>Documents assigned to you for action</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm px-3 py-1" data-testid="badge-task-count">
              <Sparkles className="w-3 h-3 mr-1" />
              {myTasks?.length || 0} pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasksLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-20" />
                  </div>
                </div>
              ))
            ) : myTasks && myTasks.length > 0 ? (
              myTasks.map((task, idx) => (
                <div 
                  key={`${task.documentId}-${task.taskType}`} 
                  className="p-4 rounded-xl border hover:border-primary/50 hover:shadow-lg cursor-pointer transition-all group"
                  style={{ animation: `slideIn 0.3s ease-out ${idx * 0.1}s backwards` }}
                  onClick={() => handleOpenTask(task)}
                  data-testid={`task-${task.documentId}-${task.taskType}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                        {getTaskIcon(task.taskType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium" data-testid={`text-task-code-${task.documentId}`}>{task.documentCode}</p>
                          <Badge className={getTaskBadgeColor(task.taskType)} data-testid={`badge-task-type-${task.documentId}`}>
                            {task.taskType.charAt(0).toUpperCase() + task.taskType.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-task-title-${task.documentId}`}>{task.title}</p>
                      </div>
                    </div>
                    <Button size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors" data-testid={`button-open-task-${task.documentId}`}>
                      Open
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-tasks">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <p className="font-medium text-lg">No pending tasks</p>
                <p className="text-sm">You're all caught up! Great work!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task Completion Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask && getTaskIcon(selectedTask.taskType)}
              Complete Task: {selectedTask?.taskType.charAt(0).toUpperCase()}{selectedTask?.taskType.slice(1)}
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.documentCode} - {selectedTask?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Task Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Document:</span>
                  <span className="ml-2 font-medium">{selectedTask?.documentCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Action:</span>
                  <span className="ml-2 font-medium capitalize">{selectedTask?.taskType}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Comments (optional)</Label>
              <Textarea
                id="comments"
                placeholder="Add any comments about completing this task..."
                value={taskComments}
                onChange={(e) => setTaskComments(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Link href={`/documents/${selectedTask?.documentId}/edit`} className="flex-1">
                <Button variant="outline" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  View Document
                </Button>
              </Link>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteTask}
              disabled={completeTaskMutation.isPending}
            >
              {completeTaskMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
