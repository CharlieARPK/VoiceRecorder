import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, Share2, Save, Sparkles, Tag, Music, Sliders, CheckCircle2, Download, MessageCircle, AlertCircle } from 'lucide-react';

const musicalKeys = [
  "指定なし", "C Major", "C# / Db Major", "D Major", "D# / Eb Major", "E Major", "F Major", 
  "F# / Gb Major", "G Major", "G# / Ab Major", "A Major", "A# / Bb Major", "B Major",
  "A Minor", "E Minor", "B Minor", "F# Minor", "C# Minor", "G# Minor", "D# Minor", 
  "D Minor", "G Minor", "C Minor", "F Minor", "Bb Minor"
];

export default function Recorder({ onSaveRecording }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [visualizerMode, setVisualizerMode] = useState('bars'); // 'bars' | 'wave'
  
  // Track metadata inputs
  const [trackTitle, setTrackTitle] = useState("");
  const [trackKey, setTrackKey] = useState("G Major");
  const [trackBpm, setTrackBpm] = useState(120);
  const [trackLyrics, setTrackLyrics] = useState("");
  
  // Completed recording preview state
  const [latestRecording, setLatestRecording] = useState(null);
  const [shareFeedback, setShareFeedback] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

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

  // Start high-end audio recording
  const startRecording = async () => {
    try {
      setErrorMsg("");
      setLatestRecording(null);
      setShareFeedback(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000
        }
      });
      streamRef.current = stream;

      // Determine best audio mimeType for quality
      let mimeType = 'audio/webm;codecs=opus';
      let fileExt = 'webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
        mimeType = 'audio/webm;codecs=pcm';
        fileExt = 'wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        fileExt = 'm4a';
      } else if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Let browser pick default
        fileExt = 'webm';
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        
        // Generate default title with date if empty
        const defaultTitle = trackTitle.trim() || `音楽アイデア録音 ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        
        const newRecording = {
          id: Date.now(),
          title: defaultTitle,
          key: trackKey,
          bpm: trackBpm,
          lyrics: trackLyrics,
          blob: audioBlob,
          url: url,
          duration: recordingTime,
          date: new Date().toLocaleDateString('ja-JP') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fileExt: fileExt,
          mimeType: mimeType || 'audio/webm'
        };

        setLatestRecording(newRecording);
      };

      // Set up Audio Context and Analyser for visualizer
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      recorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start Visualizer
      drawVisualizer();

    } catch (err) {
      console.error(err);
      setErrorMsg("マイクへのアクセス権限が必要です。Pixel 9 Proのブラウザ設定でマイクを許可してください。");
    }
  };

  const pauseOrResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setIsPaused(true);
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
    setIsPaused(false);
  };

  // Canvas visualizer loop
  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationIdRef.current = requestAnimationFrame(draw);

      if (visualizerMode === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.2;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

          const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
          gradient.addColorStop(0, '#10B981');
          gradient.addColorStop(0.5, '#06B6D4');
          gradient.addColorStop(1, '#F59E0B');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          x += barWidth;
        }
      } else {
        analyser.getByteTimeDomainData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#10B981';
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 10;
        ctx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    draw();
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // LINE Share Logic via Web Share API
  const handleShareToLine = async (track) => {
    if (!track || !track.blob) return;

    try {
      const fileName = `${track.title.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ亜-熙]/g, '_') || 'recording'}.${track.fileExt || 'wav'}`;
      const file = new File([track.blob], fileName, { type: track.blob.type });

      // Check if Web Share API with files is supported on this browser/OS
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: track.title,
          text: `🎸 ${track.title}\n（Key: ${track.key || '指定なし'}, BPM: ${track.bpm || '指定なし'}）\n\n${track.lyrics ? `【メモ/歌詞】\n${track.lyrics}\n\n` : ''}LINEで音声ファイルを送信します！`
        });
        setShareFeedback({ success: true, message: "LINEや共有アプリの画面を開きました！送信先を選択してください。" });
      } else {
        // Fallback for desktop browsers where Web Share API isn't available
        const a = document.createElement('a');
        a.href = track.url;
        a.download = fileName;
        a.click();
        setShareFeedback({ 
          success: true, 
          message: "ファイルがダウンロードされました！LINEのトーク画面にドラッグ＆ドロップして簡単に送信できます。" 
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Share error:", err);
        setShareFeedback({ success: false, message: "共有がキャンセルされたか、お使いの環境で直接共有に対応していません。ダウンロードしてLINEに送信できます。" });
      }
    }
  };

  const handleSaveToLibrary = () => {
    if (!latestRecording) return;
    onSaveRecording(latestRecording);
    setShareFeedback({ success: true, message: "「📁 録音ライブラリ」に保存しました！いつでもLINE共有や再生ができます。" });
  };

  return (
    <div className="max-w-3xl mx-auto my-4 space-y-6">
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0 text-rose-400" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Main Studio Recorder Card */}
      <div className="studio-card p-6 md:p-8 relative overflow-hidden border-t-2 border-t-emerald-500">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <h2 className="text-xl font-display font-bold tracking-wide">
              {isRecording ? "スタジオ録音中 (RAW / 高音質)" : "ミュージシャン・ボイスレコーダー"}
            </h2>
          </div>

          {/* Visualizer mode switcher */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setVisualizerMode('bars')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${visualizerMode === 'bars' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'}`}
            >
              📊 周波数バー
            </button>
            <button
              onClick={() => setVisualizerMode('wave')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${visualizerMode === 'wave' ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'}`}
            >
              〰️ オシロ波形
            </button>
          </div>
        </div>

        {/* Visualizer Canvas & Timer Screen */}
        <div className="bg-black/80 border border-white/10 rounded-2xl p-4 md:p-6 relative shadow-inner mb-6">
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="w-full h-36 md:h-44 rounded-xl bg-black/40 block"
          />

          {/* Overlaid Recording Status & Timer */}
          <div className="absolute top-6 right-6 bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            {isRecording && (
              <span className="inline-block w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            )}
            <span className="font-mono font-extrabold text-2xl md:text-3xl text-emerald-400 tracking-wider">
              {formatTime(recordingTime)}
            </span>
          </div>

          {!isRecording && !latestRecording && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-500 bg-black/30 backdrop-blur-[2px]">
              <Mic className="w-10 h-10 mb-2 opacity-50 text-emerald-400" />
              <p className="font-bold text-sm">下の「🔴 録音スタート」ボタンを押して音楽アイデアを記録</p>
            </div>
          )}
        </div>

        {/* Recording Controls */}
        <div className="flex items-center justify-center gap-4 my-6">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="btn-studio bg-gradient-to-r from-rose-500 to-red-600 text-white font-display font-extrabold text-lg px-10 py-4 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.4)] hover:shadow-[0_0_40px_rgba(244,63,94,0.6)] hover:scale-105 transition-all flex items-center gap-3 w-full sm:w-auto justify-center"
            >
              <div className="w-4 h-4 rounded-full bg-white animate-record-blink" />
              🔴 高音質録音スタート
            </button>
          ) : (
            <>
              <button
                onClick={pauseOrResumeRecording}
                className="btn-ghost px-6 py-4 rounded-2xl font-bold text-base flex items-center gap-2"
              >
                {isPaused ? <Play className="w-5 h-5 text-emerald-400" /> : <Pause className="w-5 h-5 text-amber-400" />}
                {isPaused ? "再開する" : "一時停止"}
              </button>
              
              <button
                onClick={stopRecording}
                className="btn-studio bg-white text-black font-display font-bold text-lg px-8 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"
              >
                <Square className="w-5 h-5 fill-current" />
                録音完了
              </button>
            </>
          )}
        </div>

        {/* Music Idea Metadata & Tags (Always visible or editable) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-gray-300">曲名・キー・BPM・歌詞の同時メモ（録音と一緒に保存・LINE送信されます）</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-400 mb-1">曲タイトル・フレーズ名</label>
              <input
                type="text"
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                placeholder="例: アコギAメロ新リフ"
                className="studio-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">キー (Key)</label>
              <select
                value={trackKey}
                onChange={(e) => setTrackKey(e.target.value)}
                className="studio-select w-full text-sm"
              >
                {musicalKeys.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">テンポ (BPM)</label>
              <input
                type="number"
                value={trackBpm}
                onChange={(e) => setTrackBpm(Number(e.target.value))}
                min="30"
                max="300"
                className="studio-input w-full text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">歌詞アイデア・コード進行・バンドメンバー宛てメモ</label>
            <textarea
              value={trackLyrics}
              onChange={(e) => setTrackLyrics(e.target.value)}
              placeholder="例: G -> D -> Em -> C サビでファルセット高音。LINEで聴いた感想おねがい！"
              rows={2}
              className="studio-input w-full text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Completed Recording Preview & LINE Share Panel */}
      {latestRecording && (
        <div className="studio-card p-6 md:p-8 border-2 border-emerald-500/80 bg-gradient-to-b from-emerald-950/30 to-black/80 animate-fade-in shadow-[0_0_35px_rgba(16,185,129,0.2)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <h3 className="text-lg font-display font-bold text-white">✨ 録音が完了しました！</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              {latestRecording.fileExt.toUpperCase()} 高音質
            </span>
          </div>

          {/* Audio Player Preview */}
          <div className="bg-black/60 p-4 rounded-xl border border-white/10 mb-6">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span className="text-gray-200">{latestRecording.title}</span>
              <span className="font-mono text-gray-400">{formatTime(latestRecording.duration)}</span>
            </div>
            <audio src={latestRecording.url} controls className="w-full h-11 rounded-lg accent-emerald-500" />
          </div>

          {/* Share Feedback Toast */}
          {shareFeedback && (
            <div className={`p-3.5 rounded-xl mb-6 text-sm font-medium flex items-center gap-2.5 ${shareFeedback.success ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'}`}>
              <MessageCircle className="w-5 h-5 shrink-0" />
              <span>{shareFeedback.message}</span>
            </div>
          )}

          {/* Action Buttons: LINE Share + Save to Library */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleShareToLine(latestRecording)}
              className="btn-studio btn-line py-4 text-base shadow-xl flex items-center justify-center gap-2.5 w-full font-bold"
            >
              <Share2 className="w-5 h-5" />
              💚 LINEで友達・グループに送る
            </button>

            <button
              onClick={handleSaveToLibrary}
              className="btn-studio btn-emerald py-4 text-base shadow-xl flex items-center justify-center gap-2.5 w-full font-bold"
            >
              <Save className="w-5 h-5" />
              📁 録音ライブラリに保存する
            </button>
          </div>

          <div className="mt-4 text-center">
            <a
              href={latestRecording.url}
              download={`${latestRecording.title}.${latestRecording.fileExt}`}
              className="text-xs text-gray-400 hover:text-white underline inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              ファイルを直接端末にダウンロードする
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
