/**
 * Quiz Export API
 * Exports a quiz as a ZIP file containing quiz.json and images
 * Uses streaming to reduce memory usage for large exports
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import archiver from "archiver";
import { ExportedQuiz } from "@/types/export";
import { Readable } from "stream";

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { quizId } = await params;

    // 1. Fetch quiz with all relations
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            translations: true,
            answers: {
              include: {
                translations: true,
              },
              orderBy: { orderIndex: "asc" },
            },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // 2. Track image downloads for de-duplication
    const downloadedImages = new Map<string, string>(); // url -> { buffer, ext }

    // 3. Download all images first and store in memory
    const imageBuffers = new Map<string, { buffer: ArrayBuffer; ext: string }>();

    // Process questions and download images
    const exportedQuestions = await Promise.all(
      quiz.questions.map(async (question, qIndex) => {
        let imageRef: string | null = null;

        // Download question image
        if (question.imageUrl) {
          imageRef = await downloadImage(
            question.imageUrl,
            `q_${qIndex}`,
            imageBuffers,
            downloadedImages
          );
        }

        // Process answers
        const exportedAnswers = await Promise.all(
          question.answers.map(async (answer, aIndex) => {
            let answerImageRef: string | null = null;

            if (answer.imageUrl) {
              answerImageRef = await downloadImage(
                answer.imageUrl,
                `a_${qIndex}_${aIndex}`,
                imageBuffers,
                downloadedImages
              );
            }

            return {
              answerText: answer.answerText,
              imageRef: answerImageRef,
              isCorrect: answer.isCorrect,
              orderIndex: answer.orderIndex,
              translations: answer.translations?.map((t) => ({
                languageCode: t.languageCode,
                answerText: t.answerText,
              })) ?? [],
            };
          })
        );

        return {
          questionText: question.questionText,
          imageRef,
          hostNotes: question.hostNotes,
          questionType: question.questionType as "SINGLE_SELECT" | "MULTI_SELECT" | "SECTION",
          timeLimit: question.timeLimit,
          points: question.points,
          orderIndex: question.orderIndex,
          hint: question.hint,
          easterEggEnabled: question.easterEggEnabled,
          easterEggButtonText: question.easterEggButtonText,
          easterEggUrl: question.easterEggUrl,
          easterEggDisablesScoring: question.easterEggDisablesScoring,
          translations: question.translations?.map((t) => ({
            languageCode: t.languageCode,
            questionText: t.questionText,
            hostNotes: t.hostNotes,
            hint: t.hint,
            easterEggButtonText: t.easterEggButtonText,
          })) ?? [],
          answers: exportedAnswers,
        };
      })
    );

    // 4. Create quiz.json
    const exportData: ExportedQuiz = {
      exportVersion: "1.1",
      exportedAt: new Date().toISOString(),
      title: quiz.title,
      description: quiz.description,
      theme: quiz.theme,
      autoAdmit: quiz.autoAdmit,
      powerUps: {
        hintCount: quiz.hintCount,
        copyAnswerCount: quiz.copyAnswerCount,
        doublePointsCount: quiz.doublePointsCount,
      },
      questions: exportedQuestions,
    };

    // 5. Create streaming ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 6 },
    });

    // Handle archiver errors
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      throw err;
    });

    // Add quiz.json to archive
    archive.append(JSON.stringify(exportData, null, 2), { name: "quiz.json" });

    // Add all downloaded images to archive
    Array.from(imageBuffers.entries()).forEach(([filename, { buffer, ext }]) => {
      archive.append(Buffer.from(buffer), { name: `images/${filename}.${ext}` });
    });

    // Finalize archive (no more files will be added)
    archive.finalize();

    // Convert Node.js Readable stream to Web ReadableStream
    const webStream = Readable.toWeb(archive as unknown as Readable) as ReadableStream;

    // 6. Return streaming response
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(quiz.title)}.zip"`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export quiz" },
      { status: 500 }
    );
  }
}

// Helper: Download image and store in buffer map
async function downloadImage(
  url: string,
  baseName: string,
  imageBuffers: Map<string, { buffer: ArrayBuffer; ext: string }>,
  cache: Map<string, string>
): Promise<string | null> {
  // Check cache for de-duplication
  if (cache.has(url)) {
    return cache.get(url)!;
  }

  try {
    // Handle relative URLs (uploaded images)
    const absoluteUrl = url.startsWith("http")
      ? url
      : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${url}`;

    // Check image size before downloading to prevent memory exhaustion
    const headResponse = await fetch(absoluteUrl, {
      method: "HEAD",
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!headResponse.ok) {
      console.warn(`Failed to check image size: ${url}`);
      return null;
    }

    const contentLength = headResponse.headers.get("content-length");
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const maxSizeInBytes = 10 * 1024 * 1024; // 10MB limit

      if (sizeInBytes > maxSizeInBytes) {
        console.warn(
          `Image too large (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB > 10MB): ${url}`
        );
        return null;
      }
    }

    const response = await fetch(absoluteUrl, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to download image: ${url}`);
      return null;
    }

    const buffer = await response.arrayBuffer();

    // Detect extension from Content-Type or URL
    const contentType = response.headers.get("content-type") || "";
    const ext = getExtensionFromContentType(contentType) || getExtensionFromUrl(url) || "jpg";

    const filename = baseName;
    const ref = `images/${filename}.${ext}`;

    // Store buffer and extension for later streaming
    imageBuffers.set(filename, { buffer, ext });
    cache.set(url, ref);

    return ref;
  } catch (error) {
    console.warn(`Error downloading image ${url}:`, error);
    return null;
  }
}

// Helper: Get file extension from content-type
function getExtensionFromContentType(contentType: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[contentType.split(";")[0].trim()] || null;
}

// Helper: Get extension from URL
function getExtensionFromUrl(url: string): string | null {
  const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : null;
}

// Helper: Sanitize filename for safe download
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9_\-]/gi, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
}
