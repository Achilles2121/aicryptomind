// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React from 'react';
import { AlertTriangle, Mail, Github } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-800/50 bg-slate-950/50">
      {/* Risk Disclaimer */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/80">
            <strong className="text-amber-300">Risikowarnung:</strong>{" "}
            Der Handel mit Kryptowaehrungen und anderen Finanzinstrumenten birgt erhebliche Risiken und kann zum Verlust Ihres gesamten Kapitals fuehren. Die auf dieser Plattform bereitgestellten Signale und Analysen dienen ausschliesslich zu Informationszwecken und stellen <strong>keine Finanzberatung</strong> dar. Handeln Sie nur mit Kapital, dessen Verlust Sie sich leisten koennen. Vergangene Performance ist keine Garantie fuer zukuenftige Ergebnisse.
          </div>
        </div>

        {/* Footer Content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          {/* Copyright */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Vision AI Mind</span>
            <span>(c) {currentYear}</span>
            <span className="hidden md:inline">Alle Rechte vorbehalten</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a 
              href="mailto:oemeralpay@hotmail.com"
              className="flex items-center gap-1.5 hover:text-cyan-400 transition"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Kontakt</span>
            </a>
            <a 
              href="https://github.com/Achilles2121/aicryptomind"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-cyan-400 transition"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>

          {/* Legal Links */}
          <div className="flex items-center gap-4 text-xs">
            <button className="hover:text-slate-300 transition">Datenschutz</button>
            <button className="hover:text-slate-300 transition">Impressum</button>
            <button className="hover:text-slate-300 transition">AGB</button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
