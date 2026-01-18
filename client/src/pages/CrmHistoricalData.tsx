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
import { Plus, Trash2, Pencil, TrendingUp, CalendarDays, DollarSign, Users, Award, BookOpen } from "lucide-react";
import type { HistoricalData } from "@shared/schema";

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

const createHistoricalDataSchema = z.object({
  year: z.number().min(2000).max(2100),
  month: z.string().min(1, "Month is required"),
  leadsReceived: z.number().min(0).optional(),
  dealsClosed: z.number().min(0).optional(),
  revenue: z.string().optional(),
  trainingsDelivered: z.number().min(0).optional(),
  certificationsIssued: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type CreateHistoricalData = z.infer<typeof createHistoricalDataSchema>;

export default function CrmHistoricalData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoricalData | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("all");

  const form = useForm<CreateHistoricalData>({
    resolver: zodResolver(createHistoricalDataSchema),
    defaultValues: {
      year: currentYear,
      month: "",
      leadsReceived: 0,
      dealsClosed: 0,
      revenue: "",
      trainingsDelivered: 0,
      certificationsIssued: 0,
      notes: "",
    },
  });

  const editForm = useForm<CreateHistoricalData>({
    resolver: zodResolver(createHistoricalDataSchema),
    defaultValues: {
      year: currentYear,
      month: "",
      leadsReceived: 0,
      dealsClosed: 0,
      revenue: "",
      trainingsDelivered: 0,
      certificationsIssued: 0,
      notes: "",
    },
  });

  const { data: historicalData = [], isLoading } = useQuery<HistoricalData[]>({
    queryKey: ["/api/historical-data"],
  });

  const createEntry = useMutation({
    mutationFn: async (data: CreateHistoricalData) => {
      return apiRequest("POST", "/api/historical-data", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/historical-data"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Historical data entry created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating entry", description: error.message, variant: "destructive" });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateHistoricalData> }) => {
      return apiRequest("PUT", `/api/historical-data/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/historical-data"] });
      setIsEditDialogOpen(false);
      setSelectedEntry(null);
      toast({ title: "Historical data entry updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating entry", description: error.message, variant: "destructive" });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/historical-data/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/historical-data"] });
      toast({ title: "Historical data entry deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting entry", description: error.message, variant: "destructive" });
    },
  });

  const handleEditClick = (entry: HistoricalData) => {
    setSelectedEntry(entry);
    editForm.reset({
      year: entry.year,
      month: entry.month,
      leadsReceived: entry.leadsReceived ?? 0,
      dealsClosed: entry.dealsClosed ?? 0,
      revenue: entry.revenue ?? "",
      trainingsDelivered: entry.trainingsDelivered ?? 0,
      certificationsIssued: entry.certificationsIssued ?? 0,
      notes: entry.notes ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const onCreateSubmit = (data: CreateHistoricalData) => {
    createEntry.mutate(data);
  };

  const onEditSubmit = (data: CreateHistoricalData) => {
    if (selectedEntry) {
      updateEntry.mutate({ id: selectedEntry.id, data });
    }
  };

  const filteredData = historicalData.filter((entry) => {
    if (yearFilter !== "all" && entry.year !== parseInt(yearFilter)) {
      return false;
    }
    return true;
  });

  const calculateTotals = () => {
    const relevantData = yearFilter === "all" ? historicalData : historicalData.filter(d => d.year === parseInt(yearFilter));
    return {
      totalLeads: relevantData.reduce((sum, d) => sum + (d.leadsReceived ?? 0), 0),
      totalDeals: relevantData.reduce((sum, d) => sum + (d.dealsClosed ?? 0), 0),
      totalRevenue: relevantData.reduce((sum, d) => sum + (parseFloat(d.revenue?.replace(/[^0-9.]/g, '') || '0') || 0), 0),
      totalTrainings: relevantData.reduce((sum, d) => sum + (d.trainingsDelivered ?? 0), 0),
      totalCerts: relevantData.reduce((sum, d) => sum + (d.certificationsIssued ?? 0), 0),
    };
  };

  const totals = calculateTotals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading historical data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Historical Performance Data</h1>
          <p className="text-muted-foreground">Track and analyze business performance metrics over time</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-entry">
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Historical Data Entry</DialogTitle>
              <DialogDescription>Record business performance metrics for a specific month.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          defaultValue={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-year">
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="month"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-month">
                              <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {months.map((month) => (
                              <SelectItem key={month} value={month}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leadsReceived"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leads Received</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-leads"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dealsClosed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deals Closed</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-deals"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revenue</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., QAR 50,000" data-testid="input-revenue" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="trainingsDelivered"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trainings Delivered</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-trainings"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="certificationsIssued"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certifications Issued</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            data-testid="input-certs"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes..."
                          data-testid="input-notes"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createEntry.isPending} data-testid="button-submit-create">
                    {createEntry.isPending ? "Creating..." : "Create Entry"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-leads">{totals.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {yearFilter === "all" ? "All time" : `Year ${yearFilter}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Closed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-deals">{totals.totalDeals}</div>
            <p className="text-xs text-muted-foreground">
              {yearFilter === "all" ? "All time" : `Year ${yearFilter}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-revenue">
              QAR {totals.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {yearFilter === "all" ? "All time" : `Year ${yearFilter}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trainings</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-trainings">{totals.totalTrainings}</div>
            <p className="text-xs text-muted-foreground">
              {yearFilter === "all" ? "All time" : `Year ${yearFilter}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certifications</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-certs">{totals.totalCerts}</div>
            <p className="text-xs text-muted-foreground">
              {yearFilter === "all" ? "All time" : `Year ${yearFilter}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Performance Records</CardTitle>
              <CardDescription>Monthly business performance data</CardDescription>
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-year-filter">
                <CalendarDays className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No historical data entries found.</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Entry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Trainings</TableHead>
                  <TableHead className="text-right">Certifications</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                    <TableCell className="font-medium">
                      {entry.month} {entry.year}
                    </TableCell>
                    <TableCell className="text-right">{entry.leadsReceived ?? 0}</TableCell>
                    <TableCell className="text-right">{entry.dealsClosed ?? 0}</TableCell>
                    <TableCell className="text-right">{entry.revenue || "-"}</TableCell>
                    <TableCell className="text-right">{entry.trainingsDelivered ?? 0}</TableCell>
                    <TableCell className="text-right">{entry.certificationsIssued ?? 0}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditClick(entry)}
                          data-testid={`button-edit-${entry.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete entry for ${entry.month} ${entry.year}?`)) {
                              deleteEntry.mutate(entry.id);
                            }
                          }}
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Historical Data Entry</DialogTitle>
            <DialogDescription>Update business performance metrics for this month.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="edit-select-year">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="edit-select-month">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {months.map((month) => (
                            <SelectItem key={month} value={month}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="leadsReceived"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leads Received</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="edit-input-leads"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="dealsClosed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deals Closed</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="edit-input-deals"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="revenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenue</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., QAR 50,000" data-testid="edit-input-revenue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="trainingsDelivered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trainings Delivered</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="edit-input-trainings"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="certificationsIssued"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certifications Issued</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="edit-input-certs"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes..."
                        data-testid="edit-input-notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateEntry.isPending} data-testid="button-submit-edit">
                  {updateEntry.isPending ? "Updating..." : "Update Entry"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
