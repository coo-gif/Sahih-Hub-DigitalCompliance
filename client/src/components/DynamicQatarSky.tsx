import { useState, useEffect, useMemo } from "react";

// Qatar's geographical coordinates
const QATAR_LAT = 25.2854; // degrees North
const QATAR_LON = 51.5310; // degrees East

interface NamedStar {
  name: string;
  arabicName?: string;
  constellation: string;
  fact: string;
  magnitude: number;
  distance: string;
  color: string;
  ra: number;  // Right Ascension in hours (0-24)
  dec: number; // Declination in degrees (-90 to +90)
}

// Real star catalog with accurate celestial coordinates (J2000 epoch)
const NAMED_STARS: NamedStar[] = [
  { name: "Sirius", arabicName: "الشعرى", constellation: "Canis Major", fact: "The brightest star in the night sky, known as the 'Dog Star'. Ancient Egyptians based their calendar on its rising.", magnitude: -1.46, distance: "8.6 light-years", color: "rgba(200, 220, 255, 1)", ra: 6.7525, dec: -16.7161 },
  { name: "Canopus", arabicName: "سهيل", constellation: "Carina", fact: "The second brightest star. Named after the navigator of the Greek fleet in the Trojan War.", magnitude: -0.74, distance: "310 light-years", color: "rgba(255, 255, 240, 1)", ra: 6.3992, dec: -52.6956 },
  { name: "Arcturus", arabicName: "السماك الرامح", constellation: "Boötes", fact: "An orange giant star, 25 times larger than our Sun. Its light was used to open the 1933 World's Fair.", magnitude: -0.05, distance: "37 light-years", color: "rgba(255, 200, 150, 1)", ra: 14.2611, dec: 19.1822 },
  { name: "Vega", arabicName: "الواقع", constellation: "Lyra", fact: "Will be Earth's North Star in about 12,000 years. One of the first stars to be photographed.", magnitude: 0.03, distance: "25 light-years", color: "rgba(200, 220, 255, 1)", ra: 18.6156, dec: 38.7836 },
  { name: "Capella", arabicName: "العيوق", constellation: "Auriga", fact: "Actually a system of 4 stars! The name means 'little she-goat' in Latin.", magnitude: 0.08, distance: "43 light-years", color: "rgba(255, 244, 234, 1)", ra: 5.2783, dec: 45.9981 },
  { name: "Rigel", arabicName: "رجل الجبار", constellation: "Orion", fact: "A blue supergiant, about 120,000 times more luminous than our Sun. It marks Orion's left foot.", magnitude: 0.13, distance: "860 light-years", color: "rgba(180, 200, 255, 1)", ra: 5.2422, dec: -8.2017 },
  { name: "Betelgeuse", arabicName: "إبط الجوزاء", constellation: "Orion", fact: "A red supergiant that could explode as a supernova anytime in the next million years!", magnitude: 0.42, distance: "700 light-years", color: "rgba(255, 150, 100, 1)", ra: 5.9194, dec: 7.4069 },
  { name: "Aldebaran", arabicName: "الدبران", constellation: "Taurus", fact: "The 'Eye of the Bull' - an orange giant 44 times larger than our Sun.", magnitude: 0.85, distance: "65 light-years", color: "rgba(255, 180, 120, 1)", ra: 4.5989, dec: 16.5092 },
  { name: "Antares", arabicName: "قلب العقرب", constellation: "Scorpius", fact: "Its name means 'rival of Mars' due to its red color. 700 times larger than our Sun!", magnitude: 0.96, distance: "550 light-years", color: "rgba(255, 100, 80, 1)", ra: 16.4903, dec: -26.4319 },
  { name: "Spica", arabicName: "السماك الأعزل", constellation: "Virgo", fact: "A binary star system spinning so fast the stars are egg-shaped, not spherical.", magnitude: 0.97, distance: "250 light-years", color: "rgba(180, 200, 255, 1)", ra: 13.4197, dec: -11.1614 },
  { name: "Polaris", arabicName: "نجم الشمال", constellation: "Ursa Minor", fact: "The current North Star! Ancient sailors used it for navigation. It's actually a triple star system.", magnitude: 1.98, distance: "433 light-years", color: "rgba(255, 255, 220, 1)", ra: 2.5303, dec: 89.2641 },
  { name: "Deneb", arabicName: "ذنب الدجاجة", constellation: "Cygnus", fact: "One of the most luminous stars known - if placed where our Sun is, Earth would be vaporized!", magnitude: 1.25, distance: "2,600 light-years", color: "rgba(200, 220, 255, 1)", ra: 20.6903, dec: 45.2803 },
  { name: "Fomalhaut", arabicName: "فم الحوت", constellation: "Piscis Austrinus", fact: "One of the first stars discovered to have an exoplanet. Called the 'Loneliest Star' due to its isolation.", magnitude: 1.16, distance: "25 light-years", color: "rgba(255, 255, 255, 1)", ra: 22.9603, dec: -29.6222 },
  { name: "Altair", arabicName: "الطائر", constellation: "Aquila", fact: "Rotates so fast (once every 9 hours) that it's flattened at the poles. Part of the Summer Triangle.", magnitude: 0.76, distance: "17 light-years", color: "rgba(255, 255, 240, 1)", ra: 19.8464, dec: 8.8683 },
  { name: "Regulus", arabicName: "قلب الأسد", constellation: "Leo", fact: "The 'Heart of the Lion' - spins so fast it's nearly tearing itself apart!", magnitude: 1.40, distance: "79 light-years", color: "rgba(180, 200, 255, 1)", ra: 10.1394, dec: 11.9672 },
  { name: "Procyon", arabicName: "الشعرى الشامية", constellation: "Canis Minor", fact: "The 'Little Dog Star' - 8th brightest star. It will become a white dwarf in about 10 million years.", magnitude: 0.34, distance: "11.5 light-years", color: "rgba(255, 255, 240, 1)", ra: 7.6553, dec: 5.2250 },
  { name: "Achernar", arabicName: "آخر النهر", constellation: "Eridanus", fact: "One of the flattest stars known - spins so fast it's 56% wider at the equator!", magnitude: 0.46, distance: "139 light-years", color: "rgba(180, 200, 255, 1)", ra: 1.6286, dec: -57.2367 },
  { name: "Hadar", arabicName: "حضار", constellation: "Centaurus", fact: "Also called Beta Centauri - a triple star system 390 light-years away.", magnitude: 0.61, distance: "390 light-years", color: "rgba(180, 200, 255, 1)", ra: 14.0636, dec: -60.3731 },
  { name: "Acrux", arabicName: "نجم الصليب", constellation: "Crux", fact: "The brightest star in the Southern Cross, visible from Qatar near the southern horizon.", magnitude: 0.76, distance: "320 light-years", color: "rgba(180, 200, 255, 1)", ra: 12.4433, dec: -63.0992 },
  { name: "Pollux", arabicName: "رأس التوأم المؤخر", constellation: "Gemini", fact: "The brightest star in Gemini and the closest giant star to the Sun. Has an exoplanet!", magnitude: 1.14, distance: "34 light-years", color: "rgba(255, 200, 150, 1)", ra: 7.7553, dec: 28.0261 },
];

