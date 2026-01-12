import { useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useEmployees } from "@/hooks/use-employees";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Network, UserCircle, ChevronDown, Building2 } from "lucide-react";
import type { Employee } from "@shared/schema";

interface OrgNode {
  employee: Employee;
  children: OrgNode[];
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  on_leave: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  terminated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function buildOrgTree(employees: Employee[]): OrgNode[] {
  const employeeIds = new Set(employees.map(e => e.id));
  const childrenMap = new Map<number | null, Employee[]>();
  
  employees.forEach(emp => {
    const parentId = emp.supervisorId;
    const effectiveParentId = parentId && employeeIds.has(parentId) ? parentId : null;
    if (!childrenMap.has(effectiveParentId)) {
      childrenMap.set(effectiveParentId, []);
    }
    childrenMap.get(effectiveParentId)!.push(emp);
  });
  
  function buildNode(employee: Employee): OrgNode {
    const children = childrenMap.get(employee.id) || [];
    return {
      employee,
      children: children.map(child => buildNode(child)),
    };
  }
  
  const roots = childrenMap.get(null) || [];
  return roots.map(root => buildNode(root));
}

function EmployeeCard({ employee }: { employee: Employee }) {
  const initials = employee.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="w-56 hover-elevate" data-testid={`org-card-${employee.id}`}>
      <CardContent className="p-4 flex flex-col items-center text-center">
        <Avatar className="h-16 w-16 mb-3">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-sm" data-testid={`org-name-${employee.id}`}>{employee.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{employee.jobTitle}</p>
        <Badge variant="outline" className="mt-2 text-xs">
          {employee.department}
        </Badge>
        <Badge className={`mt-2 text-xs ${statusColors[employee.status] || ""}`}>
          {employee.status.replace("_", " ")}
        </Badge>
      </CardContent>
    </Card>
  );
}

function OrgNodeComponent({ node }: { node: OrgNode }) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <EmployeeCard employee={node.employee} />
      
      {hasChildren && (
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-6 bg-border" />
          <div className="flex items-start gap-4">
            {node.children.map((child, index) => (
              <div key={child.employee.id} className="flex flex-col items-center relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-border" />
                {node.children.length > 1 && (
                  <div 
                    className={`absolute top-0 h-0.5 bg-border ${
                      index === 0 ? 'left-1/2 right-0 w-[calc(50%+8px)]' :
                      index === node.children.length - 1 ? 'right-1/2 left-0 w-[calc(50%+8px)]' :
                      'left-0 right-0 w-full'
                    }`}
                    style={{
                      left: index === 0 ? '50%' : index === node.children.length - 1 ? undefined : '-8px',
                      right: index === node.children.length - 1 ? '50%' : index === 0 ? undefined : '-8px',
                      width: index === 0 || index === node.children.length - 1 ? undefined : 'calc(100% + 16px)',
                    }}
                  />
                )}
                <div className="pt-3">
                  <OrgNodeComponent node={child} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HROrganogram() {
  const [, navigate] = useLocation();
  const { data: employees, isLoading, isError } = useEmployees();

  const orgTree = useMemo(() => {
    if (!employees) return [];
    return buildOrgTree(employees);
  }, [employees]);

  const stats = useMemo(() => {
    if (!employees) return { total: 0, active: 0, departments: 0 };
    const departments = new Set(employees.map(e => e.department));
    return {
      total: employees.length,
      active: employees.filter(e => e.status === "active").length,
      departments: departments.size,
    };
  }, [employees]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-background border-b px-6 py-4">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex-1 p-6 flex items-center justify-center">
          <Skeleton className="h-64 w-96" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-destructive">Error loading employees</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-background border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Network className="w-6 h-6" />
              Organization Chart
            </h1>
            <p className="text-muted-foreground">View company structure and reporting relationships</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/employees">
              <Button variant="outline" data-testid="button-view-employees">
                <Users className="h-4 w-4 mr-2" />
                View Employees
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 max-w-md">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-active">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-departments">{stats.departments}</p>
                <p className="text-xs text-muted-foreground">Departments</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {employees && employees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Network className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No employees yet</p>
            <p className="text-sm mt-1">Add employees to see the organizational chart</p>
            <Link href="/employees">
              <Button className="mt-4" data-testid="button-add-first-employee">
                <Users className="h-4 w-4 mr-2" />
                Go to Employees
              </Button>
            </Link>
          </div>
        ) : orgTree.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Network className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No reporting structure defined</p>
            <p className="text-sm mt-1">Assign supervisors to employees to see the organizational chart</p>
            <Link href="/employees">
              <Button className="mt-4" data-testid="button-edit-employees">
                <Users className="h-4 w-4 mr-2" />
                Edit Employees
              </Button>
            </Link>
          </div>
        ) : (
          <div className="min-w-max">
            <div className="flex flex-col items-center gap-0">
              {orgTree.map((rootNode) => (
                <div key={rootNode.employee.id} className="mb-8">
                  <OrgNodeComponent node={rootNode} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
