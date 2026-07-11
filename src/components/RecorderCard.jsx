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

  // Time-domain amplitude history buffer across horizontal time
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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const defaultName = fileName.trim() || `録音_${new Date().toLocaleDateString('ja-JP').replace(/\//g,'-')}_${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}).replace(':','')}`;
        
        setTempRecording({
          id: Date.now(),
          title: defaultName,
          blob: blob,
          url: url,
          duration: recordingTime,
          date: new Date().toLocaleDateString('ja-JP') + ' ' + new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}),
          fileExt: ext
        });
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

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
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
    if (!tempRecording) return;
    const finalName = fileName.trim() || tempRecording.title;
    onSaveRecording({ ...tempRecording, title: finalName });
    setTempRecording(null);
    setFileName("");
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="hardware-card mb-6 text-center">
      {/* Exact Card Header: 録音 */}
      <div className="flex items-center justify-between border-b border-[#30363d] pb-3 mb-6 text-left">
        <h2 className="text-xl font-bold font-sans text-white">録音</h2>
        {isRecording && (
          <span className="bg-rose-600/90 text-white text-xs font-mono px-3 py-1 rounded-full font-bold animate-pulse">
            REC {formatTime(recordingTime)}
          </span>
        )}
      </div>

      {/* HUGE Prominent Recording Button (w-28 h-28 / w-32 h-32) exactly like image.png */}
      <div className="flex justify-center my-6">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-2xl cursor-pointer ${
            isRecording 
              ? 'bg-rose-600 animate-pulse ring-8 ring-rose-500/30' 
              : 'bg-[#ef4444] hover:bg-[#dc2626] active:scale-95 shadow-[0_0_25px_rgba(239,68,68,0.4)]'
          }`}
        >
          {isRecording ? (
            <Square className="w-12 h-12 text-white fill-white" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white shadow-inner" />
          )}
        </button>
      </div>

      {/* Screen Box (ここに波形) */}
      <div className="screen-box h-44 relative mb-5 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={550}
          height={160}
          className="w-full h-full block"
        />

        {tempRecording && !isRecording && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4">
            <span className="text-emerald-400 font-bold text-sm mb-2">
              ✓ {formatTime(tempRecording.duration)}
            </span>
            <audio src={tempRecording.url} controls className="w-11/12 max-w-sm h-10 accent-emerald-500" />
          </div>
        )}
      </div>

      {/* Filename Input */}
      <div className="flex items-center gap-3 mb-5 text-left">
        <label className="text-sm font-bold text-gray-300 whitespace-nowrap">ファイル名 :</label>
        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder={tempRecording ? tempRecording.title : ""}
          className="flex-grow bg-[#0b0e14] border border-[#30363d] rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 outline-none transition-colors font-mono"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!tempRecording}
          className="btn-green flex-1 py-3.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          保存
        </button>
        <button
          onClick={onNavigateToLibrary}
          className="btn-green flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2"
        >
          <span>録音した音声を確認</span>
        </button>
      </div>
    </div>
  );
}
