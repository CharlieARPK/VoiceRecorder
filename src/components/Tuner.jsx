import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Music, Volume2, Sparkles, RefreshCw } from 'lucide-react';

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteColors = {
  "C": "#EF4444", "C#": "#F97316", "D": "#F59E0B", "D#": "#84CC16",
  "E": "#10B981", "F": "#06B6D4", "F#": "#0EA5E9", "G": "#3B82F6",
  "G#": "#6366F1", "A": "#8B5CF6", "A#": "#A855F7", "B": "#EC4899"
};

export default function Tuner() {
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState(null);
  const [noteName, setNoteName] = useState("--");
  const [octave, setOctave] = useState("");
  const [cents, setCents] = useState(0);
  const [a4Freq, setA4Freq] = useState(440);
  const [errorMsg, setErrorMsg] = useState("");

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const bufferRef = useRef(null);

  function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
      let val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // 音が小さい・無音

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE - i; j++) {
        c[i] += buf[j] * buf[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;
    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
  }

  function noteFromPitch(frequency, A4 = a4Freq) {
    let noteNum = 12 * (Math.log(frequency / A4) / Math.log(2));
    return Math.round(noteNum) + 69;
  }

  function frequencyFromNoteNumber(note, A4 = a4Freq) {
    return A4 * Math.pow(2, (note - 69) / 12);
  }

  function centsOffFromPitch(frequency, note, A4 = a4Freq) {
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note, A4)) / Math.log(2));
  }

  const startListening = async () => {
    try {
      setErrorMsg("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      bufferRef.current = new Float32Array(analyser.fftSize);
      setIsListening(true);
      updateTuner();
    } catch (err) {
      console.error(err);
      setErrorMsg("マイクのアクセス許可が見つかりません。スマートフォンの設定やブラウザでマイク権限を許可してください。");
    }
  };

  const stopListening = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsListening(false);
    setPitch(null);
    setNoteName("--");
    setOctave("");
    setCents(0);
  };

  const updateTuner = () => {
    if (!analyserRef.current || !bufferRef.current || !audioContextRef.current) return;

    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    const ac = autoCorrelate(bufferRef.current, audioContextRef.current.sampleRate);

    if (ac === -1) {
      // no signal detected recently
    } else {
      const frequency = ac;
      const noteNum = noteFromPitch(frequency);
      const note = noteStrings[noteNum % 12];
      const oct = Math.floor(noteNum / 12) - 1;
      const centDiff = centsOffFromPitch(frequency, noteNum);

      setPitch(Math.round(frequency * 10) / 10);
      setNoteName(note || "--");
      setOctave(oct);
      setCents(centDiff);
    }

    animationFrameRef.current = requestAnimationFrame(updateTuner);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Determine status color and needle rotation
  const isPerfect = Math.abs(cents) <= 5;
  const statusColor = isPerfect ? "#10B981" : cents < -5 ? "#F59E0B" : "#F43F5E";
  const needleRotation = Math.max(-45, Math.min(45, (cents / 50) * 45));

  return (
    <div className="studio-card p-6 md:p-8 max-w-xl mx-auto my-4 text-center relative overflow-hidden">
      {/* Background glow of current note */}
      {noteName !== "--" && (
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none transition-all duration-300 blur-3xl"
          style={{ backgroundColor: noteColors[noteName] || '#10B981' }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-display font-bold tracking-wide">クロマチック・チューナー</h2>
        </div>
        
        {/* A4 Calibration selector */}
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 text-sm">
          <span className="text-gray-400">基準ピッチ:</span>
          <select 
            value={a4Freq} 
            onChange={(e) => setA4Freq(Number(e.target.value))}
            className="bg-transparent text-emerald-400 font-mono font-bold outline-none cursor-pointer"
          >
            {[436, 437, 438, 439, 440, 441, 442, 443, 444].map(f => (
              <option key={f} value={f} className="bg-gray-900 text-white">{f} Hz</option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 p-3 rounded-xl mb-6 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Meter Screen */}
      <div className="bg-black/60 border border-white/10 rounded-2xl p-6 mb-8 relative shadow-inner">
        {/* Needle Gauge */}
        <div className="relative h-28 flex items-end justify-center overflow-hidden mb-4">
          {/* Gauge background arcs & tick marks */}
          <div className="absolute bottom-0 w-64 h-32 rounded-t-full border-4 border-b-0 border-white/10 flex items-end justify-center">
            <div className="w-1 h-3 bg-emerald-400 absolute top-0" />
            <div className="w-1 h-2 bg-amber-400 absolute top-3 left-8 rotate-[-30deg]" />
            <div className="w-1 h-2 bg-rose-400 absolute top-3 right-8 rotate-[30deg]" />
          </div>

          {/* Cents display labels */}
          <span className="absolute bottom-1 left-4 text-xs font-mono text-amber-400">-50♭</span>
          <span className="absolute top-2 text-xs font-mono font-bold text-emerald-400">0</span>
          <span className="absolute bottom-1 right-4 text-xs font-mono text-rose-400">+50♯</span>

          {/* Dynamic Needle */}
          <div 
            className="w-1 h-24 bg-gradient-to-t from-gray-500 via-white to-white rounded-full origin-bottom tuner-needle z-10 shadow-lg"
            style={{ 
              transform: `rotate(${needleRotation}deg)`,
              boxShadow: `0 0 10px ${statusColor}`
            }}
          />
          <div className="w-4 h-4 bg-gray-800 border-2 border-white rounded-full absolute bottom-0 z-20" />
        </div>

        {/* Note Display */}
        <div className="my-3">
          <div className="inline-flex items-baseline justify-center gap-1 min-h-[90px]">
            <span 
              className="text-7xl font-display font-extrabold tracking-tighter transition-colors duration-200"
              style={{ color: pitch ? statusColor : '#4B5563' }}
            >
              {noteName}
            </span>
            {octave !== "" && (
              <span className="text-3xl font-mono font-bold text-gray-400">{octave}</span>
            )}
          </div>
        </div>

        {/* Cents & Frequency readout */}
        <div className="flex justify-around items-center pt-3 border-t border-white/10 font-mono text-sm">
          <div>
            <span className="text-gray-400 block text-xs">ピッチズレ</span>
            <span 
              className="font-bold text-lg"
              style={{ color: statusColor }}
            >
              {pitch ? `${cents > 0 ? '+' : ''}${cents} cents` : '--'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs">検出周波数</span>
            <span className="text-gray-200 font-bold text-lg">
              {pitch ? `${pitch} Hz` : '-- Hz'}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        {pitch && (
          <div 
            className="mt-4 py-1.5 px-4 rounded-full inline-block text-xs font-bold tracking-wider uppercase transition-all duration-300"
            style={{ 
              backgroundColor: `${statusColor}20`,
              color: statusColor,
              border: `1px solid ${statusColor}60`
            }}
          >
            {isPerfect ? "✓ ピタリ IN TUNE" : cents < 0 ? "◀ フラット (低いため締めよう)" : "シャープ (高いため緩めよう) ▶"}
          </div>
        )}
      </div>

      {/* Control Button */}
      <div className="flex justify-center gap-4">
        {!isListening ? (
          <button
            onClick={startListening}
            className="btn-studio btn-emerald text-lg px-8 py-3.5 w-full max-w-xs shadow-xl"
          >
            <Mic className="w-5 h-5 animate-bounce" />
            チューナーを起動する
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="btn-studio btn-danger text-lg px-8 py-3.5 w-full max-w-xs shadow-xl"
          >
            <MicOff className="w-5 h-5" />
            チューナーを停止する
          </button>
        )}
      </div>

      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>💡 ギター・ベース・ボーカル等のチューニングに対応。静かな場所での使用が最も高精度です。</p>
        <p>📱 Pixel 9 Proの高感度マイク性能をダイレクトに引き出します。</p>
      </div>
    </div>
  );
}
