import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: number;
  title: string;
  message: string;
  urgencyLevel: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);
  const lastNotificationIdRef = useRef<number | null>(null);
  const { toast } = useToast();

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
    enabled: isEnabled && permission === 'granted',
  });

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setIsEnabled(localStorage.getItem('push-notifications-enabled') === 'true');
    }
  }, []);

  useEffect(() => {
    if (!notifications || !isEnabled || permission !== 'granted') return;

    const unreadNotifications = notifications.filter(n => !n.isRead);
    
    if (unreadNotifications.length > 0) {
      const latestNotification = unreadNotifications[0];
      
      if (lastNotificationIdRef.current !== null && 
          latestNotification.id > lastNotificationIdRef.current) {
        showBrowserNotification(latestNotification);
      }
      
      lastNotificationIdRef.current = latestNotification.id;
    }
  }, [notifications, isEnabled, permission]);

  const showBrowserNotification = (notification: Notification) => {
    if (permission !== 'granted') return;

    const browserNotif = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: `notification-${notification.id}`,
      requireInteraction: notification.urgencyLevel === 'high',
    });

    browserNotif.onclick = () => {
      window.focus();
      browserNotif.close();
    };
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast({
        title: 'Notifications not supported',
        description: 'Your browser does not support push notifications',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setIsEnabled(true);
        localStorage.setItem('push-notifications-enabled', 'true');
        toast({
          title: 'Notifications enabled',
          description: "You'll receive alerts for new tasks and announcements",
        });
        
        new Notification('Notifications Enabled', {
          body: 'You will now receive notifications from Sahih-Hub',
          icon: '/favicon.png',
        });
      } else if (result === 'denied') {
        toast({
          title: 'Notifications blocked',
          description: 'Please enable notifications in your browser settings',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const disableNotifications = () => {
    setIsEnabled(false);
    localStorage.setItem('push-notifications-enabled', 'false');
    toast({
      title: 'Notifications disabled',
      description: 'You will no longer receive browser notifications',
    });
  };

  if (!('Notification' in window)) {
    return null;
  }

  if (permission === 'granted' && isEnabled) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={disableNotifications}
        title="Disable notifications"
        data-testid="button-disable-notifications"
      >
        <Bell className="h-4 w-4 text-green-600" />
      </Button>
    );
  }

  if (permission === 'denied') {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        title="Notifications blocked in browser settings"
        data-testid="button-notifications-blocked"
      >
        <BellOff className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={requestPermission}
      title="Enable notifications"
      data-testid="button-enable-notifications"
    >
      <Bell className="h-4 w-4" />
    </Button>
  );
}
