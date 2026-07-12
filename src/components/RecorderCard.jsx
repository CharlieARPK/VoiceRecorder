import React, { useState, useEffect, useRef } from 'react';
import { Square } from 'lucide-react';

export default function RecorderCard({ onSaveRecording, recordingsCount, onNavigateToLibrary }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [fileName, setFileName] = useState("");
  const [tempRecording, setTempRecording] = useState(null);

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

  const waveformHistoryRef = useRef([]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;

      let mimeType = 'audio/webm;codecs=opus';
      let ext = 'webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
        mimeType = 'audio/webm;codecs=pcm';
        ext = 'wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        ext = 'm4a';
      } else if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
        ext = 'webm';
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      shouldAutoSaveRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const cleanMime = mimeType ? mimeType.split(';')[0] : 'audio/webm';
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

        if (shouldAutoSaveRef.current) {
          onSaveRecording(newRecord);
          setTempRecording(null);
          setFileName("");
          fileNameRef.current = "";
          shouldAutoSaveRef.current = false;
        } else {
          setTempRecording(newRecord);
        }
      };

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
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

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          recordingTimeRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);

      drawWaveform();
    } catch (err) {
      alert("マイクへのアクセスを許可してください。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
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
    const finalName = fileName.trim() || tempRecording.title;
    onSaveRecording({ ...tempRecording, title: finalName });
    setTempRecording(null);
    setFileName("");
    fileNameRef.current = "";
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
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
        onClick={isRecording ? stopRecording : startRecording}
        className={`btn-record-huge ${isRecording ? 'recording' : ''}`}
        title={isRecording ? "停止" : "録音"}
      >
        {isRecording ? (
          <Square style={{ width: '42px', height: '42px', color: '#ffffff', fill: '#ffffff' }} />
        ) : (
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }} />
        )}
      </button>

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
          style={{ flexGrow: 1 }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
        <button
          onClick={handleSave}
          disabled={!isRecording && !tempRecording}
          className="btn-green"
          style={{ flex: 1, opacity: (!isRecording && !tempRecording) ? 0.4 : 1, cursor: (!isRecording && !tempRecording) ? 'not-allowed' : 'pointer' }}
        >
          保存
        </button>
        <button
          onClick={onNavigateToLibrary}
          className="btn-green"
          style={{ flex: 1 }}
        >
          録音した音声を確認
        </button>
      </div>
    </div>
  );
}
