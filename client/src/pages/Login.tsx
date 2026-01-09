import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, LogIn } from "lucide-react";
import sahihLogoPath from "@assets/sahih_logo-1.png";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({ 
        title: "Please fill in all fields", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/auth/login', { email, password });
      
      queryClient.invalidateQueries();
      onLogin();
      setLocation('/');
      toast({ title: "Login successful" });
    } catch (error: any) {
      toast({ 
        title: "Login failed", 
        description: error.message || "Invalid email or password",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={sahihLogoPath} 
              alt="Sahih Certifications" 
              className="h-20 object-contain"
              data-testid="img-login-logo"
            />
          </div>
          <div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Quality Management System
            </CardTitle>
            <CardDescription className="mt-2">
              Sign in to access the QMS portal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@sahihcert.qa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                "Signing in..."
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
