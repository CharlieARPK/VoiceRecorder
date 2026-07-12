import React, { useState, useEffect, useRef } from 'react';
import RecorderCard from './components/RecorderCard';
import TunerCard from './components/TunerCard';
import MetronomeCard from './components/MetronomeCard';
import SavedRecordingsPage from './components/SavedRecordingsPage';
import { getAllRecordingsFromDB, saveRecordingToDB, deleteRecordingFromDB } from './utils/db';
import './App.css';

export default function App() {
  const [recordings, setRecordings] = useState([]);
  const [currentTab, setCurrentTab] = useState('studio'); // 'studio' | 'library'
  const [keepAwake, setKeepAwake] = useState(true);
  const wakeLockRef = useRef(null);

  // Screen Wake Lock API to prevent phone/screen from sleeping while using the studio app
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      // Wake Lock might fail if battery is low or not permitted by OS
      console.log('Screen Wake Lock error:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.log('Release error:', err);
      }
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && keepAwake) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (keepAwake) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [keepAwake]);

  // Load recordings from IndexedDB on initial mount
  useEffect(() => {
    getAllRecordingsFromDB()
      .then((data) => {
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
      {/* Screen Wake Lock Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '14px', padding: '10px 16px', marginBottom: '20px', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: keepAwake ? '#10b981' : '#6e7681', boxShadow: keepAwake ? '0 0 8px #10b981' : 'none', transition: 'all 0.15s' }} />
          <span style={{ fontWeight: 'bold', color: '#e5e7eb' }}>画面スリープ防止 (常時オン)</span>
        </div>
        <button
          onClick={() => setKeepAwake(!keepAwake)}
          style={{
            backgroundColor: keepAwake ? '#10b981' : '#21262d',
            color: '#ffffff',
            border: keepAwake ? '1px solid #34d399' : '1px solid #30363d',
            padding: '5px 14px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          {keepAwake ? 'ON (有効)' : 'OFF'}
        </button>
      </div>

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
