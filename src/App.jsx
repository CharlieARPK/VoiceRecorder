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
  const [isWebView, setIsWebView] = useState(false);
  const wakeLockRef = useRef(null);

  // Detect if opened inside LINE or social media WebView (In-App Browser)
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera || "";
    if (ua.includes("LINE") || ua.includes("Line") || ua.includes("FBAN") || ua.includes("FBAV") || ua.includes("Instagram") || ua.includes("Twitter")) {
      setIsWebView(true);
    }
  }, []);

  // Safe Screen Wake Lock API to prevent phone/screen from sleeping while using the studio app
  const requestWakeLock = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && navigator.wakeLock) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      // Wake Lock might fail or be blocked if battery is low or opened inside LINE WebView
      console.log('Screen Wake Lock error or blocked by WebView:', err);
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

  // Load recordings safely from IndexedDB on initial mount
  useEffect(() => {
    getAllRecordingsFromDB()
      .then((data) => {
        const restored = (data || []).map((item) => {
          try {
            return {
              ...item,
              url: item.blob ? URL.createObjectURL(item.blob) : ""
            };
          } catch (e) {
            return item;
          }
        });
        setRecordings(restored);
      })
      .catch((err) => {
        console.error("Failed to load recordings from DB (possibly restricted inside WebView):", err);
        setRecordings([]);
      });
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
      {/* LINE / In-App WebView Warning Banner */}
      {isWebView && (
        <div style={{ backgroundColor: '#f59e0b', color: '#0b0e14', padding: '12px 16px', borderRadius: '14px', marginBottom: '20px', textAlign: 'left', fontSize: '13px', fontWeight: 'bold', lineHeight: '1.5', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
          ⚠️ LINEやSNSのアプリ内ブラウザで開かれています。
          <br />
          マイクの許可や録音・保存を快適にお使いいただくため、画面右上のメニュー <b>［・・・］</b> または下部アイコンから <b>『Safariで開く』／『Chromeで開く』</b> を選んでブラウザへ切り替えてください！
        </div>
      )}

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
