import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, LogIn, Award, CheckCircle, Globe, Building2, Star } from "lucide-react";
import sahihLogoPath from "@assets/sahih_logo-1.png";

interface StarData {
  id: number;
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleDelay: number;
  color: string;
}

interface LoginProps {
  onLogin: () => Promise<void>;
}

// Generate realistic star colors (based on stellar classification)
const getStarColor = (): string => {
  const colors = [
    'rgba(255, 255, 255, 1)',      // White (most common)
    'rgba(255, 255, 255, 1)',
    'rgba(255, 255, 255, 1)',
    'rgba(255, 244, 234, 1)',      // Warm white
    'rgba(255, 244, 234, 1)',
    'rgba(200, 220, 255, 1)',      // Blue-white (hot stars)
    'rgba(255, 220, 180, 1)',      // Yellow-white
    'rgba(255, 200, 150, 1)',      // Orange tint
    'rgba(180, 200, 255, 1)',      // Blue tint
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Generate stars - unique pattern each page load
  const stars = useMemo(() => {
    const starList: StarData[] = [];
    
    // Create layers of stars for depth effect
    // Layer 1: Faint distant stars (many, small)
    for (let i = 0; i < 200; i++) {
      starList.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1 + 0.5, // 0.5-1.5px
        brightness: Math.random() * 0.3 + 0.2, // 0.2-0.5
        twinkleSpeed: Math.random() * 4 + 3, // 3-7s
        twinkleDelay: Math.random() * 5,
        color: 'rgba(255, 255, 255, 0.6)',
      });
    }
    
    // Layer 2: Medium stars
    for (let i = 200; i < 280; i++) {
      starList.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.5 + 1, // 1-2.5px
        brightness: Math.random() * 0.4 + 0.4, // 0.4-0.8
        twinkleSpeed: Math.random() * 3 + 2, // 2-5s
        twinkleDelay: Math.random() * 4,
        color: getStarColor(),
      });
    }
    
    // Layer 3: Bright prominent stars (few, large)
    for (let i = 280; i < 300; i++) {
      starList.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 2, // 2-4px
        brightness: Math.random() * 0.3 + 0.7, // 0.7-1.0
        twinkleSpeed: Math.random() * 2 + 1.5, // 1.5-3.5s
        twinkleDelay: Math.random() * 3,
        color: getStarColor(),
      });
    }
    
    return starList;
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
      {/* Night Sky Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{ 
          background: 'linear-gradient(to bottom, #030308 0%, #050510 20%, #080815 40%, #0a0a1a 60%, #0c0c1f 80%, #0e0e24 100%)',
        }}
      />
      
      {/* Twinkling Stars */}
      <div className="absolute inset-0 z-[1] overflow-hidden">
        <style>{`
          @keyframes twinkle {
            0%, 100% { 
              opacity: var(--base-opacity);
              transform: scale(1);
            }
            25% { 
              opacity: calc(var(--base-opacity) * 0.4);
              transform: scale(0.9);
            }
            50% { 
              opacity: calc(var(--base-opacity) * 1.2);
              transform: scale(1.1);
            }
            75% { 
              opacity: calc(var(--base-opacity) * 0.6);
              transform: scale(0.95);
            }
          }
          @keyframes glow {
            0%, 100% {
              box-shadow: 0 0 2px currentColor, 0 0 4px currentColor;
            }
            50% {
              box-shadow: 0 0 4px currentColor, 0 0 8px currentColor, 0 0 12px currentColor;
            }
          }
        `}</style>
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.color,
              '--base-opacity': star.brightness,
              animation: star.size > 2.5 
                ? `twinkle ${star.twinkleSpeed}s ease-in-out ${star.twinkleDelay}s infinite, glow ${star.twinkleSpeed * 1.5}s ease-in-out ${star.twinkleDelay}s infinite`
                : `twinkle ${star.twinkleSpeed}s ease-in-out ${star.twinkleDelay}s infinite`,
              boxShadow: star.size > 1.5 
                ? `0 0 ${star.size}px ${star.color.replace('1)', '0.5)')}`
                : 'none',
            } as React.CSSProperties}
          />
        ))}
      </div>
      
      {/* Subtle overlay for text readability */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-br from-slate-950/20 via-transparent to-slate-950/20"></div>

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
