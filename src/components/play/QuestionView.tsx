"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlarmClock,
  Check,
  X,
  Zap,
  Lightbulb,
  Users,
  Sparkles,
  Loader2,
  Globe,
  ChevronUp,
} from "lucide-react";
import { ThemeProvider, getAnswerColor, getSelectedAnswerStyle } from "@/components/theme/ThemeProvider";
import { PowerUpType, SupportedLanguages, type LanguageCode } from "@/types";
import { BORDER_RADIUS_MAP, SHADOW_MAP } from "@/types/theme";
import { getContrastingTextColor } from "@/lib/color-utils";

// Dynamic import
const BackgroundEffects = dynamic(
  () => import("@/components/theme/BackgroundEffects").then(mod => ({ default: mod.BackgroundEffects })),
  { ssr: false }
);

interface Answer {
  id: string;
  answerText: string;
  imageUrl?: string | null;
  translations?: Array<{ languageCode: string; answerText: string }>;
}

interface Question {
  id: string;
  questionText: string;
  imageUrl?: string | null;
  questionType: "SINGLE_SELECT" | "MULTI_SELECT";
  timeLimit: number;
  hint?: string | null;
  easterEggEnabled?: boolean;
  easterEggButtonText?: string | null;
  easterEggUrl?: string | null;
  translations?: Array<{ languageCode: string; questionText?: string; hint?: string; easterEggButtonText?: string }>;
  answers: Answer[];
}

interface Player {
  id: string;
  name: string;
  avatarColor?: string;
  avatarEmoji?: string | null;
  isActive: boolean;
}

interface AnswerResult {
  correct: boolean;
  points: number;
  position: number;
}

interface PowerUpState {
  hintsRemaining: number;
  copyRemaining: number;
  doubleRemaining: number;
  usedThisQuestion: Set<PowerUpType>;
}

interface QuestionViewProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  timeRemaining: number;
  isRevealing: boolean;
  awaitingReveal: boolean;
  hasSubmitted: boolean;
  selectedAnswers: Set<string>;
  correctAnswerIds: string[];
  answerResult: AnswerResult | null;
  powerUpState: PowerUpState;
  selectedPowerUps: Set<PowerUpType>;
  copiedPlayerId: string | null;
  showHintModal: boolean;
  showCopyPlayerSelector: boolean;
  easterEggClicked: Set<string>;
  selectedLanguage: LanguageCode;
  availableLanguages: LanguageCode[];
  showLanguageSelector: boolean;
  players: Player[];
  playerName: string;
  theme: any;
  onToggleAnswer: (answerId: string) => void;
  onSubmitMultiSelect: () => void;
  onPowerUpToggle: (powerUpType: PowerUpType) => void;
  onCopyPlayerSelected: (playerId: string) => void;
  onEasterEggClick: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onShowLanguageSelectorChange: (show: boolean) => void;
  onShowHintModalChange: (show: boolean) => void;
  onShowCopyPlayerSelectorChange: (show: boolean) => void;
  getTranslatedContent: (defaultText: string | null | undefined, translations: any[] | undefined, field: string) => string;
  screenRef?: React.RefObject<HTMLDivElement | null>;
}

