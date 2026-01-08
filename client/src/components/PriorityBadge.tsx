import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const getPriorityColor = (p: string) => {
    switch (p.toLowerCase()) {
      case "high":
        return "text-red-600 bg-red-50 border-red-100";
      case "medium":
        return "text-amber-600 bg-amber-50 border-amber-100";
      case "low":
        return "text-emerald-600 bg-emerald-50 border-emerald-100";
      default:
        return "text-gray-600 bg-gray-50 border-gray-100";
    }
  };

  return (
    <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full border", getPriorityColor(priority))}>
      {priority.toUpperCase()}
    </span>
  );
}
