-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT,
    "autoAdmit" BOOLEAN NOT NULL DEFAULT true,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "hintCount" INTEGER NOT NULL DEFAULT 0,
    "copyAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "doublePointsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "hostNotes" TEXT,
    "questionType" TEXT NOT NULL DEFAULT 'SINGLE_SELECT',
    "timeLimit" INTEGER NOT NULL DEFAULT 30,
    "points" INTEGER NOT NULL DEFAULT 100,
    "orderIndex" INTEGER NOT NULL,
    "easterEggEnabled" BOOLEAN NOT NULL DEFAULT false,
    "easterEggButtonText" TEXT,
    "easterEggUrl" TEXT,
    "easterEggDisablesScoring" BOOLEAN NOT NULL DEFAULT false,
    "hint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameCode" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT -1,
    "questionStartedAt" DATETIME,
    "autoAdmit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    CONSTRAINT "GameSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "socketId" TEXT,
    "avatarColor" TEXT,
    "avatarEmoji" TEXT,
    "languageCode" TEXT DEFAULT 'en',
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "admissionStatus" TEXT NOT NULL DEFAULT 'admitted',
    "removedAt" DATETIME,
    CONSTRAINT "Player_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedAnswerIds" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeToAnswer" INTEGER NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerAnswer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EasterEggClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "clickedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EasterEggClick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EasterEggClick_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PowerUpUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "powerUpType" TEXT NOT NULL,
    "copiedPlayerId" TEXT,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PowerUpUsage_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PowerUpUsage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "hostNotes" TEXT,
    "hint" TEXT,
    "easterEggButtonText" TEXT,
    "isAutoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "translatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionTranslation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "isAutoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "translatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnswerTranslation_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameSessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "playerId" TEXT,
    "filePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "aiMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Certificate_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Certificate_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");

-- CreateIndex
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_gameCode_key" ON "GameSession"("gameCode");

-- CreateIndex
CREATE INDEX "GameSession_gameCode_idx" ON "GameSession"("gameCode");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE INDEX "Player_gameSessionId_idx" ON "Player"("gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_gameSessionId_name_key" ON "Player"("gameSessionId", "name");

-- CreateIndex
CREATE INDEX "PlayerAnswer_playerId_idx" ON "PlayerAnswer"("playerId");

-- CreateIndex
CREATE INDEX "PlayerAnswer_questionId_idx" ON "PlayerAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAnswer_playerId_questionId_key" ON "PlayerAnswer"("playerId", "questionId");

-- CreateIndex
CREATE INDEX "EasterEggClick_playerId_idx" ON "EasterEggClick"("playerId");

-- CreateIndex
CREATE INDEX "EasterEggClick_questionId_idx" ON "EasterEggClick"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "EasterEggClick_playerId_questionId_key" ON "EasterEggClick"("playerId", "questionId");

-- CreateIndex
CREATE INDEX "PowerUpUsage_playerId_idx" ON "PowerUpUsage"("playerId");

-- CreateIndex
CREATE INDEX "PowerUpUsage_questionId_idx" ON "PowerUpUsage"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PowerUpUsage_playerId_questionId_powerUpType_key" ON "PowerUpUsage"("playerId", "questionId", "powerUpType");

-- CreateIndex
CREATE INDEX "QuestionTranslation_questionId_idx" ON "QuestionTranslation"("questionId");

-- CreateIndex
CREATE INDEX "QuestionTranslation_languageCode_idx" ON "QuestionTranslation"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTranslation_questionId_languageCode_key" ON "QuestionTranslation"("questionId", "languageCode");

-- CreateIndex
CREATE INDEX "AnswerTranslation_answerId_idx" ON "AnswerTranslation"("answerId");

-- CreateIndex
CREATE INDEX "AnswerTranslation_languageCode_idx" ON "AnswerTranslation"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerTranslation_answerId_languageCode_key" ON "AnswerTranslation"("answerId", "languageCode");

-- CreateIndex
CREATE INDEX "Certificate_gameSessionId_idx" ON "Certificate"("gameSessionId");

-- CreateIndex
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_gameSessionId_type_playerId_key" ON "Certificate"("gameSessionId", "type", "playerId");
