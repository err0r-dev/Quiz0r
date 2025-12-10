import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import {
  GameState,
  PlayerInfo,
  QuestionData,
  PlayerScore,
  GameStatus,
  PlayerAnswerDetail,
  EasterEggClickDetail,
  ClientToServerEvents,
  ServerToClientEvents,
  QuizPreloadData,
  PowerUpType,
  LanguageCode,
  SupportedLanguages,
  QuestionDataWithTranslations,
  PlayerViewState,
} from "@/types";
import { QuizTheme } from "@/types/theme";
import {
  calculateSingleSelectScore,
  calculateMultiSelectScore,
  isFullyCorrect,
  generateAvatarColor,
} from "@/lib/scoring";
import { parseTheme } from "@/lib/theme";

const prisma = new PrismaClient();

interface ActiveGame {
  gameCode: string;
  quizId: string;
  status: GameStatus;
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  timerInterval: NodeJS.Timeout | null;
  questions: QuestionData[];
  correctAnswerIds: Map<string, string[]>; // questionId -> correctAnswerIds
  playerAnswers: Map<string, Set<string>>; // questionId -> Set of playerIds who answered
  previousPositions: Map<string, number>; // playerId -> previous position
  // Performance optimization: Cache answer distribution in memory
  answerDistribution: Map<string, Record<string, number>>; // questionId -> { answerId: count }
  pendingReveal?: {
    correctAnswerIds: string[];
    stats: {
      totalAnswered: number;
      answerDistribution: Record<string, number>;
    };
  };
}

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class GameManager {
  private io: TypedServer;
  private activeGames: Map<string, ActiveGame> = new Map();
  private playerViewStates: Map<string, Map<string, PlayerViewState>> = new Map();

  constructor(io: TypedServer) {
    this.io = io;
  }

  handleConnection(socket: TypedSocket) {
    console.log(`Client connected: ${socket.id}`);

    // Host events
    socket.on("host:joinRoom", (data) => this.handleHostJoin(socket, data));
    socket.on("host:startGame", (data) => this.handleStartGame(socket, data));
    socket.on("host:nextQuestion", (data) => this.handleNextQuestion(socket, data));
    socket.on("host:showScoreboard", (data) => this.handleShowScoreboard(socket, data));
    socket.on("host:endGame", (data) => this.handleEndGame(socket, data));
    socket.on("host:skipTimer", (data) => this.handleSkipTimer(socket, data));
    socket.on("host:revealAnswers", (data) => this.handleRevealAnswers(socket, data));
    socket.on("host:cancelGame", (data) => this.handleCancelGame(socket, data));
    socket.on("host:removePlayer", (data) => this.handleRemovePlayer(socket, data));
    socket.on("host:admitPlayer", (data) => this.handleAdmitPlayer(socket, data));
    socket.on("host:refusePlayer", (data) => this.handleRefusePlayer(socket, data));
    socket.on("host:toggleAutoAdmit", (data) => this.handleToggleAutoAdmit(socket, data));
    socket.on("host:requestPlayerViews", (data) => this.handleHostRequestPlayerViews(socket, data));

    // Player events
    socket.on("player:join", (data) => this.handlePlayerJoin(socket, data));
    socket.on("player:answer", (data) => this.handlePlayerAnswer(socket, data));
    socket.on("player:preloadProgress", (data) => this.handlePreloadProgress(socket, data));
    socket.on("player:easterEggClick", (data) => this.handleEasterEggClick(socket, data));
    socket.on("player:usePowerUp", (data) => this.handlePowerUpUsage(socket, data));
    socket.on("player:updateLanguage", (data) => this.handlePlayerLanguageUpdate(socket, data));
    socket.on("player:viewUpdate", (data) => this.handlePlayerViewUpdate(socket, data));

    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  private async handleHostJoin(socket: TypedSocket, data: { gameCode: string }) {
    const { gameCode } = data;
    const upperCode = gameCode.toUpperCase();

    socket.join(`game:${upperCode}`);
    socket.join(`game:${upperCode}:host`);

    // Send current game state
    const state = await this.getGameState(upperCode);
    if (state) {
      socket.emit("game:state", state);
    }
  }

  private async handlePlayerJoin(
    socket: TypedSocket,
    data: { gameCode: string; name: string; languageCode?: LanguageCode }
  ) {
    const { gameCode, name, languageCode } = data;
    const upperCode = gameCode.toUpperCase();

    console.log(`[PlayerJoin] Player "${name}" attempting to join game ${upperCode}`);

    try{
      // Find game session
      const gameSession = await prisma.gameSession.findUnique({
        where: { gameCode: upperCode },
      });

      if (gameSession) {
        console.log(`[PlayerJoin] Game ${upperCode} found with autoAdmit = ${gameSession.autoAdmit}`);
      }

      if (!gameSession) {
        socket.emit("error", { message: "Game not found", code: "GAME_NOT_FOUND" });
        return;
      }

      if (gameSession.status !== "WAITING") {
        socket.emit("error", {
          message: "Game has already started",
          code: "GAME_STARTED",
        });
        return;
      }

      // Check if player already exists
      let player = await prisma.player.findUnique({
        where: {
          gameSessionId_name: {
            gameSessionId: gameSession.id,
            name: name.trim(),
          },
        },
      });

      if (player) {
        // If another active connection is already using this exact name, block the join
        // (allow if the existing record has no socketId or is inactive).
        if (player.isActive && player.socketId) {
          socket.emit("error", {
            message: "That name is already taken in this game. Please choose a different name.",
            code: "NAME_TAKEN",
          });
          return;
        }

        // EXISTING PLAYER - handle based on admission status
        console.log(`[PlayerJoin] Existing player "${name}" found with admissionStatus = ${player.admissionStatus}`);

        if (player.admissionStatus === "refused") {
          socket.emit("error", {
            message: "You have been refused admission to this game",
            code: "ADMISSION_REFUSED",
          });
          return;
        }

        if (player.admissionStatus === "pending") {
          // Update socket ID for pending player
          await prisma.player.update({
            where: { id: player.id },
            data: { socketId: socket.id },
          });

          // Store player context on socket
          (socket as unknown as { playerId: string }).playerId = player.id;
          (socket as unknown as { gameCode: string }).gameCode = upperCode;

          // Notify host of admission request
          this.io.to(`game:${upperCode}:host`).emit("game:admissionRequest", {
            playerId: player.id,
            playerName: player.name,
          });

          // Send game state to player (they'll see waiting screen)
          const state = await this.getGameState(upperCode);
          if (state) {
            socket.emit("game:state", state);
          }

          console.log(`[PlayerJoin] Player "${name}" is pending admission for game ${upperCode}`);
          return;
        }

        // Player is admitted - normal reconnection
        player = await prisma.player.update({
          where: { id: player.id },
          data: {
            socketId: socket.id,
            isActive: true,
            languageCode: languageCode || player.languageCode || "en",
          },
        });
      } else {
        // NEW PLAYER - create with appropriate admission status
        console.log(`[PlayerJoin] Game ${upperCode} autoAdmit setting:`, gameSession.autoAdmit);
        const admissionStatus = gameSession.autoAdmit ? "admitted" : "pending";
        console.log(`[PlayerJoin] New player "${name}" will have admission status: ${admissionStatus}`);

        player = await prisma.player.create({
          data: {
            gameSessionId: gameSession.id,
            name: name.trim(),
            socketId: socket.id,
            avatarColor: generateAvatarColor(),
            admissionStatus,
            languageCode: languageCode || "en",
          },
        });

        if (admissionStatus === "pending") {
          // Store player context on socket
          (socket as unknown as { playerId: string }).playerId = player.id;
          (socket as unknown as { gameCode: string }).gameCode = upperCode;

          // Notify host of admission request
          this.io.to(`game:${upperCode}:host`).emit("game:admissionRequest", {
            playerId: player.id,
            playerName: player.name,
          });

          // Send game state to player
          const state = await this.getGameState(upperCode);
          if (state) {
            socket.emit("game:state", state);
          }

          console.log(`[PlayerJoin] New player "${name}" awaiting admission for game ${upperCode}`);
          return;
        }
      }

      // If we reach here, player is admitted - continue with normal join flow
      // Join rooms
      socket.join(`game:${upperCode}`);
      socket.join(`game:${upperCode}:players`);

      // Store player ID on socket for disconnect handling
      (socket as unknown as { playerId: string }).playerId = player.id;
      (socket as unknown as { gameCode: string }).gameCode = upperCode;

      // Notify all clients
      const playerInfo: PlayerInfo = {
        id: player.id,
        name: player.name,
        avatarColor: player.avatarColor || "#8A2CF6",
        avatarEmoji: player.avatarEmoji,
        score: player.totalScore,
        isActive: true,
        admissionStatus: player.admissionStatus as "admitted" | "pending" | "refused",
      };

      this.io.to(`game:${upperCode}`).emit("game:playerJoined", { player: playerInfo });

      // Send game state to the player
      const state = await this.getGameState(upperCode);
      if (state) {
        socket.emit("game:state", state);
      }

      // Send quiz data for preloading
      await this.sendQuizPreloadData(socket, upperCode, player.id);

      // Seed monitor state for new player
      this.storePlayerViewState(upperCode, player.id, {
        stage: "waiting",
        playerId: player.id,
        playerName: player.name,
        languageCode: player.languageCode as LanguageCode,
        isActive: true,
      });
    } catch (error) {
      console.error("Error joining game:", error);
      socket.emit("error", { message: "Failed to join game", code: "JOIN_FAILED" });
    }
  }

  private async handleStartGame(socket: TypedSocket, data: { gameCode: string }) {
    const { gameCode } = data;
    const upperCode = gameCode.toUpperCase();

    try {
      // Load quiz with questions
      const gameSession = await prisma.gameSession.findUnique({
        where: { gameCode: upperCode },
        include: {
          quiz: {
            include: {
              questions: {
                include: { answers: { orderBy: { orderIndex: "asc" } } },
                orderBy: { orderIndex: "asc" },
              },
            },
          },
        },
      });

      if (!gameSession) {
        socket.emit("error", { message: "Game not found", code: "GAME_NOT_FOUND" });
        return;
      }

      // Initialize active game
      const questions: QuestionData[] = gameSession.quiz.questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        imageUrl: q.imageUrl,
        hostNotes: q.hostNotes,
        questionType: q.questionType as "SINGLE_SELECT" | "MULTI_SELECT",
        timeLimit: q.timeLimit,
        points: q.points,
        answers: q.answers.map((a) => ({
          id: a.id,
          answerText: a.answerText,
          imageUrl: a.imageUrl,
        })),
        easterEggEnabled: q.easterEggEnabled,
        easterEggButtonText: q.easterEggButtonText,
        easterEggUrl: q.easterEggUrl,
        easterEggDisablesScoring: q.easterEggDisablesScoring,
      }));

      const correctAnswerIds = new Map<string, string[]>();
      for (const q of gameSession.quiz.questions) {
        correctAnswerIds.set(
          q.id,
          q.answers.filter((a) => a.isCorrect).map((a) => a.id)
        );
      }

      this.activeGames.set(upperCode, {
        gameCode: upperCode,
        quizId: gameSession.quizId,
        status: "ACTIVE",
        currentQuestionIndex: -1,
        questionStartedAt: null,
        timerInterval: null,
        questions,
        correctAnswerIds,
        playerAnswers: new Map(),
        previousPositions: new Map(),
        answerDistribution: new Map(), // Initialize answer distribution cache
      });

      // Update database
      await prisma.gameSession.update({
        where: { gameCode: upperCode },
        data: { status: "ACTIVE" },
      });

      // Start first question
      await this.startNextQuestion(upperCode);
    } catch (error) {
      console.error("Error starting game:", error);
      socket.emit("error", { message: "Failed to start game", code: "START_FAILED" });
    }
  }

  private async handleNextQuestion(socket: TypedSocket, data: { gameCode: string }) {
    const upperCode = data.gameCode.toUpperCase();
    const game = this.activeGames.get(upperCode);
    if (game?.pendingReveal) {
      socket.emit("error", { message: "Reveal answers before moving to the next question", code: "REVEAL_REQUIRED" });
      return;
    }
    await this.startNextQuestion(upperCode);
  }

  private async handleSkipTimer(socket: TypedSocket, data: { gameCode: string }) {
    const upperCode = data.gameCode.toUpperCase();
    const game = this.activeGames.get(upperCode);
    if (!game || game.status !== "QUESTION") return;

    // End the current question immediately
    await this.endQuestion(upperCode);
  }

  private async handleRevealAnswers(socket: TypedSocket, data: { gameCode: string }) {
    const upperCode = data.gameCode.toUpperCase();
    const game = this.activeGames.get(upperCode);
    if (!game || game.status !== "REVEALING") return;
    if (!game.pendingReveal) {
      // Already revealed or nothing to reveal
      return;
    }

    const payload = game.pendingReveal;
    game.pendingReveal = undefined;

    this.io.to(`game:${upperCode}`).emit("game:questionEnd", payload);
  }

  private async startNextQuestion(gameCode: string) {
    const game = this.activeGames.get(gameCode);
    if (!game) return;

    // Clear any pending reveal from previous question
    game.pendingReveal = undefined;

    // Clear any existing timer
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }

    game.currentQuestionIndex++;

    // Check if quiz is complete
    if (game.currentQuestionIndex >= game.questions.length) {
      await this.endGame(gameCode);
      return;
    }

    const question = game.questions[game.currentQuestionIndex];
    const isSection = question.questionType === "SECTION";

    // For sections, use a special status; for questions, use QUESTION
    game.status = isSection ? "SECTION" : "QUESTION";
    game.questionStartedAt = isSection ? null : Date.now();

    if (!isSection) {
      game.playerAnswers.set(question.id, new Set());
    }

    // Update database
    await prisma.gameSession.update({
      where: { gameCode },
      data: {
        status: isSection ? "SECTION" : "QUESTION",
        currentQuestionIndex: game.currentQuestionIndex,
        questionStartedAt: isSection ? null : new Date(),
      },
    });

    // Calculate question number (excluding sections)
    const questionNumber = game.questions
      .slice(0, game.currentQuestionIndex + 1)
      .filter((q) => q.questionType !== "SECTION").length;

    // Send question/section to all clients
    this.io.to(`game:${gameCode}`).emit("game:questionStart", {
      question,
      questionIndex: game.currentQuestionIndex,
      questionNumber,
      startTime: game.questionStartedAt,
    });

    // Only start timer for actual questions, not sections
    if (!isSection) {
      let remaining = question.timeLimit;
      game.timerInterval = setInterval(() => {
        remaining--;
        this.io.to(`game:${gameCode}`).emit("game:timerTick", { remaining });

        if (remaining <= 0) {
          this.endQuestion(gameCode);
        }
      }, 1000);
    }
    // For sections, host will manually call nextQuestion to advance
  }

  private async handlePlayerAnswer(
    socket: TypedSocket,
    data: { gameCode: string; questionId: string; answerIds: string[] }
  ) {
    let { gameCode, questionId, answerIds } = data;
    const upperCode = gameCode.toUpperCase();
    const game = this.activeGames.get(upperCode);

    if (!game || game.status !== "QUESTION") return;

    const playerId = (socket as unknown as { playerId: string }).playerId;
    if (!playerId) return;

    // Check if already answered
    const answeredPlayers = game.playerAnswers.get(questionId);
    if (!answeredPlayers || answeredPlayers.has(playerId)) return;

    // Check for Copy power-up
    const powerUps = await prisma.powerUpUsage.findMany({
      where: { playerId, questionId },
    });

    const copyPowerUp = powerUps.find(p => p.powerUpType === "copy");
    if (copyPowerUp && copyPowerUp.copiedPlayerId) {
      // Check if copied player is still active
      const copiedPlayer = await prisma.player.findUnique({
        where: { id: copyPowerUp.copiedPlayerId },
      });

      if (!copiedPlayer || !copiedPlayer.isActive) {
        // Copied player disconnected - refund the power-up
        await prisma.powerUpUsage.delete({
          where: { id: copyPowerUp.id },
        });

        // Notify player that Copy was refunded
        socket.emit("game:powerUpRefunded", {
          powerUpType: "copy",
          reason: "Copied player disconnected",
        });

        console.log(`[PowerUp] Copy refunded for player ${playerId} - copied player disconnected`);

        // Don't process as answer - return early (counts as non-answer)
        return;
      }

      // Check for copied player's answer
      const copiedAnswer = await prisma.playerAnswer.findUnique({
        where: {
          playerId_questionId: {
            playerId: copyPowerUp.copiedPlayerId,
            questionId,
          },
        },
      });

      if (copiedAnswer) {
        // Use copied player's answer
        answerIds = JSON.parse(copiedAnswer.selectedAnswerIds);
        console.log(`[PowerUp] Player ${playerId} copied answer from ${copyPowerUp.copiedPlayerId}`);
      } else {
        // Copied player hasn't answered - count as non-answer
        console.log(`[PowerUp] Player ${playerId} copy failed - copied player hasn't answered`);
        return;
      }
    }

    answeredPlayers.add(playerId);

    // Update answer distribution in memory (performance optimization)
    if (!game.answerDistribution.has(questionId)) {
      game.answerDistribution.set(questionId, {});
    }
    const distribution = game.answerDistribution.get(questionId)!;
    for (const answerId of answerIds) {
      distribution[answerId] = (distribution[answerId] || 0) + 1;
    }

    const question = game.questions[game.currentQuestionIndex];
    const correctIds = game.correctAnswerIds.get(questionId) || [];
    const timeTaken = Date.now() - (game.questionStartedAt || 0);

    // Calculate score
    let points = 0;
    let isCorrect = false;

    if (question.questionType === "SINGLE_SELECT") {
      isCorrect = answerIds.length === 1 && correctIds.includes(answerIds[0]);
      points = calculateSingleSelectScore(
        question.points,
        question.timeLimit * 1000,
        timeTaken,
        isCorrect
      );
    } else {
      isCorrect = isFullyCorrect(answerIds, correctIds);
      points = calculateMultiSelectScore(
        question.points,
        question.timeLimit * 1000,
        timeTaken,
        answerIds,
        correctIds
      );
    }

    // Check if player clicked easter egg and scoring is disabled
    if (question.easterEggDisablesScoring) {
      const easterEggClick = await prisma.easterEggClick.findUnique({
        where: {
          playerId_questionId: {
            playerId,
            questionId,
          },
        },
      });

      if (easterEggClick) {
        // Player clicked easter egg and scoring is disabled - give 0 points
        points = 0;
      }
    }

    // Check for Double Points power-up
    const doublePowerUp = powerUps.find((p: { powerUpType: string }) => p.powerUpType === "double");
    if (doublePowerUp) {
      points = points * 2;  // Double after all other calculations
      console.log(`[PowerUp] Player ${playerId} used double points - score: ${points / 2} -> ${points}`);
    }

    // Save answer to database
    try {
      await prisma.playerAnswer.create({
        data: {
          playerId,
          questionId,
          selectedAnswerIds: JSON.stringify(answerIds),
          isCorrect,
          timeToAnswer: timeTaken,
          pointsEarned: points,
        },
      });

      // Update player's total score
      await prisma.player.update({
        where: { id: playerId },
        data: { totalScore: { increment: points } },
      });

      // Notify player of result
      const scores = await this.getPlayerScores(upperCode);
      const position = scores.findIndex((s) => s.playerId === playerId) + 1;

      socket.emit("player:answerResult", {
        correct: isCorrect,
        points,
        position,
      });

      // Notify all clients that someone answered (anonymized)
      this.io.to(`game:${upperCode}`).emit("game:answerReceived", {
        playerId,
        answered: true,
      });

      // Get the player's name and color for the detailed answer
      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (player) {
        // Send detailed answer info to host only
        const answerDetail: PlayerAnswerDetail = {
          playerId,
          playerName: player.name,
          avatarColor: player.avatarColor || "#8A2CF6",
          avatarEmoji: player.avatarEmoji,
          selectedAnswerIds: answerIds,
          isCorrect,
          pointsEarned: points,
          totalScore: player.totalScore,
          position,
          timeToAnswer: timeTaken,
        };

        this.io.to(`game:${upperCode}:host`).emit("game:playerAnswerDetail", {
          questionId,
          answer: answerDetail,
        });
      }
    } catch (error) {
      console.error("Error saving answer:", error);
    }
  }

  private async endQuestion(gameCode: string) {
    const game = this.activeGames.get(gameCode);
    if (!game) return;

    // Clear timer
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }

    game.status = "REVEALING";

    const question = game.questions[game.currentQuestionIndex];
    const correctIds = game.correctAnswerIds.get(question.id) || [];

    // Get answer statistics from memory (performance optimization)
    const answeredPlayers = game.playerAnswers.get(question.id);
    const distribution = game.answerDistribution.get(question.id) || {};

    // Update database
    await prisma.gameSession.update({
      where: { gameCode },
      data: { status: "REVEALING" },
    });

    // Cache reveal payload
    game.pendingReveal = {
      correctAnswerIds: correctIds,
      stats: {
        totalAnswered: answeredPlayers?.size || 0,
        answerDistribution: distribution,
      },
    };

    // Notify clients that time is up; reveal will be host-controlled
    this.io.to(`game:${gameCode}`).emit("game:timeUp");

    // Send updated scores (already accounted in submissions)
    const scores = await this.getPlayerScores(gameCode);
    this.io.to(`game:${gameCode}`).emit("game:scoreUpdate", { scores });

    // Send next question preview to host
    this.sendNextQuestionPreview(gameCode);
  }

  private sendNextQuestionPreview(gameCode: string) {
    const game = this.activeGames.get(gameCode);
    if (!game) return;

    const nextIndex = game.currentQuestionIndex + 1;
    // Count only actual questions (not sections)
    const totalQuestions = game.questions.filter(
      (q) => q.questionType !== "SECTION"
    ).length;

    if (nextIndex >= game.questions.length) {
      this.io.to(`game:${gameCode}:host`).emit("game:nextQuestionPreview", null);
      return;
    }

    const nextItem = game.questions[nextIndex];
    let section: QuestionData | null = null;
    let previewQuestion: QuestionData | null = nextItem;
    let previewIndex = nextIndex;

    if (nextItem.questionType === "SECTION") {
      section = nextItem;
      previewQuestion = null;
    }

    const questionNumber = previewQuestion
      ? game.questions
          .slice(0, previewIndex + 1)
          .filter((q) => q.questionType !== "SECTION").length
      : null;

    this.io.to(`game:${gameCode}:host`).emit("game:nextQuestionPreview", {
      section,
      question: previewQuestion,
      questionNumber,
      totalQuestions,
    });
  }

  private async handleShowScoreboard(
    socket: TypedSocket,
    data: { gameCode: string }
  ) {
    const upperCode = data.gameCode.toUpperCase();
    const game = this.activeGames.get(upperCode);
    if (!game) return;
    if (game.pendingReveal) {
      socket.emit("error", { message: "Reveal answers before showing the scoreboard", code: "REVEAL_REQUIRED" });
      return;
    }

    game.status = "SCOREBOARD";

    await prisma.gameSession.update({
      where: { gameCode: upperCode },
      data: { status: "SCOREBOARD" },
    });

    const scores = await this.getPlayerScores(upperCode);
    const isLastQuestion = game.currentQuestionIndex >= game.questions.length - 1;

    this.io.to(`game:${upperCode}`).emit("game:showScoreboard", {
      scores,
      phase: isLastQuestion ? "final" : "mid",
    });

    // Update previous positions for next round
    for (const score of scores) {
      game.previousPositions.set(score.playerId, score.position);
    }
  }

  private async handleEndGame(socket: TypedSocket, data: { gameCode: string }) {
    await this.endGame(data.gameCode.toUpperCase());
  }

  private async endGame(gameCode: string) {
    const game = this.activeGames.get(gameCode);
    if (!game) return;

    // Clear timer
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
    }

    game.status = "FINISHED";

    await prisma.gameSession.update({
      where: { gameCode },
      data: { status: "FINISHED", endedAt: new Date() },
    });

    const scores = await this.getPlayerScores(gameCode);
    const winners = scores.slice(0, 3).map((s) => ({
      id: s.playerId,
      name: s.name,
      avatarColor: s.avatarColor,
      avatarEmoji: s.avatarEmoji,
      score: s.score,
      isActive: true,
    }));

    this.io.to(`game:${gameCode}`).emit("game:finished", {
      finalScores: scores,
      winners,
    });

    // Start certificate generation in background
    this.startCertificateGeneration(gameCode);

    // Clean up
    this.activeGames.delete(gameCode);
    this.playerViewStates.delete(gameCode);
  }

  /**
   * Start background certificate generation
   */
  private async startCertificateGeneration(gameCode: string) {
    try {
      // Import dynamically to avoid circular dependencies
      const { CertificateService } = await import("@/lib/certificate-service");

      // Generate certificates with progress updates
      const result = await CertificateService.generateAllCertificates({
        gameCode,
        onProgress: (data) => {
          // Emit progress to clients
          this.io.to(`game:${gameCode}`).emit("certificates:progress", data);
        },
      });

      // Check if any failed after auto-retry
      if (result.failed > 0) {
        this.io.to(`game:${gameCode}`).emit("certificates:failed", {
          failedCount: result.failed,
          certificateIds: result.failedCertificates,
        });
      }

      // Emit completion event
      this.io.to(`game:${gameCode}`).emit("certificates:ready");
    } catch (error) {
      console.error("Certificate generation error:", error);
      this.io.to(`game:${gameCode}`).emit("certificates:error", {
        message: "Failed to generate certificates",
      });
    }
  }

  private async handleCancelGame(socket: TypedSocket, data: { gameCode: string }) {
    const upperCode = data.gameCode.toUpperCase();
    console.log(`Received cancel game request for ${upperCode}`);

    try {
      // Find the game session
      const gameSession = await prisma.gameSession.findUnique({
        where: { gameCode: upperCode },
      });

      if (!gameSession) {
        socket.emit("error", { message: "Game not found", code: "GAME_NOT_FOUND" });
        return;
      }

      // Only allow cancelling if game is in WAITING status
      if (gameSession.status !== "WAITING") {
        socket.emit("error", { message: "Can only cancel games that haven't started", code: "GAME_STARTED" });
        return;
      }

      // Delete all players first (due to foreign key constraints)
      await prisma.player.deleteMany({
        where: { gameSessionId: gameSession.id },
      });

      // Delete the game session
      await prisma.gameSession.delete({
        where: { gameCode: upperCode },
      });

      // Notify all clients that the game was cancelled
      this.io.to(`game:${upperCode}`).emit("game:cancelled");

      // Clean up any active game state
      this.activeGames.delete(upperCode);
      this.playerViewStates.delete(upperCode);

      console.log(`Game ${upperCode} cancelled by host`);
    } catch (error) {
      console.error("Error cancelling game:", error);
      socket.emit("error", { message: "Failed to cancel game", code: "CANCEL_FAILED" });
    }
  }

  private async handleDisconnect(socket: TypedSocket) {
    const playerId = (socket as unknown as { playerId: string }).playerId;
    const gameCode = (socket as unknown as { gameCode: string }).gameCode;

    if (playerId && gameCode) {
      // Mark player as inactive
      await prisma.player.update({
        where: { id: playerId },
        data: { isActive: false, socketId: null },
      });

      this.io.to(`game:${gameCode}`).emit("game:playerLeft", { playerId });
      this.removePlayerViewState(gameCode, playerId);
    }

    console.log(`Client disconnected: ${socket.id}`);
  }

  private async handleRemovePlayer(
    socket: TypedSocket,
    data: { gameCode: string; playerId: string }
  ) {
    const { gameCode, playerId } = data;
    const upperCode = gameCode.toUpperCase();

    try {
      // Validate game and player exist
      const gameSession = await prisma.gameSession.findUnique({
        where: { gameCode: upperCode },
      });

      if (!gameSession) {
        socket.emit("error", { message: "Game not found", code: "GAME_NOT_FOUND" });
        return;
      }

      const player = await prisma.player.findUnique({ where: { id: playerId } });

      if (!player || player.gameSessionId !== gameSession.id) {
        socket.emit("error", { message: "Player not found", code: "PLAYER_NOT_FOUND" });
        return;
      }

      if (player.admissionStatus === "pending") {
        socket.emit("error", { message: "Player already pending admission", code: "ALREADY_PENDING" });
        return;
      }

      // Set player to pending admission status
      await prisma.player.update({
        where: { id: playerId },
        data: {
          admissionStatus: "pending",
          isActive: false,
          removedAt: new Date(),
        },
      });

      // Notify the removed player if connected
      if (player.socketId) {
        const playerSocket = this.io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.emit("player:removed", {
            reason: "You have been removed from the game by the host."
          });
          playerSocket.leave(`game:${upperCode}`);
          playerSocket.leave(`game:${upperCode}:players`);
        }
      }

      // Notify all clients
      this.io.to(`game:${upperCode}`).emit("game:playerRemoved", { playerId });
      this.removePlayerViewState(upperCode, playerId);

      console.log(`[RemovePlayer] Player ${player.name} (${playerId}) removed from game ${upperCode}`);
    } catch (error) {
      console.error("Error removing player:", error);
      socket.emit("error", { message: "Failed to remove player", code: "REMOVE_FAILED" });
    }
  }

  private async handleAdmitPlayer(
    socket: TypedSocket,
    data: { gameCode: string; playerId: string }
  ) {
    const { gameCode, playerId } = data;
    const upperCode = gameCode.toUpperCase();

    try {
      // Update player to admitted status
      const player = await prisma.player.update({
        where: { id: playerId },
        data: {
          admissionStatus: "admitted",
          isActive: true,
        },
      });

      // Add player to game rooms if they have a socket
      if (player.socketId) {
        const playerSocket = this.io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.join(`game:${upperCode}`);
          playerSocket.join(`game:${upperCode}:players`);

          // Notify the player they're admitted
          playerSocket.emit("player:admissionStatus", { status: "admitted" });

          // Send quiz preload data
          await this.sendQuizPreloadData(playerSocket, upperCode, player.id);
        }
      }

      // Broadcast player joined to all clients
      const playerInfo: PlayerInfo = {
        id: player.id,
        name: player.name,
        avatarColor: player.avatarColor || "#8A2CF6",
        avatarEmoji: player.avatarEmoji,
        score: player.totalScore,
        isActive: true,
        admissionStatus: "admitted",
      };

      this.io.to(`game:${upperCode}`).emit("game:playerJoined", { player: playerInfo });

      console.log(`[AdmitPlayer] Player ${player.name} (${playerId}) admitted to game ${upperCode}`);
    } catch (error) {
      console.error("Error admitting player:", error);
      socket.emit("error", { message: "Failed to admit player", code: "ADMIT_FAILED" });
    }
  }

  private async handleRefusePlayer(
    socket: TypedSocket,
    data: { gameCode: string; playerId: string }
  ) {
    const { gameCode, playerId } = data;
    const upperCode = gameCode.toUpperCase();

    try {
      // Update player to refused status
      const player = await prisma.player.update({
        where: { id: playerId },
        data: {
          admissionStatus: "refused",
          isActive: false,
        },
      });

      // Notify the player they're refused
      if (player.socketId) {
        const playerSocket = this.io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.emit("player:admissionStatus", { status: "refused" });

          // Remove from game rooms
          playerSocket.leave(`game:${upperCode}`);
          playerSocket.leave(`game:${upperCode}:players`);
        }
      }

      console.log(`[RefusePlayer] Player ${player.name} (${playerId}) refused admission to game ${upperCode}`);
    } catch (error) {
      console.error("Error refusing player:", error);
      socket.emit("error", { message: "Failed to refuse player", code: "REFUSE_FAILED" });
    }
  }

  private async handleToggleAutoAdmit(
    socket: TypedSocket,
    data: { gameCode: string; autoAdmit: boolean }
  ) {
    const { gameCode, autoAdmit } = data;
    const upperCode = gameCode.toUpperCase();

    try {
      // Update game session
      await prisma.gameSession.update({
        where: { gameCode: upperCode },
        data: { autoAdmit },
      });

      // Broadcast updated game state to all clients
      const state = await this.getGameState(upperCode);
      if (state) {
        this.io.to(`game:${upperCode}`).emit("game:state", state);
      }

      console.log(`[ToggleAutoAdmit] Game ${upperCode} autoAdmit set to ${autoAdmit}`);
    } catch (error) {
      console.error("Error toggling auto-admit:", error);
      socket.emit("error", { message: "Failed to toggle auto-admit", code: "TOGGLE_FAILED" });
    }
  }

  private async getGameState(gameCode: string): Promise<GameState | null> {
    const gameSession = await prisma.gameSession.findUnique({
      where: { gameCode },
      include: {
        quiz: {
          include: {
            questions: {
              select: { id: true, questionType: true },
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        players: {
          where: {
            isActive: true,
            admissionStatus: "admitted",
          },
          orderBy: { totalScore: "desc" },
        },
      },
    });

    if (!gameSession) return null;

    const activeGame = this.activeGames.get(gameCode);

    // Count only actual questions (not sections)
    const totalQuestions = gameSession.quiz.questions.filter(
      (q) => q.questionType !== "SECTION"
    ).length;

    // Calculate the current question number (excluding sections)
    const currentQuestionNumber = gameSession.currentQuestionIndex >= 0
      ? gameSession.quiz.questions
          .slice(0, gameSession.currentQuestionIndex + 1)
          .filter((q) => q.questionType !== "SECTION").length
      : 0;

    // Parse theme if present
    const quizTheme = parseTheme(gameSession.quiz.theme);

    return {
      gameCode: gameSession.gameCode,
      status: gameSession.status as GameStatus,
      quizTitle: gameSession.quiz.title,
      quizTheme,
      currentQuestionIndex: gameSession.currentQuestionIndex,
      currentQuestionNumber,
      totalQuestions,
      autoAdmit: gameSession.autoAdmit,
      players: gameSession.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatarColor: p.avatarColor || "#8A2CF6",
        avatarEmoji: p.avatarEmoji,
        score: p.totalScore,
        isActive: p.isActive,
        admissionStatus: p.admissionStatus as "admitted" | "pending" | "refused",
        languageCode: (p.languageCode as LanguageCode) || "en",
      })),
      currentQuestion: activeGame?.questions[activeGame.currentQuestionIndex] || null,
      timeRemaining: activeGame?.questionStartedAt
        ? Math.max(
            0,
            activeGame.questions[activeGame.currentQuestionIndex]?.timeLimit -
              Math.floor((Date.now() - activeGame.questionStartedAt) / 1000)
          )
        : undefined,
      powerUps: {
        hintCount: gameSession.quiz.hintCount,
        copyAnswerCount: gameSession.quiz.copyAnswerCount,
        doublePointsCount: gameSession.quiz.doublePointsCount,
      },
    };
  }

  private async getPlayerScores(gameCode: string): Promise<PlayerScore[]> {
    const game = this.activeGames.get(gameCode);
    const players = await prisma.player.findMany({
      where: {
        gameSession: { gameCode },
        isActive: true,
        admissionStatus: "admitted",
      },
      orderBy: { totalScore: "desc" },
    });

    // Fetch power-up usage for all players
    const playerIds = players.map(p => p.id);
    const powerUpUsages = await prisma.powerUpUsage.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: {
        question: {
          select: { orderIndex: true },
        },
      },
    });

    // Group power-ups by player
    const powerUpsByPlayer = new Map<string, Array<{ powerUpType: PowerUpType; questionNumber: number }>>();
    for (const usage of powerUpUsages) {
      const existing = powerUpsByPlayer.get(usage.playerId) || [];
      powerUpsByPlayer.set(usage.playerId, [...existing, {
        powerUpType: usage.powerUpType as PowerUpType,
        questionNumber: usage.question.orderIndex + 1,
      }]);
    }

    return players.map((p, index) => {
      const previousPosition = game?.previousPositions.get(p.id) || index + 1;
      return {
        playerId: p.id,
        name: p.name,
        avatarColor: p.avatarColor || "#8A2CF6",
        avatarEmoji: p.avatarEmoji,
        languageCode: (p.languageCode as LanguageCode) || "en",
        score: p.totalScore,
        position: index + 1,
        change: previousPosition - (index + 1),
        powerUpsUsed: powerUpsByPlayer.get(p.id) || [],
      };
    });
  }

  private async sendQuizPreloadData(socket: TypedSocket, gameCode: string, playerId: string) {
    try {
      console.log(`[Preload] Sending quiz data to player ${playerId} in game ${gameCode}`);
      const gameSession = await prisma.gameSession.findUnique({
        where: { gameCode },
        include: {
          quiz: {
            include: {
              questions: {
                include: {
                  answers: {
                    include: {
                      translations: true,
                    },
                    orderBy: { orderIndex: "asc" },
                  },
                  translations: true,
                },
                orderBy: { orderIndex: "asc" },
              },
            },
          },
        },
      });

      if (!gameSession) {
        console.log(`[Preload] Game session not found for ${gameCode}`);
        return;
      }

      // Get active game to determine which questions to send
      const activeGame = this.activeGames.get(gameCode);
      const startIndex = activeGame?.currentQuestionIndex || 0;

      // Get questions (all if waiting, or remaining if mid-game)
      const allQuestions = gameSession.quiz.questions;
      const questionsToSend = activeGame ? allQuestions.slice(startIndex) : allQuestions;

      // Convert questions to QuestionDataWithTranslations format (without correct answer info)
      const questions: QuestionDataWithTranslations[] = questionsToSend.map((q) => {
        // Build question translations object
        const questionTranslations: Record<LanguageCode, any> = {} as any;
        q.translations.forEach((t) => {
          questionTranslations[t.languageCode as LanguageCode] = {
            questionText: t.questionText,
            hostNotes: t.hostNotes,
            hint: t.hint,
            easterEggButtonText: t.easterEggButtonText,
          };
        });

        // Build answers with translations
        const answers = q.answers.map((a) => {
          const answerTranslations: Record<LanguageCode, any> = {} as any;
          a.translations.forEach((t) => {
            answerTranslations[t.languageCode as LanguageCode] = {
              answerText: t.answerText,
            };
          });

          return {
            id: a.id,
            answerText: a.answerText,
            imageUrl: a.imageUrl,
            translations: Object.keys(answerTranslations).length > 0 ? answerTranslations : undefined,
          };
        });

        return {
          id: q.id,
          questionText: q.questionText,
          imageUrl: q.imageUrl,
          hostNotes: q.hostNotes,
          hint: q.hint,
          questionType: q.questionType as "SINGLE_SELECT" | "MULTI_SELECT" | "SECTION",
          timeLimit: q.timeLimit,
          points: q.points,
          answers,
          easterEggEnabled: q.easterEggEnabled,
          easterEggButtonText: q.easterEggButtonText,
          easterEggUrl: q.easterEggUrl,
          easterEggDisablesScoring: q.easterEggDisablesScoring,
          translations: Object.keys(questionTranslations).length > 0 ? questionTranslations : undefined,
        };
      });

      // Determine available languages (languages with at least some translations)
      // Always include English as base language
      const availableLanguages = new Set<LanguageCode>(["en"]);
      questions.forEach((q) => {
        if (q.translations) {
          Object.keys(q.translations).forEach((lang) => {
            availableLanguages.add(lang as LanguageCode);
          });
        }
        q.answers.forEach((a) => {
          if (a.translations) {
            Object.keys(a.translations).forEach((lang) => {
              availableLanguages.add(lang as LanguageCode);
            });
          }
        });
      });

      // Extract all unique image URLs
      const imageUrls: string[] = [];
      questions.forEach((q) => {
        if (q.imageUrl) imageUrls.push(q.imageUrl);
        q.answers.forEach((a) => {
          if (a.imageUrl) imageUrls.push(a.imageUrl);
        });
      });

      // Parse theme
      let theme: QuizTheme | null = null;
      if (gameSession.quiz.theme) {
        theme = parseTheme(gameSession.quiz.theme);
      }

      // Send preload data
      const preloadData: QuizPreloadData = {
        quizTitle: gameSession.quiz.title,
        totalQuestions: allQuestions.filter((q) => q.questionType !== "SECTION").length,
        questions,
        theme,
        imageUrls: Array.from(new Set(imageUrls)), // Remove duplicates
        startIndex,
        availableLanguages: Array.from(availableLanguages),
      };
      console.log(`[Preload] Emitting quiz data: ${questions.length} questions, ${preloadData.imageUrls.length} images, ${preloadData.availableLanguages.length} languages`);
      socket.emit("game:quizDataPreload", preloadData);
    } catch (error) {
      console.error("Error sending quiz preload data:", error);
    }
  }

  private handlePreloadProgress(
    socket: TypedSocket,
    data: {
      gameCode: string;
      playerId: string;
      percentage: number;
      loadedAssets: number;
      totalAssets: number;
      status: 'idle' | 'loading' | 'complete' | 'error';
    }
  ) {
    const { gameCode, playerId, percentage, status } = data;
    const upperCode = gameCode.toUpperCase();

    console.log(`[Preload] Received progress from ${playerId}: ${percentage}% (${status})`);

    // Broadcast progress update to all clients in game room
    this.io.to(`game:${upperCode}`).emit("game:playerPreloadUpdate", {
      playerId,
      percentage,
      status,
    });
  }

  private async handlePlayerLanguageUpdate(
    socket: TypedSocket,
    data: { gameCode: string; languageCode: LanguageCode }
  ) {
    try {
      const { gameCode, languageCode } = data;
      const upperCode = gameCode.toUpperCase();
      const playerId = (socket as unknown as { playerId?: string }).playerId;
      if (!playerId) {
        console.warn("[LanguageUpdate] No playerId on socket, ignoring");
        return;
      }

      const updated = await prisma.player.update({
        where: { id: playerId },
        data: { languageCode },
      });

      const playerInfo: PlayerInfo = {
        id: updated.id,
        name: updated.name,
        avatarColor: updated.avatarColor || "#8A2CF6",
        avatarEmoji: updated.avatarEmoji,
        score: updated.totalScore,
        isActive: updated.isActive,
        admissionStatus: updated.admissionStatus as "admitted" | "pending" | "refused",
        languageCode: updated.languageCode as LanguageCode,
      };

      // Notify host and players about the updated language
      this.io.to(`game:${upperCode}:host`).emit("game:playerJoined", { player: playerInfo });
      this.io.to(`game:${upperCode}`).emit("game:playerJoined", { player: playerInfo });

      // Update monitor view with latest language
      const existingView = this.playerViewStates.get(upperCode)?.get(playerId);
      this.storePlayerViewState(upperCode, playerId, {
        ...(existingView || { stage: "waiting", playerName: updated.name, playerId }),
        languageCode,
      });
    } catch (error) {
      console.error("Failed to update player language:", error);
    }
  }

  private handlePlayerViewUpdate(
    socket: TypedSocket,
    data: { gameCode: string; playerId: string; viewState: PlayerViewState }
  ) {
    const { gameCode, playerId, viewState } = data;
    const resolvedGameCode = (gameCode || (socket as any).gameCode || "").toUpperCase();
    const resolvedPlayerId = playerId || (socket as any).playerId;

    if (!resolvedGameCode || !resolvedPlayerId) {
      console.warn("[PlayerView] Missing gameCode or playerId, skipping update");
      return;
    }

    this.storePlayerViewState(resolvedGameCode, resolvedPlayerId, viewState);
  }

  private handleHostRequestPlayerViews(
    socket: TypedSocket,
    data: { gameCode: string }
  ) {
    const upperCode = data.gameCode.toUpperCase();
    const views = this.playerViewStates.get(upperCode);
    const payload: Record<string, PlayerViewState> = {};

    if (views) {
      views.forEach((view, playerId) => {
        payload[playerId] = view;
      });
    }

    socket.emit("monitor:playerViewSnapshot", { views: payload });
  }

  private storePlayerViewState(gameCode: string, playerId: string, viewState: PlayerViewState) {
    const map = this.playerViewStates.get(gameCode) ?? new Map<string, PlayerViewState>();
    const normalized: PlayerViewState = { ...viewState, playerId };
    map.set(playerId, normalized);
    this.playerViewStates.set(gameCode, map);

    this.io.to(`game:${gameCode}:host`).emit("monitor:playerViewUpdate", {
      playerId,
      viewState: normalized,
    });
  }

  private removePlayerViewState(gameCode: string, playerId: string) {
    const map = this.playerViewStates.get(gameCode);
    if (!map) return;

    if (map.delete(playerId)) {
      this.io.to(`game:${gameCode}:host`).emit("monitor:playerViewRemove", { playerId });
    }

    if (map.size === 0) {
      this.playerViewStates.delete(gameCode);
    }
  }

  private async handleEasterEggClick(
    socket: TypedSocket,
    data: { gameCode: string; questionId: string }
  ) {
    const { gameCode, questionId } = data;
    const upperCode = gameCode.toUpperCase();
    const game = this.activeGames.get(upperCode);

    if (!game || game.status !== "QUESTION") return;

    const playerId = (socket as any).playerId;
    if (!playerId) return;

    try {
      // Check for duplicate
      const existing = await prisma.easterEggClick.findUnique({
        where: {
          playerId_questionId: {
            playerId,
            questionId,
          },
        },
      });

      if (existing) {
        console.log(`[EasterEgg] Player ${playerId} already clicked for question ${questionId}`);
        return;
      }

      // Record click
      await prisma.easterEggClick.create({
        data: {
          playerId,
          questionId,
        },
      });

      // Get player details
      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (player) {
        const clickDetail: EasterEggClickDetail = {
          playerId,
          playerName: player.name,
          avatarColor: player.avatarColor || "#8A2CF6",
          avatarEmoji: player.avatarEmoji,
          clickedAt: Date.now(),
        };

        // Notify host only
        this.io.to(`game:${upperCode}:host`).emit("game:easterEggClick", {
          questionId,
          click: clickDetail,
        });

        console.log(`[EasterEgg] Player ${player.name} clicked easter egg for question ${questionId}`);
      }
    } catch (error) {
      console.error("Error handling easter egg click:", error);
    }
  }

  private async handlePowerUpUsage(
    socket: TypedSocket,
    data: {
      gameCode: string;
      questionId: string;
      powerUpType: PowerUpType;
      copiedPlayerId?: string;
    }
  ) {
    const { gameCode, questionId, powerUpType, copiedPlayerId } = data;
    const upperCode = gameCode.toUpperCase();
    const game = this.activeGames.get(upperCode);

    if (!game || game.status !== "QUESTION") return;

    const playerId = (socket as any).playerId;
    if (!playerId) return;

    try {
      // Record power-up usage
      await prisma.powerUpUsage.create({
        data: {
          playerId,
          questionId,
          powerUpType,
          copiedPlayerId: powerUpType === "copy" ? copiedPlayerId : null,
        },
      });

      // Notify host
      this.io.to(`game:${upperCode}:host`).emit("game:powerUpUsed", {
        playerId,
        questionId,
        powerUpType,
      });

      console.log(`[PowerUp] Player ${playerId} used ${powerUpType} power-up for question ${questionId}`);
    } catch (error) {
      console.error("Error handling power-up usage:", error);
    }
  }
}
