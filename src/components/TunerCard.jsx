import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export default function TunerCard() {
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState(null);
  const [noteName, setNoteName] = useState("--");
  const [cents, setCents] = useState(0);
  const [a4Freq, setA4Freq] = useState(440);

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
    if (rms < 0.01) return -1;

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

  const toggleListening = async () => {
    if (isListening) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      setIsListening(false);
      setPitch(null);
      setNoteName("--");
      setCents(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false }
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
      alert("チューナーを使用するにはマイクへのアクセスを許可してください。");
    }
  };

  const updateTuner = () => {
    if (!analyserRef.current || !bufferRef.current || !audioContextRef.current) return;

    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    const ac = autoCorrelate(bufferRef.current, audioContextRef.current.sampleRate);

    if (ac !== -1) {
      const frequency = ac;
      const noteNum = noteFromPitch(frequency);
      const note = noteStrings[noteNum % 12];
      const centDiff = centsOffFromPitch(frequency, noteNum);

      setPitch(Math.round(frequency * 10) / 10);
      setNoteName(note || "--");
      setCents(centDiff);
    }

    animationFrameRef.current = requestAnimationFrame(updateTuner);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Tuner bar behavior: Red when out of range, turns Green when within +/- 15 cents
  const inTune = pitch !== null && Math.abs(cents) <= 15;
  const activeColor = !pitch ? "#6e7681" : inTune ? "#10b981" : "#ef4444";
  const needleRotation = Math.max(-45, Math.min(45, (cents / 50) * 45));

  return (
    <div className="hardware-card mb-6 text-center relative">
      <button
        onClick={toggleListening}
        className={`absolute top-4 right-4 p-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
          isListening 
            ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30' 
            : 'bg-[#21262d] text-gray-400 border-[#30363d] hover:text-white'
        }`}
      >
        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        <span>{isListening ? "チューナー停止" : "チューナー起動"}</span>
      </button>

      {/* Screen box with curved gauge exactly like image.png */}
      <div className="screen-box p-6 pt-10 pb-4 mb-4 relative min-h-[160px] flex flex-col justify-end items-center">
        {/* Left and Right arrows (► ... ◄) and center tick */}
        <div className="w-4/5 relative h-20 flex justify-center items-end">
          <span className="absolute left-0 bottom-8 text-gray-500 font-mono text-lg font-bold">►</span>
          <span className="absolute right-0 bottom-8 text-gray-500 font-mono text-lg font-bold">◄</span>
          
          {/* Curved Arc */}
          <div 
            className="tuner-arc w-full absolute bottom-4 flex justify-center"
            style={{ borderTopColor: pitch ? activeColor : '#30363d' }}
          >
            {/* Top center mark */}
            <div 
              className="w-1 h-3 absolute -top-3 rounded-full" 
              style={{ backgroundColor: activeColor }}
            />
          </div>

          {/* Dynamic Needle */}
          <div
            className="w-1 h-16 rounded-full origin-bottom tuner-needle z-10 absolute bottom-4"
            style={{
              backgroundColor: activeColor,
              transform: `rotate(${needleRotation}deg)`,
              boxShadow: pitch ? `0 0 12px ${activeColor}` : 'none'
            }}
          />
          <div className="w-3 h-3 rounded-full bg-gray-600 border-2 border-[#161b22] absolute bottom-3 z-20" />
        </div>

        {/* Big Note Display right below the gauge */}
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span
            className="text-6xl font-bold font-mono tracking-tight transition-colors duration-150"
            style={{ color: activeColor }}
          >
            {noteName}
          </span>
          {pitch && (
            <span className="text-sm font-mono text-gray-400 ml-2">
              {pitch} Hz ({cents > 0 ? `+${cents}` : cents})
            </span>
          )}
        </div>
      </div>

      {/* Editable A4 frequency below exactly like image.png */}
      <div className="flex items-center justify-center gap-2 text-base font-mono">
        <input
          type="number"
          value={a4Freq}
          onChange={(e) => setA4Freq(Number(e.target.value) || 440)}
          className="w-20 bg-[#0b0e14] border border-[#30363d] rounded px-2 py-1 text-center font-bold text-white focus:border-emerald-500 outline-none"
        />
        <span className="text-gray-300 font-sans">Hz</span>
        <span className="text-sm text-gray-500 font-sans">（ここは編集可能）</span>
      </div>
    </div>
  );
}
