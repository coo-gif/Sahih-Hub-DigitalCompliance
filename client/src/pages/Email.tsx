import { useState, useEffect } from "react";
import { useEmails, useEmail, useSendEmail, useUnreadCount, useMarkAsRead, useGmailStatus, useConnectGmail, useDisconnectGmail } from "@/hooks/use-gmail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Trash2,
  Archive,
  Reply,
  Forward,
  MoreVertical,
  PenSquare,
  CheckCircle2,
  X,
  Link2,
  Unlink
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

export default function Email() {
  const [activeTab, setActiveTab] = useState<'INBOX' | 'SENT' | 'UNREAD'>('INBOX');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [replyMode, setReplyMode] = useState(false);
  
  const { data: gmailStatus, isLoading: statusLoading } = useGmailStatus();
  const { data: emails, isLoading: emailsLoading, refetch } = useEmails(30, activeTab);
  const { data: selectedEmail, isLoading: emailLoading } = useEmail(selectedEmailId);
  const { data: unreadData } = useUnreadCount();
  const sendEmail = useSendEmail();
  const markAsRead = useMarkAsRead();
  const { toast } = useToast();

  useEffect(() => {
    if (selectedEmail && selectedEmail.isUnread && selectedEmailId) {
      markAsRead.mutate(selectedEmailId);
    }
  }, [selectedEmail, selectedEmailId]);

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
      toast({ title: "Missing fields", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    try {
      await sendEmail.mutateAsync(composeData);
      toast({ title: "Email sent", description: "Your email has been sent successfully" });
      setShowCompose(false);
      setComposeData({ to: '', subject: '', body: '' });
      setReplyMode(false);
    } catch (error: any) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  };

  const handleReply = () => {
    if (selectedEmail) {
      const sender = extractSenderName(selectedEmail.from);
      setComposeData({
        to: sender.email,
        subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
        body: `\n\n---\nOn ${formatEmailDate(selectedEmail.date)}, ${sender.name} wrote:\n${selectedEmail.snippet}...`,
      });
      setReplyMode(true);
      setShowCompose(true);
    }
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
              setReplyMode(false);
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

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setSelectedEmailId(null); }} data-testid="tabs-email">
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
        <Card className={`flex-shrink-0 transition-all overflow-hidden ${selectedEmailId ? 'w-[320px] hidden lg:flex lg:flex-col' : 'w-full'}`}>
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
                  return (
                    <div
                      key={email.id}
                      className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                      onClick={() => setSelectedEmailId(email.id)}
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
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatEmailDate(email.date)}
                            </span>
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
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Card>

        {selectedEmailId && (
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedEmailId(null)}
                  className="lg:hidden"
                  data-testid="button-back-to-list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  {emailLoading ? (
                    <Skeleton className="h-5 w-3/4" />
                  ) : (
                    <h2 className="font-semibold truncate">{selectedEmail?.subject}</h2>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={handleReply} data-testid="button-reply">
                    <Reply className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid="button-star">
                    <Star className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid="button-archive">
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid="button-delete">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {emailLoading ? (
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
            ) : selectedEmail ? (
              <>
                <div className="p-4 border-b bg-muted/30 flex-shrink-0">
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
                <ScrollArea className="flex-1">
                  <div 
                    className="p-4 prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(selectedEmail.body) 
                    }}
                  />
                </ScrollArea>
                <div className="p-3 border-t bg-muted/30 flex-shrink-0">
                  <Button variant="outline" onClick={handleReply} className="gap-2" data-testid="button-reply-footer">
                    <Reply className="w-4 h-4" />
                    Reply
                  </Button>
                </div>
              </>
            ) : null}
          </Card>
        )}
      </div>

      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-5 h-5" />
              {replyMode ? 'Reply' : 'Compose Email'}
            </DialogTitle>
            <DialogDescription>
              {replyMode ? 'Send a reply to this email' : 'Compose and send a new email'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={composeData.to}
                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                data-testid="input-email-to"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                data-testid="input-email-subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Write your message..."
                rows={10}
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                className="resize-none"
                data-testid="textarea-email-body"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCompose(false); setReplyMode(false); }}>
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
