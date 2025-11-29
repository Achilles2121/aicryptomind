import React from "react";

const FullScreenLoader = ({ message = "Session wird geladen..." }) => {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" aria-label="Loading spinner" />
        <p className="text-sm text-slate-300">{message}</p>
      </div>
    </div>
  );
};

export default FullScreenLoader;
