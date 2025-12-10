import { prisma } from "@/lib/db";
import { ImageResponse } from "@vercel/og";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  generateHostCertificate,
  generatePlayerCertificate,
} from "@/lib/certificate-generator";
import {
  generateCongratulatoryMessage,
  getFallbackMessage,
} from "@/lib/openai-congratulations";
import { DEFAULT_THEME } from "@/types/theme";
import { PlayerScore } from "@/types";

interface GenerateCertificatesOptions {
  gameCode: string;
  onProgress?: (data: {
    completed: number;
    total: number;
    percentage: number;
    estimatedSecondsRemaining: number;
  }) => void;
}

interface CertificateGenerationResult {
  certificateId: string;
  success: boolean;
  error?: string;
}

/**
 * Certificate Service
 * Handles all certificate generation, storage, and management operations
 */
export class CertificateService {
  /**
   * Main entry point: generates all certificates for a game
   * Called from endGame() in game-manager.ts
   */
  static async generateAllCertificates(
    options: GenerateCertificatesOptions
  ): Promise<{ success: number; failed: number; failedCertificates: string[] }> {
    const { gameCode, onProgress } = options;

    // Fetch game data
    const gameData = await prisma.gameSession.findUnique({
      where: { gameCode: gameCode.toUpperCase() },
      include: {
        quiz: { select: { title: true, theme: true } },
        players: {
          where: {
            isActive: true,
            admissionStatus: "admitted",
          },
          orderBy: { totalScore: "desc" },
          include: {
            powerUpUsages: {
              include: {
                question: { select: { orderIndex: true } },
              },
            },
          },
        },
      },
    });

    if (!gameData) {
      throw new Error(`Game ${gameCode} not found`);
    }

    // Create certificate directory
    const certDir = this.getCertificateDirectory(gameCode);
    if (!existsSync(certDir)) {
      await mkdir(certDir, { recursive: true });
    }

    // Create certificate records in database (all pending)
    const certificateIds: string[] = [];

    // 1. Host certificate
    const hostCert = await prisma.certificate.create({
      data: {
        gameSessionId: gameData.id,
        type: "host",
        status: "pending",
      },
    });
    certificateIds.push(hostCert.id);

    // 2. Player certificates
    for (const player of gameData.players) {
      const playerCert = await prisma.certificate.create({
        data: {
          gameSessionId: gameData.id,
          type: "player",
          playerId: player.id,
          status: "pending",
        },
      });
      certificateIds.push(playerCert.id);
    }

    // Generate certificates in batches (optimized for performance)
    const BATCH_SIZE = 12;
    let completed = 0;
    let failed = 0;
    const failedCertificates: string[] = [];
    const startTime = Date.now();

    for (let i = 0; i < certificateIds.length; i += BATCH_SIZE) {
      const batch = certificateIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((certId) => this.generateCertificate(certId))
      );

      // Count successes and failures
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.success) {
          completed++;
        } else {
          failed++;
          failedCertificates.push(batch[index]);
        }
      });

      // Calculate progress and ETA
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      const rate = (completed + failed) / elapsed; // certificates per second
      const remaining = certificateIds.length - (completed + failed);
      const estimatedSecondsRemaining =
        rate > 0 ? Math.ceil(remaining / rate) : 0;

      onProgress?.({
        completed: completed + failed,
        total: certificateIds.length,
        percentage: Math.round(
          ((completed + failed) / certificateIds.length) * 100
        ),
        estimatedSecondsRemaining,
      });
    }

    return { success: completed, failed, failedCertificates };
  }

  /**
   * Generate a single certificate by ID
   * Private method with auto-retry logic
   */
  private static async generateCertificate(
    certificateId: string
  ): Promise<CertificateGenerationResult> {
    try {
      // Update status to "generating"
      const certificate = await prisma.certificate.update({
        where: { id: certificateId },
        data: { status: "generating" },
        include: {
          gameSession: {
            include: {
              quiz: { select: { title: true, theme: true } },
              players: {
                where: { isActive: true, admissionStatus: "admitted" },
                orderBy: { totalScore: "desc" },
                include: {
                  powerUpUsages: {
                    include: { question: { select: { orderIndex: true } } },
                  },
                },
              },
            },
          },
          player: true,
        },
      });

      // Prepare certificate data
      const { gameSession } = certificate;
      const theme = gameSession.quiz.theme
        ? JSON.parse(gameSession.quiz.theme)
        : DEFAULT_THEME;

      const playerScores: PlayerScore[] = gameSession.players.map(
        (player, index) => ({
          playerId: player.id,
          name: player.name,
          avatarColor: player.avatarColor || "#666",
          avatarEmoji: player.avatarEmoji || undefined,
          languageCode: (player.languageCode as any) || "en",
          score: player.totalScore,
          position: index + 1,
          change: 0,
          powerUpsUsed: player.powerUpUsages.map((usage) => ({
            powerUpType: usage.powerUpType as any,
            questionNumber: usage.question.orderIndex + 1,
          })),
        })
      );

      const certificateData = {
        gameCode: gameSession.gameCode,
        quizTitle: gameSession.quiz.title,
        completedDate: gameSession.endedAt || new Date(),
        theme,
        players: playerScores,
      };

      // Generate certificate JSX
      let certificateJSX: React.ReactElement;
      let aiMessage: string | undefined;

      if (certificate.type === "player" && certificate.player) {
        const player = playerScores.find(
          (p) => p.playerId === certificate.playerId
        );
        if (!player) {
          throw new Error("Player not found in scores");
        }

        // Generate or reuse AI message
        if (certificate.aiMessage) {
          aiMessage = certificate.aiMessage;
        } else {
          try {
            aiMessage = await generateCongratulatoryMessage(
              player.name,
              player.position,
              playerScores.length,
              player.score,
              gameSession.quiz.title
            );
          } catch (error) {
            console.warn("Failed to generate AI message, using fallback:", error);
            aiMessage = getFallbackMessage(
              player.name,
              player.position,
              playerScores.length
            );
          }
        }

        certificateJSX = await generatePlayerCertificate(
          certificateData,
          certificate.playerId!,
          aiMessage
        );
      } else {
        certificateJSX = await generateHostCertificate(certificateData);
      }

      // Convert to image
      const imageResponse = new ImageResponse(certificateJSX, {
        width: 1200,
        height: 1600,
      });

      const imageBuffer = await imageResponse.arrayBuffer();

      // Save to disk
      const filename =
        certificate.type === "host"
          ? "host-certificate.jpg"
          : `player-${certificate.playerId}.jpg`;
      const filePath = path.join(
        this.getCertificateDirectory(gameSession.gameCode),
        filename
      );

      await writeFile(filePath, Buffer.from(imageBuffer));

      // Update database: success
      const publicPath = `/uploads/certificates/${gameSession.gameCode}/${filename}`;
      await prisma.certificate.update({
        where: { id: certificateId },
        data: {
          status: "completed",
          filePath: publicPath,
          aiMessage,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      return { certificateId, success: true };
    } catch (error) {
      console.error(
        `Certificate generation failed for ${certificateId}:`,
        error
      );

      // Get current retry count
      const certificate = await prisma.certificate.findUnique({
        where: { id: certificateId },
      });

      const newRetryCount = (certificate?.retryCount || 0) + 1;

      // Update database: failed
      await prisma.certificate.update({
        where: { id: certificateId },
        data: {
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          retryCount: newRetryCount,
        },
      });

      // Auto-retry once
      if (newRetryCount === 1) {
        console.log(`Auto-retrying certificate ${certificateId}...`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s
        return this.generateCertificate(certificateId); // Recursive retry
      }

      return {
        certificateId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Regenerate multiple certificates
   * Used by the host regeneration UI
   */
  static async regenerateCertificates(
    certificateIds: string[]
  ): Promise<void> {
    // Reset status and retry count for selected certificates
    await prisma.certificate.updateMany({
      where: { id: { in: certificateIds } },
      data: { status: "pending", errorMessage: null, retryCount: 0 },
    });

    // Generate certificates in batches (optimized for performance)
    const BATCH_SIZE = 12;
    for (let i = 0; i < certificateIds.length; i += BATCH_SIZE) {
      const batch = certificateIds.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((certId) => this.generateCertificate(certId))
      );
    }
  }

  /**
   * Get certificate status for a game
   */
  static async getCertificateStatus(gameCode: string) {
    const certificates = await prisma.certificate.findMany({
      where: {
        gameSession: { gameCode: gameCode.toUpperCase() },
      },
      include: {
        player: { select: { name: true } },
      },
      orderBy: [
        { type: "asc" }, // host first
        { player: { totalScore: "desc" } }, // then by score
      ],
    });

    const summary = {
      total: certificates.length,
      pending: certificates.filter((c) => c.status === "pending").length,
      generating: certificates.filter((c) => c.status === "generating").length,
      completed: certificates.filter((c) => c.status === "completed").length,
      failed: certificates.filter((c) => c.status === "failed").length,
      certificates: certificates.map((cert) => ({
        id: cert.id,
        type: cert.type,
        playerId: cert.playerId,
        playerName: cert.player?.name,
        status: cert.status,
        filePath: cert.filePath,
        errorMessage: cert.errorMessage,
        retryCount: cert.retryCount,
        completedAt: cert.completedAt,
      })),
    };

    return summary;
  }

  /**
   * Get certificate directory path
   */
  private static getCertificateDirectory(gameCode: string): string {
    return path.join(
      process.cwd(),
      "public",
      "uploads",
      "certificates",
      gameCode.toUpperCase()
    );
  }
}
