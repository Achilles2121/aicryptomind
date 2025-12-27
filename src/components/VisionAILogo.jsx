// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React from "react";

export default function VisionAILogo({ className = "h-8 w-8" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Vision AI Mind"
    >
      <defs>
        <linearGradient id="vision-ai-grad" x1="6" y1="16" x2="58" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id="vision-ai-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) rotate(90) scale(14)">
          <stop stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.8" />
        </radialGradient>
      </defs>
      <path
        d="M4 32C10 20 20 14 32 14C44 14 54 20 60 32C54 44 44 50 32 50C20 50 10 44 4 32Z"
        stroke="url(#vision-ai-grad)"
        strokeWidth="3"
        fill="rgba(15,23,42,0.2)"
      />
      <circle cx="32" cy="32" r="9" fill="url(#vision-ai-core)" stroke="url(#vision-ai-grad)" strokeWidth="2" />
      <circle cx="32" cy="32" r="3" fill="#0f172a" />
      <rect x="41" y="24" width="12" height="12" rx="2" stroke="url(#vision-ai-grad)" strokeWidth="2" />
      <path d="M53 28H58" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 36H58" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M41 20V16" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M47 20V16" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 20V16" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M41 48V44" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M47 48V44" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 48V44" stroke="url(#vision-ai-grad)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
