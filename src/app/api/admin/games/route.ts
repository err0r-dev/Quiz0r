import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build WHERE clause
    const whereClause: any = {
      AND: []
    };

    // Status filter: RUNNING = not FINISHED, FINISHED = FINISHED, ALL = no filter
    if (status === "RUNNING") {
      whereClause.AND.push({ status: { not: "FINISHED" } });
    } else if (status === "FINISHED") {
      whereClause.AND.push({ status: "FINISHED" });
    }

    // Search: game code OR quiz title
    if (search) {
      whereClause.AND.push({
        OR: [
          { gameCode: { contains: search.toUpperCase() } },
          { quiz: { title: { contains: search, mode: "insensitive" } } }
        ]
      });
    }

    // Clean up empty AND array
    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    // Fetch games and total count in parallel
    const [games, total] = await Promise.all([
      prisma.gameSession.findMany({
        where: whereClause,
        include: {
          quiz: {
            select: {
              id: true,
              title: true
            }
          },
          players: {
            where: {
              admissionStatus: "admitted"
            },
            orderBy: { totalScore: "desc" },
            take: 3, // Only top 3 for list view
            select: {
              id: true,
              name: true,
              avatarColor: true,
              avatarEmoji: true,
              totalScore: true,
              isActive: true
            }
          },
          _count: {
            select: {
              players: {
                where: {
                  // For finished games, count all admitted players
                  // For running games, this still gives total admitted count
                  admissionStatus: "admitted"
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.gameSession.count({ where: whereClause })
    ]);

    return Response.json({
      games: games.map((game) => ({
        id: game.id,
        gameCode: game.gameCode,
        status: game.status,
        createdAt: game.createdAt.toISOString(),
        endedAt: game.endedAt?.toISOString() || null,
        quiz: game.quiz,
        playerCount: game._count.players,
        // For running games, show active players; for finished games, show top scorers
        topPlayers: game.status === "FINISHED"
          ? game.players
          : game.players.filter(p => p.isActive)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, {
      headers: {
        // Short cache for frequently changing game list
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5'
      }
    });
  } catch (error) {
    console.error("Failed to fetch games:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
