import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { TargetDateField, TARGET_DAYS, defaultTargetInput, targetToIso } from "@/components/TargetDateField";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHANGE_REASON_LABELS } from "@shared/schema";

export interface DocComment {
  id: number;
  documentId: number;
  authorId: number;
  content: string;
  quotedText: string;
  anchorFrom: number;
  anchorTo: number;
  assigneeIds: number[];
  mentionedIds: number[];
  isPrivate: boolean;
  kind: "comment" | "change_request";
  changeRequestId: number | null;
  reasonCategory: string | null;
  reasonOther: string | null;
  documentStatus: string;
  status: "open" | "resolved";
  resolvedById: number | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CommentUser {
  id: number;
  name: string;
  email: string;
  role?: string;
}

// The "@query" being typed just before the cursor, if any
function getMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@([^@\n]{0,40})$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
}

interface CommentComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotedText: string;
  users: CommentUser[];
  isPending: boolean;
  // comment: @tags notify, "Assign" makes a task (not on locked documents)
  // change_request: a point of a change request, with the reason for the change
  mode?: "comment" | "change_request";
  allowAssign?: boolean;
  onSubmit: (data: {
    content: string;
    mentionedIds: number[];
    assigneeIds: number[];
    targetDate?: string;
    reasonCategory?: string;
    reasonOther?: string;
  }) => void;
}

