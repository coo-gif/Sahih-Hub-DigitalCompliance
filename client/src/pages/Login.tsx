import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, LogIn, Award, CheckCircle, Globe, Building2, Star } from "lucide-react";
import sahihLogoPath from "@assets/sahih_logo-1.png";

interface LoginProps {
  onLogin: () => void;
}

interface NasaApod {
  title: string;
  url: string;
  hdurl?: string;
  explanation: string;
  date: string;
  media_type: string;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [imageCredit, setImageCredit] = useState<string>("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchNasaApod = async () => {
      try {
        const response = await fetch(
          'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY'
        );
        const data: NasaApod = await response.json();
        
        if (data.media_type === 'image') {
          setBackgroundImage(data.hdurl || data.url);
          setImageCredit(data.title);
        }
      } catch (error) {
        console.error('Failed to fetch NASA APOD:', error);
      }
    };

    fetchNasaApod();
  }, []);

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
      {/* Left Panel - Qatar Night Sky with NASA APOD */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-900/50 to-transparent"></div>
        
        {/* Animated stars overlay */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                boxShadow: '0 0 6px 1px rgba(255,255,255,0.6)',
                opacity: 0.6 + Math.random() * 0.4,
              }}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white">
          <div className="max-w-md space-y-8">
            {/* Logo - 3x Size */}
            <div className="flex justify-center mb-8">
              <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl">
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
                style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
              >
                Sahih - Hub
              </h1>
              <p className="text-xl text-white/90 font-light" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                Digital Compliance Interface
              </p>
              <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                <Globe className="w-4 h-4" />
                <span>Doha, Qatar</span>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-8">
              <div className="flex items-start gap-4 bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-lg">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">ISO 17021 Compliant</h3>
                  <p className="text-sm text-white/70">UKAS surveillance-ready QMS platform</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-lg">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Accredited Excellence</h3>
                  <p className="text-sm text-white/70">International standards certification</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-lg">
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

        {/* Image Credit */}
        {imageCredit && (
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <p className="text-xs text-white/50 flex items-center justify-center gap-1">
              <Star className="w-3 h-3" />
              Today's Sky: {imageCredit} - NASA APOD
            </p>
          </div>
        )}
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
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-gradient-to-br from-indigo-500 to-purple-600"
                >
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
                    className="h-12 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                    data-testid="input-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                      Password
                    </Label>
                    <button type="button" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
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
                    className="h-12 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                    data-testid="input-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 transition-all duration-300" 
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