export const QuestionView = React.memo(function QuestionView(props: QuestionViewProps) {
  const {
    question,
    questionNumber,
    totalQuestions,
    timeRemaining,
    isRevealing,
    awaitingReveal,
    hasSubmitted,
    selectedAnswers,
    correctAnswerIds,
    answerResult,
    powerUpState,
    selectedPowerUps,
    copiedPlayerId,
    showHintModal,
    showCopyPlayerSelector,
    easterEggClicked,
    selectedLanguage,
    availableLanguages,
    showLanguageSelector,
    players,
    playerName,
    theme,
    onToggleAnswer,
    onSubmitMultiSelect,
    onPowerUpToggle,
    onCopyPlayerSelected,
    onEasterEggClick,
    onLanguageChange,
    onShowLanguageSelectorChange,
    onShowHintModalChange,
    onShowCopyPlayerSelectorChange,
    getTranslatedContent,
    screenRef,
  } = props;

  const hasPowerUps = powerUpState.hintsRemaining > 0 || powerUpState.copyRemaining > 0 || powerUpState.doubleRemaining > 0;

  // Awaiting reveal state
  if (isRevealing && awaitingReveal) {
    return (
      <ThemeProvider theme={theme}>
        <BackgroundEffects theme={theme} />
        <div
          ref={screenRef}
          className="min-h-screen flex flex-col items-center justify-center text-center px-6"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <div className="flex flex-col items-center gap-4 text-amber-200">
            <AlarmClock className="w-14 h-14 animate-bounce" />
            <h2 className="text-3xl font-bold text-white">Time&apos;s up!</h2>
            <p className="text-lg text-amber-100/80 max-w-xl">
              The host will reveal the answers shortly. Sit tight!
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <BackgroundEffects theme={theme} />
      <div
        ref={screenRef}
        className="min-h-screen flex flex-col overflow-x-hidden"
        style={{
          background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
        }}
      >
        {/* Top bar: Timer */}
        {!isRevealing && (
          <div className="px-3 sm:px-6 pt-3 sm:pt-4">
            <div className="flex flex-col gap-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border/60 px-4 py-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Question {questionNumber} of {totalQuestions}
                </span>
                <div className={`
                  flex items-center gap-2 px-3 py-1 rounded-full font-bold text-lg tabular-nums
                  ${timeRemaining <= 5
                    ? "bg-red-500/20 text-red-500 animate-pulse"
                    : timeRemaining <= 10
                      ? "bg-amber-500/20 text-amber-500"
                      : "bg-primary/20 text-primary"}
                `}>
                  <AlarmClock className="w-4 h-4" />
                  {timeRemaining}s
                </div>
              </div>
              <Progress
                value={(timeRemaining / question.timeLimit) * 100}
                className={`h-2.5 ${timeRemaining <= 5 ? "[&>div]:bg-red-500" : timeRemaining <= 10 ? "[&>div]:bg-amber-500" : ""}`}
              />
            </div>
          </div>
        )}

        {/* Question */}
        <div className="px-3 sm:px-8 py-3 sm:py-4">
          <h2 className="text-lg sm:text-xl font-bold text-center mb-2 leading-tight">
            {getTranslatedContent(question.questionText, question.translations, "questionText")}
          </h2>
          {question.imageUrl && (
            <img
              src={question.imageUrl}
              alt="Question"
              className="max-h-24 sm:max-h-32 w-auto mx-auto rounded-lg mb-3 sm:mb-4"
            />
          )}
          {question.questionType === "MULTI_SELECT" && !hasSubmitted && (
            <p className="text-xs sm:text-sm text-center text-muted-foreground mb-2">
              Select all that apply
            </p>
          )}
        </div>

        {/* Answer Result */}
        {isRevealing && answerResult && (
          <div
            className={`mx-8 p-4 rounded-lg text-center mb-4 ${
              answerResult.correct
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            <p className="text-2xl font-bold">
              {answerResult.correct ? "Correct!" : "Wrong!"}
            </p>
            <p className="text-lg">+{answerResult.points} points</p>
            <p className="text-sm">Position: #{answerResult.position}</p>
          </div>
        )}

        {/* Power-ups Section */}
        {!hasSubmitted && hasPowerUps && (
          <div className="px-3 sm:px-8 py-3 sm:py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Zap className="w-4 h-4" />
              <span className="text-xs sm:text-sm font-medium">Power-ups</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {powerUpState.hintsRemaining > 0 && (
                <Button
                  variant={selectedPowerUps.has(PowerUpType.HINT) ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPowerUpToggle(PowerUpType.HINT)}
                  disabled={powerUpState.usedThisQuestion.has(PowerUpType.HINT)}
                  className="flex flex-col h-auto py-2 px-1 sm:px-2 min-h-[68px] sm:min-h-[76px]"
                >
                  <Lightbulb className="w-5 h-5 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                  <span className="text-[10px] sm:text-xs">Hint</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                    {powerUpState.hintsRemaining} left
                  </span>
                </Button>
              )}

              {powerUpState.copyRemaining > 0 && (
                <Button
                  variant={selectedPowerUps.has(PowerUpType.COPY) ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPowerUpToggle(PowerUpType.COPY)}
                  disabled={powerUpState.usedThisQuestion.has(PowerUpType.COPY)}
                  className="flex flex-col h-auto py-2 px-1 sm:px-2 min-h-[68px] sm:min-h-[76px]"
                >
                  <Users className="w-5 h-5 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                  <span className="text-[10px] sm:text-xs">Copy</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                    {powerUpState.copyRemaining} left
                  </span>
                </Button>
              )}

              {powerUpState.doubleRemaining > 0 && (
                <Button
                  variant={selectedPowerUps.has(PowerUpType.DOUBLE) ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPowerUpToggle(PowerUpType.DOUBLE)}
                  disabled={powerUpState.usedThisQuestion.has(PowerUpType.DOUBLE)}
                  className="flex flex-col h-auto py-2 px-1 sm:px-2 min-h-[68px] sm:min-h-[76px]"
                >
                  <Sparkles className="w-5 h-5 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                  <span className="text-[10px] sm:text-xs">2x</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                    {powerUpState.doubleRemaining} left
                  </span>
                </Button>
              )}
            </div>

            {/* Active Power-ups Feedback */}
            {(selectedPowerUps.has(PowerUpType.HINT) || selectedPowerUps.has(PowerUpType.COPY) || selectedPowerUps.has(PowerUpType.DOUBLE)) && (
              <div className="mt-3 space-y-2">
                {selectedPowerUps.has(PowerUpType.HINT) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                        Hint Active
                      </p>
                    </div>
                  </div>
                )}

                {selectedPowerUps.has(PowerUpType.COPY) && copiedPlayerId && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <p className="text-xs font-medium text-purple-900 dark:text-purple-100">
                        Copy Active - Will copy from {players.find(p => p.id === copiedPlayerId)?.name || 'selected player'}
                      </p>
                    </div>
                  </div>
                )}

                {selectedPowerUps.has(PowerUpType.DOUBLE) && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                        Double Points Active - Your score will be doubled!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Answers */}
        <div className="flex-1 px-3 sm:px-8 py-3 sm:py-4 space-y-2 sm:space-y-3">
          {question.answers.map((answer, index) => {
            const isSelected = selectedAnswers.has(answer.id);
            const isCorrect = correctAnswerIds.includes(answer.id);

            let background: string;
            let textColor: string;
            let additionalStyles: React.CSSProperties = {};

            const answerColorHex = getAnswerColor(theme, index);
            const borderRadius = theme?.effects?.borderRadius
              ? BORDER_RADIUS_MAP[theme.effects.borderRadius]
              : BORDER_RADIUS_MAP.lg;
            const boxShadow = theme?.effects?.shadow
              ? SHADOW_MAP[theme.effects.shadow]
              : SHADOW_MAP.md;

            additionalStyles.borderRadius = borderRadius;
            additionalStyles.boxShadow = boxShadow;

            if (isRevealing) {
              if (isCorrect) {
                background = theme?.gradients?.correctAnswer || "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)";
                additionalStyles.boxShadow = `0 0 0 4px rgba(34, 197, 94, 0.3), ${boxShadow}`;
                textColor = "0 0% 100%";
              } else if (isSelected && !isCorrect) {
                background = theme?.gradients?.wrongAnswer || "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
                additionalStyles.opacity = 0.5;
                textColor = "0 0% 100%";
              } else {
                background = "#9ca3af";
                additionalStyles.opacity = 0.5;
                textColor = "0 0% 100%";
              }
            } else if (hasSubmitted) {
              if (isSelected) {
                background = answerColorHex;
                const selectedStyle = getSelectedAnswerStyle(theme, true);
                Object.assign(additionalStyles, selectedStyle);
                textColor = getContrastingTextColor(answerColorHex);
              } else {
                background = "#9ca3af";
                additionalStyles.opacity = 0.5;
                textColor = "0 0% 100%";
              }
            } else if (isSelected) {
              background = answerColorHex;
              const selectedStyle = getSelectedAnswerStyle(theme, true);
              Object.assign(additionalStyles, selectedStyle);
              textColor = getContrastingTextColor(answerColorHex);
            } else {
              background = answerColorHex;
              textColor = getContrastingTextColor(answerColorHex);
            }

            return (
              <div key={answer.id} className="px-0.5 sm:px-1">
                <button
                  onClick={() => onToggleAnswer(answer.id)}
                  disabled={hasSubmitted || isRevealing}
                  className={`
                    w-full p-3 sm:p-4 text-base sm:text-lg font-medium
                    transition-all duration-200 flex items-center gap-2 sm:gap-3
                    min-h-[52px] sm:min-h-[60px]
                    ${!hasSubmitted && !isRevealing ? "active:scale-[0.98]" : ""}
                  `}
                  style={{
                    background,
                    maxWidth: '100%',
                    color: `hsl(${textColor})`,
                    ...additionalStyles,
                  }}
                >
                  <span className="font-bold text-lg sm:text-xl shrink-0">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 text-left break-words hyphens-auto leading-tight">
                    {getTranslatedContent(answer.answerText, answer.translations, "answerText")}
                  </span>
                  {isRevealing && isCorrect && <Check className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
                  {isRevealing && isSelected && !isCorrect && (
                    <X className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Submit button for multi-select */}
        {question.questionType === "MULTI_SELECT" && !hasSubmitted && !isRevealing && (
          <div className="px-8 py-4 border-t">
            <Button
              onClick={onSubmitMultiSelect}
              disabled={selectedAnswers.size === 0}
              size="lg"
              className="w-full"
            >
              Submit Answer ({selectedAnswers.size} selected)
            </Button>
          </div>
        )}

        {/* Easter Egg Button */}
        {!isRevealing && question.easterEggEnabled && question.easterEggButtonText && question.easterEggUrl && (
          <div className="px-8 py-3">
            <Button
              onClick={onEasterEggClick}
              disabled={easterEggClicked.has(question.id)}
              variant="outline"
              className="w-full border-2 border-dashed"
            >
              {easterEggClicked.has(question.id) ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Clicked!
                </>
              ) : (
                getTranslatedContent(question.easterEggButtonText, question.translations, "easterEggButtonText")
              )}
            </Button>
          </div>
        )}

        {/* Waiting message after submit */}
        {hasSubmitted && !isRevealing && (
          <div className="px-8 py-4 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Waiting for time to expire...
          </div>
        )}

        {/* Language Selector */}
        {availableLanguages.length > 1 && (
          <div className="fixed bottom-4 right-4 z-20">
            <div className={`
              bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg
              transition-all duration-200 overflow-hidden origin-bottom-right
              ${showLanguageSelector ? "w-64 max-h-[70vh] overflow-y-auto" : "w-auto"}
            `}>
              {showLanguageSelector ? (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Select Language</span>
                    <button
                      onClick={() => onShowLanguageSelectorChange(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {availableLanguages.map((langCode) => (
                      <button
                        key={langCode}
                        onClick={() => {
                          onLanguageChange(langCode);
                          onShowLanguageSelectorChange(false);
                        }}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                          transition-colors
                          ${selectedLanguage === langCode
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"}
                        `}
                      >
                        <span>{SupportedLanguages[langCode].flag}</span>
                        <span className="truncate">{SupportedLanguages[langCode].nativeName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onShowLanguageSelectorChange(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span>{SupportedLanguages[selectedLanguage].flag}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hint Modal */}
      <Dialog open={showHintModal} onOpenChange={onShowHintModalChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Hint
            </DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="text-lg">
              {getTranslatedContent(question.hint, question.translations, "hint")}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => onShowHintModalChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Player Selector Dialog */}
      <Dialog open={showCopyPlayerSelector} onOpenChange={onShowCopyPlayerSelectorChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Copy Answer
            </DialogTitle>
            <DialogDescription>
              Select a player to copy their answer. This is a blind copy - you won&apos;t see their choice.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
            {players
              .filter(p => p.name !== playerName && p.isActive)
              .map(player => (
                <Button
                  key={player.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onCopyPlayerSelected(player.id)}
                >
                  <div className="flex items-center gap-2">
                    {player.avatarEmoji?.startsWith("/") ? (
                      <img
                        src={player.avatarEmoji}
                        alt={player.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback
                          style={{ backgroundColor: player.avatarEmoji ? "transparent" : player.avatarColor }}
                          className={player.avatarEmoji ? "text-xl" : "text-white text-xs"}
                        >
                          {player.avatarEmoji || player.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span>{player.name}</span>
                  </div>
                </Button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onShowCopyPlayerSelectorChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
});
