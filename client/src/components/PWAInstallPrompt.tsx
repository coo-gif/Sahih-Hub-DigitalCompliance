import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const dismissedStorage = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissedStorage) {
      setDismissed(true);
      return;
    }

    if (isIOSDevice) {
      setTimeout(() => setShowPrompt(true), 2000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div 
      className="fixed bottom-20 left-4 right-4 lg:bottom-4 lg:left-auto lg:right-4 lg:w-80 z-50 bg-gradient-to-br from-[#7A0C1A] to-[#520812] text-white rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4"
      data-testid="pwa-install-prompt"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
        data-testid="button-dismiss-pwa-prompt"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[#F3E3D0]/20">
          <Smartphone className="w-6 h-6 text-[#F3E3D0]" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">Install Sahih-Hub</h3>
          <p className="text-xs text-[#E3C39B] mt-1">
            {isIOS 
              ? "Add to your home screen for app-like experience"
              : "Add to your home screen for quick access and offline support"
            }
          </p>
        </div>
      </div>
      
      {isIOS ? (
        <div className="mt-3 space-y-2">
          <Button
            onClick={() => setShowIOSSteps(!showIOSSteps)}
            className="w-full bg-[#F3E3D0] text-[#7A0C1A] hover:bg-[#E3C39B] font-semibold"
            data-testid="button-ios-install-steps"
          >
            <Share className="w-4 h-4 mr-2" />
            {showIOSSteps ? "Hide Steps" : "How to Install"}
          </Button>
          {showIOSSteps && (
            <div className="bg-white/10 rounded-lg p-3 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#F3E3D0] text-[#7A0C1A] rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">1</span>
                <span>Tap the <Share className="inline w-3 h-3" /> Share button below</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-[#F3E3D0] text-[#7A0C1A] rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">2</span>
                <span>Scroll and tap "Add to Home Screen"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-[#F3E3D0] text-[#7A0C1A] rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">3</span>
                <span>Tap "Add" to confirm</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Button
          onClick={handleInstall}
          className="w-full mt-3 bg-[#F3E3D0] text-[#7A0C1A] hover:bg-[#E3C39B] font-semibold"
          data-testid="button-install-pwa"
        >
          <Download className="w-4 h-4 mr-2" />
          Install App
        </Button>
      )}
    </div>
  );
}
