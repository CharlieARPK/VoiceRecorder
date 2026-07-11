import React, { useState } from 'react';
import RecorderCard from './components/RecorderCard';
import TunerCard from './components/TunerCard';
import MetronomeCard from './components/MetronomeCard';
import SavedRecordingsPage from './components/SavedRecordingsPage';
import './App.css';

export default function App() {
  const [recordings, setRecordings] = useState([]);
  const [currentTab, setCurrentTab] = useState('studio'); // 'studio' | 'library'

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

      {currentTab === 'studio' ? (
        <>
          {/* Top Section: Recorder */}
          <RecorderCard
            onSaveRecording={handleSaveRecording}
            recordingsCount={recordings.length}
            onNavigateToLibrary={() => setCurrentTab('library')}
          />

          {/* Middle Section: Tuner */}
          <TunerCard />

          {/* Bottom Section: Metronome */}
          <MetronomeCard />
        </>
      ) : (
        <SavedRecordingsPage
          recordings={recordings}
          onDeleteRecording={handleDeleteRecording}
          onBackToStudio={() => setCurrentTab('studio')}
        />
      )}
    </div>
  );
}
