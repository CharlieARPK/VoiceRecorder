import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Plus, Minus, Volume2, Zap, Radio, Sliders } from 'lucide-react';

export default function Metronome() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [soundType, setSoundType] = useState('click');
  const [subdivision, setSubdivision] = useState(1); // 1 = quarter, 2 = eighths

  // Web Audio API refs
  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0.0);
  const currentBeatInMeasureRef = useRef(0);
  const timerIDRef = useRef(null);
  const isPlayingRef = useRef(false);
  const bpmRef = useRef(120);
  const beatsPerMeasureRef = useRef(4);
  const soundTypeRef = useRef('click');
  const subdivisionRef = useRef(1);

  // Tap tempo state
  const tapTimesRef = useRef([]);

  useEffect(() => {
    bpmRef.current = bpm;
    beatsPerMeasureRef.current = beatsPerMeasure;
    soundTypeRef.current = soundType;
    subdivisionRef.current = subdivision;
  }, [bpm, beatsPerMeasure, soundType, subdivision]);

  const scheduleNote = (beatNumber, time) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Determine if it's the downbeat (accent)
    const isAccent = (beatNumber % (beatsPerMeasureRef.current * subdivisionRef.current)) === 0;
    const isSubBeat = (beatNumber % subdivisionRef.current) !== 0;

    let freq = 800;
    let dur = 0.04;

    if (soundTypeRef.current === 'click') {
      freq = isAccent ? 1200 : isSubBeat ? 600 : 880;
      osc.type = 'sine';
    } else if (soundTypeRef.current === 'woodblock') {
      freq = isAccent ? 1000 : isSubBeat ? 500 : 750;
      osc.type = 'triangle';
      dur = 0.06;
    } else if (soundTypeRef.current === 'digital') {
      freq = isAccent ? 1600 : isSubBeat ? 800 : 1200;
      osc.type = 'square';
      dur = 0.03;
    }

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(isAccent ? 0.8 : isSubBeat ? 0.3 : 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + dur);

    // Update UI beat indicator exactly when the note hits
    const timeUntilNote = (time - audioCtx.currentTime) * 1000;
    setTimeout(() => {
      if (isPlayingRef.current) {
        const displayBeat = Math.floor(beatNumber / subdivisionRef.current) % beatsPerMeasureRef.current;
        setCurrentBeat(displayBeat);
      }
    }, Math.max(0, timeUntilNote));
  };

  const nextNote = () => {
    // Advance current note and time by 16th/8th/quarter note
    const secondsPerBeat = 60.0 / bpmRef.current;
    const secondsPerStep = secondsPerBeat / subdivisionRef.current;
    nextNoteTimeRef.current += secondsPerStep;
    currentBeatInMeasureRef.current++;
  };

  const scheduler = useCallback(() => {
    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + 0.1) {
      scheduleNote(currentBeatInMeasureRef.current, nextNoteTimeRef.current);
      nextNote();
    }
    timerIDRef.current = setTimeout(scheduler, 25);
  }, []);

  const startStop = () => {
    if (isPlaying) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
      setCurrentBeat(-1);
    } else {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      isPlayingRef.current = true;
      setIsPlaying(true);
      currentBeatInMeasureRef.current = 0;
      nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
      scheduler();
    }
  };

  const handleTapTempo = () => {
    const now = Date.now();
    const times = tapTimesRef.current;
    
    // If more than 2.5s since last tap, reset
    if (times.length > 0 && now - times[times.length - 1] > 2500) {
      tapTimesRef.current = [now];
      return;
    }

    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 5) {
      tapTimesRef.current.shift();
    }

    if (tapTimesRef.current.length > 1) {
      let intervals = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calcBpm = Math.round(60000 / avgInterval);
      if (calcBpm >= 30 && calcBpm <= 300) {
        setBpm(calcBpm);
      }
    }
  };

  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Quick preset buttons
  const presets = [
    { label: "Largo (60)", val: 60 },
    { label: "Andante (90)", val: 90 },
    { label: "Moderato (120)", val: 120 },
    { label: "Allegro (140)", val: 140 },
    { label: "Presto (180)", val: 180 }
  ];

  return (
    <div className="studio-card p-6 md:p-8 max-w-xl mx-auto my-4 text-center">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-display font-bold tracking-wide">高精密度スタジオメトロノーム</h2>
        </div>
        
        {/* Sound Type Selector */}
        <select
          value={soundType}
          onChange={(e) => setSoundType(e.target.value)}
          className="studio-select text-xs"
        >
          <option value="click">スタジオ・クリック</option>
          <option value="woodblock">ウッドブロック調</option>
          <option value="digital">デジタル・ビープ</option>
        </select>
      </div>

      {/* Visual LED Beats Display */}
      <div className="bg-black/60 border border-white/10 rounded-2xl p-6 mb-8 shadow-inner">
        <div className="flex justify-center gap-3 md:gap-4 mb-6">
          {Array.from({ length: beatsPerMeasure }).map((_, idx) => {
            const isCurrent = currentBeat === idx;
            const isAccentBeat = idx === 0;
            return (
              <div
                key={idx}
                className={`w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center font-mono font-bold text-lg transition-all duration-100 ${
                  isCurrent 
                    ? isAccentBeat
                      ? 'bg-rose-500 text-white shadow-[0_0_25px_rgba(244,63,94,0.8)] scale-110'
                      : 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.8)] scale-110'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>

        {/* BPM Number readout */}
        <div className="my-2">
          <span className="text-7xl md:text-8xl font-display font-extrabold tracking-tight text-white block">
            {bpm}
          </span>
          <span className="text-sm font-mono tracking-widest text-cyan-400 uppercase">
            Beats Per Minute
          </span>
        </div>

        {/* BPM Slider */}
        <div className="mt-6 px-4">
          <input
            type="range"
            min="30"
            max="280"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-xs font-mono text-gray-500 mt-2">
            <span>30 BPM</span>
            <span>120 BPM</span>
            <span>280 BPM</span>
          </div>
        </div>
      </div>

      {/* Quick Adjustment & Tap Tempo Buttons */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <button
          onClick={() => setBpm(Math.max(30, bpm - 5))}
          className="btn-ghost py-2 rounded-xl text-sm font-mono font-bold"
        >
          -5
        </button>
        <button
          onClick={() => setBpm(Math.max(30, bpm - 1))}
          className="btn-ghost py-2 rounded-xl text-sm font-mono font-bold"
        >
          -1
        </button>
        <button
          onClick={handleTapTempo}
          className="btn-studio bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 py-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5"
        >
          <span>TAP</span>
          <span className="text-[10px] opacity-75">テンポ測定</span>
        </button>
        <button
          onClick={() => setBpm(Math.min(280, bpm + 1))}
          className="btn-ghost py-2 rounded-xl text-sm font-mono font-bold"
        >
          +1
        </button>
        <button
          onClick={() => setBpm(Math.min(280, bpm + 5))}
          className="btn-ghost py-2 rounded-xl text-sm font-mono font-bold"
        >
          +5
        </button>
      </div>

      {/* Time Signature and Subdivision Options */}
      <div className="grid grid-cols-2 gap-4 mb-8 text-left">
        <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
          <label className="block text-xs font-bold text-gray-400 mb-1">拍子 (Time Signature)</label>
          <div className="flex gap-1.5 flex-wrap">
            {[2, 3, 4, 5, 6].map((b) => (
              <button
                key={b}
                onClick={() => setBeatsPerMeasure(b)}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
                  beatsPerMeasure === b
                    ? 'bg-cyan-400 text-black shadow-md'
                    : 'bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                {b}/4
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
          <label className="block text-xs font-bold text-gray-400 mb-1">リズム細分化 (Subdivision)</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSubdivision(1)}
              className={`flex-1 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
                subdivision === 1
                  ? 'bg-cyan-400 text-black shadow-md'
                  : 'bg-black/40 text-gray-400 hover:text-white'
              }`}
            >
              ♩ 4分音符
            </button>
            <button
              onClick={() => setSubdivision(2)}
              className={`flex-1 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
                subdivision === 2
                  ? 'bg-cyan-400 text-black shadow-md'
                  : 'bg-black/40 text-gray-400 hover:text-white'
              }`}
            >
              ♪ 8分音符
            </button>
          </div>
        </div>
      </div>

      {/* Main Play/Stop Button */}
      <button
        onClick={startStop}
        className={`btn-studio text-lg px-10 py-4 w-full shadow-2xl transition-all font-display font-bold tracking-wide ${
          isPlaying
            ? 'btn-danger'
            : 'btn-cyan'
        }`}
      >
        {isPlaying ? (
          <>
            <Pause className="w-6 h-6 animate-pulse" />
            メトロノームを停止する
          </>
        ) : (
          <>
            <Play className="w-6 h-6 fill-current" />
            メトロノームをスタート
          </>
        )}
      </button>

      {/* Presets footer */}
      <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap justify-center gap-2">
        <span className="text-xs text-gray-400 self-center mr-2">おすすめテンポ:</span>
        {presets.map(p => (
          <button
            key={p.val}
            onClick={() => setBpm(p.val)}
            className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-2.5 py-1 rounded-md border border-white/10 font-mono transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
