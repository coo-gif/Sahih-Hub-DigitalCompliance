import { useState, useRef } from "react";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useUpdateSignature } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Plus, MoreHorizontal, Pencil, Trash2, UserCheck, UserX, AlertCircle, PenTool, Upload, X } from "lucide-react";
import { format } from "date-fns";

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  quality_manager: "bg-purple-100 text-purple-700",
  department_head: "bg-blue-100 text-blue-700",
  staff: "bg-muted text-slate-700",
  auditor: "bg-teal-100 text-teal-700",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  quality_manager: "Quality Manager",
  department_head: "Department Head",
  staff: "Staff",
  auditor: "Auditor",
};

export default function Users() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: users, isLoading, isError } = useUsers();
  const { toast } = useToast();
  
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const signatureMutation = useUpdateSignature();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "staff" as string,
  });
  
  const [editFormData, setEditFormData] = useState({
    name: "",
    role: "staff" as string,
    inductionStatus: "pending" as string,
    isActive: true,
  });
  
  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "staff" });
    setEditFormData({ name: "", role: "staff", inductionStatus: "pending", isActive: true });
  };
  
  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role as any,
      });
      toast({ title: "User created successfully" });
      setShowCreateDialog(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error creating user", description: error.message, variant: "destructive" });
    }
  };
  
  const handleEdit = async () => {
    if (!selectedUser) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedUser.id,
        data: {
          name: editFormData.name,
          role: editFormData.role as "admin" | "quality_manager" | "department_head" | "staff" | "auditor",
          inductionStatus: editFormData.inductionStatus as "pending" | "completed",
          isActive: editFormData.isActive,
        },
      });
      toast({ title: "User updated successfully" });
      setShowEditDialog(false);
      setSelectedUser(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error updating user", description: error.message, variant: "destructive" });
    }
  };
  
  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await deleteMutation.mutateAsync(selectedUser.id);
      toast({ title: "User deleted successfully" });
      setShowDeleteDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      toast({ title: "Error deleting user", description: error.message, variant: "destructive" });
    }
  };
  
  const handleToggleInduction = async (user: any) => {
    const newStatus = user.inductionStatus === "completed" ? "pending" : "completed";
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: { inductionStatus: newStatus as "pending" | "completed" },
      });
      toast({ 
        title: newStatus === "completed" 
          ? "Induction marked as completed" 
          : "Induction marked as pending" 
      });
    } catch (error: any) {
      toast({ title: "Error updating induction status", description: error.message, variant: "destructive" });
    }
  };
  
  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      role: user.role,
      inductionStatus: user.inductionStatus,
      isActive: user.isActive ?? true,
    });
    setShowEditDialog(true);
  };
  
  const openDeleteDialog = (user: any) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const openSignatureDialog = (user: any) => {
    setSelectedUser(user);
    setSignaturePreview(user.signatureDataUrl || null);
    setShowSignatureDialog(true);
    // The users list only carries your own signature: load another user's on demand
    if (!user.signatureDataUrl && user.hasSignature) {
      fetch(`/api/users/${user.id}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((full) => {
          if (full?.signatureDataUrl) setSignaturePreview((current) => current ?? full.signatureDataUrl);
        })
        .catch(() => {});
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSignaturePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = async () => {
    if (!selectedUser) return;
    try {
      await signatureMutation.mutateAsync({
        id: selectedUser.id,
        signatureDataUrl: signaturePreview,
      });
      toast({ title: "Signature updated successfully" });
      setShowSignatureDialog(false);
      setSelectedUser(null);
      setSignaturePreview(null);
    } catch (error: any) {
      toast({ title: "Error updating signature", description: error.message, variant: "destructive" });
    }
  };

  const handleRemoveSignature = async () => {
    if (!selectedUser) return;
    try {
      await signatureMutation.mutateAsync({
        id: selectedUser.id,
        signatureDataUrl: null,
      });
      toast({ title: "Signature removed successfully" });
      setSignaturePreview(null);
    } catch (error: any) {
      toast({ title: "Error removing signature", description: error.message, variant: "destructive" });
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-semibold" data-testid="text-error-title">Failed to load users</h2>
        <p className="text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">User Management</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">Role-Based Access Control (RBAC)</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-user">
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Users Table */}
      <Card data-testid="card-users-table">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Induction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Date Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${user.id}`}>{user.name}</TableCell>
                    <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.role] || ""} variant="secondary" data-testid={`badge-role-${user.id}`}>
                        {roleLabels[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={user.inductionStatus === "completed" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-yellow-100 text-yellow-700"
                        }
                        data-testid={`badge-induction-${user.id}`}
                      >
                        {user.inductionStatus === "completed" ? "Completed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={user.isActive 
                          ? "bg-green-100 text-green-700" 
                          : "bg-muted text-slate-700"
                        }
                        data-testid={`badge-status-${user.id}`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.signatureDataUrl || user.hasSignature ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700" data-testid={`badge-signature-${user.id}`}>
                          <PenTool className="w-3 h-3 mr-1" /> Uploaded
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm" data-testid={`text-no-signature-${user.id}`}>None</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-date-joined-${user.id}`}>
                      {user.dateJoined 
                        ? format(new Date(user.dateJoined), "MMM d, yyyy")
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${user.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)} data-testid={`menu-edit-${user.id}`}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSignatureDialog(user)} data-testid={`menu-signature-${user.id}`}>
                            <PenTool className="w-4 h-4 mr-2" /> Manage Signature
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleInduction(user)} data-testid={`menu-toggle-induction-${user.id}`}>
                            {user.inductionStatus === "completed" ? (
                              <>
                                <UserX className="w-4 h-4 mr-2" /> Mark Induction Pending
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-2" /> Complete Induction
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => openDeleteDialog(user)}
                            className="text-red-600"
                            data-testid={`menu-delete-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground" data-testid="text-no-users">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-user">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@sahihcert.qa"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                data-testid="input-password"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger id="role" data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" data-testid="option-role-admin">Admin</SelectItem>
                  <SelectItem value="quality_manager" data-testid="option-role-quality-manager">Quality Manager</SelectItem>
                  <SelectItem value="department_head" data-testid="option-role-department-head">Department Head</SelectItem>
                  <SelectItem value="staff" data-testid="option-role-staff">Staff</SelectItem>
                  <SelectItem value="auditor" data-testid="option-role-auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">Cancel</Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending || !formData.name || !formData.email || !formData.password}
              data-testid="button-submit-create"
            >
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select 
                value={editFormData.role} 
                onValueChange={(v) => setEditFormData({ ...editFormData, role: v })}
              >
                <SelectTrigger id="edit-role" data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" data-testid="option-edit-role-admin">Admin</SelectItem>
                  <SelectItem value="quality_manager" data-testid="option-edit-role-quality-manager">Quality Manager</SelectItem>
                  <SelectItem value="department_head" data-testid="option-edit-role-department-head">Department Head</SelectItem>
                  <SelectItem value="staff" data-testid="option-edit-role-staff">Staff</SelectItem>
                  <SelectItem value="auditor" data-testid="option-edit-role-auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-induction">Induction Status</Label>
              <Select 
                value={editFormData.inductionStatus} 
                onValueChange={(v) => setEditFormData({ ...editFormData, inductionStatus: v })}
              >
                <SelectTrigger id="edit-induction" data-testid="select-edit-induction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending" data-testid="option-induction-pending">Pending</SelectItem>
                  <SelectItem value="completed" data-testid="option-induction-completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Active Status</Label>
              <Switch
                id="edit-active"
                checked={editFormData.isActive}
                onCheckedChange={(v) => setEditFormData({ ...editFormData, isActive: v })}
                data-testid="switch-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">Cancel</Button>
            <Button 
              onClick={handleEdit} 
              disabled={updateMutation.isPending}
              data-testid="button-submit-edit"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedUser?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signature Upload Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-signature">
          <DialogHeader>
            <DialogTitle>Manage Signature</DialogTitle>
            <DialogDescription>
              Upload a digital signature for {selectedUser?.name}. This signature will be used on approved documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-md p-4 min-h-32 flex items-center justify-center bg-muted dark:bg-slate-900">
              {signaturePreview ? (
                <div className="relative w-full">
                  <img 
                    src={signaturePreview} 
                    alt="Signature preview" 
                    className="max-h-24 mx-auto object-contain"
                    data-testid="img-signature-preview"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0"
                    onClick={() => setSignaturePreview(null)}
                    data-testid="button-clear-signature"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <PenTool className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No signature uploaded</p>
                </div>
              )}
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png,image/jpeg"
              className="hidden"
              data-testid="input-signature-file"
            />
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
                data-testid="button-upload-signature"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
              {selectedUser?.signatureDataUrl && (
                <Button
                  variant="outline"
                  onClick={handleRemoveSignature}
                  disabled={signatureMutation.isPending}
                  data-testid="button-remove-signature"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Accepted formats: PNG, JPEG. For best results, use a transparent PNG.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)} data-testid="button-cancel-signature">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSignature} 
              disabled={signatureMutation.isPending || signaturePreview === selectedUser?.signatureDataUrl}
              data-testid="button-save-signature"
            >
              {signatureMutation.isPending ? "Saving..." : "Save Signature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
