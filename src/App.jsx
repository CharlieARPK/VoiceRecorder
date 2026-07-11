import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Recorder from './components/Recorder';
import Tuner from './components/Tuner';
import Metronome from './components/Metronome';
import RecordingsList from './components/RecordingsList';
import ShareModal from './components/ShareModal';
import { Smartphone, Sparkles, Share2, HelpCircle, Music } from 'lucide-react';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('recorder'); // 'recorder' | 'tuner' | 'metronome' | 'recordings'
  const [recordings, setRecordings] = useState([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Load sample or previously saved metadata if needed
  useEffect(() => {
    // Check if there are saved recordings or add initial demo note
    const saved = localStorage.getItem('pixelmusic_recordings_meta');
    if (saved) {
      try {
        // Note: blobs cannot be saved in localStorage directly, so we keep track during session
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSaveRecording = (newTrack) => {
    setRecordings((prev) => [newTrack, ...prev]);
  };

  const handleDeleteRecording = (id) => {
    setRecordings((prev) => prev.filter(r => r.id !== id));
  };

  const handleUpdateRecording = (id, updatedMeta) => {
    setRecordings((prev) =>
      prev.map(r => r.id === id ? { ...r, ...updatedMeta } : r)
    );
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0b0d14] text-gray-100">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        recordingsCount={recordings.length}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      <main className="container-max py-6 flex-grow">
        {activeTab === 'recorder' && (
          <div className="animate-fade-in">
            <Recorder onSaveRecording={handleSaveRecording} />
          </div>
        )}

        {activeTab === 'tuner' && (
          <div className="animate-fade-in">
            <Tuner />
          </div>
        )}

        {activeTab === 'metronome' && (
          <div className="animate-fade-in">
            <Metronome />
          </div>
        )}

        {activeTab === 'recordings' && (
          <div className="animate-fade-in">
            <RecordingsList
              recordings={recordings}
              onDeleteRecording={handleDeleteRecording}
              onUpdateRecording={handleUpdateRecording}
            />
          </div>
        )}
      </main>

      {/* Share / Instructions Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Bottom PWA Guide Footer */}
      <footer className="mt-12 py-8 bg-black/60 border-t border-white/5 text-center text-xs text-gray-500">
        <div className="container-max space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400">
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <Smartphone className="w-4 h-4" /> Pixel 9 Pro おすすめ設定
            </span>
            <span>ブラウザの右上メニュー「⋮」から **「ホーム画面に追加」** を選択するとネイティブアプリ化</span>
            <span>•</span>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="text-cyan-400 hover:underline flex items-center gap-1 font-bold"
            >
              <Share2 className="w-3.5 h-3.5" /> 友達とのアプリ共有＆LINE送信手順
            </button>
          </div>
          <p>© 2026 PixelMusic Studio — Powered by Web Audio API & Web Share API</p>
        </div>
      </footer>
    </div>
  );
}
