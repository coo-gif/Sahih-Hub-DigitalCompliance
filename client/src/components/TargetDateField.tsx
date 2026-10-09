import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock } from "lucide-react";

// Default days allowed per step (keep in step with DEFAULT_TARGET_DAYS in shared/schema.ts)
export const TARGET_DAYS = {
  prepare: 2,
  review: 1,
  approve: 1,
  hub_approval: 1,
  revise: 2,
  comment: 1,
  employee_review: 1,
  employee_approve: 1,
} as const;

// "yyyy-MM-dd" for today + N days, the value a date input expects
export function defaultTargetInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

// The end of the chosen day in the user's time zone, as sent to the server
export function targetToIso(value: string): string | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

interface TargetDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  defaultDays?: number;
  id?: string;
}

export function TargetDateField({ value, onChange, label = "Target completion date", defaultDays, id = "target-date" }: TargetDateFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <CalendarClock className="w-4 h-4 text-muted-foreground" />
        {label} <span className="text-red-500">*</span>
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        min={format(new Date(), "yyyy-MM-dd")}
        onChange={(e) => onChange(e.target.value)}
        required
        data-testid={`input-${id}`}
      />
      {defaultDays !== undefined && (
        <p className="text-xs text-muted-foreground">
          Default: {defaultDays} day{defaultDays === 1 ? "" : "s"}. Performance is measured against this date.
        </p>
      )}
    </div>
  );
}
