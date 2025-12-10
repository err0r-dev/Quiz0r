"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, Languages as LanguagesIcon } from "lucide-react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SupportedLanguages, type LanguageCode } from "@/types";

// Dynamic import for BackgroundEffects
const BackgroundEffects = dynamic(
  () => import("@/components/theme/BackgroundEffects").then(mod => ({ default: mod.BackgroundEffects })),
  { ssr: false }
);

const AVATAR_EMOJIS = [
  "😀", "😎", "🤓", "😈", "👻", "🤖", "👽", "🦊",
  "🐱", "🐶", "🐸", "🦁", "🐼", "🐨", "🦄", "🐲",
  "🌟", "⚡", "🔥", "💎", "🎮", "🎸", "🚀", "🏆",
];

interface JoinScreenProps {
  gameCode: string;
  theme: any;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  selectedEmoji: string | null;
  onEmojiSelect: (emoji: string | null) => void;
  avatarImage: string | null;
  onAvatarImageChange: (image: string | null) => void;
  uploadingImage: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  availableLanguages: LanguageCode[];
  joinError: string;
  joining: boolean;
  onJoin: (e: React.FormEvent) => void;
  screenRef?: React.RefObject<HTMLDivElement | null>;
}

export const JoinScreen = React.memo(function JoinScreen({
  gameCode,
  theme,
  playerName,
  onPlayerNameChange,
  selectedEmoji,
  onEmojiSelect,
  avatarImage,
  onAvatarImageChange,
  uploadingImage,
  onImageUpload,
  selectedLanguage,
  onLanguageChange,
  availableLanguages,
  joinError,
  joining,
  onJoin,
  screenRef,
}: JoinScreenProps) {
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
        <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Join Game</CardTitle>
            <p className="text-muted-foreground font-mono text-lg">{gameCode}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onJoin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name</label>
                <Input
                  type="text"
                  placeholder="Enter your name..."
                  value={playerName}
                  onChange={(e) => onPlayerNameChange(e.target.value.slice(0, 20))}
                  className="text-center text-lg h-12"
                  maxLength={20}
                  autoFocus
                  disabled={joining}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Choose Your Avatar</label>

                {/* Avatar Preview */}
                {(avatarImage || selectedEmoji) && (
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      {avatarImage ? (
                        <img
                          src={avatarImage}
                          alt="Avatar"
                          className="w-16 h-16 rounded-full object-cover ring-2 ring-primary"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl ring-2 ring-primary">
                          {selectedEmoji}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onAvatarImageChange(null);
                          onEmojiSelect(null);
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs hover:bg-destructive/80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Image Button */}
                <div className="flex justify-center mb-2">
                  <label
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer
                      border-2 border-dashed border-muted-foreground/30 hover:border-primary
                      transition-colors
                      ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}
                      ${avatarImage ? "bg-primary/10 border-primary" : ""}
                    `}
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span className="text-sm">
                      {uploadingImage ? "Uploading..." : avatarImage ? "Change Image" : "Upload Image"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={onImageUpload}
                      disabled={joining || uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>

                <p className="text-xs text-center text-muted-foreground mb-2">or pick an emoji</p>

                <div className="grid grid-cols-8 gap-2">
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onEmojiSelect(selectedEmoji === emoji ? null : emoji);
                        onAvatarImageChange(null); // Clear image when emoji is selected
                      }}
                      disabled={joining}
                      className={`
                        text-2xl p-2 rounded-lg transition-all
                        ${selectedEmoji === emoji && !avatarImage
                          ? "bg-primary/20 ring-2 ring-primary scale-110"
                          : "hover:bg-muted"
                        }
                      `}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Selector */}
              {availableLanguages.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <LanguagesIcon className="w-4 h-4" />
                    Select Quiz Questions/Answer Language
                  </label>
                  <Select
                    value={selectedLanguage}
                    onValueChange={(value) => onLanguageChange(value as LanguageCode)}
                    disabled={joining}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {SupportedLanguages[selectedLanguage].flag} {SupportedLanguages[selectedLanguage].nativeName}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableLanguages.map((langCode) => (
                        <SelectItem key={langCode} value={langCode}>
                          <span className="flex items-center gap-2">
                            {SupportedLanguages[langCode].flag} {SupportedLanguages[langCode].nativeName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {joinError && (
                <p className="text-sm text-destructive text-center">
                  {joinError}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={joining}
              >
                {joining ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ThemeProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if relevant props change
  return (
    prevProps.playerName === nextProps.playerName &&
    prevProps.selectedEmoji === nextProps.selectedEmoji &&
    prevProps.avatarImage === nextProps.avatarImage &&
    prevProps.uploadingImage === nextProps.uploadingImage &&
    prevProps.selectedLanguage === nextProps.selectedLanguage &&
    prevProps.joinError === nextProps.joinError &&
    prevProps.joining === nextProps.joining &&
    prevProps.availableLanguages.length === nextProps.availableLanguages.length
  );
});
