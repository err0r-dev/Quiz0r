-- CreateIndex
CREATE INDEX "GameSession_status_createdAt_idx" ON "GameSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Player_gameSessionId_admissionStatus_idx" ON "Player"("gameSessionId", "admissionStatus");

-- CreateIndex
CREATE INDEX "Player_gameSessionId_isActive_idx" ON "Player"("gameSessionId", "isActive");

-- CreateIndex
CREATE INDEX "PlayerAnswer_questionId_playerId_idx" ON "PlayerAnswer"("questionId", "playerId");
