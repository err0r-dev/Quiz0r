import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedQuiz, setCachedQuiz, invalidateQuizCache } from "@/lib/cache";

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

// GET /api/quizzes/[quizId] - Get quiz details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { quizId } = await params;

    // Check cache first
    const cached = getCachedQuiz(quizId);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
          'X-Cache': 'HIT'
        }
      });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
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
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Cache the result before returning
    setCachedQuiz(quizId, quiz);

    return NextResponse.json(quiz, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}

// PUT /api/quizzes/[quizId] - Update quiz
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { quizId } = await params;
    const body = await request.json();
    const { title, description } = body;

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
      },
    });

    // Invalidate cache after update
    invalidateQuizCache(quizId);

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 }
    );
  }
}

// PATCH /api/quizzes/[quizId] - Partially update quiz (e.g., autoAdmit, power-ups)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { quizId } = await params;
    const body = await request.json();
    const { autoAdmit, hintCount, copyAnswerCount, doublePointsCount } = body;

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(autoAdmit !== undefined && { autoAdmit }),
        ...(hintCount !== undefined && { hintCount }),
        ...(copyAnswerCount !== undefined && { copyAnswerCount }),
        ...(doublePointsCount !== undefined && { doublePointsCount }),
      },
    });

    // Invalidate cache after update
    invalidateQuizCache(quizId);

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes/[quizId] - Soft delete quiz
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { quizId } = await params;

    await prisma.quiz.update({
      where: { id: quizId },
      data: { isActive: false },
    });

    // Invalidate cache after deletion
    invalidateQuizCache(quizId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    );
  }
}
