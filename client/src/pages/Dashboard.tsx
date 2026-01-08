import { useTasks } from "@/hooks/use-tasks";
import { usePolicies } from "@/hooks/use-policies";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Link } from "wouter";
import { TaskForm } from "@/components/TaskForm";
import { PolicyForm } from "@/components/PolicyForm";
import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: policies, isLoading: policiesLoading } = usePolicies();
  
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);

  // Stats calculation
  const totalTasks = tasks?.length || 0;
  const compliantTasks = tasks?.filter(t => t.status === "compliant").length || 0;
  const pendingTasks = tasks?.filter(t => t.status === "pending" || t.status === "in_progress").length || 0;
  const complianceRate = totalTasks ? Math.round((compliantTasks / totalTasks) * 100) : 0;
  const activePolicies = policies?.filter(p => p.isActive).length || 0;

  // Chart data
  const chartData = [
    { name: "Mon", tasks: 4 },
    { name: "Tue", tasks: 3 },
    { name: "Wed", tasks: 7 },
    { name: "Thu", tasks: 2 },
    { name: "Fri", tasks: 5 },
  ];

  if (tasksLoading || policiesLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your compliance status</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowPolicyForm(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Add Policy
          </Button>
          <Button onClick={() => setShowTaskForm(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-lg shadow-slate-200/50 border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle2 className="w-24 h-24 text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900">{complianceRate}%</div>
            <p className="text-sm text-slate-500 mt-1">Based on {totalTasks} total tasks</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg shadow-slate-200/50 border-slate-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle className="w-24 h-24 text-amber-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pending Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900">{pendingTasks}</div>
            <p className="text-sm text-slate-500 mt-1">Tasks needing attention</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg shadow-slate-200/50 border-slate-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
            <FileText className="w-24 h-24 text-blue-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900">{activePolicies}</div>
            <p className="text-sm text-slate-500 mt-1">Currently enforced</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity / Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-100 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Tasks</CardTitle>
                <CardDescription>Latest compliance tasks assigned</CardDescription>
              </div>
              <Link href="/tasks" className="text-sm text-primary hover:underline flex items-center">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tasks?.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-900">{task.title}</span>
                      <span className="text-xs text-slate-500">Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
                {(!tasks || tasks.length === 0) && (
                  <div className="text-center py-8 text-slate-500">No tasks found.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Chart */}
        <div className="space-y-6">
          <Card className="border-slate-100 shadow-md h-full">
            <CardHeader>
              <CardTitle>Task Completion</CardTitle>
              <CardDescription>Activity over the last 5 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskForm open={showTaskForm} onOpenChange={setShowTaskForm} />
      <PolicyForm open={showPolicyForm} onOpenChange={setShowPolicyForm} />
    </div>
  );
}
