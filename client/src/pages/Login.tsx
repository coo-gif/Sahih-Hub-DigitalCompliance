import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, LogIn, Award, CheckCircle, Globe, Building2 } from "lucide-react";
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
    <div className="min-h-screen flex">
      {/* Left Panel - Hero Section with Qatar Elements */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#C9A227] via-[#A67C00] to-[#705900]">
        {/* Geometric Pattern Overlay - Islamic Art Inspired */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="geometric" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M10 0L20 10L10 20L0 10Z" fill="none" stroke="white" strokeWidth="0.5"/>
              <circle cx="10" cy="10" r="3" fill="none" stroke="white" strokeWidth="0.3"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#geometric)"/>
          </svg>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-sm"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-sm"></div>
        <div className="absolute top-1/2 right-10 w-40 h-40 rounded-full bg-white/5"></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white">
          <div className="max-w-md space-y-8">
            {/* Logo - 3x Size */}
            <div className="flex justify-center mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <img 
                  src={sahihLogoPath} 
                  alt="Sahih Certifications" 
                  className="h-60 object-contain"
                  data-testid="img-login-logo"
                />
              </div>
            </div>
            
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">
                Sahih - Hub
              </h1>
              <p className="text-xl text-white/80 font-light">
                Digital Compliance Interface
              </p>
              <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                <Globe className="w-4 h-4" />
                <span>Doha, Qatar</span>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-8">
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">ISO 17021 Compliant</h3>
                  <p className="text-sm text-white/70">UKAS surveillance-ready QMS platform</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Accredited Excellence</h3>
                  <p className="text-sm text-white/70">International standards certification</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Enterprise Grade</h3>
                  <p className="text-sm text-white/70">Secure document control & audit trails</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center space-y-4">
            <img 
              src={sahihLogoPath} 
              alt="Sahih Certifications" 
              className="h-32 object-contain"
              data-testid="img-login-logo-mobile"
            />
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Sahih - Hub</h2>
          </div>

          <Card className="border-0 shadow-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#C9A227] to-[#705900] mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                  Welcome Back
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                  Sign in to access your QMS portal
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@sahihcert.qa"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-12 border-slate-200 dark:border-slate-700 focus:border-[#C9A227] focus:ring-[#C9A227]/20"
                    data-testid="input-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                      Password
                    </Label>
                    <button type="button" className="text-sm text-[#C9A227] hover:text-[#705900] font-medium">
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-12 border-slate-200 dark:border-slate-700 focus:border-[#C9A227] focus:ring-[#C9A227]/20"
                    data-testid="input-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[#C9A227] to-[#705900] hover:from-[#B8931F] hover:to-[#5A4700] shadow-lg shadow-[#C9A227]/25 transition-all duration-300" 
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="w-5 h-5" />
                      Sign In to QMS
                    </span>
                  )}
                </Button>
              </form>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Compliant</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Digital Compliance Interface
            <br />
            <span className="text-xs">&copy; {new Date().getFullYear()} Sahih - Hub. Doha, Qatar.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
