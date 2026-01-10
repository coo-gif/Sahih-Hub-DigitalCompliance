import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, LogIn, Award, CheckCircle, Globe, Building2, Star } from "lucide-react";
import sahihLogoPath from "@assets/sahih_logo-1.png";

declare global {
  interface Window {
    jQuery: any;
    S: any;
  }
}

interface LoginProps {
  onLogin: () => Promise<void>;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const skyMapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Load VirtualSky library
    const loadVirtualSky = async () => {
      // Load jQuery first (required by VirtualSky)
      if (!window.jQuery) {
        const jqueryScript = document.createElement('script');
        jqueryScript.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
        jqueryScript.async = true;
        document.head.appendChild(jqueryScript);
        await new Promise(resolve => jqueryScript.onload = resolve);
      }

      // Load VirtualSky
      const vsScript = document.createElement('script');
      vsScript.src = 'https://virtualsky.lco.global/embed/virtualsky.js';
      vsScript.async = true;
      document.head.appendChild(vsScript);
      
      vsScript.onload = () => {
        if (skyMapRef.current && (window as any).S) {
          // Doha, Qatar coordinates
          const dohaLat = 25.2854;
          const dohaLon = 51.5310;
          
          new (window as any).S.VirtualSky({
            id: skyMapRef.current.id,
            projection: 'stereo',
            latitude: dohaLat,
            longitude: dohaLon,
            clock: new Date(),
            az: 180, // Looking south
            showstars: true,
            showstarlabels: false,
            showconstellations: true,
            showconstellationlabels: false,
            showplanets: true,
            showplanetlabels: true,
            showgalaxy: true,
            showdate: false,
            showposition: false,
            keyboard: false,
            mouse: false,
            cardinalpoints: false,
            gridlines_eq: false,
            gridlines_az: false,
            gradient: true,
            negative: false,
            magnitude: 6, // Show more stars (fainter ones visible)
            scalestars: 1.5, // Make stars larger/brighter
            live: true, // Real-time sky movement
            fontsize: '12px',
            fontfamily: 'system-ui',
            ground: false,
            groundcolour: 'rgba(0,0,0,0)',
            skycolour: 'rgba(5,5,20,1)',
            ecliptic: false,
            meridian: false,
            fps: 30, // Smooth animation
          });
        }
      };
    };

    loadVirtualSky();
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
      await onLogin();
      toast({ title: "Login successful" });
      setLocation('/');
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
    <div className="min-h-screen flex relative overflow-hidden">
      {/* VirtualSky Background - Real Qatar Night Sky */}
      <div 
        id="qatar-sky"
        ref={skyMapRef}
        className="absolute inset-0 z-0"
        style={{ 
          width: '100%', 
          height: '100%',
          background: 'linear-gradient(to bottom, #050514 0%, #0a0a1f 50%, #0f0f2a 100%)',
        }}
      />
      
