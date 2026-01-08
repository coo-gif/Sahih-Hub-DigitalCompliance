import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusStyles = (s: string) => {
    switch (s.toLowerCase()) {
      case "compliant":
      case "completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200";
      case "non_compliant":
      case "failed":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200";
      case "pending":
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
    }
  };

  const formatStatus = (s: string) => {
    return s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <Badge 
      variant="outline" 
      className={cn("px-3 py-1 font-medium border shadow-sm", getStatusStyles(status))}
    >
      {formatStatus(status)}
    </Badge>
  );
}
