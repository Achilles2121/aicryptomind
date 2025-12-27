// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useMemo } from "react";
import PropTypes from "prop-types";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const CENTER_X = 120;
const CENTER_Y = 120;
const RADIUS = 90;
const STROKE_WIDTH = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DASH_ARRAY = `${CIRCUMFERENCE / 2} ${CIRCUMFERENCE / 2}`;
const POINTER_LENGTH = RADIUS - 12;

const getValueColor = (value) => {
  if (!Number.isFinite(value)) return "#94a3b8";
  if (value <= 25) return "#ef4444";
  if (value <= 45) return "#f59e0b";
  if (value <= 55) return "#facc15";
  if (value <= 75) return "#86efac";
  return "#10b981";
};

export default function FearGreedGauge({ value, classification, className = "" }) {
  const safeValue = useMemo(() => (Number.isFinite(value) ? clamp(value, 0, 100) : null), [value]);
  const pointerAngle = safeValue === null ? 180 : 180 - (safeValue / 100) * 180;
  const glowColor = getValueColor(safeValue);
  const valueText = Number.isFinite(safeValue) ? Math.round(safeValue) : "--";

  return (
    <div className={`flex flex-col items-center rounded-2xl bg-slate-950/60 p-4 ${className}`}>
      <svg width="240" height="140" viewBox="0 0 240 140" className="overflow-visible">
        <defs>
          <linearGradient id="fearGreedGradient" x1="0" y1="0" x2="240" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RADIUS}
          fill="none"
          stroke="#1e293b"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={DASH_ARRAY}
          strokeLinecap="round"
          transform={`rotate(180 ${CENTER_X} ${CENTER_Y})`}
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RADIUS}
          fill="none"
          stroke="url(#fearGreedGradient)"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={DASH_ARRAY}
          strokeLinecap="round"
          transform={`rotate(180 ${CENTER_X} ${CENTER_Y})`}
        />
        <g
          style={{
            transform: `rotate(${pointerAngle}deg)`,
            transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
            transition: "transform 450ms ease-out",
          }}
        >
          <line
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={CENTER_X + POINTER_LENGTH}
            y2={CENTER_Y}
            stroke={glowColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={CENTER_X} cy={CENTER_Y} r="6" fill="#0f172a" stroke={glowColor} strokeWidth="2" />
        </g>
      </svg>
      <div className="text-center">
        <div
          className="text-2xl font-bold"
          style={{ color: glowColor, textShadow: `0 0 12px ${glowColor}` }}
        >
          {valueText}
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{classification || "Loading"}</div>
      </div>
    </div>
  );
}

FearGreedGauge.propTypes = {
  value: PropTypes.number,
  classification: PropTypes.string,
  className: PropTypes.string,
};