export function CommentComposer({ open, onOpenChange, quotedText, users, isPending, onSubmit, mode = "comment", allowAssign = true }: CommentComposerProps) {
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const isChangeRequest = mode === "change_request";
  const [content, setContent] = useState("");
  const [mentionedIds, setMentionedIds] = useState<number[]>([]);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [target, setTarget] = useState(defaultTargetInput(TARGET_DAYS.comment));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return users
      .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mention, users]);

  // A user stays tagged only while their @Name is still in the text; assigning is a separate choice
  const tagged = users.filter(u => mentionedIds.includes(u.id) && content.includes(`@${u.name}`));
  const assignees = allowAssign ? tagged.filter(u => assignedIds.includes(u.id)) : [];

  const reset = () => {
    setContent("");
    setMentionedIds([]);
    setAssignedIds([]);
    setReasonCategory("");
    setReasonOther("");
    setMention(null);
    setHighlightIndex(0);
    setTarget(defaultTargetInput(TARGET_DAYS.comment));
  };

  // Start every comment from a clean slate
  useEffect(() => {
    if (open) reset();
  }, [open]);

  const updateMention = (text: string, caret: number) => {
    const next = getMentionQuery(text, caret);
    setMention(next);
    setHighlightIndex(0);
  };

  const pickUser = (user: CommentUser) => {
    if (!mention) return;
    const caret = mention.start + 1 + mention.query.length;
    const before = content.slice(0, mention.start);
    const after = content.slice(caret);
    const inserted = `@${user.name} `;
    const next = before + inserted + after;
    setContent(next);
    setMentionedIds(ids => (ids.includes(user.id) ? ids : [...ids, user.id]));
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const removeAssignee = (user: CommentUser) => {
    setMentionedIds(ids => ids.filter(id => id !== user.id));
    setAssignedIds(ids => ids.filter(id => id !== user.id));
    setContent(c => c.split(`@${user.name}`).join(user.name));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pickUser(suggestions[highlightIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg" data-testid="dialog-add-comment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {isChangeRequest ? "Add to Change Request" : "Add Comment"}
          </DialogTitle>
          <DialogDescription>
            {isChangeRequest
              ? "Explain what should change here and why. The approved version stays in force until the COO accepts the change."
              : allowAssign
                ? "Type @ to tag people: they are notified. Tick \"Assign\" to also give someone a task."
                : "This document is approved and locked. Tag people with @ to notify them; only you and the people tagged can see this comment."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <blockquote className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm italic max-h-24 overflow-y-auto">
            {quotedText}
          </blockquote>

          <div className="relative">
            <Label htmlFor="comment-content" className="sr-only">Comment</Label>
            <Textarea
              id="comment-content"
              ref={textareaRef}
              value={content}
              rows={4}
              placeholder={isChangeRequest ? "What should change, and why" : "e.g. @Nazif Ahammad please see clause 5.2 here"}
              onChange={(e) => {
                setContent(e.target.value);
                updateMention(e.target.value, e.target.selectionStart);
              }}
              onKeyDown={handleKeyDown}
              onClick={(e) => updateMention(content, e.currentTarget.selectionStart)}
              data-testid="input-comment-content"
            />
            {mention && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-lg max-h-56 overflow-y-auto"
                data-testid="mention-suggestions"
              >
                {suggestions.map((user, index) => (
                  <button
                    type="button"
                    key={user.id}
                    className={`w-full text-left px-3 py-2 flex flex-col ${index === highlightIndex ? "bg-muted" : "hover:bg-muted"}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickUser(user);
                    }}
                    data-testid={`mention-option-${user.id}`}
                  >
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isChangeRequest ? (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cr-reason">Reason for change <span className="text-red-500">*</span></Label>
                <Select value={reasonCategory} onValueChange={setReasonCategory}>
                  <SelectTrigger id="cr-reason" data-testid="select-cr-reason">
                    <SelectValue placeholder="Choose the reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANGE_REASON_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reasonCategory === "other" && (
                <Input
                  value={reasonOther}
                  onChange={(e) => setReasonOther(e.target.value)}
                  placeholder="Please specify"
                  data-testid="input-cr-reason-other"
                />
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Tagged:</span>
                {tagged.length === 0 ? (
                  <span className="text-muted-foreground italic">no one (type @ to tag)</span>
                ) : (
                  tagged.map(user => (
                    <Badge key={user.id} variant="secondary" className="gap-2 py-1" data-testid={`tag-chip-${user.id}`}>
                      @{user.name}
                      {allowAssign && (
                        <label className="flex items-center gap-1 text-xs font-normal cursor-pointer">
                          <Checkbox
                            checked={assignedIds.includes(user.id)}
                            onCheckedChange={(checked) => setAssignedIds(ids => checked ? [...ids, user.id] : ids.filter(id => id !== user.id))}
                            data-testid={`checkbox-assign-${user.id}`}
                          />
                          Assign
                        </label>
                      )}
                      <button type="button" onClick={() => removeAssignee(user)} className="rounded-full hover:bg-muted">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              {tagged.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {assignees.length > 0
                    ? `${assignees.map(u => u.name).join(", ")} will get a task. Others tagged are only notified.`
                    : "Tagged people are notified. It is not a task unless you tick Assign."}
                </p>
              )}
            </div>
          )}

          {assignees.length > 0 && (
            <TargetDateField
              id="comment-target"
              label="Assigned people must act by"
              value={target}
              onChange={setTarget}
              defaultDays={TARGET_DAYS.comment}
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({
              content: content.trim(),
              mentionedIds: tagged.map(u => u.id),
              assigneeIds: assignees.map(u => u.id),
              targetDate: assignees.length > 0 ? targetToIso(target) : undefined,
              reasonCategory: isChangeRequest ? reasonCategory : undefined,
              reasonOther: isChangeRequest && reasonCategory === "other" ? reasonOther : undefined,
            })}
            disabled={
              !content.trim() || isPending || (assignees.length > 0 && !target) ||
              (isChangeRequest && (!reasonCategory || (reasonCategory === "other" && !reasonOther.trim())))
            }
            data-testid="button-submit-comment"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isChangeRequest ? "Add to Change Request" : "Comment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Renders comment text with @mentions of known users emphasised
function CommentText({ content, users }: { content: string; users: CommentUser[] }) {
  const names = users.map(u => u.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{content}</>;
  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = content.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") && names.includes(part.slice(1))
          ? <span key={i} className="font-semibold text-primary">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

interface CommentsPanelProps {
  comments: DocComment[];
  users: CommentUser[];
  currentUser?: { id: number; email: string; role: string };
  activeCommentId: number | null;
  onSelect: (comment: DocComment) => void;
  onResolve: (comment: DocComment) => void;
  onDelete: (comment: DocComment) => void;
  onClose: () => void;
  canComment: boolean;
}

export function CommentsPanel({ comments, users, currentUser, activeCommentId, onSelect, onResolve, onDelete, onClose, canComment }: CommentsPanelProps) {
  const [filter, setFilter] = useState<"open" | "mine" | "resolved">("open");
  const nameOf = (id: number | null) => users.find(u => u.id === id)?.name || "Unknown user";
  const isManager = currentUser && (currentUser.email === "coo@sahihcertify.com" || currentUser.role === "admin" || currentUser.role === "quality_manager");

  const open = comments.filter(c => c.status === "open");
  const mine = open.filter(c => currentUser && c.assigneeIds.includes(currentUser.id));
  const resolved = comments.filter(c => c.status === "resolved");
  const visible = filter === "open" ? open : filter === "mine" ? mine : resolved;

  return (
    <div className="w-80 border-l bg-muted/30 flex flex-col flex-shrink-0" data-testid="panel-comments">
      <div className="p-4 border-b bg-background flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Comments</h3>
          {open.length > 0 && <Badge variant="secondary">{open.length}</Badge>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-comments">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="px-4 pt-3 flex gap-1">
        {([
          ["open", `Open (${open.length})`],
          ["mine", `Assigned to me (${mine.length})`],
          ["resolved", `Resolved (${resolved.length})`],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setFilter(value)}
            data-testid={`filter-comments-${value}`}
          >
            {label}
          </Button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {visible.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {filter === "open" && canComment
                ? <p>No open comments. Select text in the document, right-click and choose <strong>Comment</strong>.</p>
                : <p>Nothing here.</p>}
            </div>
          ) : (
            visible.map(comment => {
              const canResolve = comment.status === "open" && currentUser &&
                (comment.authorId === currentUser.id || comment.assigneeIds.includes(currentUser.id) || comment.mentionedIds.includes(currentUser.id) || isManager);
              const canDelete = comment.status === "open" && currentUser?.id === comment.authorId;
              return (
                <Card
                  key={comment.id}
                  className={`cursor-pointer transition-colors ${activeCommentId === comment.id ? "border-amber-400 ring-1 ring-amber-300" : ""} ${comment.status === "resolved" ? "opacity-70" : ""}`}
                  onClick={() => onSelect(comment)}
                  data-testid={`card-comment-${comment.id}`}
                >
                  <CardContent className="p-3 space-y-2">
                    <blockquote className="border-l-2 border-amber-400 pl-2 text-xs italic text-muted-foreground line-clamp-2">
                      {comment.quotedText}
                    </blockquote>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      <CommentText content={comment.content} users={users} />
                    </p>
                    {(comment.kind === "change_request" || comment.isPrivate) && (
                      <div className="flex flex-wrap gap-1">
                        {comment.kind === "change_request" && (
                          <Badge className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
                            Change request · {comment.reasonCategory === "other" ? comment.reasonOther : CHANGE_REASON_LABELS[comment.reasonCategory || ""] || "Reason not given"}
                          </Badge>
                        )}
                        {comment.isPrivate && comment.kind !== "change_request" && (
                          <Badge variant="outline" className="text-xs">Private: you and the people tagged</Badge>
                        )}
                      </div>
                    )}
                    {Array.from(new Set([...(comment.mentionedIds || []), ...comment.assigneeIds])).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set([...(comment.mentionedIds || []), ...comment.assigneeIds])).map(id => (
                          <Badge key={id} variant="outline" className={`text-xs ${comment.assigneeIds.includes(id) ? "border-primary text-primary" : ""}`}>
                            @{nameOf(id)}{comment.assigneeIds.includes(id) ? " · assigned" : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {nameOf(comment.authorId)} · {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      {comment.status === "resolved" && comment.resolvedById && (
                        <> · resolved by {nameOf(comment.resolvedById)}</>
                      )}
                    </div>
                    {(canResolve || canDelete) && (
                      <div className="flex gap-2 pt-1">
                        {canResolve && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); onResolve(comment); }}
                            data-testid={`button-resolve-comment-${comment.id}`}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-600"
                            onClick={(e) => { e.stopPropagation(); onDelete(comment); }}
                            data-testid={`button-delete-comment-${comment.id}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
