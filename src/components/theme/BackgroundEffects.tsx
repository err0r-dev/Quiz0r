"use client";

import React, { useEffect, useState, useCallback } from "react";
import { QuizTheme } from "@/types/theme";

interface BackgroundEffectsProps {
  theme: QuizTheme | null;
  contained?: boolean; // If true, uses absolute positioning instead of fixed
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export function BackgroundEffects({ theme, contained = false }: BackgroundEffectsProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Check if theme has custom background animation
  const hasCustomAnimation = theme?.customCSS?.backgroundAnimation;
  const themeName = theme?.name?.toLowerCase() || "";

  // Position class based on contained prop
  const positionClass = contained ? "absolute" : "fixed";

  // Generate particles based on theme
  const generateParticles = useCallback(() => {
    const count = 25; // Reduced from 50 for better performance
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 10 + 5,
        duration: Math.random() * 10 + 10,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }

    setParticles(newParticles);
  }, []);

  useEffect(() => {
    if (hasCustomAnimation) {
      generateParticles();
    }
  }, [hasCustomAnimation, generateParticles]);

  if (!hasCustomAnimation) {
    return null;
  }

  // Render snow effect
  if (themeName.includes("festive") || themeName.includes("christmas") || themeName.includes("winter")) {
    return (
      <div className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-0`}>
        <style>{`
          @keyframes snowfall {
            0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 0.8; }
            100% { transform: translateY(105vh) translateX(30px) rotate(360deg); opacity: 0; }
          }
          .snowflake {
            position: absolute;
            color: white;
            text-shadow: 0 0 5px rgba(255,255,255,0.5);
            animation: snowfall linear infinite;
          }
        `}</style>
        {particles.map((p) => (
          <div
            key={p.id}
            className="snowflake"
            style={{
              left: `${p.x}%`,
              top: `-20px`,
              fontSize: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              opacity: p.opacity,
            }}
          >
            *
          </div>
        ))}
      </div>
    );
  }

  // Render stars effect
  if (themeName.includes("space") || themeName.includes("galaxy") || themeName.includes("cosmic")) {
    return (
      <div className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-0`}>
        <style>{`
          @keyframes twinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.3); }
          }
          .star {
            position: absolute;
            background: white;
            border-radius: 50%;
            animation: twinkle ease-in-out infinite;
          }
        `}</style>
        {particles.map((p) => (
          <div
            key={p.id}
            className="star"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size / 3}px`,
              height: `${p.size / 3}px`,
              animationDuration: `${p.duration / 3}s`,
              animationDelay: `${p.delay}s`,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>
    );
  }

  // Render bubbles effect
  if (themeName.includes("ocean") || themeName.includes("sea") || themeName.includes("water")) {
    return (
      <div className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-0`}>
        <style>{`
          @keyframes bubble {
            0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
            10% { opacity: 0.6; }
            100% { transform: translateY(-10vh) scale(1); opacity: 0; }
          }
          .bubble {
            position: absolute;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3);
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent);
            animation: bubble linear infinite;
          }
        `}</style>
        {particles.map((p) => (
          <div
            key={p.id}
            className="bubble"
            style={{
              left: `${p.x}%`,
              bottom: `-50px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // Render neon geometric effect
  if (themeName.includes("neon") || themeName.includes("arcade") || themeName.includes("retro")) {
    return (
      <div className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-0`}>
        <style>{`
          @keyframes neonFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
            50% { transform: translateY(-20px) rotate(180deg); opacity: 0.6; }
          }
          .neon-shape {
            position: absolute;
            border: 2px solid;
            animation: neonFloat ease-in-out infinite;
          }
        `}</style>
        {particles.slice(0, 20).map((p, i) => (
          <div
            key={p.id}
            className="neon-shape"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size * 2}px`,
              height: `${p.size * 2}px`,
              borderColor: ["#FF00FF", "#00FFFF", "#FFFF00", "#00FF00"][i % 4],
              borderRadius: i % 2 === 0 ? "50%" : "0",
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              filter: `drop-shadow(0 0 10px ${["#FF00FF", "#00FFFF", "#FFFF00", "#00FF00"][i % 4]})`,
            }}
          />
        ))}
      </div>
    );
  }

  // Generic particle effect (fallback)
  return (
    <div className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-0`}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-30px) translateX(10px); opacity: 0.6; }
        }
        .particle {
          position: absolute;
          background: currentColor;
          border-radius: 50%;
          animation: float ease-in-out infinite;
        }
      `}</style>
      {particles.slice(0, 30).map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size / 2}px`,
            height: `${p.size / 2}px`,
            color: "white",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity * 0.5,
          }}
        />
      ))}
    </div>
  );
}

// Celebration effects component
interface CelebrationProps {
  type: "confetti" | "sparkle" | "glow" | "fireworks" | "none";
  trigger: boolean;
}

export function CelebrationEffect({ type, trigger }: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger && type !== "none") {
      setActive(true);

      // Generate celebration particles
      const newParticles: Particle[] = [];
      const count = type === "confetti" ? 50 : type === "fireworks" ? 30 : 20; // Reduced for performance

      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: i,
          x: 50 + (Math.random() - 0.5) * 60,
          y: 50,
          size: Math.random() * 10 + 5,
          duration: Math.random() * 2 + 1,
          delay: Math.random() * 0.5,
          opacity: 1,
        });
      }

      setParticles(newParticles);

      // Clear after animation
      const timer = setTimeout(() => {
        setActive(false);
        setParticles([]);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [trigger, type]);

  if (!active || type === "none") {
    return null;
  }

  if (type === "confetti") {
    const colors = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#A78BFA", "#F97316"];

    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">{/* Celebration effects always use fixed */}
        <style>{`
          @keyframes confettiFall {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .confetti {
            position: absolute;
            animation: confettiFall ease-out forwards;
          }
        `}</style>
        {particles.map((p, i) => (
          <div
            key={p.id}
            className="confetti"
            style={{
              left: `${p.x}%`,
              top: "-20px",
              width: `${p.size}px`,
              height: `${p.size * 0.6}px`,
              backgroundColor: colors[i % colors.length],
              animationDuration: `${p.duration + 1}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (type === "sparkle") {
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <style>{`
          @keyframes sparkle {
            0% { transform: scale(0) rotate(0deg); opacity: 1; }
            50% { transform: scale(1) rotate(180deg); opacity: 1; }
            100% { transform: scale(0) rotate(360deg); opacity: 0; }
          }
          .sparkle {
            position: absolute;
            animation: sparkle ease-out forwards;
          }
        `}</style>
        {particles.map((p) => (
          <div
            key={p.id}
            className="sparkle text-yellow-300"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size * 2}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          >
            ✦
          </div>
        ))}
      </div>
    );
  }

  if (type === "fireworks") {
    const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];

    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <style>{`
          @keyframes firework {
            0% { transform: scale(0); opacity: 1; }
            100% { transform: scale(2); opacity: 0; }
          }
          .firework {
            position: absolute;
            border-radius: 50%;
            animation: firework ease-out forwards;
          }
        `}</style>
        {particles.map((p, i) => (
          <div
            key={p.id}
            className="firework"
            style={{
              left: `${p.x}%`,
              top: `${20 + Math.random() * 40}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: colors[i % colors.length],
              boxShadow: `0 0 ${p.size}px ${colors[i % colors.length]}`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // Glow effect
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <style>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at center, rgba(34, 197, 94, 0.4) 0%, transparent 70%)",
          animation: "glowPulse 1.5s ease-out forwards",
        }}
      />
    </div>
  );
}