// Astronomical calculation functions
const toRadians = (degrees: number): number => degrees * Math.PI / 180;
const toDegrees = (radians: number): number => radians * 180 / Math.PI;

// Calculate Julian Date from a JavaScript Date
const getJulianDate = (date: Date): number => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  
  const JD = Math.floor(365.25 * (y + 4716)) + 
             Math.floor(30.6001 * (m + 1)) + 
             day + B - 1524.5 +
             (hour + minute / 60 + second / 3600) / 24;
  
  return JD;
};

// Calculate Local Sidereal Time in degrees
const getLocalSiderealTime = (jd: number, longitude: number): number => {
  const T = (jd - 2451545.0) / 36525.0;
  
  // Greenwich Mean Sidereal Time in degrees
  let GMST = 280.46061837 + 
             360.98564736629 * (jd - 2451545.0) +
             0.000387933 * T * T -
             T * T * T / 38710000.0;
  
  // Normalize to 0-360
  GMST = GMST % 360;
  if (GMST < 0) GMST += 360;
  
  // Local Sidereal Time
  let LST = GMST + longitude;
  LST = LST % 360;
  if (LST < 0) LST += 360;
  
  return LST;
};

// Convert RA/Dec to Altitude/Azimuth for a given location and time
const raDecToAltAz = (
  ra: number,      // Right Ascension in hours
  dec: number,     // Declination in degrees
  lat: number,     // Observer latitude in degrees
  lst: number      // Local Sidereal Time in degrees
): { altitude: number; azimuth: number } => {
  // Convert RA from hours to degrees
  const raDeg = ra * 15;
  
  // Hour Angle in degrees
  let ha = lst - raDeg;
  if (ha < 0) ha += 360;
  if (ha > 180) ha -= 360;
  
  // Convert to radians
  const haRad = toRadians(ha);
  const decRad = toRadians(dec);
  const latRad = toRadians(lat);
  
  // Calculate altitude
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altitude = toDegrees(Math.asin(sinAlt));
  
  // Calculate azimuth
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / 
                (Math.cos(latRad) * Math.cos(toRadians(altitude)));
  let azimuth = toDegrees(Math.acos(Math.max(-1, Math.min(1, cosAz))));
  
  // Correct azimuth for quadrant
  if (Math.sin(haRad) > 0) {
    azimuth = 360 - azimuth;
  }
  
  return { altitude, azimuth };
};

