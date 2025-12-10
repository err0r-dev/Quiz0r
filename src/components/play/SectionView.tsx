"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Layers } from "lucide-react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

// Dynamic import for BackgroundEffects
const BackgroundEffects = dynamic(
  () => import("@/components/theme/BackgroundEffects").then(mod => ({ default: mod.BackgroundEffects })),
  { ssr: false }
);

interface SectionViewProps {
  sectionTitle: string;
  sectionNotes?: string | null;
  imageUrl?: string | null;
  theme: any;
  screenRef?: React.RefObject<HTMLDivElement | null>;
}

export const SectionView = React.memo(function SectionView({
  sectionTitle,
  sectionNotes,
  imageUrl,
  theme,
  screenRef,
}: SectionViewProps) {
  return (
    <ThemeProvider theme={theme}>
      <div
        ref={screenRef}
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          background: theme?.gradients?.sectionSlide || 'linear-gradient(135deg, hsl(0 0% 35%) 0%, hsl(0 0% 25%) 100%)',
        }}
      >
        <BackgroundEffects theme={theme} />
        <div className="text-center text-white relative z-10 px-4 max-w-2xl mx-auto">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h1 className="text-3xl font-bold mb-4">
            {sectionTitle}
          </h1>
          {sectionNotes && (
            <p className="text-lg opacity-90 mb-6">
              {sectionNotes}
            </p>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Section"
              className="max-h-48 mx-auto rounded-xl shadow-lg mb-6"
            />
          )}
          <p className="text-sm opacity-70">
            Waiting for host to continue...
          </p>
        </div>
      </div>
    </ThemeProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if section content changes
  return (
    prevProps.sectionTitle === nextProps.sectionTitle &&
    prevProps.sectionNotes === nextProps.sectionNotes &&
    prevProps.imageUrl === nextProps.imageUrl
  );
});
