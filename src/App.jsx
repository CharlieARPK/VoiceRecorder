import React, { useState, useEffect, useRef } from 'react';
import RecorderCard from './components/RecorderCard';
import TunerCard from './components/TunerCard';
import MetronomeCard from './components/MetronomeCard';
import SavedRecordingsPage from './components/SavedRecordingsPage';
import ScreenAwake from './components/ScreenAwake';
import { getAllRecordingsFromDB, saveRecordingToDB, deleteRecordingFromDB } from './utils/db';
import { APP_VERSION } from './version';
import './App.css';

export default function App() {
  const [recordings, setRecordings] = useState([]);
  const [currentTab, setCurrentTab] = useState('studio');
  const [isWebView, setIsWebView] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [deletedTrack, setDeletedTrack] = useState(null);
  const [libraryMessage, setLibraryMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const busyRef = useRef(false);
  const recordingUrlsRef = useRef(new Set());

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const timer = window.setTimeout(() => setIsWebView(/LINE|FBAN|FBAV|Instagram|Twitter/i.test(ua)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    const ownedUrls = recordingUrlsRef.current;
    getAllRecordingsFromDB().then(data => {
      if (disposed) return;
      const restored = data.map(item => {
        const url = item.blob ? URL.createObjectURL(item.blob) : '';
        if (url) ownedUrls.add(url);
        return { ...item, url };
      });
      setRecordings(previous => {
        const ids = new Set(previous.map(item => item.id));
        return [...previous, ...restored.filter(item => !ids.has(item.id))].sort((a, b) => b.id - a.id);
      });
    }).catch(() => {
      if (!disposed) setLibraryMessage('保存した録音を読み込めませんでした。ページを開き直してお試しください。');
    });
    return () => {
      disposed = true;
      ownedUrls.forEach(url => URL.revokeObjectURL(url));
      ownedUrls.clear();
    };
  }, []);

  const handleSaveRecording = async track => {
    // Let the recorder retain its draft and show a retry/download option on failure.
    await saveRecordingToDB(track);
    if (track.url) recordingUrlsRef.current.add(track.url);
    setRecordings(previous => [track, ...previous.filter(item => item.id !== track.id)]);
  };

  const handleDeleteRecording = async id => {
    if (busyRef.current) return;
    const track = recordings.find(item => item.id === id);
    if (!track || !window.confirm(`「${track.title}」を削除しますか？`)) return;
    busyRef.current = true;
    setIsDeleting(true);
    try {
      await deleteRecordingFromDB(id);
      if (deletedTrack?.url) {
        URL.revokeObjectURL(deletedTrack.url);
        recordingUrlsRef.current.delete(deletedTrack.url);
      }
      setDeletedTrack(track);
      setRecordings(previous => previous.filter(item => item.id !== id));
      setLibraryMessage('');
    } catch {
      setLibraryMessage('削除できませんでした。録音は残っています。もう一度お試しください。');
    } finally {
      busyRef.current = false;
      setIsDeleting(false);
    }
  };

  const undoDelete = async () => {
    if (busyRef.current || !deletedTrack) return;
    busyRef.current = true;
    setIsDeleting(true);
    try {
      await saveRecordingToDB(deletedTrack);
      setRecordings(previous => [deletedTrack, ...previous].sort((a, b) => b.id - a.id));
      setDeletedTrack(null);
      setLibraryMessage('');
    } catch {
      setLibraryMessage('復元できませんでした。もう一度「取り消す」を押してください。');
    } finally {
      busyRef.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <div className="studio-container">
      {isWebView && <div className="app-notice">
        LINEやSNSのアプリ内ブラウザで開かれています。マイクや音声共有を使うには、メニューから「Chromeで開く」または「Safariで開く」を選んでください。
      </div>}
      <ScreenAwake />
      {libraryMessage && <p className="app-notice" role="alert">{libraryMessage}</p>}
      {deletedTrack && <div className="app-notice" role="status">
        <span>「{deletedTrack.title}」を削除しました。次の削除・ページを閉じるまで取り消せます。</span>
        <button type="button" className="tempo-done" disabled={isDeleting} onClick={undoDelete}>取り消す</button>
      </div>}
      {currentTab === 'library' && hasUnsaved && <div className="app-notice">
        <span>未保存の録音を保持しています。スタジオに戻って保存してください。</span>
        <button type="button" className="tempo-done" onClick={() => setCurrentTab('studio')}>録音へ戻る</button>
      </div>}
      {/* Retain the recorder while visiting the library so its unsaved audio survives. */}
      <div hidden={currentTab !== 'studio'}>
        <RecorderCard onSaveRecording={handleSaveRecording}
          onUnsavedChange={setHasUnsaved}
          onNavigateToLibrary={() => setCurrentTab('library')} />
      </div>
      {currentTab === 'studio' ? <>
        <TunerCard />
        <MetronomeCard />
      </> : <SavedRecordingsPage recordings={recordings}
        isDeleting={isDeleting} onDeleteRecording={handleDeleteRecording}
        onBackToStudio={() => setCurrentTab('studio')} />}
      <div className="app-version" aria-label={`アプリバージョン ${APP_VERSION}`}>v{APP_VERSION}</div>
    </div>
  );
}
