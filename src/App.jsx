import React, { useState } from 'react';
import RecorderCard from './components/RecorderCard';
import TunerCard from './components/TunerCard';
import MetronomeCard from './components/MetronomeCard';
import SavedRecordingsModal from './components/SavedRecordingsModal';
import './App.css';

export default function App() {
  const [recordings, setRecordings] = useState([]);
  const [isSavedListOpen, setIsSavedListOpen] = useState(false);

  const handleSaveRecording = (newTrack) => {
    setRecordings((prev) => [newTrack, ...prev]);
  };

  const handleDeleteRecording = (id) => {
    setRecordings((prev) => prev.filter(r => r.id !== id));
  };

  return (
    <div className="studio-container">
      {/* Sleek Minimal Header */}
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold font-mono tracking-wider text-gray-200">
          VOICE RECORDER & TUNER
        </h1>
      </header>

      {/* Top Section: Recorder */}
      <RecorderCard
        onSaveRecording={handleSaveRecording}
        recordingsCount={recordings.length}
        onOpenSavedList={() => setIsSavedListOpen(true)}
      />

      {/* Middle Section: Tuner */}
      <TunerCard />

      {/* Bottom Section: Metronome */}
      <MetronomeCard />

      {/* Saved Tracks Modal */}
      <SavedRecordingsModal
        isOpen={isSavedListOpen}
        onClose={() => setIsSavedListOpen(false)}
        recordings={recordings}
        onDeleteRecording={handleDeleteRecording}
      />
    </div>
  );
}
