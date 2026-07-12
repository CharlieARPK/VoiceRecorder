import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Plus, Minus } from 'lucide-react';

export default function MetronomeCard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [subdivision, setSubdivision] = useState(1);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [pendulumAngle, setPendulumAngle] = useState(0);

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
          setPendulumAngle((prev) => prev <= 0 ? 34 : -34);
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
      setPendulumAngle(-34);
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
    <div className="hardware-card">
      <div className="card-header">
        <h2 className="card-title">メトロノーム</h2>
      </div>

      {/* Real Mechanical Metronome Pendulum Rod drawn on bulletproof SVG (`棒が左右に動く`) */}
      <div className="screen-box" style={{ padding: '16px', marginBottom: '20px' }}>
        <svg viewBox="0 0 400 190" style={{ width: '100%', maxWidth: '380px', margin: '0 auto', display: 'block' }}>
          
          {/* Metronome Housing Outline */}
          <polygon points="130,170 270,170 230,20 170,20" fill="#161b22" stroke="#30363d" strokeWidth="4" />
          
          {/* Center Vertical Scale Line */}
          <line x1="200" y1="25" x2="200" y2="165" stroke="#21262d" strokeWidth="2" />

          {/* Swinging Pendulum Rod around pivot (200, 160) */}
          <g style={{ transform: `rotate(${pendulumAngle}deg)`, transformOrigin: '200px 160px', transition: 'transform 0.16s ease-in-out' }}>
            <line x1="200" y1="160" x2="200" y2="25" stroke={isPlaying ? "#10b981" : "#6e7681"} strokeWidth="6" strokeLinecap="round" />
            
            {/* Sliding Bob Weight on the Rod */}
            <rect x="185" y="65" width="30" height="24" rx="4" fill="#e5e7eb" stroke="#1f2937" strokeWidth="3" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
            <line x1="188" y1="77" x2="212" y2="77" stroke="#4b5563" strokeWidth="2" />
          </g>

          {/* Bottom Pivot Hinge */}
          <circle cx="200" cy="160" r="10" fill="#9ca3af" stroke="#0b0e14" strokeWidth="4" />
        </svg>
      </div>

      {/* (-) [ 90 ] (+) right next to numeric input (100% side-by-side row via .row-nowrap) */}
      <div className="row-nowrap">
        <button
          onClick={() => setBpm(Math.max(30, bpm - 1))}
          className="btn-plus-minus"
          title="-1"
        >
          <Minus style={{ width: '22px', height: '22px' }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0b0e14', border: '1px solid #30363d', borderRadius: '14px', padding: '6px 16px' }}>
          <input
            type="number"
            min="30"
            max="300"
            value={bpm}
            onChange={(e) => setBpm(Math.max(30, Math.min(300, Number(e.target.value) || 90)))}
            style={{ width: '76px', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '32px', fontWeight: 'bold', textAlign: 'center', fontFamily: 'monospace', outline: 'none' }}
          />
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#9ca3af' }}>BPM</span>
        </div>

        <button
          onClick={() => setBpm(Math.min(300, bpm + 1))}
          className="btn-plus-minus"
          title="+1"
        >
          <Plus style={{ width: '22px', height: '22px' }} />
        </button>
      </div>

      {/* Beat indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '20px 0' }}>
        {Array.from({ length: beatsPerMeasure }).map((_, idx) => {
          const active = currentBeat === idx;
          return (
            <div
              key={idx}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? (idx === 0 ? '#ef4444' : '#10b981') : '#21262d',
                border: '1px solid #30363d',
                boxShadow: active ? (idx === 0 ? '0 0 12px #ef4444' : '0 0 12px #10b981') : 'none',
                transform: active ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.12s'
              }}
            />
          );
        })}
      </div>

      {/* Time Signature and Subdivision selects */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', paddingBottom: '20px' }}>
        <select
          value={beatsPerMeasure}
          onChange={(e) => setBeatsPerMeasure(Number(e.target.value))}
          className="input-dark"
          style={{ cursor: 'pointer', fontWeight: 'bold' }}
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
          className="input-dark"
          style={{ cursor: 'pointer', fontWeight: 'bold' }}
        >
          <option value="1">♩ 4分音符</option>
          <option value="2">♪ 8分音符</option>
          <option value="3">3連符（三連符）</option>
        </select>
      </div>

      {/* HUGE Play/Stop Button */}
      <button
        onClick={togglePlay}
        className="btn-green"
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '16px',
          backgroundColor: isPlaying ? '#e11d48 !important' : '',
          background: isPlaying ? 'linear-gradient(180deg, #e11d48 0%, #be123c 100%)' : ''
        }}
      >
        {isPlaying ? (
          <>
            <Pause style={{ width: '20px', height: '20px', fill: '#ffffff' }} />
            <span>停止</span>
          </>
        ) : (
          <>
            <Play style={{ width: '20px', height: '20px', fill: '#ffffff' }} />
            <span>再生</span>
          </>
        )}
      </button>
    </div>
  );
}
