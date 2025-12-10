import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GameListItem } from "@/types/admin";
import { formatDistanceToNow } from "date-fns";

interface GameCardProps {
  game: GameListItem;
  onClick: () => void;
}

export const GameCard = React.memo(function GameCard({ game, onClick }: GameCardProps) {
  const isRunning = game.status !== "FINISHED";
  const dateDisplay = game.endedAt
    ? formatDistanceToNow(new Date(game.endedAt), { addSuffix: true })
    : formatDistanceToNow(new Date(game.createdAt), { addSuffix: true });

  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg truncate flex-1">
            {game.quiz.title}
          </CardTitle>
          {isRunning && (
            <Badge variant="default" className="ml-2">
              Live
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <code className="font-mono">{game.gameCode}</code>
          <span>•</span>
          <span>{game.playerCount} players</span>
        </div>
        <p className="text-xs text-muted-foreground">{dateDisplay}</p>
      </CardHeader>

      {game.topPlayers.length > 0 && (
        <CardContent>
          <div className="flex items-center gap-2">
            {game.topPlayers.map((player, idx) => (
              <div key={player.id} className="flex items-center gap-1">
                <Avatar className="w-6 h-6">
                  <AvatarFallback
                    style={{ backgroundColor: player.avatarColor }}
                    className="text-xs"
                  >
                    {player.avatarEmoji || player.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                  {player.totalScore}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if game data actually changed
  return (
    prevProps.game.id === nextProps.game.id &&
    prevProps.game.status === nextProps.game.status &&
    prevProps.game.playerCount === nextProps.game.playerCount &&
    prevProps.game.topPlayers.length === nextProps.game.topPlayers.length
  );
});
