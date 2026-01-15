import { useState, useEffect, useMemo } from "react";

interface NamedStar {
  name: string;
  arabicName?: string;
  constellation: string;
  fact: string;
  magnitude: number;
  distance: string;
  color: string;
}

const NAMED_STARS: NamedStar[] = [
  { name: "Sirius", arabicName: "الشعرى", constellation: "Canis Major", fact: "The brightest star in the night sky, known as the 'Dog Star'. Ancient Egyptians based their calendar on its rising.", magnitude: -1.46, distance: "8.6 light-years", color: "rgba(200, 220, 255, 1)" },
  { name: "Canopus", arabicName: "سهيل", constellation: "Carina", fact: "The second brightest star. Named after the navigator of the Greek fleet in the Trojan War.", magnitude: -0.74, distance: "310 light-years", color: "rgba(255, 255, 240, 1)" },
  { name: "Arcturus", arabicName: "السماك الرامح", constellation: "Boötes", fact: "An orange giant star, 25 times larger than our Sun. Its light was used to open the 1933 World's Fair.", magnitude: -0.05, distance: "37 light-years", color: "rgba(255, 200, 150, 1)" },
  { name: "Vega", arabicName: "الواقع", constellation: "Lyra", fact: "Will be Earth's North Star in about 12,000 years. One of the first stars to be photographed.", magnitude: 0.03, distance: "25 light-years", color: "rgba(200, 220, 255, 1)" },
  { name: "Capella", arabicName: "العيوق", constellation: "Auriga", fact: "Actually a system of 4 stars! The name means 'little she-goat' in Latin.", magnitude: 0.08, distance: "43 light-years", color: "rgba(255, 244, 234, 1)" },
  { name: "Rigel", arabicName: "رجل الجبار", constellation: "Orion", fact: "A blue supergiant, about 120,000 times more luminous than our Sun. It marks Orion's left foot.", magnitude: 0.13, distance: "860 light-years", color: "rgba(180, 200, 255, 1)" },
  { name: "Betelgeuse", arabicName: "إبط الجوزاء", constellation: "Orion", fact: "A red supergiant that could explode as a supernova anytime in the next million years!", magnitude: 0.42, distance: "700 light-years", color: "rgba(255, 150, 100, 1)" },
  { name: "Aldebaran", arabicName: "الدبران", constellation: "Taurus", fact: "The 'Eye of the Bull' - an orange giant 44 times larger than our Sun.", magnitude: 0.85, distance: "65 light-years", color: "rgba(255, 180, 120, 1)" },
  { name: "Antares", arabicName: "قلب العقرب", constellation: "Scorpius", fact: "Its name means 'rival of Mars' due to its red color. 700 times larger than our Sun!", magnitude: 0.96, distance: "550 light-years", color: "rgba(255, 100, 80, 1)" },
  { name: "Spica", arabicName: "السماك الأعزل", constellation: "Virgo", fact: "A binary star system spinning so fast the stars are egg-shaped, not spherical.", magnitude: 0.97, distance: "250 light-years", color: "rgba(180, 200, 255, 1)" },
  { name: "Polaris", arabicName: "نجم الشمال", constellation: "Ursa Minor", fact: "The current North Star! Ancient sailors used it for navigation. It's actually a triple star system.", magnitude: 1.98, distance: "433 light-years", color: "rgba(255, 255, 220, 1)" },
  { name: "Deneb", arabicName: "ذنب الدجاجة", constellation: "Cygnus", fact: "One of the most luminous stars known - if placed where our Sun is, Earth would be vaporized!", magnitude: 1.25, distance: "2,600 light-years", color: "rgba(200, 220, 255, 1)" },
  { name: "Fomalhaut", arabicName: "فم الحوت", constellation: "Piscis Austrinus", fact: "One of the first stars discovered to have an exoplanet. Called the 'Loneliest Star' due to its isolation.", magnitude: 1.16, distance: "25 light-years", color: "rgba(255, 255, 255, 1)" },
  { name: "Altair", arabicName: "الطائر", constellation: "Aquila", fact: "Rotates so fast (once every 9 hours) that it's flattened at the poles. Part of the Summer Triangle.", magnitude: 0.76, distance: "17 light-years", color: "rgba(255, 255, 240, 1)" },
  { name: "Regulus", arabicName: "قلب الأسد", constellation: "Leo", fact: "The 'Heart of the Lion' - spins so fast it's nearly tearing itself apart!", magnitude: 1.40, distance: "79 light-years", color: "rgba(180, 200, 255, 1)" },
];

