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
      alert("マイクへのアクセスを許可してください。");
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

  const inTune = pitch !== null && Math.abs(cents) <= 6;
  const isFlat = pitch !== null && cents < -6;
  const isSharp = pitch !== null && cents > 6;

  const activeColor = !pitch ? "#6e7681" : inTune ? "#10b981" : "#ef4444";
  const needleRotation = !pitch ? 0 : Math.max(-48, Math.min(48, (cents / 50) * 48));

  return (
    <div className="hardware-card mb-6 text-center relative">
      {/* Exact Header: チューナー */}
      <div className="flex items-center justify-between border-b border-[#30363d] pb-3 mb-6 text-left">
        <h2 className="text-xl font-bold font-sans text-white">チューナー</h2>
        <button
          onClick={toggleListening}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
            isListening 
              ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30' 
              : 'bg-[#21262d] text-gray-300 border-[#30363d] hover:text-white'
          }`}
        >
          {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isListening ? "停止" : "起動"}</span>
        </button>
      </div>

      {/* Screen Box with Arc Indicator & Flat/Sharp Triangles */}
      <div className="screen-box p-6 pt-10 pb-6 mb-5 relative min-h-[190px] flex flex-col justify-end items-center">
        
        {/* Circular Arc & Indicator Navigation */}
        <div className="w-full max-w-xs relative h-24 flex justify-center items-end">
          
          {/* Left triangle ▶ right next to left of arc indicator */}
          <div 
            className={`absolute left-8 bottom-6 flex flex-col items-center transition-all duration-150 ${
              isFlat 
                ? 'text-rose-500 scale-125 drop-shadow-[0_0_10px_#ef4444] font-bold' 
                : inTune && pitch 
                  ? 'text-emerald-400 font-bold' 
                  : 'text-gray-700'
            }`}
          >
            <span className="text-3xl font-mono leading-none">▶</span>
          </div>

          {/* Right triangle ◀ right next to right of arc indicator */}
          <div 
            className={`absolute right-8 bottom-6 flex flex-col items-center transition-all duration-150 ${
              isSharp 
                ? 'text-rose-500 scale-125 drop-shadow-[0_0_10px_#ef4444] font-bold' 
                : inTune && pitch 
                  ? 'text-emerald-400 font-bold' 
                  : 'text-gray-700'
            }`}
          >
            <span className="text-3xl font-mono leading-none">◀</span>
          </div>

          {/* Circular Arc (`円弧`) */}
          <div 
            className="tuner-arc w-3/5 absolute bottom-4 flex justify-center"
            style={{ borderTopColor: pitch ? activeColor : '#30363d' }}
          >
            {/* Center target exact indicator */}
            <div 
              className={`w-1.5 h-4 absolute -top-4 rounded-full transition-all ${
                inTune ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]' : 'bg-gray-600'
              }`}
            />
          </div>

          {/* Dynamic Indicator Needle moving across the arc */}
          <div
            className="w-1.5 h-20 rounded-full origin-bottom tuner-needle z-10 absolute bottom-4 transition-transform duration-100 ease-out"
            style={{
              backgroundColor: activeColor,
              transform: `rotate(${needleRotation}deg)`,
              boxShadow: pitch ? `0 0 14px ${activeColor}` : 'none'
            }}
          />
          <div className="w-4 h-4 rounded-full bg-gray-300 border-4 border-[#161b22] absolute bottom-2 z-20" />
        </div>

        {/* Note Display below the gauge */}
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <span
            className="text-6xl font-bold font-mono tracking-tight transition-colors duration-150"
            style={{ color: activeColor }}
          >
            {noteName}
          </span>
          {pitch && (
            <span className="text-sm font-mono text-gray-400 ml-1">
              {pitch} Hz
            </span>
          )}
        </div>
      </div>

      {/* Reference frequency (no extra words) */}
      <div className="flex items-center justify-center gap-2 text-base font-mono">
        <input
          type="number"
          value={a4Freq}
          onChange={(e) => setA4Freq(Number(e.target.value) || 440)}
          className="w-20 bg-[#0b0e14] border border-[#30363d] rounded-lg px-2 py-1 text-center font-bold text-white focus:border-emerald-500 outline-none"
        />
        <span className="text-gray-300 font-sans font-bold">Hz</span>
      </div>
    </div>
  );
}
