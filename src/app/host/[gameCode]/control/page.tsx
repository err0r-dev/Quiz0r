"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { PowerUpType, SupportedLanguages } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  SkipForward,
  BarChart3,
  Square,
  Users,
  Monitor,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  FastForward,
  StickyNote,
  X,
  Eye,
  Layers,
  Trash2,
  UserCheck,
  UserX,
  Bell,
  Shield,
  Lightbulb,
  Sparkles,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { CertificateDownloadButton } from "@/components/certificate/CertificateDownloadButton";
import { CertificateStatusBanner } from "@/components/certificate/CertificateStatusBanner";
import { CertificateRegenerationPanel } from "@/components/certificate/CertificateRegenerationPanel";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";

export default function HostControlPage({
  params,
}: {
  params: { gameCode: string };
}) {
  const { gameCode } = params;
  const {
    connected,
    gameState,
    currentQuestion,
    timeRemaining,
    scores,
    playerAnswers,
    easterEggClicks,
    powerUpUsages,
    nextQuestionPreview,
    awaitingReveal,
    gameCancelled,
    admissionRequests,
    startGame,
    nextQuestion,
    showScoreboard,
    endGame,
    skipTimer,
    revealAnswers,
    cancelGame,
    removePlayer,
    admitPlayer,
    refusePlayer,
    toggleAutoAdmit,
  } = useSocket({ gameCode, role: "host" });

  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<{ id: string; name: string } | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");

  // Fetch tunnel URL on mount
  useEffect(() => {
    async function fetchTunnelUrl() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.tunnelUrl) {
          setTunnelUrl(data.tunnelUrl);
        }
      } catch (error) {
        console.error("Failed to fetch tunnel URL:", error);
      }
    }
    fetchTunnelUrl();
  }, []);

  // Poll for short URL created by display page (only if URL shortener API is configured)
  useEffect(() => {
    if (!gameCode) return;

    let interval: NodeJS.Timeout | null = null;
    let checkCount = 0;
    const MAX_CHECKS = 5; // Stop after 5 attempts (10 seconds)
    let stopped = false; // Track if we should stop polling

    async function checkShortUrl() {
      if (stopped) return;

      checkCount++;

      try {
        const res = await fetch(`/api/shorten?gameCode=${gameCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.shortUrl) {
            setShortUrl(data.shortUrl);
            // Stop polling once we have the URL
            stopped = true;
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
          } else if (checkCount >= MAX_CHECKS) {
            // No short URL after max checks - stop polling
            // This means either no API key or URL not created yet
            stopped = true;
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
          }
        }
      } catch (error) {
        console.error("Failed to retrieve short URL:", error);
        // Stop polling on error
        stopped = true;
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    }

    // Set up interval first
    interval = setInterval(checkShortUrl, 2000);

    // Then check immediately
    checkShortUrl();

    return () => {
      stopped = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [gameCode]);

  function copyExternalUrl() {
    if (tunnelUrl) {
      const fullUrl = `${tunnelUrl}/play/${gameCode}`;
      // Use short URL if available, otherwise fallback to full URL
      const urlToCopy = shortUrl || fullUrl;

      // Try modern clipboard API first, fallback to textarea method for non-secure contexts
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(urlToCopy).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
          // Fallback if clipboard API fails
          fallbackCopy(urlToCopy);
        });
      } else {
        // Use fallback for non-secure contexts (like Docker without HTTPS)
        fallbackCopy(urlToCopy);
      }
    }
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    document.body.removeChild(textarea);
  }

  function openDisplay() {
    if (typeof window === "undefined") return;
    const win = window.open(
      "",
      "quiz-display",
      "width=1280,height=720"
    );
    win?.location.replace(`/host/${gameCode}/display`);
  }

  function openMonitor() {
    if (typeof window === "undefined") return;
    const win = window.open(
      "",
      "quiz-playermonitor",
      "width=1400,height=900"
    );
    win?.location.replace(`/host/${gameCode}/playermonitor`);
  }

  function handleStartGame() {
    openDisplay();
    openMonitor();
    startGame();
  }

  function handleRemovePlayer(playerId: string, playerName: string) {
    setPlayerToRemove({ id: playerId, name: playerName });
    setRemoveDialogOpen(true);
  }

  function confirmRemovePlayer() {
    if (playerToRemove) {
      removePlayer(playerToRemove.id);
      setRemoveDialogOpen(false);
      setPlayerToRemove(null);
    }
  }

  function handleAdmitPlayer(playerId: string) {
    admitPlayer(playerId);
  }

  function handleRefusePlayer(playerId: string) {
    refusePlayer(playerId);
  }

  function handleToggleAutoAdmit(checked: boolean) {
    toggleAutoAdmit(checked);
  }

  // Get current question's answers for display
  const currentAnswers = currentQuestion
    ? playerAnswers.get(currentQuestion.id) || []
    : [];

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-xl font-bold text-primary">
            Connecting to game...
          </div>
        </div>
      </div>
    );
  }

  if (gameCancelled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-muted-foreground">
            Game Cancelled
          </div>
          <Link href="/host">
            <Button>Back to Host</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-muted-foreground">
            Game not found
          </div>
          <Link href="/host">
            <Button>Back to Host</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    WAITING: "bg-yellow-500",
    ACTIVE: "bg-blue-500",
    QUESTION: "bg-green-500",
    SECTION: "bg-indigo-500",
    REVEALING: "bg-purple-500",
    SCOREBOARD: "bg-orange-500",
    FINISHED: "bg-gray-500",
  };

  const displayScores = scores.length > 0
    ? scores
    : gameState.players.map((p, i) => ({
        ...p,
        playerId: p.id,
        position: i + 1,
        change: 0,
      }));

  // Filter players by search
  const filteredDisplayScores = playerSearch
    ? displayScores.filter((player) =>
        player.name.toLowerCase().includes(playerSearch.toLowerCase())
      )
    : displayScores;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="text-lg sm:text-xl font-bold text-primary">
              Quiz0r
            </Link>
            <Separator orientation="vertical" className="h-4 sm:h-6 hidden sm:block" />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-mono font-bold text-base sm:text-lg">{gameCode}</span>
              <Badge className={`${statusColors[gameState.status]} text-xs sm:text-sm`}>
                {gameState.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <DarkModeToggle showLabel={false} />
            {tunnelUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyExternalUrl}
                className="gap-1.5 sm:gap-2 px-2 sm:px-3"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copy URL</span>
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openMonitor} className="px-2 sm:px-3">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Player Monitor</span>
              <ExternalLink className="w-3 h-3 ml-1 sm:ml-2 hidden sm:inline" />
            </Button>
            <Button variant="outline" size="sm" onClick={openDisplay} className="px-2 sm:px-3">
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Open Display</span>
              <ExternalLink className="w-3 h-3 ml-1 sm:ml-2 hidden sm:inline" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Controls */}
          <div className="md:col-span-2 space-y-6">
            {/* Game Info */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg sm:text-xl">{gameState.quizTitle}</CardTitle>
                  <Badge className={`${statusColors[gameState.status]} text-xs`}>
                    {gameState.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats row */}
                <div className="flex items-center gap-4 sm:gap-8 text-sm flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Q:</span>
                    <span className="font-medium">
                      {gameState.currentQuestionNumber}/{gameState.totalQuestions}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {gameState.players.filter((p) => p.isActive).length}
                    </span>
                  </div>
                </div>

                {/* Prominent Timer during QUESTION status */}
                {gameState.status === "QUESTION" && (
                  <div className="space-y-3">
                    <div className={`
                      flex items-center justify-center gap-3 p-4 rounded-xl
                      ${timeRemaining <= 5
                        ? "bg-red-500/10 border-2 border-red-500"
                        : timeRemaining <= 10
                          ? "bg-amber-500/10 border-2 border-amber-500"
                          : "bg-primary/10 border-2 border-primary/50"}
                    `}>
                      <span className={`
                        text-4xl sm:text-5xl font-bold tabular-nums
                        ${timeRemaining <= 5
                          ? "text-red-500 animate-pulse"
                          : timeRemaining <= 10
                            ? "text-amber-500"
                            : "text-primary"}
                      `}>
                        {timeRemaining}
                      </span>
                      <span className="text-muted-foreground text-sm">seconds</span>
                    </div>

                    {/* Answered progress */}
                    {(() => {
                      const activeAdmitted = gameState.players.filter(
                        (p) => p.isActive && p.admissionStatus === "admitted"
                      );
                      const answeredCount = activeAdmitted.filter((p) => p.hasAnswered).length;
                      const progressPercent = activeAdmitted.length > 0
                        ? (answeredCount / activeAdmitted.length) * 100
                        : 0;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Answered</span>
                            <span className="font-medium">{answeredCount} / {activeAdmitted.length}</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Control Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Game Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {gameState.status === "WAITING" && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      {gameState.players.length === 0
                        ? "Waiting for players to join..."
                        : `${gameState.players.length} player${
                            gameState.players.length !== 1 ? "s" : ""
                          } ready`}
                    </p>
                    <Button
                      onClick={handleStartGame}
                      disabled={gameState.players.length === 0}
                      size="lg"
                      className="w-full"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Game
                    </Button>
                    <Button
                      onClick={cancelGame}
                      variant="ghost"
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Game
                    </Button>
                  </div>
                )}

                {gameState.status === "ACTIVE" && (
                  <div className="space-y-4 text-center py-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">Starting game...</p>
                  </div>
                )}

                {gameState.status === "QUESTION" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="font-medium mb-2 flex items-center gap-2">
                        Current Question:
                        {currentQuestion?.easterEggEnabled && (
                          <span className="text-lg" title="This question has an easter egg">
                            🥚
                          </span>
                        )}
                      </p>
                      <p className="text-lg">{currentQuestion?.questionText}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {currentQuestion?.questionType === "MULTI_SELECT"
                          ? "Multi-select"
                          : "Single select"}{" "}
                        • {currentQuestion?.points} points •{" "}
                        {currentQuestion?.timeLimit}s
                      </p>
                    </div>
                    {currentQuestion?.hostNotes && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">Host Notes</p>
                        </div>
                        <p className="text-amber-900 dark:text-amber-200 text-sm whitespace-pre-wrap">{currentQuestion.hostNotes}</p>
                      </div>
                    )}
                    {(() => {
                      const activeAdmitted = gameState.players.filter(
                        (p) => p.isActive && p.admissionStatus === "admitted"
                      );
                      const answeredCount = activeAdmitted.filter((p) => p.hasAnswered).length;
                      const allAnswered = activeAdmitted.length > 0 && answeredCount === activeAdmitted.length;
                      return (
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {answeredCount} of {activeAdmitted.length} players answered
                          </div>
                          {allAnswered && (
                            <Button onClick={skipTimer} variant="secondary" size="sm">
                              <FastForward className="w-4 h-4 mr-2" />
                              Skip Timer
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {gameState.status === "SECTION" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <p className="font-medium text-indigo-800 dark:text-indigo-300">Section</p>
                      </div>
                      <p className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                        {currentQuestion?.questionText}
                      </p>
                      {currentQuestion?.hostNotes && (
                        <p className="text-indigo-700 dark:text-indigo-300 mt-2">
                          {currentQuestion.hostNotes}
                        </p>
                      )}
                    </div>
                    {currentQuestion?.imageUrl && (
                      <div className="rounded-lg overflow-hidden border">
                        <img
                          src={currentQuestion.imageUrl}
                          alt="Section"
                          className="max-h-48 mx-auto"
                        />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Players are seeing this section slide. Click &quot;Continue&quot; when ready to proceed.
                    </p>
                    <Button onClick={nextQuestion} size="lg" className="w-full">
                      <SkipForward className="w-4 h-4 mr-2" />
                      Continue
                    </Button>
                  </div>
                )}

                {gameState.status === "REVEALING" && (
                  <div className="space-y-4">
                    {awaitingReveal ? (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                          <Bell className="w-4 h-4" />
                          <span className="font-medium">Time&apos;s up! Reveal answers when ready.</span>
                        </div>
                        <Button onClick={revealAnswers} variant="secondary" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          Reveal Answers
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Showing correct answer...
                      </p>
                    )}
                    {currentQuestion?.hostNotes && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">Host Notes</p>
                        </div>
                        <p className="text-amber-900 dark:text-amber-200 text-sm whitespace-pre-wrap">{currentQuestion.hostNotes}</p>
                      </div>
                    )}
                    {/* Next Question Preview */}
                    {nextQuestionPreview && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <p className="font-medium text-blue-800 dark:text-blue-300 text-sm">
                            {nextQuestionPreview.questionNumber
                              ? `Up Next (Q${nextQuestionPreview.questionNumber} of ${nextQuestionPreview.totalQuestions})`
                              : "Up Next"}
                          </p>
                        </div>
                        {nextQuestionPreview.section ? (
                          <div className="p-3 bg-indigo-100/70 dark:bg-indigo-800/30 rounded border border-indigo-200 dark:border-indigo-700">
                            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Section</p>
                            <p className="text-indigo-900 dark:text-indigo-100">
                              {nextQuestionPreview.section.questionText}
                            </p>
                            {nextQuestionPreview.section.hostNotes && (
                              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                                {nextQuestionPreview.section.hostNotes}
                              </p>
                            )}
                          </div>
                        ) : (
                          nextQuestionPreview.question && (
                            <div className="space-y-2">
                              <p className="text-blue-900 dark:text-blue-200 font-medium">
                                {nextQuestionPreview.question.questionText}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {nextQuestionPreview.question.answers.map((answer, i) => (
                                  <span
                                    key={answer.id}
                                    className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300 rounded"
                                  >
                                    {String.fromCharCode(65 + i)}. {answer.answerText}
                                  </span>
                                ))}
                              </div>
                              {nextQuestionPreview.question.hostNotes && (
                                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 italic">
                                  Notes: {nextQuestionPreview.question.hostNotes}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                    <div className="flex gap-4">
                      <Button
                        onClick={showScoreboard}
                        variant="outline"
                        className="flex-1"
                        disabled={awaitingReveal}
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Show Scoreboard
                      </Button>
                      {gameState.currentQuestionNumber < gameState.totalQuestions ? (
                        <Button onClick={nextQuestion} className="flex-1" disabled={awaitingReveal}>
                          <SkipForward className="w-4 h-4 mr-2" />
                          Next Question
                        </Button>
                      ) : (
                        <Button onClick={endGame} variant="destructive" className="flex-1" disabled={awaitingReveal}>
                          <Square className="w-4 h-4 mr-2" />
                          End Game
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {gameState.status === "SCOREBOARD" && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Showing scoreboard...
                    </p>
                    {/* Next Question Preview */}
                    {nextQuestionPreview && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <p className="font-medium text-blue-800 dark:text-blue-300 text-sm">
                            {nextQuestionPreview.questionNumber
                              ? `Up Next (Q${nextQuestionPreview.questionNumber} of ${nextQuestionPreview.totalQuestions})`
                              : "Up Next"}
                          </p>
                        </div>
                        {nextQuestionPreview.section ? (
                          <div className="p-3 bg-indigo-100/70 dark:bg-indigo-800/30 rounded border border-indigo-200 dark:border-indigo-700">
                            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Section</p>
                            <p className="text-indigo-900 dark:text-indigo-100">
                              {nextQuestionPreview.section.questionText}
                            </p>
                            {nextQuestionPreview.section.hostNotes && (
                              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                                {nextQuestionPreview.section.hostNotes}
                              </p>
                            )}
                          </div>
                        ) : (
                          nextQuestionPreview.question && (
                            <div className="space-y-2">
                              <p className="text-blue-900 dark:text-blue-200 font-medium">
                                {nextQuestionPreview.question.questionText}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {nextQuestionPreview.question.answers.map((answer, i) => (
                                  <span
                                    key={answer.id}
                                    className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300 rounded"
                                  >
                                    {String.fromCharCode(65 + i)}. {answer.answerText}
                                  </span>
                                ))}
                              </div>
                              {nextQuestionPreview.question.hostNotes && (
                                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 italic">
                                  Notes: {nextQuestionPreview.question.hostNotes}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                    {gameState.currentQuestionNumber < gameState.totalQuestions ? (
                      <Button onClick={nextQuestion} size="lg" className="w-full" disabled={awaitingReveal}>
                        <SkipForward className="w-4 h-4 mr-2" />
                        Next Question
                      </Button>
                    ) : (
                      <Button
                        onClick={endGame}
                        variant="destructive"
                        size="lg"
                        className="w-full"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        End Game
                      </Button>
                    )}
                  </div>
                )}

                {gameState.status === "FINISHED" && (
                  <div className="space-y-4 text-center">
                    <p className="text-xl font-bold text-green-600">
                      Game Complete!
                    </p>

                    {/* Certificate Status Banner */}
                    <CertificateStatusBanner gameCode={gameCode} />

                    {/* Download Button */}
                    <CertificateDownloadButton
                      gameCode={gameCode}
                      type="host"
                    />

                    {/* Certificate Regeneration Panel */}
                    <CertificateRegenerationPanel gameCode={gameCode} />

                    <Link href="/host">
                      <Button size="lg" className="w-full">
                        Start New Game
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Fallback for unexpected status */}
                {!["WAITING", "ACTIVE", "QUESTION", "SECTION", "REVEALING", "SCOREBOARD", "FINISHED"].includes(gameState.status) && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">Unexpected game state: {gameState.status}</span>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      The game entered an unexpected state. Try refreshing the page or ending the game.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                        Refresh Page
                      </Button>
                      <Button onClick={endGame} variant="destructive" size="sm">
                        End Game
                      </Button>
                    </div>
                  </div>
                )}

                {/* Emergency End Button */}
                {gameState.status !== "WAITING" &&
                  gameState.status !== "FINISHED" && (
                    <Button
                      onClick={endGame}
                      variant="ghost"
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      End Game Early
                    </Button>
                  )}
              </CardContent>
            </Card>

            {/* Player Answers Card - shown during QUESTION and REVEALING */}
            {(gameState.status === "QUESTION" ||
              gameState.status === "REVEALING") &&
              currentQuestion && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Player Answers</span>
                      <Badge variant="secondary">
                        {currentAnswers.length} / {gameState.players.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {currentAnswers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Waiting for answers...
                        </p>
                      ) : (
                        currentAnswers
                          .sort((a, b) => a.timeToAnswer - b.timeToAnswer)
                          .map((answer) => (
                            <div
                              key={answer.playerId}
                              className={`
                                flex items-center gap-3 p-2 rounded-lg border
                                ${answer.isCorrect ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"}
                              `}
                            >
                              {answer.avatarEmoji?.startsWith("/") ? (
                              <img
                                src={answer.avatarEmoji}
                                alt={answer.playerName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <Avatar className="w-8 h-8">
                                <AvatarFallback
                                  style={{ backgroundColor: answer.avatarEmoji ? "transparent" : answer.avatarColor }}
                                  className={answer.avatarEmoji ? "text-xl" : "text-white text-xs"}
                                >
                                  {answer.avatarEmoji || answer.playerName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">
                                    {answer.playerName}
                                  </p>
                                  {answer.isCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                  )}
                                  {easterEggClicks.get(currentQuestion.id)?.some((click) => click.playerId === answer.playerId) && (
                                    <span className="text-base" title="Clicked easter egg">
                                      🥚
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {(answer.timeToAnswer / 1000).toFixed(1)}s
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">
                                  +{answer.pointsEarned}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Total: {answer.totalScore} (#{answer.position})
                                </p>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>

          {/* Sidebar - Players/Scores */}
          <div className="space-y-6">
            {/* Admission Control Status - Compact when auto-admit */}
            {gameState.autoAdmit ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-100/50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-400">Auto-admit enabled</span>
              </div>
            ) : (
              <Card className="border-yellow-300 dark:border-yellow-700">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="w-4 h-4 text-yellow-600" />
                    Admission Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Requires Approval</span>
                    {admissionRequests.length > 0 && (
                      <Badge variant="destructive" className="animate-pulse">
                        {admissionRequests.length} pending
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Admission Requests */}
            {admissionRequests.length > 0 && (
              <Card className="border-yellow-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-yellow-500" />
                    Admission Requests ({admissionRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {admissionRequests.map((request) => (
                      <div
                        key={request.playerId}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border-2 border-yellow-200 dark:border-yellow-800"
                      >
                        <p className="font-medium text-lg">{request.playerName}</p>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => handleAdmitPlayer(request.playerId)}
                            className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-initial"
                            title="Admit player to game"
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Admit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRefusePlayer(request.playerId)}
                            title="Refuse player admission"
                            className="flex-1 sm:flex-initial"
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Refuse
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Players ({gameState.players.filter((p) => p.isActive).length})
                  </div>
                  {playerSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlayerSearch("")}
                      className="h-7 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </CardTitle>
                {/* Search input - always visible */}
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search players..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredDisplayScores.length === 0 && playerSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No players match "{playerSearch}"
                    </p>
                  )}
                  {filteredDisplayScores.map((player, index) => {
                    const playerInfo = gameState.players.find(
                      (p) => p.id === player.playerId
                    );
                    const isActive = playerInfo?.isActive ?? true;
                    return (
                      <div
                        key={player.playerId}
                        className={`
                          flex items-center gap-3 p-3 rounded-xl border
                          ${!isActive ? "opacity-50" : ""}
                          ${index === 0 && gameState.status !== "WAITING"
                            ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                            : "bg-card border-border hover:border-primary/30"}
                          transition-colors
                        `}
                      >
                        <span className="text-base font-bold w-6 text-center text-muted-foreground">
                          {index + 1}
                        </span>
                        {player.avatarEmoji?.startsWith("/") ? (
                          <img
                            src={player.avatarEmoji}
                            alt={player.name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                          />
                        ) : (
                          <Avatar className="w-10 h-10 ring-2 ring-border">
                            <AvatarFallback
                              style={{ backgroundColor: player.avatarEmoji ? "transparent" : player.avatarColor }}
                              className={player.avatarEmoji ? "text-2xl" : "text-white text-sm font-medium"}
                            >
                              {player.avatarEmoji || player.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate max-w-[120px] sm:max-w-[160px]" title={player.name}>
                              {player.name}
                            </p>
                            {player.languageCode && player.languageCode !== "en" && (
                              <span
                                className="text-base shrink-0"
                                title={SupportedLanguages[player.languageCode]?.nativeName || player.languageCode}
                              >
                                {SupportedLanguages[player.languageCode]?.flag || ""}
                              </span>
                            )}
                          </div>
                          {!isActive && (
                            <p className="text-xs text-destructive">
                              Disconnected
                            </p>
                          )}
                        </div>

                        {/* Indicators container */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Answered indicator during question */}
                          {gameState.status === "QUESTION" && playerInfo?.hasAnswered && (
                            <span title="Answered">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </span>
                          )}

                          {/* Download Progress - compact */}
                          {playerInfo?.downloadStatus?.status === 'loading' && (
                            <div className="w-12 h-2 bg-muted rounded-full overflow-hidden" title={`${Math.round(playerInfo.downloadStatus.percentage)}%`}>
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${playerInfo.downloadStatus.percentage}%` }}
                              />
                            </div>
                          )}
                          {playerInfo?.downloadStatus?.status === 'complete' && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}

                          {/* Easter Egg Indicator */}
                          {currentQuestion?.easterEggEnabled &&
                            easterEggClicks.get(currentQuestion.id)?.some((click) => click.playerId === player.playerId) && (
                              <span className="text-sm" title="Clicked easter egg">🥚</span>
                            )}

                          {/* Power-up Indicators - using lucide icons */}
                          {currentQuestion && powerUpUsages.get(currentQuestion.id)
                            ?.filter((usage) => usage.playerId === player.playerId)
                            .map((usage, idx) => (
                              <span
                                key={idx}
                                className="flex items-center justify-center w-5 h-5 rounded bg-muted"
                                title={`Used ${usage.powerUpType} power-up`}
                              >
                                {usage.powerUpType === "hint" && <Lightbulb className="w-3 h-3 text-blue-500" />}
                                {usage.powerUpType === "copy" && <Users className="w-3 h-3 text-purple-500" />}
                                {usage.powerUpType === "double" && <Sparkles className="w-3 h-3 text-amber-500" />}
                              </span>
                            ))}
                        </div>

                        <span className="font-bold text-primary text-base shrink-0 ml-1 min-w-[40px] text-right">
                          {player.score}
                        </span>

                        {/* Remove Player Button */}
                        <button
                          onClick={() => handleRemovePlayer(player.playerId, player.name)}
                          className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors shrink-0"
                          title="Remove player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  {gameState.players.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No players yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Remove Player Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Player?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{playerToRemove?.name}</strong> from the game?
              They will be able to request to rejoin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemovePlayer}
            >
              Remove Player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
