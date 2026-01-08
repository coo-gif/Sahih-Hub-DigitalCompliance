import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPolicySchema, type InsertPolicy, type Policy } from "@shared/schema";
import { useCreatePolicy, useUpdatePolicy } from "@/hooks/use-policies";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface PolicyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: Policy;
}

export function PolicyForm({ open, onOpenChange, policy }: PolicyFormProps) {
  const { toast } = useToast();
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  
  const isEditing = !!policy;

  const form = useForm<InsertPolicy>({
    resolver: zodResolver(insertPolicySchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (policy) {
      form.reset({
        title: policy.title,
        content: policy.content || "",
        category: policy.category,
        isActive: policy.isActive ?? true,
      });
    } else {
      form.reset({
        title: "",
        content: "",
        category: "",
        isActive: true,
      });
    }
  }, [policy, form, open]);

  const onSubmit = async (data: InsertPolicy) => {
    try {
      if (isEditing && policy) {
        await updatePolicy.mutateAsync({ id: policy.id, ...data });
        toast({ title: "Policy updated", description: "Successfully updated policy details." });
      } else {
        await createPolicy.mutateAsync(data);
        toast({ title: "Policy created", description: "New policy has been added." });
      }
      onOpenChange(false);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  };

  const isPending = createPolicy.isPending || updatePolicy.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Policy" : "Create New Policy"}</DialogTitle>
          <DialogDescription>
            Defines rules and guidelines for compliance.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Data Protection Policy" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Security, HR, Finance" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter policy details..." 
                      className="min-h-[150px]"
                      {...field} 
                      value={field.value || ""} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Is this policy currently enforced?
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Policy"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
