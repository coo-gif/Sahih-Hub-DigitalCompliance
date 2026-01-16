import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, AlertCircle, Sparkles, X, MessageCircle, Clock, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

import hubEebiFormal from "@assets/generated_images/smart_genie_full_body_formal.png";
import hubEebiCasual from "@assets/generated_images/smart_genie_full_body_casual.png";
import hubEebiSweater from "@assets/generated_images/smart_genie_sweater_outfit.png";
import hubEebiVest from "@assets/generated_images/smart_genie_vest_outfit.png";
import hubEebiBlazer from "@assets/generated_images/smart_genie_blazer_outfit.png";
import hubEebiHeadshot from "@assets/generated_images/smart_genie_mascot_headshot.png";

const hubEebiOutfits = [
  hubEebiFormal,
  hubEebiCasual,
  hubEebiSweater,
  hubEebiVest,
  hubEebiBlazer,
];

const getDailyOutfit = () => {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return hubEebiOutfits[dayOfYear % hubEebiOutfits.length];
};

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

const stateEmojis: Record<string, { icon: typeof CheckCircle; label: string; message: string }> = {
  flexing: { icon: Sparkles, label: "Excellent!", message: "You're doing amazing! Keep up the stellar work!" },
  healthy: { icon: CheckCircle, label: "Good job!", message: "Great progress! Your compliance is on track." },
  tired: { icon: AlertTriangle, label: "Needs attention", message: "Let's focus on those pending tasks together." },
  weak: { icon: AlertCircle, label: "Falling behind", message: "I'm worried about some overdue items. Need help?" },
  critical: { icon: AlertCircle, label: "Urgent!", message: "We need to act now! Several tasks are overdue." },
};