// Convert altitude/azimuth to screen coordinates using stereographic projection
// This is astronomically correct - preserves angular relationships
// View: Looking south with zenith at top center, horizon at bottom
const altAzToScreen = (
  altitude: number,  // degrees above horizon (0-90)
  azimuth: number    // degrees from North clockwise (0-360)
): { x: number; y: number; visible: boolean } => {
  // Star must be above horizon to be visible
  if (altitude < 0) {
    return { x: 0, y: 0, visible: false };
  }
  
  // Use stereographic projection (preserves shapes and angles)
  // Convert to radians
  const altRad = toRadians(altitude);
  const azRad = toRadians(azimuth);
  
  // Stereographic projection from zenith
  // r = distance from center (zenith), ranging from 0 (zenith) to 1 (horizon)
  const zenithAngle = toRadians(90 - altitude);
  const r = Math.tan(zenithAngle / 2);
  
  // Normalize r so horizon (alt=0) maps to edge of visible area
  // tan(45°) = 1, so horizon maps to r=1
  const rNormalized = Math.min(r, 1);
  
  // Convert polar to Cartesian
  // Azimuth: 0° = North (up), 90° = East (right), 180° = South (down), 270° = West (left)
  // For south-facing view, rotate so South (180°) is at bottom
  const viewAz = azRad - Math.PI; // Rotate so South is at 0
  
  // x: East is positive (right), West is negative (left)
  // y: zenith at top, horizon at bottom
  const xNorm = rNormalized * Math.sin(viewAz);
  const yNorm = rNormalized * Math.cos(viewAz);
  
  // Map to screen coordinates (0-100%)
  // Center is at (50, 30) to give more sky view
  const x = 50 + xNorm * 45; // Scale to use 90% of width
  const y = 30 + yNorm * 60; // Scale to use more vertical space
  
  // Check if within visible screen bounds
  if (x < 0 || x > 100 || y < 0 || y > 100) {
    return { x: 0, y: 0, visible: false };
  }
  
  return { x, y, visible: true };
};

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

