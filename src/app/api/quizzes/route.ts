import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedQuizList, setCachedQuizList, invalidateQuizListCache } from "@/lib/cache";

// GET /api/quizzes - List all quizzes
export async function GET() {
  try {
    // Check cache first
    const cached = getCachedQuizList();
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
          'X-Cache': 'HIT' // Helpful for debugging
        }
      });
    }


    // Fetch quizzes with question counts only (no translation data)
    const quizzes = await prisma.quiz.findMany({
      where: { isActive: true },
      include: {
        questions: {
          select: {
            id: true,
            questionType: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get all quiz IDs for translation query
    const quizIds = quizzes.map((q) => q.id);

    // Fetch translation languages in a single optimized query
    // This replaces the N+1 query pattern with a single query
    const questionTranslations = await prisma.questionTranslation.findMany({
      where: {
        question: { quizId: { in: quizIds } },
        languageCode: { not: "en" },
      },
      select: {
        languageCode: true,
        question: {
          select: {
            quizId: true,
          },
        },
      },
    });

    const answerTranslations = await prisma.answerTranslation.findMany({
      where: {
        answer: { question: { quizId: { in: quizIds } } },
        languageCode: { not: "en" },
      },
      select: {
        languageCode: true,
        answer: {
          select: {
            question: {
              select: {
                quizId: true,
              },
            },
          },
        },
      },
    });

    // Build a map of quizId -> language codes
    const translationMap = new Map<string, Set<string>>();

    questionTranslations.forEach((t) => {
      const quizId = t.question.quizId;
      if (!translationMap.has(quizId)) {
        translationMap.set(quizId, new Set());
      }
      translationMap.get(quizId)!.add(t.languageCode);
    });

    answerTranslations.forEach((t) => {
      const quizId = t.answer.question.quizId;
      if (!translationMap.has(quizId)) {
        translationMap.set(quizId, new Set());
      }
      translationMap.get(quizId)!.add(t.languageCode);
    });

    // Calculate question counts and merge translation data
    const quizzesWithQuestionCount = quizzes.map((quiz) => {
      const questionCount = quiz.questions.filter(
        (q) => q.questionType !== "SECTION"
      ).length;

      const translationLanguages = Array.from(
        translationMap.get(quiz.id) || new Set<string>()
      ).sort();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { questions, ...rest } = quiz;
      return {
        ...rest,
        questionCount,
        translationLanguages,
      };
    });

    // Cache the result before returning
    setCachedQuizList(quizzesWithQuestionCount);

    return NextResponse.json(quizzesWithQuestionCount, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        'X-Cache': 'MISS' // Helpful for debugging
      }
    });
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}

// POST /api/quizzes - Create a new quiz
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
      },
    });

    // Invalidate quiz list cache after creating new quiz
    invalidateQuizListCache();

    return NextResponse.json(quiz, { status: 201 });
  } catch (error) {
    console.error("Error creating quiz:", error);
    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 }
    );
  }
}
