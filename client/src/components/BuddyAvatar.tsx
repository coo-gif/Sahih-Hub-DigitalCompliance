import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, AlertCircle, Sparkles, X, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import sahihLogo from "@assets/sahih_logo_buddy.png";

interface BuddyDialogue {
  id: number;
  dialogueType: string;
  message: string;
  isAcknowledged: boolean;
  createdAt: string;
}

interface BuddyStatusData {
  buddyName: string;
  compliance: {
    score: number;
    state: string;
  };
  stats: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
  };
  style: {
    colorClass: string;
    bgColorClass: string;
    animationClass: string;
  };
  pendingDialogues: BuddyDialogue[];
  lastUpdated: string;
}

const stateEmojis: Record<string, { icon: typeof CheckCircle; label: string }> = {
  flexing: { icon: Sparkles, label: "Excellent!" },
  healthy: { icon: CheckCircle, label: "Good job!" },
  tired: { icon: AlertTriangle, label: "Needs attention" },
  weak: { icon: AlertCircle, label: "Falling behind" },
  critical: { icon: AlertCircle, label: "Urgent action needed" },
};

export function BuddyAvatar({ compact = false }: { compact?: boolean }) {
  const { data: buddyStatus, isLoading } = useQuery<BuddyStatusData>({
    queryKey: ["/api/buddy/status"],
    refetchInterval: 60000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (dialogueId: number) => {
      return apiRequest("POST", `/api/buddy/dialogues/${dialogueId}/acknowledge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/status"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        {!compact && <div className="h-4 w-20 bg-muted rounded animate-pulse" />}
      </div>
    );
  }

  if (!buddyStatus) return null;

  const { compliance, style, pendingDialogues, buddyName } = buddyStatus;
  const stateInfo = stateEmojis[compliance.state] || stateEmojis.healthy;
  const StateIcon = stateInfo.icon;

  const getAvatarGradient = () => {
    if (compliance.score >= 90) return "from-emerald-400 to-teal-500";
    if (compliance.score >= 80) return "from-green-400 to-emerald-500";
    if (compliance.score >= 70) return "from-yellow-400 to-amber-500";
    if (compliance.score >= 60) return "from-orange-400 to-amber-600";
    return "from-red-400 to-rose-600";
  };

  const getScoreColor = () => {
    if (compliance.score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (compliance.score >= 80) return "text-green-600 dark:text-green-400";
    if (compliance.score >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (compliance.score >= 60) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  if (compact) {
    return (
      <motion.div
        className="relative"
        animate={compliance.score < 60 ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <div
          className={cn(
            "h-9 w-9 rounded-full overflow-hidden shadow-md ring-2",
            compliance.score >= 90 ? "ring-emerald-400" :
            compliance.score >= 80 ? "ring-green-400" :
            compliance.score >= 70 ? "ring-yellow-400" :
            compliance.score >= 60 ? "ring-orange-400" : "ring-red-400",
            compliance.score < 70 && "animate-pulse"
          )}
        >
          <img src={sahihLogo} alt="Buddy" className="h-full w-full object-cover" />
        </div>
        {pendingDialogues.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {pendingDialogues.length}
          </span>
        )}
      </motion.div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <motion.div
          className="relative"
          animate={
            compliance.score < 60
              ? { scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }
              : compliance.score < 70
              ? { opacity: [1, 0.6, 1] }
              : {}
          }
          transition={{ repeat: Infinity, duration: compliance.score < 60 ? 1.5 : 2 }}
        >
          <div
            className={cn(
              "h-12 w-12 rounded-full overflow-hidden shadow-lg ring-2",
              compliance.score >= 90 ? "ring-emerald-400" :
              compliance.score >= 80 ? "ring-green-400" :
              compliance.score >= 70 ? "ring-yellow-400" :
              compliance.score >= 60 ? "ring-orange-400" : "ring-red-400"
            )}
          >
            <img src={sahihLogo} alt="Buddy" className="h-full w-full object-cover" />
          </div>
          {compliance.score >= 90 && (
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Sparkles className="h-5 w-5 text-yellow-400" />
            </motion.div>
          )}
        </motion.div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{buddyName}</h4>
          <div className="flex items-center gap-1.5">
            <StateIcon className={cn("h-3.5 w-3.5", getScoreColor())} />
            <span className={cn("text-xs", getScoreColor())}>{stateInfo.label}</span>
          </div>
        </div>

        <div className="text-right">
          <div className={cn("text-lg font-bold", getScoreColor())}>{compliance.score}%</div>
          <div className="text-xs text-muted-foreground">Compliance</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Progress
          value={compliance.score}
          className="h-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{buddyStatus.stats.completedTasks}/{buddyStatus.stats.totalTasks} tasks</span>
          {buddyStatus.stats.overdueTasks > 0 && (
            <span className="text-red-500">{buddyStatus.stats.overdueTasks} overdue</span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {pendingDialogues.slice(0, 2).map((dialogue) => (
          <motion.div
            key={dialogue.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="p-2.5 rounded-lg bg-muted/50 border border-border text-xs"
          >
            <div className="flex justify-between items-start gap-2">
              <p className="flex-1">{dialogue.message}</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 shrink-0"
                onClick={() => acknowledgeMutation.mutate(dialogue.id)}
                disabled={acknowledgeMutation.isPending}
                data-testid={`button-acknowledge-dialogue-${dialogue.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function BuddySidebarWidget() {
  return (
    <div className="border-t border-sidebar-border">
      <BuddyAvatar />
    </div>
  );
}