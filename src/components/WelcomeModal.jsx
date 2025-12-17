// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Zap, Target, Shield, TrendingUp } from 'lucide-react';

const STORAGE_KEY = 'visionai_welcome_seen';

const WelcomeModal = ({ onComplete }) => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(STORAGE_KEY);
    if (!hasSeenWelcome) {
      // Small delay for better UX
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
    if (onComplete) onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  const steps = [
    {
      icon: <Zap className="w-12 h-12 text-cyan-400" />,
      title: "Willkommen bei Vision AI Mind! 🚀",
      content: "Dein AI-gestütztes Trading Dashboard mit unserem einzigartigen 8-Punkte-Kriterien-System.",
      highlight: "Weniger Trades. Bessere Trades."
    },
    {
      icon: <Target className="w-12 h-12 text-emerald-400" />,
      title: "So funktioniert unser System",
      content: "Wir analysieren RSI, MACD, Volumen, Trend, Momentum, Support/Resistance, Liquidität und Smart Money.",
      highlight: "Nur wenn ALLE 8 Kriterien erfüllt sind, gibt es ein Signal."
    },
    {
      icon: <Shield className="w-12 h-12 text-amber-400" />,
      title: "Risikomanagement inklusive",
      content: "Unser TP/SL Rechner berechnet automatisch deine Take-Profit und Stop-Loss Levels mit optimalem Risk/Reward.",
      highlight: "Nie wieder raten – immer wissen."
    },
    {
      icon: <TrendingUp className="w-12 h-12 text-purple-400" />,
      title: "Bereit? Los geht's!",
      content: "Wähle oben ein Asset (BTC, ETH, Gold...) und beobachte die Live-Signale. Der Beginner-Mode hilft dir beim Einstieg.",
      highlight: "7 Tage kostenlos testen – keine Kreditkarte nötig."
    }
  ];

  const currentStep = steps[step - 1];
  const isLastStep = step === steps.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-900 border border-cyan-500/30 rounded-2xl p-8 max-w-lg w-full shadow-2xl shadow-cyan-500/10 animate-in fade-in zoom-in duration-300">
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-300 transition"
          aria-label="Schließen"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-slate-800 rounded-2xl flex items-center justify-center">
            {currentStep.icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-3">
            {currentStep.title}
          </h2>

          {/* Description */}
          <p className="text-slate-400 mb-4 leading-relaxed">
            {currentStep.content}
          </p>

          {/* Highlight */}
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 rounded-full text-sm text-cyan-300 mb-8">
            ✨ {currentStep.highlight}
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i + 1 === step 
                  ? 'bg-cyan-400 w-8' 
                  : i + 1 < step 
                    ? 'bg-cyan-600 w-2' 
                    : 'bg-slate-600 w-2'
              }`}
              aria-label={`Schritt ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 border border-slate-600 rounded-xl text-slate-300 font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Zurück
            </button>
          )}
          
          <button
            onClick={() => isLastStep ? handleComplete() : setStep(s => s + 1)}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-semibold hover:from-cyan-500 hover:to-blue-500 transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
          >
            {isLastStep ? "Los geht's! 🚀" : (
              <>
                Weiter
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Skip Link */}
        <button
          onClick={handleSkip}
          className="w-full mt-4 text-sm text-slate-500 hover:text-slate-400 transition"
        >
          Überspringen
        </button>
      </div>
    </div>
  );
};

export default WelcomeModal;