interface StarData {
  id: number;
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleDelay: number;
  color: string;
  namedStar?: NamedStar;
}

interface PlanetData {
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  glowColor: string;
  visible: boolean;
}

interface MeteorData {
  id: number;
  startX: number;
  startY: number;
  angle: number;
  length: number;
  duration: number;
  delay: number;
}

type TimeOfDay = 'night' | 'dawn' | 'sunrise' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'dusk';

const getStarColor = (): string => {
  const colors = [
    'rgba(255, 255, 255, 1)',
    'rgba(255, 255, 255, 1)',
    'rgba(255, 255, 255, 1)',
    'rgba(255, 244, 234, 1)',
    'rgba(255, 244, 234, 1)',
    'rgba(200, 220, 255, 1)',
    'rgba(255, 220, 180, 1)',
    'rgba(255, 200, 150, 1)',
    'rgba(180, 200, 255, 1)',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const getQatarTime = (): Date => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3 * 60 * 60 * 1000));
};

const getTimeOfDay = (hour: number): TimeOfDay => {
  if (hour >= 0 && hour < 5) return 'night';
  if (hour >= 5 && hour < 6) return 'dawn';
  if (hour >= 6 && hour < 7) return 'sunrise';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 18) return 'sunset';
  if (hour >= 18 && hour < 19) return 'dusk';
  return 'night';
};

const getSkyGradient = (timeOfDay: TimeOfDay): string => {
  switch (timeOfDay) {
    case 'night':
      return 'linear-gradient(to bottom, #030308 0%, #050510 20%, #080815 40%, #0a0a1a 60%, #0c0c1f 80%, #0e0e24 100%)';
    case 'dawn':
      return 'linear-gradient(to bottom, #0a0a1a 0%, #1a1a2e 20%, #2d1b4e 40%, #4a2c6e 60%, #6b3d7a 70%, #8b4d6e 80%, #c27066 90%, #e8a87c 100%)';
    case 'sunrise':
      return 'linear-gradient(to bottom, #1a1a2e 0%, #2d3a52 15%, #4a5a72 30%, #7a8a9a 45%, #f4a460 60%, #ff8c42 70%, #ff6b35 80%, #ff4500 90%, #ff6347 100%)';
    case 'morning':
      return 'linear-gradient(to bottom, #1e3c72 0%, #2a5298 20%, #4a90b8 40%, #7ec8e3 60%, #a8d8ea 80%, #cce8f4 100%)';
    case 'noon':
      return 'linear-gradient(to bottom, #0c4a6e 0%, #0369a1 20%, #0284c7 40%, #38bdf8 60%, #7dd3fc 80%, #bae6fd 100%)';
    case 'afternoon':
      return 'linear-gradient(to bottom, #1e3a5f 0%, #2d5a7b 20%, #4a7c99 40%, #7aa5c0 60%, #a8c8dc 80%, #d4e8f2 100%)';
    case 'sunset':
      return 'linear-gradient(to bottom, #1a1a2e 0%, #2d2b52 10%, #4a3f6e 20%, #6d4a7a 30%, #a85a78 40%, #d4686a 50%, #f08050 60%, #ffa040 70%, #ffc040 80%, #ffe080 100%)';
    case 'dusk':
      return 'linear-gradient(to bottom, #0a0a18 0%, #151528 15%, #252545 30%, #3a3a65 45%, #5a4a75 55%, #7a5a80 65%, #9a6a7a 75%, #b07060 85%, #c08050 100%)';
    default:
      return 'linear-gradient(to bottom, #030308 0%, #0e0e24 100%)';
  }
};