      {/* Subtle overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-slate-950/30 via-transparent to-slate-950/30"></div>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center items-center px-12 text-white">
        <div className="max-w-md space-y-8">
          {/* Logo with star glow effect */}
          <div className="flex justify-center mb-8">
            <div 
              className="rounded-2xl p-8 border border-amber-400/30"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(191, 149, 63, 0.15) 0%, transparent 70%)',
                boxShadow: '0 0 60px 20px rgba(191, 149, 63, 0.2), 0 0 100px 40px rgba(191, 149, 63, 0.1)',
              }}
            >
              <img 
                src={sahihLogoPath} 
                alt="Sahih Certifications" 
                className="h-60 object-contain"
                style={{
                  filter: 'brightness(1.2) drop-shadow(0 0 20px rgba(255, 215, 0, 0.6)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.4))',
                }}
                data-testid="img-login-logo"
              />
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <h1 
              className="text-5xl font-bold tracking-tight"
              style={{ 
                background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #FBF5B7 50%, #FCF6BA 75%, #BF953F 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(191, 149, 63, 0.5)',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            >
              SAHIH-HUB
            </h1>
            <p 
              className="text-xl font-light tracking-wide"
              style={{ 
                color: '#e2d5b5',
                textShadow: '0 0 10px rgba(191, 149, 63, 0.3), 0 2px 4px rgba(0,0,0,0.5)' 
              }}
            >
              Digital Compliance Interface
            </p>
            <div 
              className="flex items-center justify-center gap-2 text-sm pt-2"
              style={{ color: '#c4b896' }}
            >
              <Globe className="w-4 h-4" />
              <span>Doha, Qatar</span>
              <span className="mx-2">•</span>
              <Star className="w-4 h-4" />
              <span>Live Night Sky</span>
            </div>
          </div>

          {/* Features with better visibility */}
          <div className="space-y-4 pt-8">
            <div 
              className="flex items-start gap-4 rounded-xl p-4 border"
              style={{
                background: 'linear-gradient(135deg, rgba(191, 149, 63, 0.15) 0%, rgba(0,0,0,0.4) 100%)',
                borderColor: 'rgba(191, 149, 63, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <div 
                className="p-2 rounded-lg"
                style={{ background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #AA771C)' }}
              >
                <Shield className="w-6 h-6 text-amber-900" />
              </div>
              <div>
                <h3 
                  className="font-semibold text-lg"
                  style={{ color: '#FCF6BA', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  ISO 17021 Compliant
                </h3>
                <p style={{ color: '#c4b896', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  UKAS surveillance-ready QMS platform
                </p>
              </div>
            </div>
            
            <div 
              className="flex items-start gap-4 rounded-xl p-4 border"
              style={{
                background: 'linear-gradient(135deg, rgba(191, 149, 63, 0.15) 0%, rgba(0,0,0,0.4) 100%)',
                borderColor: 'rgba(191, 149, 63, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <div 
                className="p-2 rounded-lg"
                style={{ background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #AA771C)' }}
              >
                <Award className="w-6 h-6 text-amber-900" />
              </div>
              <div>
                <h3 
                  className="font-semibold text-lg"
                  style={{ color: '#FCF6BA', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  Accredited Excellence
                </h3>
                <p style={{ color: '#c4b896', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  International standards certification
                </p>
              </div>
            </div>
            
            <div 
              className="flex items-start gap-4 rounded-xl p-4 border"
              style={{
                background: 'linear-gradient(135deg, rgba(191, 149, 63, 0.15) 0%, rgba(0,0,0,0.4) 100%)',
                borderColor: 'rgba(191, 149, 63, 0.3)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <div 
                className="p-2 rounded-lg"
                style={{ background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #AA771C)' }}
              >
                <Building2 className="w-6 h-6 text-amber-900" />
              </div>
              <div>
                <h3 
                  className="font-semibold text-lg"
                  style={{ color: '#FCF6BA', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  Enterprise Grade
                </h3>
                <p style={{ color: '#c4b896', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  Secure document control & audit trails
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sky Credit */}
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <p className="text-xs flex items-center justify-center gap-1" style={{ color: 'rgba(196, 184, 150, 0.6)' }}>
            <Star className="w-3 h-3" />
            Real-time Qatar Night Sky • VirtualSky
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form blended with night sky */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center space-y-4">
            <img 
              src={sahihLogoPath} 
              alt="Sahih Certifications" 
              className="h-32 object-contain"
              style={{
                filter: 'brightness(1.2) drop-shadow(0 0 15px rgba(255, 215, 0, 0.5))',
              }}
              data-testid="img-login-logo-mobile"
            />
            <h2 
              className="text-2xl font-bold"
              style={{ 
                background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #AA771C)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SAHIH-HUB
            </h2>
          </div>

          <Card 
            className="border shadow-2xl backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.85) 0%, rgba(25, 25, 50, 0.9) 100%)',
              borderColor: 'rgba(191, 149, 63, 0.3)',
              boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 60px rgba(191, 149, 63, 0.1)',
            }}
          >
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                  style={{ 
                    background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)',
                    boxShadow: '0 0 30px rgba(191, 149, 63, 0.5)',
                  }}
                >
                  <Shield className="w-8 h-8 text-amber-900" />
                </div>
                <h2 
                  className="text-2xl font-bold"
                  style={{ color: '#FCF6BA', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                >
                  Welcome Back
                </h2>
                <p style={{ color: '#a09880' }}>
                  Sign in to access your QMS portal
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label 
                    htmlFor="email" 
                    className="font-medium"
                    style={{ color: '#d4c8a8' }}
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@SAHIHCERTIFY.COM"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-12"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderColor: 'rgba(191, 149, 63, 0.3)',
                      color: '#e2d5b5',
                    }}
                    data-testid="input-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label 
                      htmlFor="password" 
                      className="font-medium"
                      style={{ color: '#d4c8a8' }}
                    >
                      Password
                    </Label>
                    <button 
                      type="button" 
                      className="text-sm font-medium hover:underline"
                      style={{ color: '#BF953F' }}
                    >
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
                    className="h-12"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderColor: 'rgba(191, 149, 63, 0.3)',
                      color: '#e2d5b5',
                    }}
                    data-testid="input-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold text-amber-900 transition-all duration-300 hover:scale-[1.02]" 
                  style={{
                    background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)',
                    boxShadow: '0 4px 20px rgba(191, 149, 63, 0.4), 0 0 30px rgba(191, 149, 63, 0.2)'
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

              <div className="pt-4 border-t" style={{ borderColor: 'rgba(191, 149, 63, 0.2)' }}>
                <div className="flex items-center justify-center gap-6 text-sm" style={{ color: '#a09880' }}>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Compliant</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm" style={{ color: '#8a7f65' }}>
            Digital Compliance Interface
            <br />
            <span className="text-xs">&copy; {new Date().getFullYear()} SAHIH-HUB. Doha, Qatar.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
