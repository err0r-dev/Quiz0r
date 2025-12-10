"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { GameListItem, GameFilters } from "@/types/admin";
import { GameCard } from "@/components/admin/GameCard";
import { GameSidePanel } from "@/components/admin/GameSidePanel";
import { GamePagination } from "@/components/admin/GamePagination";

export default function GamesPage() {
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [filters, setFilters] = useState<GameFilters>({
    status: "ALL",
    search: "",
    sortBy: "date",
    sortOrder: "desc",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Fetch games when filters or page changes
  useEffect(() => {
    fetchGames();
  }, [filters, pagination.page]);

  async function fetchGames() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filters.status,
        search: filters.search,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const res = await fetch(`/api/admin/games?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGames(data.games);
        setPagination((prev) => ({ ...prev, ...data.pagination }));
      }
    } catch (error) {
      console.error("Failed to fetch games:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleGameDeleted = useCallback((gameId: string) => {
    setSelectedGameId(null);
    setGames((prev) => prev.filter((g) => g.id !== gameId));

    const isLastGameOnPage = games.length === 1 && pagination.page > 1;
    if (isLastGameOnPage) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
      return;
    }

    fetchGames();
  }, [games.length, pagination.page]);

  const handleGameClick = useCallback((gameId: string) => {
    setSelectedGameId(gameId);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Games</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your game sessions
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <Tabs
          value={filters.status}
          onValueChange={(v) =>
            setFilters({ ...filters, status: v as any })
          }
        >
          <TabsList>
            <TabsTrigger value="RUNNING">Running</TabsTrigger>
            <TabsTrigger value="FINISHED">History</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by game code or quiz name..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
      </div>

      {/* Game Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading games...</div>
        </div>
      ) : games.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">No games found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => handleGameClick(game.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && games.length > 0 && (
        <GamePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Side Panel */}
      <GameSidePanel
        gameId={selectedGameId}
        onClose={() => setSelectedGameId(null)}
        onDeleted={handleGameDeleted}
      />
    </div>
  );
}
