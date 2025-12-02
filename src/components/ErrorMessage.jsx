import React from "react";

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-600/50 bg-red-900/30 p-3 text-sm text-red-200">
      <div className="flex items-center justify-between">
        <span>{message || "Something went wrong"}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded bg-red-500/70 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
