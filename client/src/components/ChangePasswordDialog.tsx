import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/DocumentSources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Change your own password (current password required), or, with `resetFor`, an admin sets a new
 * password for another user.
 */
export function ChangePasswordDialog({
  open, onOpenChange, resetFor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetFor?: { id: number; name: string };
}) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (open) { setCurrent(""); setNext(""); setConfirm(""); }
  }, [open]);

  const save = useMutation({
    mutationFn: () => resetFor
      ? apiRequest("POST", `/api/users/${resetFor.id}/reset-password`, { newPassword: next })
      : apiRequest("POST", "/api/auth/change-password", { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      toast({ title: resetFor ? `New password set for ${resetFor.name}` : "Password changed" });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Password not changed", description: errorMessage(err), variant: "destructive" }),
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = next.length >= 8 && next === confirm && (resetFor || current.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{resetFor ? `Reset password for ${resetFor.name}` : "Change password"}</DialogTitle>
          <DialogDescription>
            {resetFor ? "They will be told to change it after signing in." : "Use at least 8 characters."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }}>
          {!resetFor && (
            <div>
              <Label htmlFor="pw-current">Current password</Label>
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw-confirm">Repeat new password</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            {mismatch && <p className="text-xs text-destructive mt-1">The passwords don't match.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!ready || save.isPending} data-testid="button-save-password">Save password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
