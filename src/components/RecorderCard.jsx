import React, { useState, useEffect, useRef } from 'react';
import { Square } from 'lucide-react';

export default function RecorderCard({ onSaveRecording, onUnsavedChange, onNavigateToLibrary }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [fileName, setFileName] = useState("");
  const [tempRecording, setTempRecording] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState('');
  const [replacePrompt, setReplacePrompt] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationIdRef = useRef(null);
  const shouldAutoSaveRef = useRef(false);
  const recordingTimeRef = useRef(0);
  const fileNameRef = useRef("");
  const draftRef = useRef(null);
  const recordingStartedRef = useRef(0);
  const navigateAfterStopRef = useRef(false);
  const startingRef = useRef(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);

  const waveformHistoryRef = useRef([]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const releaseAudio = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
  };

  const saveDraft = async (draft, startNext = false) => {
    if (savingRef.current || !draft) return false;
    savingRef.current = true;
    setIsSaving(true);
    setRecordingMessage('');
    try {
      await onSaveRecording({ ...draft, title: fileNameRef.current.trim() || draft.title });
      draftRef.current = null; // Its URL is now owned by the saved library.
      setTempRecording(null);
      setFileName('');
      fileNameRef.current = '';
      setReplacePrompt(false);
      setRecordingMessage('端末に保存しました');
      if (startNext) await startRecording(true);
      return true;
    } catch {
      setRecordingMessage('端末に保存できませんでした。録音は保持しています。再試行するか、音声をダウンロードしてください。');
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const startRecording = async (replaceConfirmed = false) => {
    if (startingRef.current || mediaRecorderRef.current?.state === 'recording') return;
    if (draftRef.current && !replaceConfirmed) { setReplacePrompt(true); return; }
    if (replaceConfirmed && draftRef.current) {
      URL.revokeObjectURL(draftRef.current.url);
      draftRef.current = null;
      setTempRecording(null);
    }
    startingRef.current = true;
    setIsStarting(true);
    setRecordingMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;
      if (!mountedRef.current) { releaseAudio(); return; }

      const supportedFormat = [
        { mimeType: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' },
        { mimeType: 'audio/mp4', ext: 'm4a' },
        { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
        { mimeType: 'audio/webm', ext: 'webm' }
      ].find(({ mimeType: candidate }) => MediaRecorder.isTypeSupported(candidate));

      const mimeType = supportedFormat?.mimeType || '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      shouldAutoSaveRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (!mountedRef.current) return;
        // The browser can also stop recording (for example, if the mic ends).
        recordingTimeRef.current = Math.floor((performance.now() - recordingStartedRef.current) / 1000);
        setRecordingTime(recordingTimeRef.current);
        releaseAudio();
        setIsRecording(false);
        const cleanMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const ext = cleanMime === 'audio/mp4' ? 'm4a' : cleanMime === 'audio/ogg' ? 'ogg' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: cleanMime });
        const url = URL.createObjectURL(blob);
        const defaultName = fileNameRef.current.trim() || `録音_${new Date().toLocaleDateString('ja-JP').replace(/\//g,'-')}_${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}).replace(':','')}`;
        
        const newRecord = {
          id: Date.now(),
          title: defaultName,
          blob: blob,
          url: url,
          duration: recordingTimeRef.current,
          date: new Date().toLocaleDateString('ja-JP') + ' ' + new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}),
          fileExt: ext
        };

        draftRef.current = newRecord;
        setTempRecording(newRecord);
        setIsFinalizing(false);
        if (shouldAutoSaveRef.current) await saveDraft(newRecord);
        shouldAutoSaveRef.current = false;
        if (navigateAfterStopRef.current) {
          navigateAfterStopRef.current = false;
          onNavigateToLibrary();
        }
      };
      recorder.onerror = () => {
        setRecordingMessage('録音中に問題が発生しました。停止して、音声を確認してください。');
      };

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      if (!mountedRef.current) { releaseAudio(); return; }
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      waveformHistoryRef.current = new Array(150).fill(0.02);

      recorder.start(100);
      setIsRecording(true);
      setTempRecording(null);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      // This clock read runs after microphone permission in a user event, never in render.
      // eslint-disable-next-line react-hooks/purity
      recordingStartedRef.current = performance.now();

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((performance.now() - recordingStartedRef.current) / 1000);
        recordingTimeRef.current = elapsed;
        setRecordingTime(elapsed);
      }, 1000);

      drawWaveform();
    } catch {
      releaseAudio();
      setRecordingMessage('録音を開始できませんでした。ブラウザのマイク許可を確認して、もう一度お試しください。');
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setIsStarting(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      recordingTimeRef.current = Math.floor((performance.now() - recordingStartedRef.current) / 1000);
      setRecordingTime(recordingTimeRef.current);
      setIsFinalizing(true);
      mediaRecorderRef.current.stop();
    }
    releaseAudio();
    setIsRecording(false);
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const draw = () => {
      animationIdRef.current = requestAnimationFrame(draw);
      analyser.getFloatTimeDomainData(dataArray);

      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const abs = Math.abs(dataArray[i]);
        if (abs > peak) peak = abs;
      }
      
      const scaledAmp = Math.min(1.0, Math.max(0.02, peak * 3.5));
      waveformHistoryRef.current.push(scaledAmp);
      if (waveformHistoryRef.current.length > 150) {
        waveformHistoryRef.current.shift();
      }

      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#21262d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      const barWidth = canvas.width / waveformHistoryRef.current.length;
      const centerY = canvas.height / 2;

      for (let i = 0; i < waveformHistoryRef.current.length; i++) {
        const amp = waveformHistoryRef.current[i];
        const barHeight = (amp * canvas.height * 0.85);
        const x = i * barWidth;

        ctx.fillStyle = i === waveformHistoryRef.current.length - 1 ? '#34d399' : '#10b981';
        ctx.fillRect(x, centerY - barHeight / 2, Math.max(1.5, barWidth - 1), barHeight);
      }
    };

    draw();
  };

  const handleSave = () => {
    if (isRecording) {
      shouldAutoSaveRef.current = true;
      stopRecording();
      return;
    }
    if (!tempRecording) return;
    saveDraft(tempRecording);
  };

  const navigateToLibrary = () => {
    if (isStarting || isFinalizing || isSaving) return;
    if (isRecording) {
      navigateAfterStopRef.current = true;
      stopRecording();
    } else {
      onNavigateToLibrary();
    }
  };

  useEffect(() => {
    onUnsavedChange(Boolean(isRecording || isFinalizing || isSaving || tempRecording));
  }, [isRecording, isFinalizing, isSaving, tempRecording, onUnsavedChange]);

  useEffect(() => {
    if (!isRecording && !isFinalizing && !isSaving && !tempRecording) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isRecording, isFinalizing, isSaving, tempRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      releaseAudio();
      if (draftRef.current?.url) URL.revokeObjectURL(draftRef.current.url);
    };
  }, []);

  return (
    <div className="hardware-card">
      <div className="card-header">
        <h2 className="card-title">録音</h2>
        {isRecording && (
          <span style={{ backgroundColor: '#e11d48', color: '#fff', fontSize: '13px', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
            REC {formatTime(recordingTime)}
          </span>
        )}
      </div>

      <button
        onClick={() => isRecording ? stopRecording() : startRecording()}
        disabled={isStarting || isFinalizing || isSaving}
        className={`btn-record-huge ${isRecording ? 'recording' : ''}`}
        title={isRecording ? "停止" : "録音"}
      >
        {isRecording ? (
          <Square style={{ width: '42px', height: '42px', color: '#ffffff', fill: '#ffffff' }} />
        ) : (
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }} />
        )}
      </button>
      {(isStarting || isFinalizing || recordingMessage) && <p className="recorder-status" role="status">
        {isStarting ? 'マイクを準備しています…' : isFinalizing ? '音声をまとめています…' : recordingMessage}
      </p>}
      {replacePrompt && <div className="app-notice" role="group" aria-label="未保存録音の確認">
        <p>未保存の録音があります。次の録音の前に選んでください。</p>
        <button type="button" className="tempo-done" disabled={isSaving} onClick={() => saveDraft(tempRecording, true)}>保存して録音</button>
        <button type="button" className="tempo-done" disabled={isSaving} onClick={() => { setReplacePrompt(false); startRecording(true); }}>破棄して録音</button>
        <button type="button" className="tempo-done" onClick={() => setReplacePrompt(false)}>戻る</button>
      </div>}

      {/* Screen Box (Waveform) */}
      <div className="screen-box" style={{ height: '160px', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          width={560}
          height={160}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {tempRecording && !isRecording && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
              ✓ {formatTime(tempRecording.duration)}
            </span>
            <audio src={tempRecording.url} controls style={{ width: '90%', maxWidth: '320px', height: '40px', accentColor: '#10b981' }} />
          </div>
        )}
      </div>
      {tempRecording && <div className="draft-actions">
        <span>未保存の録音</span>
        <a className="tempo-done" href={tempRecording.url} download={`${fileName.trim() || tempRecording.title}.${tempRecording.fileExt}`}>音声をダウンロード</a>
      </div>}

      {/* Filename Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', textAlign: 'left' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#d1d5db', whiteSpace: 'nowrap' }}>ファイル名 :</label>
        <input
          type="text"
          value={fileName}
          onChange={(e) => {
            setFileName(e.target.value);
            fileNameRef.current = e.target.value;
          }}
          placeholder={tempRecording ? tempRecording.title : ""}
          className="input-dark"
          style={{ flexGrow: 1, minWidth: 0 }}
          disabled={isSaving}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
        <button
          onClick={handleSave}
          disabled={isStarting || isFinalizing || isSaving || (!isRecording && !tempRecording)}
          className="btn-green"
          style={{ flex: 1, opacity: (!isRecording && !tempRecording) ? 0.4 : 1, cursor: (!isRecording && !tempRecording) ? 'not-allowed' : 'pointer' }}
        >
          {isSaving ? '保存中…' : '保存'}
        </button>
        <button
          onClick={navigateToLibrary}
          disabled={isStarting || isFinalizing || isSaving}
          className="btn-green"
          style={{ flex: 1 }}
        >
          録音した音声を確認
        </button>
      </div>
    </div>
  );
}
