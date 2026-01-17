import { useState, useEffect, useRef } from "react";
import { useEmails, useEmail, useSendEmail, useUnreadCount, useMarkAsRead, useDeleteEmail, useArchiveEmail, useStarEmail, useUnstarEmail, useMarkAsSpam, useMarkAsUnread, useGmailStatus, useConnectGmail, useDisconnectGmail, useThread, useAIDraft, EmailMessage, SendEmailData } from "@/hooks/use-gmail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Send, 
  Inbox, 
  RefreshCw, 
  ArrowLeft, 
  Circle,
  Clock,
  User,
  Paperclip,
  Star,
  StarOff,
  Trash2,
  Archive,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  PenSquare,
  CheckCircle2,
  X,
  Link2,
  Unlink,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Wand2,
  MessageSquare,
  Users,
  Plus,
  Download,
  AlertTriangle,
  Eye,
  EyeOff
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import DOMPurify from "dompurify";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

function formatEmailDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (!isValid(date)) return dateStr;
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, 'h:mm a');
    }
    return format(date, 'MMM d, yyyy h:mm a');
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (!isValid(date)) return dateStr;
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, 'h:mm a');
    }
    return format(date, 'MMM d');
  } catch {
    return dateStr;
  }
}

function extractSenderName(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  }
  return { name: from, email: from };
}