export function HubEebiFullBody({ className }: { className?: string }) {
  const { data: buddyStatus } = useQuery<BuddyStatusData>({
    queryKey: ["/api/buddy/status"],
    refetchInterval: 30000,
  });

  const dailyOutfit = getDailyOutfit();
  const compliance = buddyStatus?.compliance || { score: 75, state: 'healthy' };
  const stats = buddyStatus?.stats || { totalTasks: 0, completedTasks: 0, overdueTasks: 0 };
  const pendingTasks = stats.totalTasks - stats.completedTasks;
  const stateInfo = stateEmojis[compliance.state] || stateEmojis.healthy;

  const encouragingQuotes = [
    "All caught up! Time to make today amazing.",
    "You're crushing it! Ready for new challenges?",
    "Clean slate! What great things will you accomplish?",
    "All done! Success is built one task at a time.",
    "Way to go! Take a moment to celebrate your wins.",
  ];

  const getMessage = () => {
    if (stats.overdueTasks > 0) {
      return `You have ${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? 's' : ''}! Let's tackle them together.`;
    }
    if (pendingTasks > 0) {
      return `${pendingTasks} task${pendingTasks > 1 ? 's' : ''} waiting for you. You've got this!`;
    }
    if (stats.totalTasks === 0) {
      return "Ready to start your day? Let's add some tasks!";
    }
    const quoteIndex = new Date().getDate() % encouragingQuotes.length;
    return encouragingQuotes[quoteIndex];
  };

  const getImageStyle = () => {
    if (compliance.score >= 90) {
      return { filter: 'saturate(1.3) brightness(1.1)', transform: 'scale(1.02)' };
    }
    if (compliance.score >= 80) {
      return { filter: 'saturate(1.1) brightness(1.05)' };
    }
    if (compliance.score >= 70) {
      return { filter: 'saturate(1)' };
    }
    if (compliance.score >= 60) {
      return { filter: 'saturate(0.8) brightness(0.95)' };
    }
    if (compliance.score >= 50) {
      return { filter: 'saturate(0.6) brightness(0.9)' };
    }
    return { filter: 'saturate(0.4) brightness(0.85) grayscale(0.3)' };
  };

  const getAnimationClass = () => {
    if (compliance.score >= 90) return "animate-pulse";
    if (compliance.score < 50) return "opacity-80";
    return "";
  };

  return (
    <motion.div 
      className={cn("relative flex flex-col items-center", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative">
        <motion.img 
          src={dailyOutfit} 
          alt="Hub-eebi" 
          className={cn("h-20 sm:h-24 lg:h-28 w-auto object-contain drop-shadow-lg transition-all duration-500", getAnimationClass())}
          style={getImageStyle()}
          animate={compliance.score >= 90 ? { 
            y: [0, -3, 0],
          } : compliance.score < 50 ? {
            y: [0, 2, 0],
          } : {}}
          transition={{ 
            duration: compliance.score >= 90 ? 2 : 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {compliance.score >= 90 && (
          <motion.div 
            className="absolute -top-2 left-1/2 -translate-x-1/2"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-6 w-6 text-yellow-400 drop-shadow-lg" />
          </motion.div>
        )}
        
        <div className={cn(
          "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white",
          compliance.score >= 80 ? "bg-green-500" :
          compliance.score >= 60 ? "bg-yellow-500" : "bg-red-500"
        )}>
          {compliance.score >= 80 ? (
            <CheckCircle className="w-3.5 h-3.5 text-white" />
          ) : compliance.score >= 60 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-white" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-white" />
          )}
        </div>
      </div>
      
      <motion.div
        className="mt-1 max-w-[160px] bg-white/95 backdrop-blur-sm rounded-md px-2 py-1.5 shadow-md border border-white/50"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-start gap-1.5">
          <MessageCircle className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-[9px] sm:text-[10px] text-foreground leading-tight">{getMessage()}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

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

  const dailyOutfit = getDailyOutfit();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        {!compact && <div className="h-4 w-20 bg-muted rounded animate-pulse" />}
      </div>
    );
  }

  if (!buddyStatus) return null;

  const { compliance, pendingDialogues, buddyName, stats } = buddyStatus;
  const stateInfo = stateEmojis[compliance.state] || stateEmojis.healthy;
  const StateIcon = stateInfo.icon;
  const pendingTasks = stats.totalTasks - stats.completedTasks;

  const getScoreColor = () => {
    if (compliance.score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (compliance.score >= 80) return "text-green-600 dark:text-green-400";
    if (compliance.score >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (compliance.score >= 60) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getBorderColor = () => {
    if (compliance.score >= 90) return "border-emerald-400";
    if (compliance.score >= 80) return "border-green-400";
    if (compliance.score >= 70) return "border-yellow-400";
    if (compliance.score >= 60) return "border-orange-400";
    return "border-red-400";
  };

  const encouragingQuotes = [
    "All caught up! Time to make today amazing.",
    "You're crushing it! Ready for new challenges?",
    "Clean slate! What great things will you accomplish?",
    "All done! Success is built one task at a time.",
    "Way to go! Take a moment to celebrate your wins.",
  ];

  const getMessage = () => {
    if (stats.overdueTasks > 0) {
      return `${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? 's' : ''}! Let's fix this.`;
    }
    if (pendingTasks > 0) {
      return `${pendingTasks} pending task${pendingTasks > 1 ? 's' : ''}. You've got this!`;
    }
    if (stats.totalTasks === 0) {
      return "Ready to start your day? Let's add some tasks!";
    }
    const quoteIndex = new Date().getDate() % encouragingQuotes.length;
    return encouragingQuotes[quoteIndex];
  };

  if (compact) {
    return (
      <div className="relative">
        <div className="h-12 w-10 overflow-hidden">
          <img src={dailyOutfit} alt="Hub-eebi" className="h-full w-full object-contain" />
        </div>
        {pendingDialogues.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {pendingDialogues.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className={cn("h-14 w-14 overflow-hidden rounded-full border-2 bg-gradient-to-b from-sidebar/80 to-sidebar/40 shadow-lg", getBorderColor())}>
            <motion.img 
              src={hubEebiHeadshot} 
              alt="Hub-eeeebi" 
              className="h-full w-full object-cover transition-all duration-500"
              style={{
                filter: compliance.score >= 90 ? 'saturate(1.3) brightness(1.1)' :
                        compliance.score >= 80 ? 'saturate(1.1) brightness(1.05)' :
                        compliance.score >= 70 ? 'saturate(1)' :
                        compliance.score >= 60 ? 'saturate(0.8) brightness(0.95)' :
                        compliance.score >= 50 ? 'saturate(0.6) brightness(0.9)' :
                        'saturate(0.4) brightness(0.85) grayscale(0.3)'
              }}
              animate={compliance.score >= 90 ? { scale: [1, 1.02, 1] } : compliance.score < 50 ? { opacity: [1, 0.9, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          {compliance.score >= 90 && (
            <motion.div 
              className="absolute -top-1 -right-1"
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="h-4 w-4 text-yellow-400 drop-shadow" />
            </motion.div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm truncate">Hub-eeeebi</h4>
          <div className="flex items-center gap-1.5">
            <StateIcon className={cn("h-3.5 w-3.5", getScoreColor())} />
            <span className={cn("text-xs font-medium", getScoreColor())}>{stateInfo.label}</span>
          </div>
          <div className={cn("text-xl font-bold mt-1", getScoreColor())}>{compliance.score}%</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Progress value={compliance.score} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ListTodo className="w-3 h-3" />
            {stats.completedTasks}/{stats.totalTasks} tasks
          </span>
          {stats.overdueTasks > 0 && (
            <span className="text-red-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {stats.overdueTasks} overdue
            </span>
          )}
        </div>
      </div>

      <motion.div
        className="p-2.5 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="flex items-start gap-2">
          <MessageCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground leading-tight">{getMessage()}</p>
        </div>
      </motion.div>

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

export { getDailyOutfit, hubEebiOutfits };
