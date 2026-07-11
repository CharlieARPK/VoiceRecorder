import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Plus, Minus } from 'lucide-react';

export default function MetronomeCard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [subdivision, setSubdivision] = useState(1); // 1: 4分音符, 2: 8分音符, 3: 3連符
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [pendulumAngle, setPendulumAngle] = useState(0); // -32 | +32 | 0

  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0.0);
  const currentStepRef = useRef(0);
  const timerIDRef = useRef(null);
  const isPlayingRef = useRef(false);
  const bpmRef = useRef(90);
  const beatsRef = useRef(4);
  const subRef = useRef(1);

  useEffect(() => {
    bpmRef.current = bpm;
    beatsRef.current = beatsPerMeasure;
    subRef.current = subdivision;
  }, [bpm, beatsPerMeasure, subdivision]);

  const scheduleNote = (stepNumber, time) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const totalStepsPerBeat = subRef.current;
    const beatIndex = Math.floor(stepNumber / totalStepsPerBeat) % beatsRef.current;
    const isDownbeat = stepNumber % (beatsRef.current * totalStepsPerBeat) === 0;
    const isSubBeat = stepNumber % totalStepsPerBeat !== 0;

    const freq = isDownbeat ? 1200 : isSubBeat ? 600 : 880;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(isDownbeat ? 0.8 : isSubBeat ? 0.25 : 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.04);

    const timeUntilNote = (time - audioCtx.currentTime) * 1000;
    setTimeout(() => {
      if (isPlayingRef.current) {
        setCurrentBeat(beatIndex);
        if (stepNumber % totalStepsPerBeat === 0) {
          // Swing real pendulum rod left and right like actual metronome
          setPendulumAngle((prev) => prev <= 0 ? 32 : -32);
        }
      }
    }, Math.max(0, timeUntilNote));
  };

  const nextNote = () => {
    const secondsPerBeat = 60.0 / bpmRef.current;
    const secondsPerStep = secondsPerBeat / subRef.current;
    nextNoteTimeRef.current += secondsPerStep;
    currentStepRef.current++;
  };

  const scheduler = useCallback(() => {
    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + 0.1) {
      scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
      nextNote();
    }
    timerIDRef.current = setTimeout(scheduler, 25);
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
      setCurrentBeat(-1);
      setPendulumAngle(0);
    } else {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
      currentStepRef.current = 0;
      nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
      setPendulumAngle(-32);
      scheduler();
    }
  };

  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return (
    <div className="hardware-card text-center relative">
      {/* 1. Card Header: 「メトロノーム」 */}
      <div className="flex items-center justify-between border-b border-[#30363d] pb-3 mb-5 text-left">
        <h2 className="text-xl font-bold font-sans tracking-wide text-white flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
          <span>メトロノーム</span>
        </h2>
        <span className="text-xs font-mono text-gray-400">
          {isPlaying ? "🎚️ 動作中" : "待機中"}
        </span>
      </div>

      {/* 2. Real Mechanical Metronome Pendulum Rod (棒が左右に動く) */}
      <div className="screen-box h-36 mb-5 relative flex flex-col justify-end items-center overflow-hidden py-3">
        {/* Metronome Triangle/Pyramid Housing Outline */}
        <div className="absolute bottom-2 w-36 h-28 border-b-4 border-l-2 border-r-2 border-[#30363d] rounded-t-3xl opacity-40 pointer-events-none" />
        
        {/* Center vertical guide line */}
        <div className="absolute bottom-3 w-0.5 h-24 bg-[#21262d] pointer-events-none" />

        {/* The Swinging Rod (実際のメトロノームの棒) */}
        <div 
          className="w-1.5 h-28 rounded-full origin-bottom z-10 absolute bottom-3 transition-transform duration-200 ease-in-out shadow-lg"
          style={{
            backgroundColor: isPlaying ? '#10b981' : '#6e7681',
            transform: `rotate(${pendulumAngle}deg)`,
            boxShadow: isPlaying ? '0 0 16px #10b981' : 'none'
          }}
        >
          {/* Sliding Weight Bob on the Rod */}
          <div className="w-5 h-6 bg-gray-200 border-2 border-gray-700 rounded-md shadow-md absolute -left-1.5 top-8 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-gray-500" />
          </div>
        </div>

        {/* Pivot Hinge at the bottom */}
        <div className="w-5 h-5 rounded-full bg-gray-400 border-4 border-[#0b0e14] absolute bottom-2 z-20 shadow" />

        {!isPlaying && (
          <span className="absolute top-4 text-xs font-mono text-gray-500 pointer-events-none">
            【 機械式振り子バー 】
          </span>
        )}
      </div>

      {/* 3. (-) [ 90 ] (+) BPM inline right next to each other (プラスマイナスは数字の横に) */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <button
          onClick={() => setBpm(Math.max(30, bpm - 1))}
          className="w-10 h-10 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white flex items-center justify-center transition-colors font-bold text-lg cursor-pointer active:scale-95"
          title="テンポ -1"
        >
          <Minus className="w-5 h-5" />
        </button>

        <div className="flex items-baseline gap-1.5 px-2 bg-[#0b0e14] border border-[#30363d] rounded-xl py-1">
          <input
            type="number"
            min="30"
            max="300"
            value={bpm}
            onChange={(e) => setBpm(Math.max(30, Math.min(300, Number(e.target.value) || 90)))}
            className="w-20 bg-transparent text-center text-3xl font-mono font-bold text-white focus:text-emerald-400 outline-none transition-colors"
          />
          <span className="text-sm font-bold text-gray-400 pr-1">BPM</span>
        </div>

        <button
          onClick={() => setBpm(Math.min(300, bpm + 1))}
          className="w-10 h-10 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white flex items-center justify-center transition-colors font-bold text-lg cursor-pointer active:scale-95"
          title="テンポ +1"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="text-xs text-gray-400 mb-5 font-sans">（ボックス内を直接タップして数値変更も可能）</div>

      {/* Beat indicators */}
      <div className="flex justify-center gap-4 mb-6">
        {Array.from({ length: beatsPerMeasure }).map((_, idx) => {
          const active = currentBeat === idx;
          return (
            <div
              key={idx}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                active
                  ? idx === 0 
                    ? 'bg-rose-500 scale-125 shadow-[0_0_12px_#ef4444]' 
                    : 'bg-emerald-500 scale-125 shadow-[0_0_12px_#10b981]'
                  : 'bg-[#21262d] border border-[#30363d]'
              }`}
            >
              {active && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
            </div>
          );
        })}
      </div>

      {/* Time Signature and Subdivision dropdowns */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6 pt-4 border-t border-[#30363d] text-sm">
        <select
          value={beatsPerMeasure}
          onChange={(e) => setBeatsPerMeasure(Number(e.target.value))}
          className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-3 py-2 font-mono text-white outline-none cursor-pointer"
        >
          <option value="2">2/4 拍子</option>
          <option value="3">3/4 拍子</option>
          <option value="4">4/4 拍子</option>
          <option value="5">5/4 拍子</option>
          <option value="6">6/8 拍子</option>
        </select>

        <select
          value={subdivision}
          onChange={(e) => setSubdivision(Number(e.target.value))}
          className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-3 py-2 font-sans text-white outline-none cursor-pointer font-bold"
        >
          <option value="1">♩ 4分音符</option>
          <option value="2">♪ 8分音符</option>
          <option value="3">3連符（三連符）</option>
        </select>
      </div>

      {/* Play/Stop button */}
      <button
        onClick={togglePlay}
        className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
          isPlaying 
            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]' 
            : 'btn-green text-white'
        }`}
      >
        {isPlaying ? (
          <>
            <Pause className="w-5 h-5 fill-current" />
            <span>メトロノーム停止</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5 fill-current" />
            <span>メトロノーム再生スタート</span>
          </>
        )}
      </button>
    </div>
  );
}
