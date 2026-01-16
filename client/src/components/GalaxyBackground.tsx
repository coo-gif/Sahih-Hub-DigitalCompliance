import { useState, useEffect } from "react";

interface StarParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  color: string;
}

export function GalaxyBackground() {
  const [stars, setStars] = useState<StarParticle[]>([]);

  useEffect(() => {
    const generatedStars: StarParticle[] = [];
    const colors = [
      'rgba(255, 255, 255, 1)',
      'rgba(200, 220, 255, 1)',
      'rgba(255, 200, 150, 1)',
      'rgba(180, 200, 255, 1)',
      'rgba(255, 244, 234, 1)',
    ];

    for (let i = 0; i < 300; i++) {
      generatedStars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    setStars(generatedStars);
  }, []);

  return (
    <>
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(to bottom, #000005 0%, #020210 20%, #050520 40%, #080830 60%, #0a0a40 80%, #0c0c50 100%)',
        }}
      />
      
      <div className="absolute inset-0 z-[1] overflow-hidden">
        <style>{`
          @keyframes galaxyTwinkle {
            0%, 100% { 
              opacity: var(--base-opacity);
              transform: scale(1);
            }
            50% { 
              opacity: calc(var(--base-opacity) * 1.5);
              transform: scale(1.2);
            }
          }
          @keyframes galaxyRotate {
            from {
              transform: translate(-50%, -50%) rotate(0deg);
            }
            to {
              transform: translate(-50%, -50%) rotate(360deg);
            }
          }
          @keyframes coreGlow {
            0%, 100% {
              box-shadow: 0 0 60px 30px rgba(255, 200, 100, 0.4),
                          0 0 120px 60px rgba(255, 150, 50, 0.3),
                          0 0 200px 100px rgba(255, 100, 50, 0.2);
            }
            50% {
              box-shadow: 0 0 80px 40px rgba(255, 200, 100, 0.5),
                          0 0 160px 80px rgba(255, 150, 50, 0.4),
                          0 0 250px 125px rgba(255, 100, 50, 0.25);
            }
          }
          @keyframes spiralArm {
            0%, 100% {
              opacity: 0.6;
            }
            50% {
              opacity: 0.8;
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
              '--base-opacity': star.opacity,
              animation: `galaxyTwinkle ${star.twinkleSpeed}s ease-in-out infinite`,
              animationDelay: `${star.id * 0.05}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      
      <div 
        className="absolute z-[2]"
        style={{
          left: '55%',
          top: '45%',
          width: '600px',
          height: '600px',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '50%',
            width: '80px',
            height: '80px',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255, 230, 180, 1) 0%, rgba(255, 200, 100, 0.9) 30%, rgba(255, 150, 50, 0.6) 60%, transparent 100%)',
            animation: 'coreGlow 4s ease-in-out infinite',
          }}
        />
        
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            width: '500px',
            height: '500px',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            animation: 'galaxyRotate 300s linear infinite',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: `
                conic-gradient(
                  from 0deg,
                  transparent 0deg,
                  rgba(100, 180, 255, 0.15) 20deg,
                  rgba(150, 200, 255, 0.25) 40deg,
                  transparent 80deg,
                  transparent 180deg,
                  rgba(100, 180, 255, 0.15) 200deg,
                  rgba(150, 200, 255, 0.25) 220deg,
                  transparent 260deg,
                  transparent 360deg
                )
              `,
              borderRadius: '50%',
              filter: 'blur(20px)',
              animation: 'spiralArm 8s ease-in-out infinite',
            }}
          />
          
          <div
            style={{
              position: 'absolute',
              width: '80%',
              height: '80%',
              left: '10%',
              top: '10%',
              background: `
                conic-gradient(
                  from 45deg,
                  transparent 0deg,
                  rgba(255, 150, 100, 0.1) 30deg,
                  rgba(255, 200, 150, 0.2) 60deg,
                  transparent 100deg,
                  transparent 180deg,
                  rgba(255, 150, 100, 0.1) 210deg,
                  rgba(255, 200, 150, 0.2) 240deg,
                  transparent 280deg,
                  transparent 360deg
                )
              `,
              borderRadius: '50%',
              filter: 'blur(15px)',
              animation: 'spiralArm 6s ease-in-out infinite',
              animationDelay: '2s',
            }}
          />
        </div>
        
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            width: '400px',
            height: '150px',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            background: 'radial-gradient(ellipse at center, rgba(255, 200, 150, 0.2) 0%, rgba(200, 180, 255, 0.1) 40%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />
      </div>
      
      <div 
        className="absolute z-[3] text-white"
        style={{
          left: '10%',
          top: '15%',
          maxWidth: '300px',
        }}
      >
        <h2 
          className="text-2xl font-bold mb-2"
          style={{
            background: 'linear-gradient(135deg, #64b5f6 0%, #90caf9 50%, #bbdefb 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Andromeda Galaxy
        </h2>
        <p className="text-cyan-400 text-sm mb-1">M31 • 2.5 million ly</p>
        <p className="text-gray-400 text-xs">~1 trillion stars</p>
      </div>
      
      <div 
        className="absolute z-[3] rounded-lg p-4 border"
        style={{
          left: '8%',
          bottom: '20%',
          maxWidth: '280px',
          background: 'rgba(0, 20, 40, 0.7)',
          borderColor: 'rgba(100, 180, 255, 0.3)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h3 className="text-cyan-300 font-semibold mb-2">Spiral Arms</h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          Active star-forming regions
        </p>
        <ul className="text-gray-400 text-xs mt-2 space-y-1">
          <li>• Two main segmented spiral arms</li>
          <li>• Rich in young, hot blue-white stars</li>
        </ul>
      </div>
      
      <div 
        className="absolute z-[3] flex gap-2"
        style={{
          right: '10%',
          top: '15%',
        }}
      >
        <button 
          className="px-4 py-2 rounded text-sm font-medium transition-all"
          style={{
            background: 'rgba(100, 180, 255, 0.3)',
            color: 'white',
            border: '1px solid rgba(100, 180, 255, 0.5)',
          }}
        >
          Visible
        </button>
        <button 
          className="px-4 py-2 rounded text-sm font-medium transition-all hover-elevate"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          Infrared
        </button>
        <button 
          className="px-4 py-2 rounded text-sm font-medium transition-all hover-elevate"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          Ultraviolet
        </button>
      </div>
    </>
  );
}
