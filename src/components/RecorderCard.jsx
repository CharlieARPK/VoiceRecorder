import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Save, FolderOpen, Mic, Square } from 'lucide-react';

export default function RecorderCard({ onSaveRecording, recordingsCount, onOpenSavedList }) {
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
        const defaultName = fileName.trim() || `Recording_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}).replace(':','')}`;
        
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
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

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
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationIdRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#10b981';
      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
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
      {/* Top red round button exactly like image.png */}
      <div className="flex justify-center mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "停止" : "録音スタート"}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
            isRecording 
              ? 'bg-rose-600 animate-pulse ring-4 ring-rose-500/40' 
              : 'bg-[#ef4444] hover:bg-[#dc2626] active:scale-95'
          }`}
        >
          {isRecording ? (
            <Square className="w-6 h-6 text-white fill-white" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white shadow-inner" />
          )}
        </button>
      </div>

      {/* Screen Box (ここに波形) */}
      <div className="screen-box h-40 relative mb-4 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full h-full block"
        />

        {isRecording ? (
          <div className="absolute top-3 right-3 bg-red-600/90 text-white text-xs font-mono px-2.5 py-1 rounded font-bold">
            REC {formatTime(recordingTime)}
          </div>
        ) : !tempRecording ? (
          <span className="absolute text-gray-500 font-mono text-sm pointer-events-none">
            ここに波形（上の赤ボタンで録音）
          </span>
        ) : (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4">
            <span className="text-emerald-400 font-bold text-sm mb-2">✓ 録音完了（{formatTime(tempRecording.duration)}）</span>
            <audio src={tempRecording.url} controls className="w-4/5 h-10 accent-emerald-500" />
          </div>
        )}
      </div>

      {/* Filename Input */}
      <div className="flex items-center gap-2 mb-4 text-left">
        <label className="text-sm font-medium text-gray-400 whitespace-nowrap">ファイル名 :</label>
        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder={tempRecording ? tempRecording.title : "例: アコギアイデア_01"}
          className="flex-grow bg-[#0b0e14] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none transition-colors"
        />
      </div>

      {/* Action Buttons exactly like image.png */}
      <div className="flex justify-between items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!tempRecording}
          className="btn-green flex-1 py-3"
        >
          保存
        </button>
        <button
          onClick={onOpenSavedList}
          className="btn-green flex-1 py-3 flex items-center justify-center gap-2"
        >
          <span>録音した音声を確認 ({recordingsCount})</span>
        </button>
      </div>
    </div>
  );
}
