import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2, FileCheck } from "lucide-react";
import { sanitizeFormHtml } from "@/lib/sanitize-form-html";

interface DocuGenieForm {
  id: number;
  title: string;
  description: string | null;
  htmlForm: string | null;
  status: string;
}

export default function FormSubmit() {
  const [, params] = useRoute("/form/:token");
  const token = params?.token;
  const { toast } = useToast();
  const [form, setForm] = useState<DocuGenieForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  useEffect(() => {
    const fetchForm = async () => {
      if (!token) {
        setError("Invalid form link");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/docugenie/share/${token}`);
        if (!response.ok) {
          const data = await response.json();
          setError(data.message || "Form not found");
          return;
        }
        const data = await response.json();
        setForm(data);
      } catch (err) {
        setError("Failed to load form");
      } finally {
        setIsLoading(false);
      }
    };

    fetchForm();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form || !token) return;

    setIsSubmitting(true);
    try {
      const formElement = e.currentTarget;
      const formData = new FormData(formElement);
      const data: Record<string, string> = {};
      formData.forEach((value, key) => {
        if (key !== "submitterName" && key !== "submitterEmail") {
          data[key] = value.toString();
        }
      });

      const response = await fetch(`/api/docugenie/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: data,
          submitterName,
          submitterEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit form");
      }

      setIsSubmitted(true);
      toast({ title: "Form submitted successfully!" });
    } catch (err: any) {
      toast({ 
        title: "Error submitting form", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="loading-form">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="error-form">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Form Not Available</h2>
            <p className="text-muted-foreground">{error || "This form is no longer available."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="success-form">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">Your response has been submitted successfully.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" data-testid="form-submit-page">
      <div className="max-w-2xl mx-auto">
        <Card data-testid="form-card">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary mb-2">
              <FileCheck className="h-5 w-5" />
              <span className="text-sm font-medium">DocuGenie Form</span>
            </div>
            <CardTitle data-testid="form-title">{form.title}</CardTitle>
            {form.description && (
              <CardDescription data-testid="form-description">{form.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" data-testid="submission-form">
              <div className="space-y-4 border-b pb-6">
                <h3 className="font-medium text-sm text-muted-foreground">Your Information (Optional)</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your Name</label>
                    <Input
                      name="submitterName"
                      value={submitterName}
                      onChange={(e) => setSubmitterName(e.target.value)}
                      placeholder="Enter your name"
                      data-testid="input-submitter-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your Email</label>
                    <Input
                      name="submitterEmail"
                      type="email"
                      value={submitterEmail}
                      onChange={(e) => setSubmitterEmail(e.target.value)}
                      placeholder="Enter your email"
                      data-testid="input-submitter-email"
                    />
                  </div>
                </div>
              </div>

              {form.htmlForm ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: sanitizeFormHtml(form.htmlForm) }}
                  className="space-y-4"
                  data-testid="dynamic-form-content"
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">This form has no content.</p>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
                data-testid="button-submit-form"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Form"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by DocuGenie • Sahih Certifications QMS
        </p>
      </div>
    </div>
  );
}
