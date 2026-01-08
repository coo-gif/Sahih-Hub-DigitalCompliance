import { useTasks, useDeleteTask } from "@/hooks/use-tasks";
import { type Task } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MoreHorizontal, Plus, Search, Filter, Loader2, Trash, Edit } from "lucide-react";
import { TaskForm } from "@/components/TaskForm";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Tasks() {
  const { data: tasks, isLoading } = useTasks();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const filteredTasks = tasks?.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask.mutateAsync(id);
      toast({ title: "Task deleted", description: "The task has been permanently removed." });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingTask(undefined);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 mt-1">Manage compliance tasks and audits</p>
        </div>
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />
          Create Task
        </Button>
      </div>

      <Card className="border-slate-100 shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
             <div>
                <CardTitle>All Tasks</CardTitle>
                <CardDescription>A list of all compliance tracking items.</CardDescription>
             </div>
             <div className="flex gap-2 w-full md:w-auto">
               <div className="relative w-full md:w-64">
                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                 <Input 
                   placeholder="Search tasks..." 
                   className="pl-9"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
               </div>
               <Button variant="outline" size="icon">
                 <Filter className="h-4 w-4 text-slate-500" />
               </Button>
             </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks?.map((task) => (
                    <TableRow key={task.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{task.title}</span>
                          {task.description && (
                            <span className="text-xs text-slate-500 truncate max-w-[200px]">{task.description}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className="text-sm text-slate-600">
                            {format(new Date(task.dueDate), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">No due date</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(task)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-red-600 focus:text-red-600">
                              <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTasks?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                        No tasks found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TaskForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        task={editingTask} 
      />
    </div>
  );
}
