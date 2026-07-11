import React from 'react';
import { Mic, Music, Zap, ListMusic, Share2, Smartphone, Sparkles } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, recordingsCount, onOpenShareModal }) {
  const tabs = [
    { id: 'recorder', label: 'レコーダー & LINE送信', icon: Mic },
    { id: 'tuner', label: 'ピッチチューナー', icon: Sparkles },
    { id: 'metronome', label: '高精度メトロノーム', icon: Zap },
    { id: 'recordings', label: `録音ライブラリ (${recordingsCount})`, icon: ListMusic }
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0b0d14]/85 backdrop-blur-xl border-b border-white/10 shadow-xl">
      <div className="container-max py-3 md:py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Music className="w-6 h-6 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  PixelMusic <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Studio</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-white/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Smartphone className="w-3 h-3" /> Pixel 9 Pro / PWA
                </span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">
                ミュージシャン専用 高音質レコーダー・チューナー・メトロノーム・LINEワンタップ共有
              </p>
            </div>
          </div>

          {/* Share App Button */}
          <button
            onClick={onOpenShareModal}
            className="btn-studio btn-line py-2 px-4 text-xs md:text-sm font-bold flex items-center gap-2 shadow-md"
          >
            <Share2 className="w-4 h-4" />
            <span>友達とアプリ共有 / LINE送信ガイド</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex gap-1.5 md:gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-100'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-emerald-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
