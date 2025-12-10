"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PowerUpType } from "@/types";
import type { CertificateButtonState } from "@/components/certificate/CertificateDownloadButton";

// Dynamic imports
const BackgroundEffects = dynamic(
  () => import("@/components/theme/BackgroundEffects").then(mod => ({ default: mod.BackgroundEffects })),
  { ssr: false }
);

const CertificateDownloadButton = dynamic(
  () => import("@/components/certificate/CertificateDownloadButton").then(mod => ({ default: mod.CertificateDownloadButton })),
  { ssr: false }
);

interface PlayerScore {
  playerId: string;
  name: string;
  score: number;
  avatarColor?: string;
  avatarEmoji?: string | null;
  position: number;
  change?: number;
  powerUpsUsed?: Array<{ powerUpType: PowerUpType; questionNumber: number }>;
}

interface ScoreboardViewProps {
  isFinished: boolean;
  scores: PlayerScore[];
  playerName: string;
  gameCode: string;
  playerId?: string;
  certificateState: CertificateButtonState;
  onCertificateStateChange: (state: CertificateButtonState) => void;
  theme: any;
  screenRef?: React.RefObject<HTMLDivElement | null>;
}

export const ScoreboardView = React.memo(function ScoreboardView({
  isFinished,
  scores,
  playerName,
  gameCode,
  playerId,
  certificateState,
  onCertificateStateChange,
  theme,
  screenRef,
}: ScoreboardViewProps) {
  const router = useRouter();

  const myScore = scores.find(
    (s) => s.name.toLowerCase() === playerName.toLowerCase()
  );
  const myPosition = myScore?.position || 0;
  const showGeneratingMessage =
    certificateState === "checking" || certificateState === "generating";

  return (
    <ThemeProvider theme={theme}>
      <div
        ref={screenRef}
        className="min-h-screen p-3 sm:p-4 relative"
        style={{
          background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
        }}
      >
        <BackgroundEffects theme={theme} />
        {/* My Position */}
        <Card className="mb-4 sm:mb-6 relative z-10 shadow-xl border-2">
          <CardContent className="pt-4 sm:pt-6 text-center">
            {myPosition <= 3 && isFinished && (
              <div className="mb-2">
                {myPosition === 1 && (
                  <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-yellow-500" />
                )}
                {myPosition === 2 && (
                  <Medal className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400" />
                )}
                {myPosition === 3 && (
                  <Award className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-amber-600" />
                )}
              </div>
            )}
            <p className="text-3xl sm:text-4xl font-bold text-primary">#{myPosition}</p>
            <p className="text-base sm:text-lg font-medium truncate max-w-full px-2">{playerName}</p>
            <p className="text-xl sm:text-2xl font-bold mt-2">{myScore?.score || 0} pts</p>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <h2 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 relative z-10">
          {isFinished ? "Final Results" : "Leaderboard"}
        </h2>
        <div className="space-y-1.5 sm:space-y-2 relative z-10">
          {scores.slice(0, 10).map((player, index) => {
            const isMe =
              player.name.toLowerCase() === playerName.toLowerCase();
            return (
              <div
                key={player.playerId}
                className={`
                  flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg shadow-lg
                  ${isMe ? "bg-primary/10 ring-2 ring-primary" : "bg-card"}
                `}
              >
                <span className="font-bold w-5 sm:w-6 text-center text-sm sm:text-base">{index + 1}</span>
                {player.avatarEmoji?.startsWith("/") ? (
                  <img
                    src={player.avatarEmoji}
                    alt={player.name}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <Avatar className="w-7 h-7 sm:w-8 sm:h-8 shrink-0">
                    <AvatarFallback
                      style={{ backgroundColor: player.avatarEmoji ? "transparent" : player.avatarColor }}
                      className={player.avatarEmoji ? "text-lg sm:text-xl" : "text-white text-xs"}
                    >
                      {player.avatarEmoji || player.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className={`flex-1 truncate text-sm sm:text-base ${isMe ? "font-bold" : ""}`}>
                  {player.name}
                  {isMe && " (You)"}
                </span>

                {/* Power-up indicators */}
                {player.powerUpsUsed && player.powerUpsUsed.length > 0 && (
                  <div className="flex gap-0.5 sm:gap-1 shrink-0">
                    {player.powerUpsUsed.slice(0, 3).map((usage, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 bg-muted rounded"
                        title={`Q${usage.questionNumber}: ${usage.powerUpType}`}
                      >
                        {usage.powerUpType === "hint" && "💡"}
                        {usage.powerUpType === "copy" && "👥"}
                        {usage.powerUpType === "double" && "⚡"}
                      </span>
                    ))}
                    {player.powerUpsUsed.length > 3 && (
                      <span className="text-[10px] sm:text-xs text-muted-foreground">+{player.powerUpsUsed.length - 3}</span>
                    )}
                  </div>
                )}

                <span className="font-bold text-primary text-sm sm:text-base shrink-0">{player.score}</span>
              </div>
            );
          })}
        </div>

        {isFinished && (
          <div className="mt-6 sm:mt-8 text-center space-y-3 sm:space-y-4 relative z-10">
            <p className="text-sm sm:text-base text-muted-foreground">Thanks for playing!</p>

            {showGeneratingMessage && (
              <div className="flex items-center justify-center gap-2 text-sm sm:text-base text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating your certificate...</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-center sm:items-center gap-3 sm:gap-4">
              {/* Download Button */}
              {playerId && (
                <CertificateDownloadButton
                  gameCode={gameCode}
                  playerId={playerId}
                  playerName={playerName}
                  type="player"
                  className={`w-full sm:w-auto ${showGeneratingMessage ? "hidden" : ""}`}
                  onStateChange={onCertificateStateChange}
                />
              )}

              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => router.push("/play")}
              >
                Play Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if relevant data changes
  return (
    prevProps.isFinished === nextProps.isFinished &&
    prevProps.scores.length === nextProps.scores.length &&
    prevProps.playerName === nextProps.playerName &&
    prevProps.certificateState === nextProps.certificateState &&
    JSON.stringify(prevProps.scores.slice(0, 10).map(s => ({ id: s.playerId, score: s.score, position: s.position }))) ===
    JSON.stringify(nextProps.scores.slice(0, 10).map(s => ({ id: s.playerId, score: s.score, position: s.position })))
  );
});