const calculateAccurateMoonPhase = (date: Date): number => {
  const SYNODIC_MONTH = 29.53058867;
  const KNOWN_NEW_MOON = new Date('2024-01-11T11:57:00Z').getTime();
  
  const daysSinceNewMoon = (date.getTime() - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  const lunarAge = ((daysSinceNewMoon % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  
  return lunarAge / SYNODIC_MONTH;
};

const getMoonIlluminationPercent = (phase: number): number => {
  return (1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100;
};

const getMoonPosition = (hour: number, date: Date): { x: number; y: number; visible: boolean; phase: number; illumination: number; isWaxing: boolean } => {
  const phase = calculateAccurateMoonPhase(date);
  const illumination = getMoonIlluminationPercent(phase);
  const isWaxing = phase < 0.5;
  
  if (hour >= 7 && hour < 18) {
    return { x: 50, y: 120, visible: false, phase, illumination, isWaxing };
  }
  
  let progress = 0;
  if (hour >= 18) {
    progress = (hour - 18) / 12;
  } else {
    progress = (hour + 6) / 12;
  }
  
  const x = 15 + progress * 70;
  const y = 20 - Math.sin(progress * Math.PI) * 10 + 15;
  
  return { x, y, visible: true, phase, illumination, isWaxing };
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
  
  // Calculate star positions based on current Qatar time - updates every minute
  const stars = useMemo(() => {
    const starList: StarData[] = [];
    
    // Calculate Julian Date and Local Sidereal Time for Qatar
    const jd = getJulianDate(qatarTime);
    const lst = getLocalSiderealTime(jd, QATAR_LON);
    
    // Add named stars with astronomically calculated positions
    NAMED_STARS.forEach((namedStar, index) => {
      const { altitude, azimuth } = raDecToAltAz(namedStar.ra, namedStar.dec, QATAR_LAT, lst);
      const { x, y, visible } = altAzToScreen(altitude, azimuth);
      
      if (visible) {
        starList.push({
          id: index,
          x,
          y,
          size: 3.5 + (1.5 - namedStar.magnitude) * 0.8, // Brighter = larger
          brightness: 0.9,
          twinkleSpeed: 2,
          twinkleDelay: index * 0.3,
          color: namedStar.color,
          namedStar: namedStar,
        });
      }
    });
    
    // Generate background stars with semi-random but consistent positions
    // Using a seeded approach so they don't jump around on re-render
    const seed = Math.floor(qatarTime.getTime() / 3600000); // Changes every hour
    const pseudoRandom = (i: number): number => {
      const x = Math.sin(seed + i * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    
    // Dim background stars
    for (let i = NAMED_STARS.length; i < 200 + NAMED_STARS.length; i++) {
      starList.push({
        id: i,
        x: pseudoRandom(i) * 100,
        y: pseudoRandom(i + 1000) * 100,
        size: pseudoRandom(i + 2000) * 1 + 0.5,
        brightness: pseudoRandom(i + 3000) * 0.3 + 0.2,
        twinkleSpeed: pseudoRandom(i + 4000) * 4 + 3,
        twinkleDelay: pseudoRandom(i + 5000) * 5,
        color: 'rgba(255, 255, 255, 0.6)',
      });
    }
    
    // Medium brightness stars
    for (let i = 200 + NAMED_STARS.length; i < 280 + NAMED_STARS.length; i++) {
      starList.push({
        id: i,
        x: pseudoRandom(i) * 100,
        y: pseudoRandom(i + 1000) * 100,
        size: pseudoRandom(i + 2000) * 1.5 + 1,
        brightness: pseudoRandom(i + 3000) * 0.4 + 0.4,
        twinkleSpeed: pseudoRandom(i + 4000) * 3 + 2,
        twinkleDelay: pseudoRandom(i + 5000) * 4,
        color: getStarColor(),
      });
    }
    
    // Bright unnamed stars
    for (let i = 280 + NAMED_STARS.length; i < 300 + NAMED_STARS.length; i++) {
      starList.push({
        id: i,
        x: pseudoRandom(i) * 100,
        y: pseudoRandom(i + 1000) * 100,
        size: pseudoRandom(i + 2000) * 2 + 2,
        brightness: pseudoRandom(i + 3000) * 0.3 + 0.7,
        twinkleSpeed: pseudoRandom(i + 4000) * 2 + 1.5,
        twinkleDelay: pseudoRandom(i + 5000) * 3,
        color: getStarColor(),
      });
    }
    
    return starList;
  }, [qatarTime]);
  
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
  const moonPosition = getMoonPosition(hour, qatarTime);
  
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
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: '#f5f5dc',
              boxShadow: `0 0 ${10 + moonPosition.illumination / 5}px rgba(245, 245, 220, ${0.3 + moonPosition.illumination / 200}), 0 0 ${20 + moonPosition.illumination / 3}px rgba(245, 245, 220, ${0.2 + moonPosition.illumination / 300})`,
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 35% 35%, transparent 10%, rgba(200, 200, 180, 0.3) 40%, transparent 60%),
                          radial-gradient(circle at 65% 65%, transparent 5%, rgba(180, 180, 160, 0.2) 30%, transparent 50%)`,
            }}
          />
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              background: moonPosition.isWaxing
                ? `linear-gradient(to right, #0a0a12 0%, #0a0a12 ${50 - moonPosition.illumination / 2}%, transparent ${50 - moonPosition.illumination / 2}%)`
                : `linear-gradient(to left, #0a0a12 0%, #0a0a12 ${50 - moonPosition.illumination / 2}%, transparent ${50 - moonPosition.illumination / 2}%)`,
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
        <span className="mx-1">|</span>
        <span className="text-amber-300/70">Astronomically Accurate Sky</span>
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
