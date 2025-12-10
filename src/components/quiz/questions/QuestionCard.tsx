"use client";

import React from "react";
import {
  GripVertical,
  Check,
  Pencil,
  Trash2,
  Copy,
  Layers,
  Image,
  AlertCircle,
  Globe,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SupportedLanguages, type LanguageCode } from "@/types";

interface Answer {
  id?: string;
  answerText: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  questionText: string;
  imageUrl?: string | null;
  questionType: string;
  timeLimit: number;
  points: number;
  hostNotes?: string | null;
  hint?: string | null;
  orderIndex: number;
  answers: Answer[];
}

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  onEdit: (question: Question) => void;
  onDelete: (questionId: string) => void;
  onDuplicate: (questionId: string) => void;
  isInSection: boolean;
  hintRequired: boolean;
  showHintWarning: boolean;
  translationStatus: "complete" | "partial" | "none";
  completeLanguages: LanguageCode[];
  partialLanguages: LanguageCode[];
}

export const QuestionCard = React.memo(function QuestionCard({
  question,
  questionNumber,
  onEdit,
  onDelete,
  onDuplicate,
  isInSection,
  hintRequired,
  showHintWarning,
  translationStatus,
  completeLanguages,
  partialLanguages,
}: QuestionCardProps) {
  const isSection = question.questionType === "SECTION";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TooltipProvider>
      <div
        ref={setNodeRef}
        style={style}
        className={isInSection && !isSection ? "ml-8" : ""}
      >
        <Card
          className={`group ${
            isSection ? "border-primary/50 bg-primary/5" : ""
          } ${isDragging ? "ring-2 ring-primary" : ""}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-2 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors touch-manipulation"
              >
                <GripVertical className="w-5 h-5" />
              </div>

              {/* Question Number/Icon */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm shrink-0 ${
                  isSection
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isSection ? (
                  <Layers className="w-4 h-4" />
                ) : (
                  questionNumber
                )}
              </div>

              {/* Question Content */}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-medium line-clamp-2">
                  {question.questionText}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                  {isSection ? (
                    <>
                      <span className="text-primary font-medium">Section</span>
                      {question.hostNotes && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px]">
                            {question.hostNotes}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span>
                        {question.questionType === "MULTI_SELECT"
                          ? "Multi Select"
                          : "Single Select"}
                      </span>
                      <span>·</span>
                      <span>{question.timeLimit}s</span>
                      <span>·</span>
                      <span>{question.points} pts</span>
                    </>
                  )}
                  {question.imageUrl && (
                    <>
                      <span>·</span>
                      <span className="flex items-center">
                        <Image className="w-3 h-3 mr-1" />
                        Image
                      </span>
                    </>
                  )}
                </CardDescription>
                {(completeLanguages.length > 0 || partialLanguages.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {completeLanguages.map((lang) => (
                      <span
                        key={`complete-${lang}`}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 px-2 py-0.5 text-[11px] font-medium"
                        title={`${SupportedLanguages[lang]?.name || lang} translation complete`}
                      >
                        <span>{SupportedLanguages[lang]?.flag}</span>
                        <span>Full</span>
                      </span>
                    ))}
                    {partialLanguages.map((lang) => (
                      <span
                        key={`partial-${lang}`}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 text-[11px] font-medium"
                        title={`${SupportedLanguages[lang]?.name || lang} translation incomplete`}
                      >
                        <span>{SupportedLanguages[lang]?.flag}</span>
                        <span>Partial</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Warning Badges & Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Hint Warning */}
                {showHintWarning && !isSection && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-1.5 text-amber-500">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Hint required but missing</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Translation Warning */}
                {translationStatus === "partial" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-1.5 text-amber-500">
                        <Globe className="w-4 h-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Some translations incomplete</p>
                      {completeLanguages.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Complete:{" "}
                          {completeLanguages
                            .map((l) => SupportedLanguages[l]?.flag)
                            .join(" ")}
                        </p>
                      )}
                      {partialLanguages.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Needs work:{" "}
                          {partialLanguages
                            .map((l) => SupportedLanguages[l]?.flag)
                            .join(" ")}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Translation Complete Indicator */}
                {translationStatus === "complete" &&
                  completeLanguages.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-0.5 px-1">
                          {completeLanguages.slice(0, 3).map((lang) => (
                            <span key={lang} className="text-xs leading-none">
                              {SupportedLanguages[lang]?.flag}
                            </span>
                          ))}
                          {completeLanguages.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{completeLanguages.length - 3}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Translations complete</p>
                        <p className="text-xs text-muted-foreground">
                          {completeLanguages
                            .map((l) => SupportedLanguages[l]?.name)
                            .join(", ")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                {/* Duplicate Button */}
                {!isSection && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDuplicate(question.id)}
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate</TooltipContent>
                  </Tooltip>
                )}

                {/* Edit Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(question)}
                      className="h-8 w-8"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>

                {/* Delete Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(question.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>

          {/* Answer Preview (for questions only) */}
          {!isSection && question.answers.length > 0 && (
            <CardContent className="pt-0 pl-[72px]">
              <div className="flex flex-wrap gap-1.5">
                {question.answers.map((answer, aIndex) => (
                  <div
                    key={aIndex}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      answer.isCorrect
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {answer.isCorrect && (
                      <Check className="w-3 h-3 inline mr-0.5" />
                    )}
                    <span className="truncate max-w-[120px] inline-block align-middle">
                      {answer.answerText}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: re-render only if question data or warnings changed
  return (
    prevProps.question.id === nextProps.question.id &&
    prevProps.question.questionText === nextProps.question.questionText &&
    prevProps.question.imageUrl === nextProps.question.imageUrl &&
    prevProps.questionNumber === nextProps.questionNumber &&
    prevProps.showHintWarning === nextProps.showHintWarning &&
    prevProps.translationStatus === nextProps.translationStatus &&
    prevProps.question.answers.length === nextProps.question.answers.length
  );
});

// Drag overlay version (non-interactive)
export const QuestionCardOverlay = React.memo(function QuestionCardOverlay({
  question,
  questionNumber,
}: {
  question: Question;
  questionNumber: number;
}) {
  const isSection = question.questionType === "SECTION";

  return (
    <Card
      className={`${
        isSection ? "border-primary/50 bg-primary/5" : ""
      } ring-2 ring-primary shadow-lg`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="p-2 -m-1 text-muted-foreground">
            <GripVertical className="w-5 h-5" />
          </div>

          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm shrink-0 ${
              isSection
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary"
            }`}
          >
            {isSection ? <Layers className="w-4 h-4" /> : questionNumber}
          </div>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium line-clamp-1">
              {question.questionText}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
});
