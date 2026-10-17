import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Phone, Building2, User, MapPin, Factory, FileText, Search, Download, X, Users } from "lucide-react";
import { format } from "date-fns";
import type { Customer, User as UserType } from "@shared/schema";

const createCustomerSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  companyName: z.string().optional(),
  contactPersons: z.string().optional(),
  phoneEmail: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().optional(),
  accountOwnerId: z.number().optional().nullable(),
  communicationHistory: z.string().optional(),
});

type CreateCustomerData = z.infer<typeof createCustomerSchema>;

export default function CrmCustomers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<CreateCustomerData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      customerName: "",
      companyName: "",
      contactPersons: "",
      phoneEmail: "",
      address: "",
      industry: "",
      accountOwnerId: null,
      communicationHistory: "",
    },
  });

  const editForm = useForm<CreateCustomerData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      customerName: "",
      companyName: "",
      contactPersons: "",
      phoneEmail: "",
      address: "",
      industry: "",
      accountOwnerId: null,
      communicationHistory: "",
    },
  });

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const createCustomer = useMutation({
    mutationFn: async (data: CreateCustomerData) => {
      return apiRequest("POST", "/api/customers", {
        ...data,
        accountOwnerId: data.accountOwnerId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Customer created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating customer", description: error.message, variant: "destructive" });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<CreateCustomerData>) => {
      return apiRequest("PUT", `/api/customers/${id}`, {
        ...data,
        accountOwnerId: data.accountOwnerId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
      editForm.reset();
      toast({ title: "Customer updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating customer", description: error.message, variant: "destructive" });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting customer", description: error.message, variant: "destructive" });
    },
  });

  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    editForm.reset({
      customerName: customer.customerName,
      companyName: customer.companyName || "",
      contactPersons: customer.contactPersons || "",
      phoneEmail: customer.phoneEmail || "",
      address: customer.address || "",
      industry: customer.industry || "",
      accountOwnerId: customer.accountOwnerId,
      communicationHistory: customer.communicationHistory || "",
    });
    setIsEditDialogOpen(true);
  };

  const onCreateSubmit = (data: CreateCustomerData) => {
    createCustomer.mutate(data);
  };

  const onEditSubmit = (data: CreateCustomerData) => {
    if (selectedCustomer) {
      updateCustomer.mutate({ id: selectedCustomer.id, ...data });
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = 
      customer.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contactPersons?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.industry?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const getUserName = (userId: number | null) => {
    if (!userId) return "-";
    const user = users.find((u) => u.id === userId);
    return user?.name || "-";
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="crm-customers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Customers</h1>
          <p className="text-muted-foreground">Manage your customer accounts and relationships</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-customer">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>Enter the customer details below</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter customer name" {...field} data-testid="input-customer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter company name" {...field} data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactPersons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Person(s)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter contact persons" {...field} data-testid="input-contact-persons" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone / Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone or email" {...field} data-testid="input-phone-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter address" {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Healthcare, Manufacturing" {...field} data-testid="input-industry" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountOwnerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Owner</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                          value={field.value?.toString() || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-account-owner">
                              <SelectValue placeholder="Select account owner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No owner assigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="communicationHistory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Communication History</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Log communication history..." 
                          className="min-h-[100px]" 
                          {...field} 
                          data-testid="input-communication-history" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCustomer.isPending} data-testid="button-submit-create">
                    {createCustomer.isPending ? "Creating..." : "Create Customer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-stat-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total">{customers.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-with-contracts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Contracts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-with-contracts">
              {customers.filter((c) => c.contractFileUrl).length}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-assigned">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Owners</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-assigned">
              {customers.filter((c) => c.accountOwnerId).length}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-industries">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Industries</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-industries">
              {new Set(customers.filter((c) => c.industry).map((c) => c.industry)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>View and manage all customer accounts</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[250px]"
                  data-testid="input-search-customers"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-customers">
              {searchQuery ? "No customers match your search" : "No customers yet. Create your first customer!"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Account Owner</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    <TableCell>
                      <div className="font-medium" data-testid={`text-customer-name-${customer.id}`}>
                        {customer.customerName}
                      </div>
                      {customer.contactPersons && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {customer.contactPersons}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.companyName && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {customer.companyName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.phoneEmail && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {customer.phoneEmail}
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate max-w-[150px]">{customer.address}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.industry && (
                        <div className="flex items-center gap-1">
                          <Factory className="h-4 w-4 text-muted-foreground" />
                          {customer.industry}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getUserName(customer.accountOwnerId)}</TableCell>
                    <TableCell>
                      {customer.contractFileUrl ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={customer.contractFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-sm"
                            data-testid={`link-contract-${customer.id}`}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="truncate max-w-[100px]">{customer.contractFileName || "View"}</span>
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(customer)}
                          data-testid={`button-edit-customer-${customer.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this customer?")) {
                              deleteCustomer.mutate(customer.id);
                            }
                          }}
                          data-testid={`button-delete-customer-${customer.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update the customer details below</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer name" {...field} data-testid="input-edit-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter company name" {...field} data-testid="input-edit-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contactPersons"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person(s)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter contact persons" {...field} data-testid="input-edit-contact-persons" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="phoneEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone / Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone or email" {...field} data-testid="input-edit-phone-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter address" {...field} data-testid="input-edit-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Healthcare, Manufacturing" {...field} data-testid="input-edit-industry" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="accountOwnerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Owner</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-account-owner">
                            <SelectValue placeholder="Select account owner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No owner assigned</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="communicationHistory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Communication History</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Log communication history..." 
                        className="min-h-[100px]" 
                        {...field} 
                        data-testid="input-edit-communication-history" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCustomer.isPending} data-testid="button-submit-edit">
                  {updateCustomer.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
