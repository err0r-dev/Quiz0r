"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Loader2, UserX, Bell } from "lucide-react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import dynamic from "next/dynamic";

// Dynamic import for BackgroundEffects
const BackgroundEffects = dynamic(
  () => import("@/components/theme/BackgroundEffects").then(mod => ({ default: mod.BackgroundEffects })),
  { ssr: false }
);

type ErrorState =
  | { type: "admissionPending" }
  | { type: "admissionRefused" }
  | { type: "playerRemoved"; reason?: string }
  | { type: "gameCancelled" }
  | { type: "error"; message: string }
  | { type: "loading"; message?: string }
  | { type: "gameNotFound" }
  | { type: "gameEnded" }
  | { type: "connecting" };

interface ErrorStatesProps {
  state: ErrorState;
  theme: any;
  screenRef?: React.RefObject<HTMLDivElement | null>;
}

export const ErrorStates = React.memo(function ErrorStates({
  state,
  theme,
  screenRef,
}: ErrorStatesProps) {
  const router = useRouter();

  const getContent = () => {
    switch (state.type) {
      case "admissionPending":
        return {
          icon: <Bell className="w-12 h-12 mx-auto text-primary mb-4" />,
          title: "Waiting for Admission",
          description: "Your request to join has been sent. The host will admit you shortly.",
          buttonText: "Leave Game",
          buttonVariant: "outline" as const,
          borderClass: "",
        };

      case "admissionRefused":
        return {
          icon: <UserX className="w-12 h-12 mx-auto text-destructive mb-4" />,
          title: "Admission Refused",
          description: "The host has refused your request to join this game. Please contact the game host.",
          buttonText: "Join Another Game",
          buttonVariant: "outline" as const,
          borderClass: "",
        };

      case "playerRemoved":
        return {
          icon: <X className="w-12 h-12 mx-auto text-destructive mb-4" />,
          title: "Removed from Game",
          description: state.reason || "You have been removed from the game. Please contact the game host.",
          buttonText: "Join Another Game",
          buttonVariant: "outline" as const,
          borderClass: "border-destructive",
        };

      case "gameCancelled":
        return {
          icon: <X className="w-12 h-12 mx-auto text-muted-foreground mb-4" />,
          title: "Game Cancelled",
          description: "The host has cancelled this game.",
          buttonText: "Join Another Game",
          buttonVariant: "default" as const,
          borderClass: "",
        };

      case "error":
        return {
          icon: <X className="w-12 h-12 mx-auto text-destructive mb-4" />,
          title: state.message,
          description: null,
          buttonText: "Try Another Code",
          buttonVariant: "default" as const,
          borderClass: "",
        };

      case "loading":
        return {
          icon: <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />,
          title: null,
          description: state.message || "Checking game...",
          buttonText: null,
          buttonVariant: null,
          borderClass: "",
        };

      case "gameNotFound":
        return {
          icon: <X className="w-12 h-12 mx-auto text-muted-foreground mb-4" />,
          title: "Game Not Found",
          description: "This game code doesn't exist. Please check the code and try again.",
          buttonText: "Enter Different Code",
          buttonVariant: "default" as const,
          borderClass: "",
        };

      case "gameEnded":
        return {
          icon: <X className="w-12 h-12 mx-auto text-muted-foreground mb-4" />,
          title: "Game Has Ended",
          description: "This game is no longer accepting new players.",
          buttonText: "Join Another Game",
          buttonVariant: "default" as const,
          borderClass: "",
        };

      case "connecting":
        return {
          icon: <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />,
          title: null,
          description: "Connecting to game...",
          buttonText: null,
          buttonVariant: null,
          borderClass: "",
        };

      default:
        return {
          icon: <X className="w-12 h-12 mx-auto text-destructive mb-4" />,
          title: "Error",
          description: "An error occurred",
          buttonText: "Go Back",
          buttonVariant: "default" as const,
          borderClass: "",
        };
    }
  };

  const content = getContent();
  const titleClass = state.type === "error" || state.type === "playerRemoved" || state.type === "admissionRefused"
    ? "text-destructive"
    : "";

  return (
    <ThemeProvider theme={theme}>
      <div
        ref={screenRef}
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
        }}
      >
        <BackgroundEffects theme={theme} />
        <Card className={`w-full max-w-sm relative z-10 shadow-2xl border-2 ${content.borderClass}`}>
          <CardContent className="pt-6 text-center">
            {content.icon}
            {content.title && (
              <p className={`text-lg font-bold mb-2 ${titleClass}`}>
                {content.title}
              </p>
            )}
            {content.description && (
              <p className="text-muted-foreground">
                {content.description}
              </p>
            )}
            {content.buttonText && content.buttonVariant && (
              <Button
                onClick={() => router.push("/play")}
                className="mt-6"
                variant={content.buttonVariant}
              >
                {content.buttonText}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </ThemeProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if state type or relevant data changed
  if (prevProps.state.type !== nextProps.state.type) return false;
  if (prevProps.state.type === "error" && nextProps.state.type === "error") {
    return prevProps.state.message === nextProps.state.message;
  }
  if (prevProps.state.type === "playerRemoved" && nextProps.state.type === "playerRemoved") {
    return prevProps.state.reason === nextProps.state.reason;
  }
  if (prevProps.state.type === "loading" && nextProps.state.type === "loading") {
    return prevProps.state.message === nextProps.state.message;
  }
  return true; // No change for states without data
});