function extractAllRecipients(email: EmailMessage): string[] {
  const recipients: string[] = [];
  if (email.to) {
    recipients.push(...email.to.split(',').map(e => e.trim()));
  }
  if (email.cc) {
    recipients.push(...email.cc.split(',').map(e => e.trim()));
  }
  return recipients;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Email() {
  const [activeTab, setActiveTab] = useState<'INBOX' | 'SENT' | 'UNREAD'>('INBOX');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState<SendEmailData>({ to: '', subject: '', body: '' });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [replyMode, setReplyMode] = useState<'reply' | 'replyAll' | null>(null);
  const [attachments, setAttachments] = useState<{ filename: string; mimeType: string; content: string }[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [threadSummary, setThreadSummary] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: gmailStatus, isLoading: statusLoading } = useGmailStatus();
  const { data: emails, isLoading: emailsLoading, refetch } = useEmails(30, activeTab);
  const { data: selectedEmail, isLoading: emailLoading } = useEmail(selectedEmailId);
  const { data: threadMessages, isLoading: threadLoading } = useThread(selectedThreadId);
  const { data: unreadData } = useUnreadCount();
  const sendEmail = useSendEmail();
  const markAsRead = useMarkAsRead();
  const deleteEmail = useDeleteEmail();
  const archiveEmail = useArchiveEmail();
  const starEmail = useStarEmail();
  const unstarEmail = useUnstarEmail();
  const markAsSpam = useMarkAsSpam();
  const markAsUnread = useMarkAsUnread();
  const aiDraft = useAIDraft();
  const { toast } = useToast();
  const [isStarred, setIsStarred] = useState(false);

  // Update starred status when email loads
  useEffect(() => {
    if (selectedEmail) {
      setIsStarred((selectedEmail.labelIds || []).includes('STARRED'));
    }
  }, [selectedEmail]);

  useEffect(() => {
    if (selectedEmail && selectedEmail.isUnread && selectedEmailId) {
      markAsRead.mutate(selectedEmailId);
    }
  }, [selectedEmail, selectedEmailId]);

  useEffect(() => {
    if (selectedEmail?.threadId) {
      setSelectedThreadId(selectedEmail.threadId);
      // Expand the last message by default
      if (threadMessages && threadMessages.length > 0) {
        setExpandedMessages(new Set([threadMessages[threadMessages.length - 1].id]));
      }
    }
  }, [selectedEmail?.threadId]);

  useEffect(() => {
    // When thread messages load, expand the last one
    if (threadMessages && threadMessages.length > 0) {
      setExpandedMessages(new Set([threadMessages[threadMessages.length - 1].id]));
    }
  }, [threadMessages]);

  // Generate summary when thread loads
  useEffect(() => {
    if (threadMessages && threadMessages.length > 1 && !threadSummary) {
      generateThreadSummary();
    }
  }, [threadMessages]);

  const generateThreadSummary = async () => {
    if (!threadMessages || threadMessages.length === 0) return;
    
    const context = threadMessages.map(m => 
      `From: ${extractSenderName(m.from).name}\nDate: ${formatEmailDate(m.date)}\n${m.snippet}`
    ).join('\n\n---\n\n');
    
    try {
      const result = await aiDraft.mutateAsync({
        prompt: 'Summarize this email thread',
        context,
        action: 'summarize'
      });
      setThreadSummary(result.result);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  };

  const connectGmail = useConnectGmail();
  const disconnectGmail = useDisconnectGmail();
  const [, setLocation] = useLocation();
  
  // Check for OAuth callback query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');
    
    if (connected === 'true') {
      toast({ title: "Gmail Connected", description: "Your Gmail account has been connected successfully!" });
      window.history.replaceState({}, '', '/email');
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/status'] });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        'access_denied': 'You denied access to your Gmail account.',
        'missing_params': 'Invalid callback parameters.',
        'token_exchange_failed': 'Failed to complete the connection. Please try again.',
        'invalid_state': 'Security validation failed. Please try connecting again.',
      };
      toast({ 
        title: "Connection Failed", 
        description: errorMessages[error] || 'An error occurred connecting your Gmail.',
        variant: "destructive" 
      });
      window.history.replaceState({}, '', '/email');
    }
  }, []);

  const handleConnectGmail = async () => {
    try {
      await connectGmail.mutateAsync();
    } catch (error: any) {
      toast({ 
        title: "Connection Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await disconnectGmail.mutateAsync();
      toast({ title: "Gmail Disconnected", description: "Your Gmail account has been disconnected." });
    } catch (error: any) {
      toast({ 
        title: "Disconnect Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  // Show connection screen if Gmail is not connected
  if (!statusLoading && gmailStatus && !gmailStatus.connected) {
    // OAuth is available - show connect button
    if (gmailStatus.oauthAvailable) {
      return (
        <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4 lg:p-6">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Connect Your Gmail</h2>
                <p className="text-muted-foreground">
                  Connect your Google Workspace email account to send and receive emails directly from the application.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
                <p className="font-medium">What you'll be able to do:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Send emails from your work account</li>
                  <li>View your inbox and read emails</li>
                  <li>Reply to messages directly</li>
                  <li>Receive notifications for new emails</li>
                </ul>
              </div>
              <Button 
                onClick={handleConnectGmail}
                disabled={connectGmail.isPending}
                className="w-full"
                data-testid="button-connect-gmail"
              >
                <Link2 className="w-4 h-4 mr-2" />
                {connectGmail.isPending ? 'Connecting...' : 'Connect Gmail Account'}
              </Button>
              <p className="text-xs text-muted-foreground">
                You'll be redirected to Google to authorize access to your email.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    // No OAuth configured - show admin setup instructions
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4 lg:p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Email Setup Required</h2>
              <p className="text-muted-foreground">
                An administrator needs to configure Google OAuth to enable email features.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
              <p className="font-medium">For Administrators:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Go to Google Cloud Console and create OAuth credentials</li>
                <li>Add <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_ID</code> to Secrets</li>
                <li>Add <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_SECRET</code> to Secrets</li>
                <li>Restart the application</li>
              </ol>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-refresh-connection">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      const emailData: SendEmailData = {
        ...composeData,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      
      await sendEmail.mutateAsync(emailData);
      toast({ title: "Email sent", description: "Your email has been sent successfully" });
      setShowCompose(false);
      setComposeData({ to: '', subject: '', body: '' });
      setReplyMode(null);
      setAttachments([]);
      setShowCc(false);
      setShowBcc(false);
    } catch (error: any) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  };

  // Convert HTML to plain text for quoting
  const htmlToPlainText = (html: string): string => {
    // Remove HTML tags and convert common entities
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleReply = () => {
    if (selectedEmail) {
      const sender = extractSenderName(selectedEmail.from);
      const plainTextBody = htmlToPlainText(selectedEmail.body || '');
      const quotedText = plainTextBody.split('\n').map(line => `> ${line}`).join('\n');
      
      setComposeData({
        to: sender.email,
        subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
        body: `\n\n---\nOn ${formatEmailDate(selectedEmail.date)}, ${sender.name} wrote:\n${quotedText}`,
        inReplyTo: selectedEmail.id,
      });
      setReplyMode('reply');
      setShowCompose(true);
    }
  };

  const handleReplyAll = () => {
    if (selectedEmail) {
      const sender = extractSenderName(selectedEmail.from);
      const allRecipients = extractAllRecipients(selectedEmail);
      const ccRecipients = allRecipients.filter(r => r !== sender.email);
      const plainTextBody = htmlToPlainText(selectedEmail.body || '');
      const quotedText = plainTextBody.split('\n').map(line => `> ${line}`).join('\n');
      
      setComposeData({
        to: sender.email,
        cc: ccRecipients.join(', '),
        subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
        body: `\n\n---\nOn ${formatEmailDate(selectedEmail.date)}, ${sender.name} wrote:\n${quotedText}`,
        inReplyTo: selectedEmail.id,
      });
      setReplyMode('replyAll');
      setShowCc(true);
      setShowCompose(true);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmailId) return;
    
    try {
      await deleteEmail.mutateAsync(selectedEmailId);
      toast({ title: "Email moved to trash" });
      setSelectedEmailId(null);
      setSelectedThreadId(null);
      setThreadSummary(null);
      setExpandedMessages(new Set());
    } catch (error: any) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    if (!selectedEmailId) return;
    
    try {
      await archiveEmail.mutateAsync(selectedEmailId);
      toast({ title: "Email archived" });
      setSelectedEmailId(null);
      setSelectedThreadId(null);
      setThreadSummary(null);
      setExpandedMessages(new Set());
    } catch (error: any) {
      toast({ title: "Failed to archive", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleStar = async () => {
    if (!selectedEmailId) return;
    
    try {
      if (isStarred) {
        await unstarEmail.mutateAsync(selectedEmailId);
        setIsStarred(false);
        toast({ title: "Star removed" });
      } else {
        await starEmail.mutateAsync(selectedEmailId);
        setIsStarred(true);
        toast({ title: "Email starred" });
      }
    } catch (error: any) {
      toast({ title: "Failed to update star", description: error.message, variant: "destructive" });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          content: base64
        }]);
      };
      reader.readAsDataURL(file);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleAIDraft = async (action: 'compose' | 'reply' | 'grammar') => {
    if (!aiPrompt && action !== 'grammar') {
      toast({ title: "Enter a prompt", description: "Please describe what you want to write", variant: "destructive" });
      return;
    }

    const prompt = action === 'grammar' ? composeData.body : aiPrompt;
    const context = selectedEmail ? `Subject: ${selectedEmail.subject}\nFrom: ${selectedEmail.from}\nContent: ${selectedEmail.snippet}` : undefined;

    try {
      const result = await aiDraft.mutateAsync({ prompt, context, action });
      setComposeData(prev => ({ ...prev, body: result.result }));
      setAiPrompt('');
      setShowAiPanel(false);
      toast({ title: "Draft generated", description: "AI has generated your email draft" });
    } catch (error: any) {
      toast({ title: "AI Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleMessageExpand = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Email</h1>
            <p className="text-sm text-muted-foreground">
              {unreadData?.count ? `${unreadData.count} unread` : 'Your inbox'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh-emails"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={() => {
              setComposeData({ to: '', subject: '', body: '' });
              setReplyMode(null);
              setAttachments([]);
              setShowCc(false);
              setShowBcc(false);
              setShowCompose(true);
            }}
            data-testid="button-compose-email"
          >
            <PenSquare className="w-4 h-4 mr-2" />
            Compose
          </Button>
          {gmailStatus?.mode === 'oauth' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDisconnectGmail}
              disabled={disconnectGmail.isPending}
              data-testid="button-disconnect-gmail"
            >
              <Unlink className="w-4 h-4 mr-2" />
              {disconnectGmail.isPending ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setSelectedEmailId(null); setSelectedThreadId(null); setThreadSummary(null); }} data-testid="tabs-email">
        <TabsList>
          <TabsTrigger value="INBOX" className="flex items-center gap-2" data-testid="tab-inbox">
            <Inbox className="w-4 h-4" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="UNREAD" className="flex items-center gap-2" data-testid="tab-unread">
            <Circle className="w-3 h-3 fill-primary text-primary" />
            Unread
            {unreadData?.count ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5" data-testid="badge-unread-count">
                {unreadData.count}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="SENT" className="flex items-center gap-2" data-testid="tab-sent">
            <Send className="w-4 h-4" />
            Sent
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Email List */}
        <Card className={`flex-shrink-0 transition-all overflow-hidden ${selectedEmailId ? 'w-[280px] hidden lg:flex lg:flex-col' : 'w-full max-w-md'}`}>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {activeTab === 'INBOX' && <Inbox className="w-4 h-4" />}
              {activeTab === 'UNREAD' && <Circle className="w-4 h-4 fill-primary text-primary" />}
              {activeTab === 'SENT' && <Send className="w-4 h-4" />}
              {activeTab === 'INBOX' ? 'Inbox' : activeTab === 'SENT' ? 'Sent' : 'Unread'}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {emailsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  </div>
                ))
              ) : emails?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No emails found</p>
                </div>
              ) : (
                emails?.map((email) => {
                  const sender = extractSenderName(email.from);
                  const isSelected = email.id === selectedEmailId;
                  const emailIsStarred = email.labelIds?.includes('STARRED');
                  return (
                    <ContextMenu key={email.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                          onClick={() => { 
                            setSelectedEmailId(email.id); 
                            setThreadSummary(null);
                          }}
                          data-testid={`email-item-${email.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              {email.isUnread && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className={`text-sm truncate ${email.isUnread ? 'font-semibold' : 'font-medium'}`}>
                                  {sender.name}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {emailIsStarred && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                                  <span className="text-xs text-muted-foreground">
                                    {formatShortDate(email.date)}
                                  </span>
                                </div>
                              </div>
                              <p className={`text-sm truncate ${email.isUnread ? 'font-medium' : ''}`}>
                                {email.subject}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {email.snippet}
                              </p>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem 
                          onClick={() => {
                            setSelectedEmailId(email.id);
                            setThreadSummary(null);
                            setTimeout(() => handleReply(), 100);
                          }}
                          data-testid={`context-reply-${email.id}`}
                        >
                          <Reply className="w-4 h-4 mr-2" />
                          Reply
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => {
                            setSelectedEmailId(email.id);
                            setThreadSummary(null);
                            setTimeout(() => handleReplyAll(), 100);
                          }}
                          data-testid={`context-reply-all-${email.id}`}
                        >
                          <ReplyAll className="w-4 h-4 mr-2" />
                          Reply All
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem 
                          onClick={async () => {
                            try {
                              if (emailIsStarred) {
                                await unstarEmail.mutateAsync(email.id);
                                toast({ title: "Email unstarred" });
                              } else {
                                await starEmail.mutateAsync(email.id);
                                toast({ title: "Email starred" });
                              }
                            } catch (error: any) {
                              toast({ title: "Failed to update star", description: error.message, variant: "destructive" });
                            }
                          }}
                          data-testid={`context-star-${email.id}`}
                        >
                          {emailIsStarred ? (
                            <>
                              <StarOff className="w-4 h-4 mr-2" />
                              Unstar
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4 mr-2" />
                              Star
                            </>
                          )}
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={async () => {
                            try {
                              if (email.isUnread) {
                                await markAsRead.mutateAsync(email.id);
                                toast({ title: "Marked as read" });
                              } else {
                                await markAsUnread.mutateAsync(email.id);
                                toast({ title: "Marked as unread" });
                              }
                            } catch (error: any) {
                              toast({ title: "Failed to update", description: error.message, variant: "destructive" });
                            }
                          }}
                          data-testid={`context-read-${email.id}`}
                        >
                          {email.isUnread ? (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Mark as Read
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Mark as Unread
                            </>
                          )}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem 
                          onClick={async () => {
                            try {
                              await archiveEmail.mutateAsync(email.id);
                              toast({ title: "Email archived" });
                              if (selectedEmailId === email.id) {
                                setSelectedEmailId(null);
                                setSelectedThreadId(null);
                                setThreadSummary(null);
                                setExpandedMessages(new Set());
                              }
                            } catch (error: any) {
                              toast({ title: "Failed to archive", description: error.message, variant: "destructive" });
                            }
                          }}
                          data-testid={`context-archive-${email.id}`}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={async () => {
                            try {
                              await markAsSpam.mutateAsync(email.id);
                              toast({ title: "Marked as spam" });
                              if (selectedEmailId === email.id) {
                                setSelectedEmailId(null);
                                setSelectedThreadId(null);
                                setThreadSummary(null);
                                setExpandedMessages(new Set());
                              }
                            } catch (error: any) {
                              toast({ title: "Failed to mark as spam", description: error.message, variant: "destructive" });
                            }
                          }}
                          data-testid={`context-spam-${email.id}`}
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Mark as Spam
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={async () => {
                            try {
                              await deleteEmail.mutateAsync(email.id);
                              toast({ title: "Email moved to trash" });
                              if (selectedEmailId === email.id) {
                                setSelectedEmailId(null);
                                setSelectedThreadId(null);
                                setThreadSummary(null);
                                setExpandedMessages(new Set());
                              }
                            } catch (error: any) {
                              toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
                            }
                          }}
                          className="text-destructive focus:text-destructive"
                          data-testid={`context-delete-${email.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Thread Preview */}
        {selectedEmailId && (
          <Card className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => { setSelectedEmailId(null); setSelectedThreadId(null); setThreadSummary(null); }}
                  className="lg:hidden"
                  data-testid="button-back-to-list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0 overflow-hidden">
                  {emailLoading ? (
                    <Skeleton className="h-5 w-3/4" />
                  ) : (
                    <div className="overflow-hidden">
                      <h2 className="font-semibold truncate" title={selectedEmail?.subject}>{selectedEmail?.subject}</h2>
                      {threadMessages && threadMessages.length > 1 && (
                        <p className="text-xs text-muted-foreground">{threadMessages.length} messages in thread</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={handleReply} data-testid="button-reply" title="Reply">
                    <Reply className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleReplyAll} data-testid="button-reply-all" title="Reply All">
                    <ReplyAll className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleToggleStar} 
                    data-testid="button-star" 
                    title={isStarred ? "Unstar" : "Star"}
                    disabled={starEmail.isPending || unstarEmail.isPending}
                  >
                    <Star className={`w-4 h-4 ${isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleArchive} 
                    data-testid="button-archive" 
                    title="Archive"
                    disabled={archiveEmail.isPending}
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleDelete} 
                    data-testid="button-delete" 
                    title="Delete"
                    disabled={deleteEmail.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <div className="flex-1 flex overflow-hidden min-w-0">
              {/* Thread Messages */}
              <ScrollArea className="flex-1 min-w-0">
                {threadLoading || emailLoading ? (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : threadMessages && threadMessages.length > 0 ? (
                  <div className="divide-y">
                    {threadMessages.map((message, index) => {
                      const sender = extractSenderName(message.from);
                      const isExpanded = expandedMessages.has(message.id);
                      const isLast = index === threadMessages.length - 1;
                      
                      return (
                        <Collapsible 
                          key={message.id} 
                          open={isExpanded}
                          onOpenChange={() => toggleMessageExpand(message.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className={`p-4 cursor-pointer hover:bg-muted/30 ${isExpanded ? 'bg-muted/20' : ''}`}>
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <User className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{sender.name}</span>
                                    <span className="text-xs text-muted-foreground">&lt;{sender.email}&gt;</span>
                                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatEmailDate(message.date)}
                                    </span>
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                  {!isExpanded && (
                                    <p className="text-sm text-muted-foreground truncate mt-1">{message.snippet}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-4">
                              <div className="ml-13 pl-10">
                                {message.to && (
                                  <div className="text-sm text-muted-foreground mb-2">
                                    <span className="font-medium">To:</span> {message.to}
                                  </div>
                                )}
                                {message.cc && (
                                  <div className="text-sm text-muted-foreground mb-2">
                                    <span className="font-medium">CC:</span> {message.cc}
                                  </div>
                                )}
                                
                                <div 
                                  className="prose prose-sm dark:prose-invert max-w-none mt-3 overflow-x-auto break-words [&_*]:max-w-full [&_img]:max-w-full"
                                  dangerouslySetInnerHTML={{ 
                                    __html: DOMPurify.sanitize(message.body || '<p class="text-muted-foreground italic">No content</p>') 
                                  }}
                                />
                                
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-4 pt-4 border-t">
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <Paperclip className="w-4 h-4" />
                                      Attachments ({message.attachments.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {message.attachments.map((att, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                                          <FileText className="w-4 h-4" />
                                          <span>{att.filename}</span>
                                          <span className="text-muted-foreground">({formatFileSize(att.size)})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                ) : selectedEmail ? (
                  <>
                    <div className="p-4 border-b bg-muted/30">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{extractSenderName(selectedEmail.from).name}</span>
                            <span className="text-xs text-muted-foreground">&lt;{extractSenderName(selectedEmail.from).email}&gt;</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <span>to {selectedEmail.to}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatEmailDate(selectedEmail.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div 
                      className="p-4 prose prose-sm dark:prose-invert max-w-none overflow-x-auto break-words [&_*]:max-w-full [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(selectedEmail.body || '<p class="text-muted-foreground italic">No content</p>') 
                      }}
                    />
                  </>
                ) : null}
                
                {/* Quick Reply Footer */}
                <div className="p-3 border-t bg-muted/30 sticky bottom-0">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReply} className="gap-2" data-testid="button-reply-footer">
                      <Reply className="w-4 h-4" />
                      Reply
                    </Button>
                    <Button variant="outline" onClick={handleReplyAll} className="gap-2" data-testid="button-reply-all-footer">
                      <ReplyAll className="w-4 h-4" />
                      Reply All
                    </Button>
                  </div>
                </div>
              </ScrollArea>

              {/* Thread Summary Sidebar */}
              {threadMessages && threadMessages.length > 1 && (
                <div className="w-[240px] flex-shrink-0 border-l bg-muted/20 hidden xl:flex xl:flex-col">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Thread Summary
                    </h3>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    {aiDraft.isPending ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    ) : threadSummary ? (
                      <div className="prose prose-sm dark:prose-invert">
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(threadSummary.replace(/\n/g, '<br/>')) }} />
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Generating summary...</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={generateThreadSummary}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Generate Summary
                        </Button>
                      </div>
                    )}
                  </ScrollArea>
                  
                  <div className="p-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Thread Participants</p>
                    <div className="space-y-1">
                      {Array.from(new Set(threadMessages.map(m => extractSenderName(m.from).email))).map((email, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-3 h-3 text-primary" />
                          </div>
                          <span className="truncate">{email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={(open) => { setShowCompose(open); if (!open) { setReplyMode(null); setAttachments([]); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-5 h-5" />
              {replyMode === 'reply' ? 'Reply' : replyMode === 'replyAll' ? 'Reply All' : 'Compose Email'}
            </DialogTitle>
            <DialogDescription>
              {replyMode ? 'Send a reply to this email' : 'Compose and send a new email'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="to">To *</Label>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={composeData.to}
                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                data-testid="input-email-to"
              />
            </div>
            
            <div className="flex gap-2">
              {!showCc && (
                <Button variant="ghost" size="sm" onClick={() => setShowCc(true)} data-testid="button-add-cc">
                  <Plus className="w-3 h-3 mr-1" /> CC
                </Button>
              )}
              {!showBcc && (
                <Button variant="ghost" size="sm" onClick={() => setShowBcc(true)} data-testid="button-add-bcc">
                  <Plus className="w-3 h-3 mr-1" /> BCC
                </Button>
              )}
            </div>
            
            {showCc && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cc">CC</Label>
                  <Button variant="ghost" size="sm" onClick={() => { setShowCc(false); setComposeData(prev => ({ ...prev, cc: '' })); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <Input
                  id="cc"
                  type="email"
                  placeholder="cc@example.com"
                  value={composeData.cc || ''}
                  onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                  data-testid="input-email-cc"
                />
              </div>
            )}
            
            {showBcc && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bcc">BCC</Label>
                  <Button variant="ghost" size="sm" onClick={() => { setShowBcc(false); setComposeData(prev => ({ ...prev, bcc: '' })); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <Input
                  id="bcc"
                  type="email"
                  placeholder="bcc@example.com"
                  value={composeData.bcc || ''}
                  onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                  data-testid="input-email-bcc"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                data-testid="input-email-subject"
              />
            </div>
            
            {/* AI Assistant Panel */}
            <Collapsible open={showAiPanel} onOpenChange={setShowAiPanel}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-purple-200 dark:border-purple-800">
                  <Wand2 className="w-4 h-4 text-purple-500" />
                  AI Writing Assistant
                  {showAiPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 p-4 rounded-lg bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border border-purple-200 dark:border-purple-800 space-y-3">
                  <div className="space-y-2">
                    <Label>What would you like to write?</Label>
                    <Textarea
                      placeholder="e.g., Write a professional email requesting a meeting next week to discuss the project timeline..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={3}
                      className="resize-none"
                      data-testid="textarea-ai-prompt"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      size="sm" 
                      onClick={() => handleAIDraft(replyMode ? 'reply' : 'compose')}
                      disabled={aiDraft.isPending || !aiPrompt}
                      className="gap-1 bg-purple-600 hover:bg-purple-700"
                      data-testid="button-ai-generate"
                    >
                      {aiDraft.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Generate Draft
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAIDraft('grammar')}
                      disabled={aiDraft.isPending || !composeData.body}
                      className="gap-1"
                      data-testid="button-ai-grammar"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Fix Grammar
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <div className="space-y-2">
              <Label htmlFor="body">Message *</Label>
              <Textarea
                id="body"
                placeholder="Write your message..."
                rows={12}
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                className="resize-none font-sans"
                data-testid="textarea-email-body"
              />
            </div>
            
            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-attachment"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-add-attachment"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Attach Files
                </Button>
                {attachments.length > 0 && (
                  <span className="text-sm text-muted-foreground">{attachments.length} file(s) attached</span>
                )}
              </div>
              
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                      <FileText className="w-4 h-4" />
                      <span>{att.filename}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5" 
                        onClick={() => removeAttachment(i)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCompose(false); setReplyMode(null); setAttachments([]); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={sendEmail.isPending}
              data-testid="button-send-email"
            >
              {sendEmail.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
