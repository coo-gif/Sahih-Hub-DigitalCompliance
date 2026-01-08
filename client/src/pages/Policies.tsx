import { usePolicies, useDeletePolicy } from "@/hooks/use-policies";
import { type Policy } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Calendar, Loader2, Edit, Trash } from "lucide-react";
import { PolicyForm } from "@/components/PolicyForm";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Policies() {
  const { data: policies, isLoading } = usePolicies();
  const deletePolicy = useDeletePolicy();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | undefined>(undefined);

  const filteredPolicies = policies?.filter(policy => 
    policy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    policy.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this policy?")) {
      await deletePolicy.mutateAsync(id);
      toast({ title: "Policy deleted", description: "The policy has been removed." });
    }
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingPolicy(undefined);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Policies</h1>
          <p className="text-slate-500 mt-1">Company standards and compliance documents</p>
        </div>
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />
          Add Policy
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <Search className="w-5 h-5 text-slate-400" />
        <Input 
          placeholder="Search policies by title or category..." 
          className="border-none shadow-none focus-visible:ring-0 px-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
         <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolicies?.map((policy) => (
            <Card key={policy.id} className="hover:shadow-lg transition-all duration-300 border-slate-200 group flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                <div className="p-2 bg-blue-50 rounded-lg text-primary mb-2">
                  <FileText className="w-6 h-6" />
                </div>
                <Badge variant={policy.isActive ? "default" : "secondary"} className={policy.isActive ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : ""}>
                  {policy.isActive ? "Active" : "Archived"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{policy.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2 min-h-[40px]">
                    {policy.content || "No description provided."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs font-normal text-slate-500 bg-slate-50">
                    {policy.category}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t bg-slate-50/50 flex justify-between items-center text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {policy.lastUpdated ? format(new Date(policy.lastUpdated), "MMM d, yyyy") : "N/A"}
                </div>
                <div className="flex gap-2">
                   <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => handleEdit(policy)}>
                      <Edit className="w-4 h-4" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600" onClick={() => handleDelete(policy.id)}>
                      <Trash className="w-4 h-4" />
                   </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
          {filteredPolicies?.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No policies found.
            </div>
          )}
        </div>
      )}

      <PolicyForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        policy={editingPolicy} 
      />
    </div>
  );
}
