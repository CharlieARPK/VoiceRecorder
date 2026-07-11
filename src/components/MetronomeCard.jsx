import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Plus, Minus } from 'lucide-react';

export default function MetronomeCard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [subdivision, setSubdivision] = useState(1); // 1: 4分音符, 2: 8分音符, 3: 3連符
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [pendulumSide, setPendulumSide] = useState('center'); // 'left' | 'right' | 'center'

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
          setPendulumSide((prev) => prev === 'left' ? 'right' : 'left');
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
      setPendulumSide('center');
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
      setPendulumSide('left');
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
      {/* Pendulum / Indicator exactly like image.png */}
      <div className="flex justify-center items-center h-20 mb-4 relative overflow-hidden">
        <div className="flex items-center gap-6 text-gray-500 font-mono text-sm">
          <span className={pendulumSide === 'left' ? 'text-emerald-400 font-bold scale-125 transition-all' : ''}>←</span>
          
          {/* Center stick */}
          <div className="relative w-16 h-16 flex justify-center">
            <div className="absolute top-0 w-1 h-full bg-[#30363d] rounded-full" />
            <div 
              className="absolute top-0 w-1.5 h-14 bg-emerald-500 rounded-full origin-top transition-transform duration-100 ease-in-out shadow-[0_0_10px_#10b981]"
              style={{
                transform: pendulumSide === 'left' ? 'rotate(-24deg)' : pendulumSide === 'right' ? 'rotate(24deg)' : 'rotate(0deg)'
              }}
            />
          </div>

          <span className={pendulumSide === 'right' ? 'text-emerald-400 font-bold scale-125 transition-all' : ''}>→</span>
        </div>
      </div>

      {/* (-) [ 90 ] BPM (+) exactly like image.png with numeric input */}
      <div className="flex items-center justify-center gap-4 mb-2">
        <button
          onClick={() => setBpm(Math.max(30, bpm - 1))}
          className="btn-icon-circle"
          title="テンポ -1"
        >
          <Minus className="w-6 h-6" />
        </button>

        <div className="flex items-baseline gap-2">
          <input
            type="number"
            min="30"
            max="300"
            value={bpm}
            onChange={(e) => setBpm(Math.max(30, Math.min(300, Number(e.target.value) || 90)))}
            className="w-24 bg-[#0b0e14] border border-[#30363d] rounded-xl py-2 text-center text-3xl font-mono font-bold text-white focus:border-emerald-500 outline-none transition-colors"
          />
          <span className="text-xl font-bold text-gray-300">BPM</span>
        </div>

        <button
          onClick={() => setBpm(Math.min(300, bpm + 1))}
          className="btn-icon-circle"
          title="テンポ +1"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="text-xs text-gray-500 mb-6 font-sans">（数値入力も可能に）</div>

      {/* Beat indicators (● ○ ○ ○) */}
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
              {active && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          );
        })}
      </div>

      {/* Time Signature and Subdivision dropdowns (4/4 4分音符 三連符も) */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6 pt-4 border-t border-[#30363d] text-sm">
        <select
          value={beatsPerMeasure}
          onChange={(e) => setBeatsPerMeasure(Number(e.target.value))}
          className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-3 py-1.5 font-mono text-white outline-none cursor-pointer"
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
          className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-3 py-1.5 font-sans text-white outline-none cursor-pointer"
        >
          <option value="1">♩ 4分音符</option>
          <option value="2">♪ 8分音符</option>
          <option value="3">3連符（三連符）</option>
        </select>
      </div>

      {/* Play/Stop button */}
      <button
        onClick={togglePlay}
        className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-md ${
          isPlaying 
            ? 'bg-rose-600 hover:bg-rose-700 text-white' 
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
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
            <span>メトロノーム再生</span>
          </>
        )}
      </button>
    </div>
  );
}
