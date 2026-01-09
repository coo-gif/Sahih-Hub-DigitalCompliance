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
      {/* Left Panel - Hero Section with Sparkling Gold */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, #FEDB37 0%, #FDB931 8%, #9f7928 30%, #8A6E2F 40%, transparent 70%),
            radial-gradient(ellipse at 80% 80%, #FFFFFF 0%, #FFFFAC 8%, #D1B464 25%, #5d4a1f 50%, #5d4a1f 100%)
          `
        }}
      >
        {/* Animated Shimmer Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(
              110deg,
              transparent 20%,
              rgba(255, 255, 255, 0.4) 40%,
              rgba(255, 255, 255, 0.6) 50%,
              rgba(255, 255, 255, 0.4) 60%,
              transparent 80%
            )`,
            animation: 'shimmer 3s infinite linear',
            backgroundSize: '200% 100%',
          }}
        />
        
        {/* Sparkle particles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-2 h-2 bg-white rounded-full animate-pulse" style={{ top: '15%', left: '20%', boxShadow: '0 0 10px 2px rgba(255,255,255,0.8)' }}></div>
          <div className="absolute w-1 h-1 bg-white rounded-full animate-pulse" style={{ top: '25%', left: '70%', animationDelay: '0.5s', boxShadow: '0 0 8px 2px rgba(255,255,255,0.6)' }}></div>
          <div className="absolute w-2 h-2 bg-white rounded-full animate-pulse" style={{ top: '60%', left: '15%', animationDelay: '1s', boxShadow: '0 0 10px 2px rgba(255,255,255,0.8)' }}></div>
          <div className="absolute w-1 h-1 bg-white rounded-full animate-pulse" style={{ top: '75%', left: '80%', animationDelay: '1.5s', boxShadow: '0 0 8px 2px rgba(255,255,255,0.6)' }}></div>
          <div className="absolute w-2 h-2 bg-white rounded-full animate-pulse" style={{ top: '40%', left: '85%', animationDelay: '2s', boxShadow: '0 0 10px 2px rgba(255,255,255,0.8)' }}></div>
          <div className="absolute w-1 h-1 bg-white rounded-full animate-pulse" style={{ top: '85%', left: '40%', animationDelay: '0.3s', boxShadow: '0 0 8px 2px rgba(255,255,255,0.6)' }}></div>
          <div className="absolute w-2 h-2 bg-white rounded-full animate-pulse" style={{ top: '10%', left: '50%', animationDelay: '0.7s', boxShadow: '0 0 10px 2px rgba(255,255,255,0.8)' }}></div>
          <div className="absolute w-1 h-1 bg-white rounded-full animate-pulse" style={{ top: '50%', left: '30%', animationDelay: '1.2s', boxShadow: '0 0 8px 2px rgba(255,255,255,0.6)' }}></div>
        </div>

        {/* Geometric Pattern Overlay - Islamic Art Inspired */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="geometric" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M10 0L20 10L10 20L0 10Z" fill="none" stroke="white" strokeWidth="0.5"/>
              <circle cx="10" cy="10" r="3" fill="none" stroke="white" strokeWidth="0.3"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#geometric)"/>
          </svg>
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white drop-shadow-lg">
          <div className="max-w-md space-y-8">
            {/* Logo - 3x Size */}
            <div className="flex justify-center mb-8">
              <div className="bg-white/20 backdrop-blur-md rounded-2xl p-6 border border-white/30 shadow-2xl">
                <img 
                  src={sahihLogoPath} 
                  alt="Sahih Certifications" 
                  className="h-60 object-contain"
                  data-testid="img-login-logo"
                />
              </div>
            </div>
            
            <div className="text-center space-y-4">
              <h1 
                className="text-4xl font-bold tracking-tight"
                style={{
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                Sahih - Hub
              </h1>
              <p className="text-xl text-white/90 font-light" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                Digital Compliance Interface
              </p>
              <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                <Globe className="w-4 h-4" />
                <span>Doha, Qatar</span>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-8">
              <div className="flex items-start gap-4 bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-lg">
                <div className="p-2 bg-white/25 rounded-lg">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">ISO 17021 Compliant</h3>
                  <p className="text-sm text-white/80">UKAS surveillance-ready QMS platform</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-lg">
                <div className="p-2 bg-white/25 rounded-lg">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Accredited Excellence</h3>
                  <p className="text-sm text-white/80">International standards certification</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-lg">
                <div className="p-2 bg-white/25 rounded-lg">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Enterprise Grade</h3>
                  <p className="text-sm text-white/80">Secure document control & audit trails</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CSS Animation */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
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
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                  style={{
                    background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)'
                  }}
                >
                  <Shield className="w-8 h-8 text-amber-900" />
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
                    className="h-12 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-amber-500/20"
                    data-testid="input-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                      Password
                    </Label>
                    <button type="button" className="text-sm text-amber-600 hover:text-amber-700 font-medium">
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
                    className="h-12 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-amber-500/20"
                    data-testid="input-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold text-amber-900 shadow-lg transition-all duration-300 hover:scale-[1.02]" 
                  style={{
                    background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)',
                    boxShadow: '0 4px 15px rgba(191, 149, 63, 0.4)'
                  }}
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-amber-900/30 border-t-amber-900 rounded-full animate-spin"></div>
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
