import React, { useState, useEffect } from 'react';
import RecorderCard from './components/RecorderCard';
import TunerCard from './components/TunerCard';
import MetronomeCard from './components/MetronomeCard';
import SavedRecordingsPage from './components/SavedRecordingsPage';
import { getAllRecordingsFromDB, saveRecordingToDB, deleteRecordingFromDB } from './utils/db';
import './App.css';

export default function App() {
  const [recordings, setRecordings] = useState([]);
  const [currentTab, setCurrentTab] = useState('studio'); // 'studio' | 'library'

  // Load recordings from IndexedDB on initial mount so they survive page reload
  useEffect(() => {
    getAllRecordingsFromDB()
      .then((data) => {
        // Recreate object URLs for saved Blobs
        const restored = data.map((item) => ({
          ...item,
          url: URL.createObjectURL(item.blob)
        }));
        setRecordings(restored);
      })
      .catch((err) => console.error("Failed to load recordings from DB:", err));
  }, []);

  const handleSaveRecording = async (newTrack) => {
    try {
      await saveRecordingToDB(newTrack);
      setRecordings((prev) => [newTrack, ...prev]);
    } catch (err) {
      console.error("Failed to save recording to DB:", err);
      setRecordings((prev) => [newTrack, ...prev]);
    }
  };

  const handleDeleteRecording = async (id) => {
    try {
      await deleteRecordingFromDB(id);
      setRecordings((prev) => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error("Failed to delete from DB:", err);
      setRecordings((prev) => prev.filter(r => r.id !== id));
    }
  };

  return (
    <div className="studio-container">
      {currentTab === 'studio' ? (
        <>
          <RecorderCard
            onSaveRecording={handleSaveRecording}
            recordingsCount={recordings.length}
            onNavigateToLibrary={() => setCurrentTab('library')}
          />
          <TunerCard />
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