const getSunPosition = (hour: number, minute: number): { x: number; y: number; visible: boolean; size: number; color: string } => {
  const totalMinutes = hour * 60 + minute;
  
  if (totalMinutes < 300 || totalMinutes > 1140) {
    return { x: 50, y: 120, visible: false, size: 0, color: '' };
  }
  
  const progress = (totalMinutes - 300) / (1140 - 300);
  const x = 10 + progress * 80;
  const y = 90 - Math.sin(progress * Math.PI) * 80;
  
  let color = '#fff5e6';
  let size = 60;
  
  if (hour >= 5 && hour < 7) {
    color = '#ff6b35';
    size = 70;
  } else if (hour >= 7 && hour < 9) {
    color = '#ffa500';
    size = 65;
  } else if (hour >= 16 && hour < 18) {
    color = '#ff6347';
    size = 70;
  } else if (hour >= 18 && hour < 19) {
    color = '#ff4500';
    size = 75;
  }
  
  return { x, y, visible: true, size, color };
};

const getMoonPosition = (hour: number): { x: number; y: number; visible: boolean; phase: number } => {
  if (hour >= 7 && hour < 18) {
    return { x: 50, y: 120, visible: false, phase: 0.7 };
  }
  
  let progress = 0;
  if (hour >= 18) {
    progress = (hour - 18) / 12;
  } else {
    progress = (hour + 6) / 12;
  }
  
  const x = 15 + progress * 70;
  const y = 20 - Math.sin(progress * Math.PI) * 10 + 15;
  
  const dayOfMonth = new Date().getDate();
  const phase = (dayOfMonth % 30) / 30;
  
  return { x, y, visible: true, phase };
};

