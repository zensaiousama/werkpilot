'use client';

import { useEffect, useState } from 'react';

const COLORS = ['#2E75B6', '#D4760A', '#2D8C3C', '#1B2A4A', '#E5A54B'];
const PARTICLE_COUNT = 40;

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  xVel: number;
  yVel: number;
  delay: number;
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 20,
    y: 40,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
    xVel: (Math.random() - 0.5) * 8,
    yVel: -(2 + Math.random() * 6),
    delay: Math.random() * 0.2,
  }));
}

export default function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    // Use requestAnimationFrame to avoid synchronous setState in effect
    const raf = requestAnimationFrame(() => {
      setParticles(createParticles());
    });
    const timer = setTimeout(() => setParticles([]), 1200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall 1s ease-out forwards`,
            animationDelay: `${p.delay}s`,
            ['--x-vel' as string]: `${p.xVel * 30}px`,
            ['--y-vel' as string]: `${p.yVel * 40}px`,
          }}
        />
      ))}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(var(--x-vel), calc(var(--y-vel) + 300px)) rotate(720deg);
          }
        }
      `}} />
    </div>
  );
}
