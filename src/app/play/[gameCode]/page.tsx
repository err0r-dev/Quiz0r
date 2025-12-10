"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useQuizPreloader } from "@/hooks/useQuizPreloader";
import { PowerUpType, PlayerPowerUpState, SupportedLanguages, type LanguageCode, type QuestionDataWithTranslations, type PlayerViewState } from "@/types";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { BackgroundEffects } from "@/components/theme/BackgroundEffects";
import { type CertificateButtonState } from "@/components/certificate/CertificateDownloadButton";

// Extracted play screen components (optimization: reduce re-renders)
import { ErrorStates } from "@/components/play/ErrorStates";
import { JoinScreen } from "@/components/play/JoinScreen";
import { WaitingLobby } from "@/components/play/WaitingLobby";
import { SectionView } from "@/components/play/SectionView";
import { QuestionView } from "@/components/play/QuestionView";
import { ScoreboardView } from "@/components/play/ScoreboardView";

export default function PlayerGamePage({
  params,
}: {
  params: { gameCode: string };
}) {
  const { gameCode } = params;
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [easterEggClicked, setEasterEggClicked] = useState<Set<string>>(new Set());
  const [gameStatus, setGameStatus] = useState<"loading" | "valid" | "not_found" | "ended">("loading");
  const [joinTheme, setJoinTheme] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");
  const [availableLanguages, setAvailableLanguages] = useState<LanguageCode[]>(["en"]);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [knownPlayerId, setKnownPlayerId] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const latestScreenshot = useRef<string | null>(null);
  const CAPTURE_INTERVAL_MS = 800;

  // Power-up state
  const [powerUpState, setPowerUpState] = useState<PlayerPowerUpState>({
    hintsRemaining: 0,
    copyRemaining: 0,
    doubleRemaining: 0,
    usedThisQuestion: new Set(),
  });
  const [selectedPowerUps, setSelectedPowerUps] = useState<Set<PowerUpType>>(new Set());
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);
  const [showCopyPlayerSelector, setShowCopyPlayerSelector] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [certificateState, setCertificateState] = useState<CertificateButtonState>("checking");

  // Check if game exists and is joinable on mount
  useEffect(() => {
    async function checkGame() {
      try {
        const res = await fetch(`/api/games/${gameCode}`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (res.ok) {
          const data = await res.json();
          setJoinTheme(data.quizTheme);
          if (data.availableLanguages) {
            const langs = data.availableLanguages.includes("en")
              ? data.availableLanguages
              : ["en", ...data.availableLanguages];
            setAvailableLanguages(Array.from(new Set(langs)));
          }
          if (data.status === "WAITING") {
            setGameStatus("valid");
          } else if (data.status === "FINISHED") {
            setGameStatus("ended");
          } else {
            // Game is in progress (ACTIVE, QUESTION, REVEALING, SCOREBOARD)
            setGameStatus("ended");
          }
        } else if (res.status === 404) {
          setGameStatus("not_found");
        } else {
          setGameStatus("not_found");
        }
      } catch {
        setGameStatus("not_found");
      }
    }
    checkGame();
  }, [gameCode]);

  // Load language preference from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem(`quiz_language_${gameCode}`);
    if (savedLanguage && savedLanguage in SupportedLanguages) {
      setSelectedLanguage(savedLanguage as LanguageCode);
    }
  }, [gameCode]);

  // Save language preference to localStorage when it changes
  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem(`quiz_language_${gameCode}`, selectedLanguage);
    }
  }, [selectedLanguage, gameCode]);

  // Common emojis for avatar selection
  const avatarEmojis = [
    "😀", "😎", "🤓", "😈", "👻", "🤖", "👽", "🦊",
    "🐱", "🐶", "🐸", "🦁", "🐼", "🐨", "🦄", "🐲",
    "🌟", "⚡", "🔥", "💎", "🎮", "🎸", "🚀", "🏆",
  ];

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setJoinError("Invalid file type. Use JPEG, PNG, GIF, or WebP");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setJoinError("Image too large. Maximum size is 5MB");
      return;
    }

    setUploadingImage(true);
    setJoinError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarImage(data.url);
        setSelectedEmoji(null); // Clear emoji when image is selected
      } else {
        const data = await res.json();
        setJoinError(data.error || "Failed to upload image");
      }
    } catch {
      setJoinError("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  const {
    socket,
    connected,
    gameState,
    currentQuestion,
    timeRemaining,
    scores,
    answerResult,
    questionEnded,
    awaitingReveal,
    error,
    gameCancelled,
    playerRemoved,
    removalReason,
    admissionStatus,
    submitAnswer,
  } = useSocket({
    gameCode,
    role: "player",
    playerName: joined ? playerName : undefined,
    languageCode: joined ? selectedLanguage : undefined,
  });

  // Get player ID from game state
  const playerId = gameState?.players.find(
    (p) => p.name.toLowerCase() === playerName.toLowerCase()
  )?.id;

  const playerInfo = useMemo(
    () => gameState?.players.find((p) => p.id === playerId) || null,
    [gameState?.players, playerId]
  );

  useEffect(() => {
    if (playerId) {
      setKnownPlayerId(playerId);
    }
  }, [playerId]);

  // Initialize quiz preloader
  const { quizData } = useQuizPreloader({
    gameCode,
    playerId,
    socket,
  });

  // Extract available languages from quiz data
  useEffect(() => {
    if (quizData?.availableLanguages) {
      setAvailableLanguages(quizData.availableLanguages);

      // If selected language is not available, reset to English
      if (!quizData.availableLanguages.includes(selectedLanguage)) {
        setSelectedLanguage("en");
      }
    }
  }, [quizData, selectedLanguage]);

  // Use preloaded question if available, otherwise fall back to socket-provided question
  const effectiveCurrentQuestion = useMemo<QuestionDataWithTranslations | null>(() => {
    if (quizData && gameState?.currentQuestionIndex !== undefined) {
      // Preloaded questions may start at a non-zero index when joining mid-game
      const offset = (quizData.startIndex ?? 0);
      const localIndex = gameState.currentQuestionIndex - offset;
      if (localIndex >= 0 && localIndex < quizData.questions.length) {
        return quizData.questions[localIndex];
      }
    }
    // Fall back to socket-provided question (cast to include potential translations)
    return currentQuestion as QuestionDataWithTranslations | null;
  }, [quizData, gameState?.currentQuestionIndex, currentQuestion]);

  // Reset selected answers when question changes
  useEffect(() => {
    setSelectedAnswers(new Set());
    setHasSubmitted(false);
  }, [effectiveCurrentQuestion?.id]);

  // Initialize power-up counts from gameState
  useEffect(() => {
    if (gameState?.powerUps) {
      setPowerUpState((prev) => ({
        ...prev,
        hintsRemaining: gameState.powerUps.hintCount,
        copyRemaining: gameState.powerUps.copyAnswerCount,
        doubleRemaining: gameState.powerUps.doublePointsCount,
      }));
    }
  }, [gameState?.powerUps]);

  // Reset power-up selections when question changes
  useEffect(() => {
    if (gameState?.status === "QUESTION") {
      setPowerUpState((prev) => ({ ...prev, usedThisQuestion: new Set() }));
      setSelectedPowerUps(new Set());
      setCopiedPlayerId(null);
    }
  }, [gameState?.currentQuestionIndex, gameState?.status]);

  // Translation utility function
  const getTranslatedContent = (
    content: string | null | undefined,
    translations?: Record<string, any>,
    field?: string
  ): string => {
    // If no content, return empty string
    if (!content) return "";

    // If English is selected or no translations available, return original content
    if (selectedLanguage === "en" || !translations) return content;

    // Try to get translation for the selected language
    const translation = translations[selectedLanguage];
    if (translation && field && translation[field]) {
      return translation[field];
    }

    // Fallback to original content (English)
    return content;
  };

  const renderedQuestion = useMemo(() => {
    if (!effectiveCurrentQuestion || !gameState) return null;

    return {
      id: effectiveCurrentQuestion.id,
      questionText: getTranslatedContent(
        effectiveCurrentQuestion.questionText,
        effectiveCurrentQuestion.translations,
        "questionText"
      ),
      questionType: effectiveCurrentQuestion.questionType,
      answers: effectiveCurrentQuestion.answers.map((answer) => ({
        id: answer.id,
        answerText: getTranslatedContent(
          answer.answerText,
          answer.translations,
          "answerText"
        ),
        imageUrl: answer.imageUrl,
      })),
      imageUrl: effectiveCurrentQuestion.imageUrl,
      points: effectiveCurrentQuestion.points,
      questionNumber: gameState.currentQuestionNumber,
      totalQuestions: gameState.totalQuestions,
    };
  }, [effectiveCurrentQuestion, gameState, selectedLanguage]);

  const monitorViewState = useMemo<PlayerViewState | null>(() => {
    const resolvedPlayerId = playerId || knownPlayerId;
    if (!resolvedPlayerId || !playerName) return null;

    if (gameCancelled) {
      return {
        stage: "cancelled",
        playerId: resolvedPlayerId,
        playerName,
        languageCode: selectedLanguage,
        message: "Game cancelled by host",
        isActive: false,
      };
    }

    if (playerRemoved) {
      return {
        stage: "removed",
        playerId: resolvedPlayerId,
        playerName,
        languageCode: selectedLanguage,
        message: removalReason || "You have been removed from the game",
        isActive: false,
      };
    }

    if (!gameState || !connected) {
      return {
        stage: "connecting",
        playerId: resolvedPlayerId,
        playerName,
        languageCode: selectedLanguage,
        message: "Connecting...",
        isActive: !!playerInfo?.isActive,
      };
    }

    let stage: PlayerViewState["stage"] = "waiting";
    if (gameState.status === "SECTION") {
      stage = "section";
    } else if (gameState.status === "QUESTION") {
      stage = "question";
    } else if (gameState.status === "REVEALING") {
      stage = awaitingReveal ? "awaiting-reveal" : "reveal";
    } else if (gameState.status === "SCOREBOARD") {
      stage = "scoreboard";
    } else if (gameState.status === "FINISHED") {
      stage = "finished";
    } else if (gameState.status === "WAITING") {
      stage = "waiting";
    }

    const scoreboardData =
      gameState.status === "SCOREBOARD" || gameState.status === "FINISHED"
        ? (() => {
            const phase: "mid" | "final" =
              gameState.status === "FINISHED" ? "final" : "mid";
            return { scores, phase };
          })()
        : undefined;

    return {
      stage,
      playerId: resolvedPlayerId,
      playerName,
      languageCode: selectedLanguage,
      question: renderedQuestion || undefined,
      selectedAnswerIds: Array.from(selectedAnswers),
      hasSubmitted,
      awaitingReveal,
      timeRemaining,
      correctAnswerIds: questionEnded?.correctAnswerIds,
      answerResult,
      score: playerInfo?.score,
      downloadStatus: playerInfo?.downloadStatus,
      scoreboard: scoreboardData,
      message: removalReason || undefined,
      isActive: playerInfo?.isActive,
    };
  }, [
    answerResult,
    awaitingReveal,
    connected,
    gameCancelled,
    gameState,
    hasSubmitted,
    playerId,
    knownPlayerId,
    playerInfo,
    playerName,
    playerRemoved,
    removalReason,
    renderedQuestion,
    scores,
    selectedAnswers,
    selectedLanguage,
    questionEnded,
    timeRemaining,
  ]);

  useEffect(() => {
    if (!socket || !monitorViewState) return;

    socket.emit("player:viewUpdate", {
      gameCode: gameCode.toUpperCase(),
      playerId: monitorViewState.playerId,
      viewState: monitorViewState,
    });
  }, [socket, monitorViewState, gameCode]);

  // Capture visual snapshot for monitor (best-effort)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let cancelled = false;

    async function captureAndSend() {
      if (!screenRef.current || !socket || !monitorViewState) return;
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(screenRef.current, {
          useCORS: true,
          logging: false,
          scale: 0.5,
          backgroundColor: null,
          ignoreElements: (el) => el.getAttribute("data-ignore-monitor") === "true",
        });
        const screenshot = canvas.toDataURL("image/jpeg", 0.7);
        latestScreenshot.current = screenshot;
        if (!cancelled) {
          socket.emit("player:viewUpdate", {
            gameCode: gameCode.toUpperCase(),
            playerId: monitorViewState.playerId,
            viewState: { ...monitorViewState, screenshot },
          });
        }
      } catch (err) {
        // fail silently - monitor will show fallback state
        console.error("Failed to capture monitor view", err);
      }
    }

    // Initial capture and then regular cadence
    captureAndSend();
    interval = setInterval(captureAndSend, CAPTURE_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [socket, monitorViewState, gameCode]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");

    const name = playerName.trim();
    if (!name) {
      setJoinError("Please enter your name");
      return;
    }

    if (name.length > 20) {
      setJoinError("Name must be 20 characters or less");
      return;
    }

    setJoining(true);

    try {
      const res = await fetch(`/api/games/${gameCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ name, avatarEmoji: avatarImage || selectedEmoji }),
      });

      if (res.ok) {
        setJoined(true);
      } else {
        const data = await res.json();
        // If admission is pending, still proceed to join (socket will handle waiting state)
        if (data.status === "pending") {
          setJoined(true);
        } else {
          setJoinError(data.error || "Failed to join game");
        }
      }
    } catch {
      setJoinError("Failed to join game");
    } finally {
      setJoining(false);
    }
  }

  function emitPowerUps(questionId: string) {
    if (!socket) return;

    // Emit power-ups first
    Array.from(selectedPowerUps).forEach((powerUpType) => {
      socket.emit("player:usePowerUp", {
        gameCode: gameCode.toUpperCase(),
        questionId,
        powerUpType,
        ...(powerUpType === PowerUpType.COPY && copiedPlayerId ? { copiedPlayerId } : {}),
      });

      // Update local state
      setPowerUpState((prev) => {
        const next = { ...prev };
        if (powerUpType === PowerUpType.HINT) next.hintsRemaining--;
        if (powerUpType === PowerUpType.COPY) next.copyRemaining--;
        if (powerUpType === PowerUpType.DOUBLE) next.doubleRemaining--;
        const usedSet = new Set(next.usedThisQuestion);
        usedSet.add(powerUpType);
        next.usedThisQuestion = usedSet;
        return next;
      });
    });

    // Clear selection
    setSelectedPowerUps(new Set());
    setCopiedPlayerId(null);
  }

  function toggleAnswer(answerId: string) {
    if (hasSubmitted) return;

    const newSelected = new Set(selectedAnswers);

    if (effectiveCurrentQuestion?.questionType === "SINGLE_SELECT") {
      // Single select - replace selection
      newSelected.clear();
      newSelected.add(answerId);
      // Emit power-ups before submitting answer
      emitPowerUps(effectiveCurrentQuestion.id);
      // Auto-submit for single select
      submitAnswer(effectiveCurrentQuestion.id, [answerId]);
      setHasSubmitted(true);
    } else {
      // Multi select - toggle
      if (newSelected.has(answerId)) {
        newSelected.delete(answerId);
      } else {
        newSelected.add(answerId);
      }
    }

    setSelectedAnswers(newSelected);
  }

  function handleSubmitMultiSelect() {
    if (!effectiveCurrentQuestion || hasSubmitted || selectedAnswers.size === 0) return;
    // Emit power-ups before submitting answer
    emitPowerUps(effectiveCurrentQuestion.id);
    submitAnswer(effectiveCurrentQuestion.id, Array.from(selectedAnswers));
    setHasSubmitted(true);
  }

  function handleEasterEggClick() {
    if (!effectiveCurrentQuestion || !socket) return;

    const questionId = effectiveCurrentQuestion.id;
    if (easterEggClicked.has(questionId)) return; // Already clicked

    // Emit socket event
    socket.emit("player:easterEggClick", {
      gameCode: gameCode.toUpperCase(),
      questionId,
    });

    // Open URL in new tab
    if (effectiveCurrentQuestion.easterEggUrl) {
      window.open(
        effectiveCurrentQuestion.easterEggUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }

    // Mark as clicked
    setEasterEggClicked((prev) => new Set(prev).add(questionId));
  }

  function handlePowerUpToggle(powerUpType: PowerUpType) {
    if (powerUpType === PowerUpType.HINT) {
      // Show hint modal - once selected, can't unselect
      if (!selectedPowerUps.has(PowerUpType.HINT)) {
        setShowHintModal(true);
        setSelectedPowerUps((prev) => {
          const next = new Set(prev);
          next.add(PowerUpType.HINT);
          return next;
        });
      }
    } else if (powerUpType === PowerUpType.COPY) {
      // Open player selector only if not already selected
      if (!selectedPowerUps.has(PowerUpType.COPY)) {
        setShowCopyPlayerSelector(true);
      }
    } else if (powerUpType === PowerUpType.DOUBLE) {
      // Toggle double points with visual feedback
      setSelectedPowerUps((prev) => {
        const next = new Set(prev);
        if (next.has(powerUpType)) {
          next.delete(powerUpType);
        } else {
          next.add(powerUpType);
        }
        return next;
      });
    }
  }

  function handleCopyPlayerSelected(selectedPlayerId: string) {
    setSelectedPowerUps((prev) => {
      const next = new Set(prev);
      next.add(PowerUpType.COPY);
      return next;
    });
    setCopiedPlayerId(selectedPlayerId);
    setShowCopyPlayerSelector(false);
  }

  // Player waiting for admission (pending status)
  if (joined && gameState && !gameState.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
    return <ErrorStates state={{ type: "admissionPending" }} theme={gameState?.quizTheme || joinTheme} screenRef={screenRef} />;
  }

  // Admission refused
  if (admissionStatus === "refused") {
    return <ErrorStates state={{ type: "admissionRefused" }} theme={gameState?.quizTheme || joinTheme} screenRef={screenRef} />;
  }

  // Player removed (initial removal screen)
  if (playerRemoved && admissionStatus !== "admitted") {
    return <ErrorStates state={{ type: "playerRemoved", reason: removalReason || undefined }} theme={gameState?.quizTheme || joinTheme} screenRef={screenRef} />;
  }

  // Game cancelled state
  if (gameCancelled) {
    return <ErrorStates state={{ type: "gameCancelled" }} theme={gameState?.quizTheme || joinTheme} screenRef={screenRef} />;
  }

  // Error state
  if (error) {
    return <ErrorStates state={{ type: "error", message: error }} theme={joinTheme} screenRef={screenRef} />;
  }

  // Loading state while checking game
  if (!joined && gameStatus === "loading") {
    return <ErrorStates state={{ type: "loading", message: "Checking game..." }} theme={joinTheme} screenRef={screenRef} />;
  }

  // Game not found
  if (!joined && gameStatus === "not_found") {
    return <ErrorStates state={{ type: "gameNotFound" }} theme={joinTheme} screenRef={screenRef} />;
  }

  // Game has ended or is in progress
  if (!joined && gameStatus === "ended") {
    return <ErrorStates state={{ type: "gameEnded" }} theme={joinTheme} screenRef={screenRef} />;
  }

  // Not joined yet - show name entry (only if game is valid)
  if (!joined) {
    return (
      <JoinScreen
        gameCode={gameCode}
        theme={joinTheme}
        playerName={playerName}
        selectedEmoji={selectedEmoji}
        avatarImage={avatarImage}
        onAvatarImageChange={setAvatarImage}
        uploadingImage={uploadingImage}
        selectedLanguage={selectedLanguage}
        availableLanguages={availableLanguages}
        joinError={joinError}
        joining={joining}
        onPlayerNameChange={(name) => setPlayerName(name.slice(0, 20))}
        onEmojiSelect={(emoji) => {
          setSelectedEmoji(selectedEmoji === emoji ? null : emoji);
          setAvatarImage(null);
        }}
        onImageUpload={handleImageUpload}
        onLanguageChange={(lang) => setSelectedLanguage(lang as LanguageCode)}
        onJoin={handleJoin}
        screenRef={screenRef}
      />
    );
  }

  // Connecting
  if (!connected || !gameState) {
    return <ErrorStates state={{ type: "connecting" }} theme={joinTheme} screenRef={screenRef} />;
  }

  // Waiting for game to start
  if (gameState.status === "WAITING") {
    const playerAvatar = avatarImage || selectedEmoji;
    return (
      <WaitingLobby
        quizTitle={gameState.quizTitle || "Get ready for the quiz"}
        playerName={playerName}
        playerAvatar={playerAvatar}
        gameCode={gameCode}
        playerCount={gameState.players.length}
        powerUps={gameState.powerUps || { hintCount: 0, copyAnswerCount: 0, doublePointsCount: 0 }}
        theme={gameState.quizTheme}
        screenRef={screenRef}
      />
    );
  }

  // Section view - players just see the section slide
  if (gameState.status === "SECTION" && effectiveCurrentQuestion) {
    return (
      <SectionView
        sectionTitle={getTranslatedContent(
          effectiveCurrentQuestion.questionText,
          effectiveCurrentQuestion.translations,
          "questionText"
        )}
        sectionNotes={effectiveCurrentQuestion.hostNotes ? getTranslatedContent(
          effectiveCurrentQuestion.hostNotes,
          effectiveCurrentQuestion.translations,
          "hostNotes"
        ) : null}
        imageUrl={effectiveCurrentQuestion.imageUrl}
        theme={gameState.quizTheme}
        screenRef={screenRef}
      />
    );
  }

  // Question view
  if (
    gameState.status === "QUESTION" ||
    (gameState.status === "REVEALING" && effectiveCurrentQuestion)
  ) {
    const isRevealing = gameState.status === "REVEALING";
    const correctIds = questionEnded?.correctAnswerIds || [];

    return (
      <QuestionView
        question={effectiveCurrentQuestion! as any}
        questionNumber={gameState.currentQuestionNumber || 1}
        totalQuestions={gameState.totalQuestions || 1}
        timeRemaining={timeRemaining}
        isRevealing={isRevealing}
        awaitingReveal={awaitingReveal}
        hasSubmitted={hasSubmitted}
        selectedAnswers={selectedAnswers}
        correctAnswerIds={correctIds}
        answerResult={answerResult}
        powerUpState={powerUpState}
        selectedPowerUps={selectedPowerUps}
        copiedPlayerId={copiedPlayerId}
        showHintModal={showHintModal}
        showCopyPlayerSelector={showCopyPlayerSelector}
        easterEggClicked={easterEggClicked}
        selectedLanguage={selectedLanguage}
        availableLanguages={availableLanguages}
        showLanguageSelector={showLanguageSelector}
        players={gameState.players}
        playerName={playerName}
        theme={gameState.quizTheme}
        onToggleAnswer={toggleAnswer}
        onSubmitMultiSelect={() => submitAnswer(effectiveCurrentQuestion!.id, Array.from(selectedAnswers))}
        onPowerUpToggle={handlePowerUpToggle}
        onCopyPlayerSelected={handleCopyPlayerSelected}
        onEasterEggClick={handleEasterEggClick}
        onLanguageChange={(lang) => setSelectedLanguage(lang)}
        onShowHintModalChange={setShowHintModal}
        onShowCopyPlayerSelectorChange={setShowCopyPlayerSelector}
        onShowLanguageSelectorChange={setShowLanguageSelector}
        getTranslatedContent={getTranslatedContent}
        screenRef={screenRef}
      />
    );
  }
  // Scoreboard
  if (gameState.status === "SCOREBOARD" || gameState.status === "FINISHED") {
    const isFinished = gameState.status === "FINISHED";
    const displayScores =
      scores.length > 0
        ? scores
        : gameState.players.map((p, i) => ({
            ...p,
            playerId: p.id,
            position: i + 1,
            change: 0,
          }));

    const myPlayer = gameState.players.find(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );

    return (
      <ScoreboardView
        isFinished={isFinished}
        scores={displayScores}
        playerName={playerName}
        gameCode={gameCode}
        playerId={myPlayer?.id}
        certificateState={certificateState}
        onCertificateStateChange={setCertificateState}
        theme={gameState.quizTheme}
        screenRef={screenRef}
      />
    );
  }
  // Default loading state
  const theme = gameState?.quizTheme || joinTheme;
  return (
    <ThemeProvider theme={theme}>
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
        }}
      >
        <BackgroundEffects theme={theme} />
        <div className="relative z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    </ThemeProvider>
  );
}