export function DynamicQatarSky() {
  const [qatarTime, setQatarTime] = useState(getQatarTime());
  const [meteorShower, setMeteorShower] = useState<MeteorData[]>([]);
  const [selectedStar, setSelectedStar] = useState<{star: NamedStar, x: number, y: number} | null>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setQatarTime(getQatarTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const timeOfDay = getTimeOfDay(qatarTime.getHours());
    if (timeOfDay === 'night' || timeOfDay === 'dawn' || timeOfDay === 'dusk') {
      const createMeteor = () => {
        if (Math.random() < 0.3) {
          const meteor: MeteorData = {
            id: Date.now(),
            startX: Math.random() * 80 + 10,
            startY: Math.random() * 30,
            angle: Math.random() * 30 + 30,
            length: Math.random() * 100 + 50,
            duration: Math.random() * 0.5 + 0.3,
            delay: 0,
          };
          setMeteorShower(prev => [...prev.slice(-5), meteor]);
        }
      };
      
      const meteorInterval = setInterval(createMeteor, 3000 + Math.random() * 5000);
      return () => clearInterval(meteorInterval);
    }
  }, [qatarTime]);
  
  const stars = useMemo(() => {
    const starList: StarData[] = [];
    
    // Named stars at fixed positions (these are the clickable ones)
    const namedStarPositions = [
      { x: 15, y: 8 },   // Polaris (North Star - top)
      { x: 72, y: 12 },  // Sirius
      { x: 28, y: 18 },  // Vega
      { x: 85, y: 22 },  // Canopus
      { x: 42, y: 15 },  // Arcturus
      { x: 58, y: 28 },  // Capella
      { x: 35, y: 35 },  // Rigel
      { x: 78, y: 38 },  // Betelgeuse
      { x: 12, y: 42 },  // Aldebaran
      { x: 92, y: 8 },   // Antares
      { x: 48, y: 45 },  // Spica
      { x: 65, y: 5 },   // Deneb
      { x: 22, y: 52 },  // Fomalhaut
      { x: 55, y: 18 },  // Altair
      { x: 38, y: 8 },   // Regulus
    ];
    
    // Add named stars first (bright, clickable)
    NAMED_STARS.forEach((namedStar, index) => {
      const pos = namedStarPositions[index];
      starList.push({
        id: index,
        x: pos.x,
        y: pos.y,
        size: 3.5 + (1.5 - namedStar.magnitude) * 0.5, // Brighter = larger
        brightness: 0.9,
        twinkleSpeed: 2,
        twinkleDelay: index * 0.3,
        color: namedStar.color,
        namedStar: namedStar,
      });
    });
    
    // Dim background stars
    for (let i = NAMED_STARS.length; i < 200 + NAMED_STARS.length; i++) {
      starList.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1 + 0.5,
        brightness: Math.random() * 0.3 + 0.2,
        twinkleSpeed: Math.random() * 4 + 3,
        twinkleDelay: Math.random() * 5,
        color: 'rgba(255, 255, 255, 0.6)',
      });
    }
    
    // Medium brightness stars
    for (let i = 200 + NAMED_STARS.length; i < 280 + NAMED_STARS.length; i++) {
      starList.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.5 + 1,
        brightness: Math.random() * 0.4 + 0.4,
        twinkleSpeed: Math.random() * 3 + 2,
        twinkleDelay: Math.random() * 4,
        color: getStarColor(),
      });
    }
    
    // Bright unnamed stars
    for (let i = 280 + NAMED_STARS.length; i < 300 + NAMED_STARS.length; i++) {
      starList.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 2,
        brightness: Math.random() * 0.3 + 0.7,
        twinkleSpeed: Math.random() * 2 + 1.5,
        twinkleDelay: Math.random() * 3,
        color: getStarColor(),
      });
    }
    
    return starList;
  }, []);
  
  const planets = useMemo((): PlanetData[] => {
    const hour = qatarTime.getHours();
    const isNight = hour < 6 || hour >= 18;
    
    return [
      {
        name: 'Venus',
        x: 25,
        y: 15,
        size: 4,
        color: '#fffacd',
        glowColor: 'rgba(255, 250, 205, 0.6)',
        visible: isNight && (hour >= 18 && hour < 22 || hour >= 4 && hour < 6),
      },
      {
        name: 'Mars',
        x: 65,
        y: 25,
        size: 3,
        color: '#cd5c5c',
        glowColor: 'rgba(205, 92, 92, 0.5)',
        visible: isNight,
      },
      {
        name: 'Jupiter',
        x: 80,
        y: 18,
        size: 5,
        color: '#ffd699',
        glowColor: 'rgba(255, 214, 153, 0.6)',
        visible: isNight && hour >= 21 || hour < 5,
      },
      {
        name: 'Saturn',
        x: 45,
        y: 12,
        size: 4,
        color: '#f4e4bc',
        glowColor: 'rgba(244, 228, 188, 0.5)',
        visible: isNight && hour >= 23 || hour < 4,
      },
    ];
  }, [qatarTime]);
  
  const hour = qatarTime.getHours();
  const minute = qatarTime.getMinutes();
  const timeOfDay = getTimeOfDay(hour);
  const skyGradient = getSkyGradient(timeOfDay);
  const sunPosition = getSunPosition(hour, minute);
  const moonPosition = getMoonPosition(hour);
  
  const showStars = timeOfDay === 'night' || timeOfDay === 'dawn' || timeOfDay === 'dusk';
  const starsOpacity = timeOfDay === 'night' ? 1 : timeOfDay === 'dawn' || timeOfDay === 'dusk' ? 0.5 : 0;
  
  return (
    <>
      <div 
        className="absolute inset-0 z-0 transition-all duration-[60000ms]"
        style={{ background: skyGradient }}
      />
      
      {sunPosition.visible && (
        <div
          className="absolute z-[1] rounded-full transition-all duration-[60000ms]"
          style={{
            left: `${sunPosition.x}%`,
            top: `${sunPosition.y}%`,
            width: `${sunPosition.size}px`,
            height: `${sunPosition.size}px`,
            background: `radial-gradient(circle, ${sunPosition.color} 0%, ${sunPosition.color}dd 40%, transparent 70%)`,
            boxShadow: `0 0 ${sunPosition.size * 2}px ${sunPosition.color}, 0 0 ${sunPosition.size * 4}px ${sunPosition.color}80`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
      
      {moonPosition.visible && (
        <div
          className="absolute z-[1] transition-all duration-[60000ms]"
          style={{
            left: `${moonPosition.x}%`,
            top: `${moonPosition.y}%`,
            width: '40px',
            height: '40px',
            background: `radial-gradient(circle at ${30 + moonPosition.phase * 40}% 50%, #f5f5dc 0%, #e8e8d0 50%, #d0d0c0 100%)`,
            borderRadius: '50%',
            boxShadow: '0 0 20px rgba(245, 245, 220, 0.5), 0 0 40px rgba(245, 245, 220, 0.3)',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 30% 30%, transparent 10%, rgba(200, 200, 180, 0.3) 40%, transparent 60%),
                          radial-gradient(circle at 60% 60%, transparent 5%, rgba(180, 180, 160, 0.2) 30%, transparent 50%)`,
            }}
          />
        </div>
      )}
      
      {showStars && (
        <div 
          className="absolute inset-0 z-[1] overflow-hidden transition-opacity duration-[10000ms]"
          style={{ opacity: starsOpacity }}
        >
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
            @keyframes meteor {
              0% {
                opacity: 0;
                transform: translateX(0) translateY(0);
              }
              10% {
                opacity: 1;
              }
              90% {
                opacity: 1;
              }
              100% {
                opacity: 0;
                transform: translateX(var(--meteor-x)) translateY(var(--meteor-y));
              }
            }
            @keyframes planetPulse {
              0%, 100% {
                box-shadow: 0 0 10px var(--glow-color), 0 0 20px var(--glow-color);
              }
              50% {
                box-shadow: 0 0 15px var(--glow-color), 0 0 30px var(--glow-color), 0 0 45px var(--glow-color);
              }
            }
          `}</style>
          
          {stars.map((star) => (
            <div
              key={star.id}
              className={`absolute rounded-full ${star.namedStar ? 'cursor-pointer hover:scale-150 transition-transform duration-200' : ''}`}
              onClick={(e) => {
                if (star.namedStar) {
                  e.stopPropagation();
                  setSelectedStar({ star: star.namedStar, x: star.x, y: star.y });
                }
              }}
              data-testid={star.namedStar ? `star-${star.namedStar.name.toLowerCase()}` : undefined}
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
                boxShadow: star.namedStar 
                  ? `0 0 ${star.size * 2}px ${star.color}, 0 0 ${star.size * 4}px ${star.color.replace('1)', '0.5)')}`
                  : star.size > 1.5 
                    ? `0 0 ${star.size}px ${star.color.replace('1)', '0.5)')}`
                    : 'none',
                zIndex: star.namedStar ? 10 : 1,
              } as React.CSSProperties}
            />
          ))}
          
          {planets.filter(p => p.visible).map((planet) => (
            <div
              key={planet.name}
              className="absolute rounded-full"
              title={planet.name}
              style={{
                left: `${planet.x}%`,
                top: `${planet.y}%`,
                width: `${planet.size}px`,
                height: `${planet.size}px`,
                backgroundColor: planet.color,
                '--glow-color': planet.glowColor,
                animation: 'planetPulse 4s ease-in-out infinite',
                transform: 'translate(-50%, -50%)',
              } as React.CSSProperties}
            />
          ))}
          
          {meteorShower.map((meteor) => (
            <div
              key={meteor.id}
              className="absolute pointer-events-none"
              style={{
                left: `${meteor.startX}%`,
                top: `${meteor.startY}%`,
                width: `${meteor.length}px`,
                height: '2px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 10%, rgba(255,255,255,0.8) 50%, white 100%)',
                transform: `rotate(${meteor.angle}deg)`,
                '--meteor-x': `${meteor.length * Math.cos(meteor.angle * Math.PI / 180)}px`,
                '--meteor-y': `${meteor.length * Math.sin(meteor.angle * Math.PI / 180)}px`,
                animation: `meteor ${meteor.duration}s ease-out forwards`,
                boxShadow: '0 0 4px white, 0 0 8px rgba(255,255,255,0.5)',
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
      
      <div className="absolute inset-0 z-[2] bg-gradient-to-br from-slate-950/10 via-transparent to-slate-950/10"></div>
      
      <div 
        className="absolute bottom-2 left-2 z-[3] px-2 py-1 rounded-md text-[10px] backdrop-blur-sm"
        style={{ 
          background: 'rgba(0,0,0,0.3)', 
          color: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        Qatar Time: {qatarTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
        <span className="mx-1">|</span>
        <span className="capitalize">{timeOfDay.replace('_', ' ')}</span>
      </div>
      
      {/* Star Information Popup */}
      {selectedStar && (
        <div 
          className="fixed inset-0 z-[100]"
          onClick={() => setSelectedStar(null)}
        >
          <div 
            className="absolute z-[101] max-w-xs animate-in fade-in zoom-in-95 duration-200"
            style={{
              left: `${Math.min(Math.max(selectedStar.x, 15), 75)}%`,
              top: `${Math.min(Math.max(selectedStar.y + 5, 10), 60)}%`,
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="rounded-xl p-4 backdrop-blur-md border shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 30, 0.95) 0%, rgba(20, 20, 50, 0.95) 100%)',
                borderColor: selectedStar.star.color.replace('1)', '0.5)'),
                boxShadow: `0 0 30px ${selectedStar.star.color.replace('1)', '0.3)')}, 0 10px 40px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Header with star glow */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full animate-pulse"
                    style={{ 
                      backgroundColor: selectedStar.star.color,
                      boxShadow: `0 0 10px ${selectedStar.star.color}, 0 0 20px ${selectedStar.star.color.replace('1)', '0.5)')}`,
                    }}
                  />
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedStar.star.name}</h3>
                    {selectedStar.star.arabicName && (
                      <p className="text-sm" style={{ color: selectedStar.star.color }}>{selectedStar.star.arabicName}</p>
                    )}
                  </div>
                </div>
                <button 
                  className="text-white/50 hover:text-white transition-colors text-xl leading-none"
                  onClick={() => setSelectedStar(null)}
                  data-testid="button-close-star-info"
                >
                  ×
                </button>
              </div>
              
              {/* Constellation */}
              <div className="text-xs text-amber-200/80 mb-2">
                Constellation: <span className="text-amber-100">{selectedStar.star.constellation}</span>
              </div>
              
              {/* Stats */}
              <div className="flex gap-4 mb-3 text-xs">
                <div>
                  <span className="text-white/50">Magnitude:</span>
                  <span className="text-white ml-1">{selectedStar.star.magnitude}</span>
                </div>
                <div>
                  <span className="text-white/50">Distance:</span>
                  <span className="text-white ml-1">{selectedStar.star.distance}</span>
                </div>
              </div>
              
              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-3" />
              
              {/* Fun Fact */}
              <div className="text-sm text-white/90 leading-relaxed">
                {selectedStar.star.fact}
              </div>
              
              {/* Tap hint */}
              <p className="text-[10px] text-white/30 mt-3 text-center">
                Tap anywhere to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
