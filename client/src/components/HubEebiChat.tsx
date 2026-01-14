import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Draggable from "react-draggable";
import { 
  MessageCircle, X, Send, Bug, Upload, Camera, 
  CheckCircle, Clock, AlertCircle, Sparkles, ThumbsUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import hubEebiFormal from "@assets/generated_images/hub-eebi_formal_suit_avatar.png";
import hubEebiCasual from "@assets/generated_images/hub-eebi_casual_polo_avatar.png";
import hubEebiSweater from "@assets/generated_images/hub-eebi_sweater_avatar.png";
import hubEebiVest from "@assets/generated_images/hub-eebi_vest_avatar.png";
import hubEebiBlazer from "@assets/generated_images/hub-eebi_blazer_avatar.png";

const hubEebiOutfits = [hubEebiFormal, hubEebiCasual, hubEebiSweater, hubEebiVest, hubEebiBlazer];

const getDailyOutfit = () => {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return hubEebiOutfits[dayOfYear % hubEebiOutfits.length];
};

interface BugReport {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  screenshotUrl: string | null;
  priority: string;
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
  closedAt: string | null;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'hubeebi';
  message: string;
  timestamp: Date;
}


export function HubEebiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'hubeebi',
      message: "Hi there! I'm Hub-eebi, your AI-powered assistant for Sahih Hub! I can guide you step-by-step through any feature.\n\nTry asking me:\n• How do I create a document?\n• Where can I see my tasks?\n• How does the approval process work?\n\nI'm here to help you navigate the app with ease!",
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugPriority, setBugPriority] = useState("medium");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const dailyOutfit = getDailyOutfit();

  const { data: myBugReports = [] } = useQuery<BugReport[]>({
    queryKey: ["/api/my-bug-reports"],
    enabled: isOpen,
  });

  const createBugReportMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; priority: string; screenshotUrl?: string }) => {
      return apiRequest("POST", "/api/bug-reports", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-bug-reports"] });
      toast({ title: "Bug Report Submitted!", description: "Thank you for helping improve Hub-eebi's world!" });
      setBugTitle("");
      setBugDescription("");
      setBugPriority("medium");
      setScreenshotPreview(null);
      setActiveTab("reports");
      
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'hubeebi',
        message: "Thank you so much for reporting this issue! Your contribution helps make our Hub a better place for everyone. I've notified our team and they'll look into it right away!",
        timestamp: new Date(),
      }]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isAiLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: inputMessage,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage("");
    setIsAiLoading(true);

    // Create a placeholder for Hub-eebi's response that will be streamed
    const responseId = (Date.now() + 1).toString();
    setChatMessages(prev => [...prev, {
      id: responseId,
      type: 'hubeebi',
      message: '',
      timestamp: new Date(),
    }]);

    try {
      // Get conversation history (last 10 messages for context)
      const history = chatMessages.slice(-10).map(msg => ({
        type: msg.type,
        message: msg.message,
      }));

      const response = await fetch('/api/hubeebi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend, history }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullResponse += event.content;
              setChatMessages(prev => prev.map(msg =>
                msg.id === responseId ? { ...msg, message: fullResponse } : msg
              ));
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    } catch (error) {
      console.error('Hub-eebi AI error:', error);
      setChatMessages(prev => prev.map(msg =>
        msg.id === responseId 
          ? { ...msg, message: "I'm having a little trouble thinking right now. Please try again in a moment!" }
          : msg
      ));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitBugReport = () => {
    if (!bugTitle.trim() || !bugDescription.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    createBugReportMutation.mutate({
      title: bugTitle,
      description: bugDescription,
      priority: bugPriority,
      screenshotUrl: screenshotPreview || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Open</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">In Progress</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Resolved</Badge>;
      case 'closed':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/30">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <Draggable nodeRef={nodeRef} bounds="parent">
        <div ref={nodeRef} className="fixed top-20 right-4 z-50 cursor-move">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white px-3 py-2 rounded-full shadow-lg transition-colors"
            data-testid="button-open-hubeebi-chat"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-medium text-xs">Hub-eebi</span>
          </button>
        </div>
      </Draggable>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed top-32 right-4 z-50 w-96 max-w-[calc(100vw-3rem)] bg-background border rounded-xl shadow-2xl overflow-hidden"
            data-testid="hubeebi-chat-dialog"
          >
            <div className="bg-gradient-to-r from-cyan-500 to-teal-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-10 bg-white/20 rounded-lg overflow-hidden">
                  <img src={dailyOutfit} alt="Hub-eebi" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Hub-eebi</h3>
                  <p className="text-xs text-white/80">Your Compliance Buddy</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-hubeebi-chat"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 p-0 h-auto">
                <TabsTrigger value="chat" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2" data-testid="tab-chat">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="report" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2" data-testid="tab-report-bug">
                  <Bug className="w-4 h-4 mr-2" />
                  Report Bug
                </TabsTrigger>
                <TabsTrigger value="reports" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2" data-testid="tab-my-reports">
                  <Clock className="w-4 h-4 mr-2" />
                  My Reports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="m-0 flex flex-col h-80">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {chatMessages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex gap-2",
                          msg.type === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {msg.type === 'hubeebi' && (
                          <div className="h-8 w-6 flex-shrink-0 overflow-hidden rounded bg-muted">
                            <img src={dailyOutfit} alt="Hub-eebi" className="h-full w-full object-contain" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                            msg.type === 'user'
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {msg.message || (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <span className="animate-pulse">Thinking</span>
                              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t flex gap-2">
                  <Input
                    placeholder={isAiLoading ? "Hub-eebi is thinking..." : "Ask me anything about the app..."}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                    disabled={isAiLoading}
                    data-testid="input-chat-message"
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendMessage} 
                    disabled={isAiLoading || !inputMessage.trim()}
                    data-testid="button-send-message"
                  >
                    {isAiLoading ? (
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="report" className="m-0 p-4 h-80 overflow-auto">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bug-title">Issue Title *</Label>
                    <Input
                      id="bug-title"
                      placeholder="Brief description of the issue"
                      value={bugTitle}
                      onChange={(e) => setBugTitle(e.target.value)}
                      data-testid="input-bug-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bug-description">Description *</Label>
                    <Textarea
                      id="bug-description"
                      placeholder="Please describe the issue in detail..."
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      rows={3}
                      data-testid="input-bug-description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bug-priority">Priority</Label>
                    <Select value={bugPriority} onValueChange={setBugPriority}>
                      <SelectTrigger id="bug-priority" data-testid="select-bug-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Screenshot (Optional)</Label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                        data-testid="button-upload-screenshot"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Screenshot
                      </Button>
                    </div>
                    {screenshotPreview && (
                      <div className="relative mt-2">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => setScreenshotPreview(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSubmitBugReport}
                    disabled={createBugReportMutation.isPending}
                    data-testid="button-submit-bug-report"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    {createBugReportMutation.isPending ? "Submitting..." : "Submit Bug Report"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="reports" className="m-0 h-80">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {myBugReports.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ThumbsUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No bug reports yet!</p>
                        <p className="text-xs">Everything seems to be working well.</p>
                      </div>
                    ) : (
                      myBugReports.map((report) => (
                        <motion.div
                          key={report.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">{report.ticketNumber}</p>
                              <p className="font-medium text-sm truncate">{report.title}</p>
                            </div>
                            {getStatusBadge(report.status)}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{report.description}</p>
                          {report.status === 'closed' && report.resolutionNotes && (
                            <div className="mt-2 p-2 bg-green-500/10 rounded text-xs text-green-700 dark:text-green-400">
                              <span className="font-medium flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Resolved:
                              </span> {report.resolutionNotes}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Reported: {new Date(report.createdAt).toLocaleDateString()}
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default HubEebiChat;
