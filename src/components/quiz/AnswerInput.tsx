"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Trash2 } from "lucide-react";

interface Answer {
  id?: string;
  answerText: string;
  imageUrl?: string | null;
  isCorrect: boolean;
}

interface AnswerInputProps {
  answer: Answer;
  index: number;
  canDelete: boolean;
  onChange: (field: keyof Answer, value: string | boolean) => void;
  onDelete: () => void;
  onToggleCorrect: () => void;
}

export const AnswerInput = React.memo(function AnswerInput({
  answer,
  index,
  canDelete,
  onChange,
  onDelete,
  onToggleCorrect,
}: AnswerInputProps) {
  const letterLabel = String.fromCharCode(65 + index);

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-colors ${
        answer.isCorrect
          ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
          : "border-border bg-background"
      }`}
    >
      {/* Letter label */}
      <div
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm shrink-0 ${
          answer.isCorrect
            ? "bg-green-500 text-white"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {letterLabel}
      </div>

      {/* Answer text input */}
      <Input
        placeholder={`Answer ${letterLabel}`}
        value={answer.answerText}
        onChange={(e) => onChange("answerText", e.target.value)}
        className="flex-1 min-w-0"
      />

      {/* Correct toggle button */}
      <Button
        type="button"
        variant={answer.isCorrect ? "default" : "outline"}
        size="sm"
        onClick={onToggleCorrect}
        className={`shrink-0 h-8 w-8 sm:h-9 sm:w-9 p-0 ${
          answer.isCorrect
            ? "bg-green-500 hover:bg-green-600 text-white"
            : ""
        }`}
        title={answer.isCorrect ? "Marked as correct" : "Mark as correct"}
      >
        {answer.isCorrect ? (
          <Check className="w-4 h-4" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </Button>

      {/* Delete button */}
      {canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Remove answer"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if answer data or index changes
  return (
    prevProps.index === nextProps.index &&
    prevProps.canDelete === nextProps.canDelete &&
    prevProps.answer.id === nextProps.answer.id &&
    prevProps.answer.answerText === nextProps.answer.answerText &&
    prevProps.answer.isCorrect === nextProps.answer.isCorrect &&
    prevProps.answer.imageUrl === nextProps.answer.imageUrl
  );
});

export type { Answer };
