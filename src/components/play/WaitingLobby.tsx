"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Trophy, AlarmClock, Zap, Target, Sparkles, Lightbulb, Users } from "lucide-react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

// Dynamic import for BackgroundEffects
const BackgroundEffects = dynamic(
  () => import("@/components/theme/BackgroundEffects").then(mod => ({ default: mod.BackgroundEffects })),
  { ssr: false }
);

interface PowerUpConfig {
  hintCount: number;
  copyAnswerCount: number;
  doublePointsCount: number;
}

interface WaitingLobbyProps {
  quizTitle: string;
  playerName: string;
  playerAvatar: string | null;
  gameCode: string;
  playerCount: number;
  powerUps: PowerUpConfig;
  theme: any;
  screenRef?: React.RefObject<HTMLDivElement | null>;
}

export const WaitingLobby = React.memo(function WaitingLobby({
  quizTitle,
  playerName,
  playerAvatar,
  gameCode,
  playerCount,
  powerUps,
  theme,
  screenRef,
}: WaitingLobbyProps) {
  const hasPowerUps =
    powerUps.hintCount > 0 ||
    powerUps.copyAnswerCount > 0 ||
    powerUps.doublePointsCount > 0;

  return (
    <ThemeProvider theme={theme}>
      <div
        ref={screenRef}
        className="min-h-screen relative overflow-hidden"
        style={{
          background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
        }}
      >
        <BackgroundEffects theme={theme} />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="text-center mb-8 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Lobby</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              {quizTitle || "Get ready for the quiz"}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Warm up while we set the stage. Here&apos;s how to score big and use your power-ups wisely.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr,1.15fr] gap-4 sm:gap-6 items-start">
            <Card className="border-2 shadow-2xl bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6 sm:p-7 space-y-5">
                <div className="flex flex-col items-center gap-4 text-center">
                  {playerAvatar ? (
                    playerAvatar.startsWith("/") ? (
                      <img
                        src={playerAvatar}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover ring-2 ring-primary shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center text-4xl ring-2 ring-primary/60 shadow-inner">
                        {playerAvatar}
                      </div>
                    )
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary/60 shadow-inner">
                      <Check className="w-10 h-10 text-primary" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">You&apos;re in</p>
                    <h2 className="text-2xl sm:text-3xl font-bold">{playerName}</h2>
                    <p className="text-muted-foreground">
                      Waiting for the host to start the game...
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 text-left shadow-inner">
                    <p className="text-xs uppercase tracking-wide text-primary/80">Players joined</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {playerCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card/70 px-4 py-3 text-left shadow-inner">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Room code</p>
                    <p className="text-2xl font-bold tabular-nums">{gameCode.toUpperCase()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4 sm:space-y-5">
              <div
                className="rounded-2xl border border-border/70 shadow-xl overflow-hidden"
                style={{
                  background: theme?.gradients?.sectionSlide || 'linear-gradient(135deg, hsl(262 83% 16%) 0%, hsl(262 83% 10%) 100%)',
                }}
              >
                <div className="p-6 sm:p-7 space-y-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-primary/80">How to play</p>
                      <h3 className="text-xl sm:text-2xl font-semibold">Rules &amp; scoring</h3>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center shadow-inner">
                      <Trophy className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <AlarmClock className="w-4 h-4" />
                        Beat the clock
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Timer counts down each question. Single choice locks in instantly; multi-select needs Submit before zero.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Zap className="w-4 h-4" />
                        Speed bonus
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Every question has base points. Answering instantly can add up to +50% bonus; slower answers earn less.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Target className="w-4 h-4" />
                        Multi-select fairness
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Points scale with accuracy: (correct picks − wrong picks) / total correct. Wrong or no answer = zero.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="w-4 h-4" />
                        Finish strong
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Scores update each round and feed the leaderboard. Double Points (when enabled) multiplies after bonuses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm shadow-xl">
                <div className="p-6 sm:p-7 space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                      Power-ups
                    </p>
                  </div>

                  {hasPowerUps ? (
                    <div className="grid sm:grid-cols-3 gap-3">
                      {powerUps.hintCount > 0 && (
                        <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 space-y-1">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <Lightbulb className="w-4 h-4" />
                            Hint
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Reveal the question hint (when available). Uses {powerUps.hintCount > 1 ? "one of your " : "your "}limited hints.
                          </p>
                          <p className="text-xs font-medium text-primary">
                            {powerUps.hintCount} ready
                          </p>
                        </div>
                      )}

                      {powerUps.copyAnswerCount > 0 && (
                        <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 space-y-1">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <Users className="w-4 h-4" />
                            Copy
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Pick a teammate and mirror their answer. If they don&apos;t answer in time, you miss out too.
                          </p>
                          <p className="text-xs font-medium text-primary">
                            {powerUps.copyAnswerCount} ready
                          </p>
                        </div>
                      )}

                      {powerUps.doublePointsCount > 0 && (
                        <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 space-y-1">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <Sparkles className="w-4 h-4" />
                            2x Points
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Doubles your score for that question after speed and accuracy are calculated.
                          </p>
                          <p className="text-xs font-medium text-primary">
                            {powerUps.doublePointsCount} ready
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground text-center">
                      The host hasn&apos;t enabled power-ups for this game—focus on speed and accuracy.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if relevant props change
  return (
    prevProps.quizTitle === nextProps.quizTitle &&
    prevProps.playerName === nextProps.playerName &&
    prevProps.playerAvatar === nextProps.playerAvatar &&
    prevProps.gameCode === nextProps.gameCode &&
    prevProps.playerCount === nextProps.playerCount &&
    prevProps.powerUps.hintCount === nextProps.powerUps.hintCount &&
    prevProps.powerUps.copyAnswerCount === nextProps.powerUps.copyAnswerCount &&
    prevProps.powerUps.doublePointsCount === nextProps.powerUps.doublePointsCount
  );
});
