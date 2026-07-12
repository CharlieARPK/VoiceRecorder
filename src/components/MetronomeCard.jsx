import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Plus, Minus } from 'lucide-react';

const TIME_SIGNATURES = [
  [1, 4], [2, 4], [3, 4], [4, 4],
  [5, 4], [6, 4], [3, 8], [5, 8],
  [6, 8], [7, 8], [9, 8], [12, 8]
];

export default function MetronomeCard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [timeSig, setTimeSig] = useState([6, 8]); // [beats, noteValue]
  const [subdivision, setSubdivision] = useState(1);
  const [accentFirstBeat, setAccentFirstBeat] = useState(true);
  const [currentStep, setCurrentStep] = useState(-1);
  const [pendulumAngle, setPendulumAngle] = useState(0);

  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0.0);
  const currentStepRef = useRef(0);
  const timerIDRef = useRef(null);
  const isPlayingRef = useRef(false);
  const bpmRef = useRef(90);
  const timeSigRef = useRef([6, 8]);
  const subRef = useRef(1);
  const accentRef = useRef(true);

  useEffect(() => {
    bpmRef.current = bpm;
    timeSigRef.current = timeSig;
    subRef.current = subdivision;
    accentRef.current = accentFirstBeat;
  }, [bpm, timeSig, subdivision, accentFirstBeat]);

  const handleTimeSigChange = (newTs) => {
    setTimeSig(newTs);
    if (newTs[1] !== timeSig[1]) {
      setSubdivision(1);
    }
  };

  const getTimingInfo = (ts, sub, currentBpm) => {
    const beats = ts[0];
    const noteVal = ts[1];
    const isCompound = (noteVal === 8 && beats % 3 === 0); // e.g., 3/8, 6/8, 9/8, 12/8

    let secondsPerStep;
    let totalStepsInMeasure;
    let mainBeatsCount;

    if (isCompound) {
      // In 6/8, 9/8, 12/8: BPM represents the dotted quarter note (♩.) tempo
      mainBeatsCount = beats / 3;
      if (sub === 1) { // ♩. (Dotted quarter note)
        secondsPerStep = 60.0 / currentBpm;
        totalStepsInMeasure = mainBeatsCount;
      } else if (sub === 3) { // ♪♪♪ (Eighth notes / 3 per dotted quarter)
        secondsPerStep = (60.0 / currentBpm) / 3.0;
        totalStepsInMeasure = beats;
      } else { // 16th notes (sub === 6)
        secondsPerStep = (60.0 / currentBpm) / 6.0;
        totalStepsInMeasure = beats * 2;
      }
    } else if (noteVal === 8) {
      // For 5/8, 7/8: BPM represents the eighth note (♪) tempo
      mainBeatsCount = beats;
      if (sub === 1) {
        secondsPerStep = 60.0 / currentBpm;
        totalStepsInMeasure = beats;
      } else if (sub === 3) { // Triplets inside eighth note
        secondsPerStep = (60.0 / currentBpm) / 3.0;
        totalStepsInMeasure = beats * 3;
      } else {
        secondsPerStep = (60.0 / currentBpm) / 2.0;
        totalStepsInMeasure = beats * 2;
      }
    } else {
      // For /4 time signatures (1/4, 2/4, 3/4, 4/4, 5/4, 6/4): BPM represents quarter note (♩) tempo
      mainBeatsCount = beats;
      if (sub === 1) { // ♩
        secondsPerStep = 60.0 / currentBpm;
        totalStepsInMeasure = beats;
      } else if (sub === 2) { // ♫ (Eighth notes)
        secondsPerStep = (60.0 / currentBpm) / 2.0;
        totalStepsInMeasure = beats * 2;
      } else if (sub === 3) { // 3連符 (Triplets per quarter note)
        secondsPerStep = (60.0 / currentBpm) / 3.0;
        totalStepsInMeasure = beats * 3;
      } else { // ♬ (Sixteenth notes, sub === 4)
        secondsPerStep = (60.0 / currentBpm) / 4.0;
        totalStepsInMeasure = beats * 4;
      }
    }

    return { secondsPerStep, totalStepsInMeasure, mainBeatsCount, isCompound };
  };

  const scheduleNote = (stepNum, time) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    const { totalStepsInMeasure, isCompound } = getTimingInfo(timeSigRef.current, subRef.current, bpmRef.current);
    const stepInMeasure = stepNum % totalStepsInMeasure;
    const isDownbeat = (stepInMeasure === 0);

    let isMainBeat = false;
    if (isCompound) {
      if (subRef.current === 1) isMainBeat = true;
      else if (subRef.current === 3) isMainBeat = (stepInMeasure % 3 === 0);
      else if (subRef.current === 6) isMainBeat = (stepInMeasure % 6 === 0);
    } else {
      if (subRef.current === 1) isMainBeat = true;
      else if (subRef.current === 2) isMainBeat = (stepInMeasure % 2 === 0);
      else if (subRef.current === 3) isMainBeat = (stepInMeasure % 3 === 0);
      else if (subRef.current === 4) isMainBeat = (stepInMeasure % 4 === 0);
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    let freq = 880;
    let vol = 0.45;

    if (isDownbeat && accentRef.current) {
      freq = 1200;
      vol = 0.85;
    } else if (isMainBeat) {
      freq = 880;
      vol = 0.55;
    } else {
      freq = 600;
      vol = 0.25;
    }

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.04);

    const timeUntilNote = (time - audioCtx.currentTime) * 1000;
    setTimeout(() => {
      if (isPlayingRef.current) {
        setCurrentStep(stepInMeasure);
        if (isMainBeat) {
          setPendulumAngle((prev) => (prev <= 0 ? 34 : -34));
        }
      }
    }, Math.max(0, timeUntilNote));
  };

  const nextNote = () => {
    const { secondsPerStep } = getTimingInfo(timeSigRef.current, subRef.current, bpmRef.current);
    nextNoteTimeRef.current += secondsPerStep;
    currentStepRef.current++;
  };

  const scheduler = useCallback(() => {
    if (!audioContextRef.current) return;
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
      setCurrentStep(-1);
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

  const { totalStepsInMeasure } = getTimingInfo(timeSig, subdivision, bpm);

  return (
    <div className="hardware-card">
      <div className="card-header">
        <h2 className="card-title">メトロノーム</h2>
      </div>

      {/* Real Mechanical Metronome Pendulum Rod drawn on bulletproof SVG */}
      <div className="screen-box" style={{ padding: '16px', marginBottom: '20px' }}>
        <svg viewBox="0 0 400 190" style={{ width: '100%', maxWidth: '380px', margin: '0 auto', display: 'block' }}>
          <polygon points="130,170 270,170 230,20 170,20" fill="#161b22" stroke="#30363d" strokeWidth="4" />
          <line x1="200" y1="25" x2="200" y2="165" stroke="#21262d" strokeWidth="2" />

          <g style={{ transform: `rotate(${pendulumAngle}deg)`, transformOrigin: '200px 160px', transition: 'transform 0.16s ease-in-out' }}>
            <line x1="200" y1="160" x2="200" y2="25" stroke={isPlaying ? "#10b981" : "#6e7681"} strokeWidth="6" strokeLinecap="round" />
            <rect x="185" y="65" width="30" height="24" rx="4" fill="#e5e7eb" stroke="#1f2937" strokeWidth="3" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
            <line x1="188" y1="77" x2="212" y2="77" stroke="#4b5563" strokeWidth="2" />
          </g>

          <circle cx="200" cy="160" r="10" fill="#9ca3af" stroke="#0b0e14" strokeWidth="4" />
        </svg>
      </div>

      {/* (-) [ 90 ] (+) right next to numeric input */}
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

      {/* Beat step indicators */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', margin: '20px 0' }}>
        {Array.from({ length: totalStepsInMeasure }).map((_, idx) => {
          const active = currentStep === idx;
          const isFirst = idx === 0;
          return (
            <div
              key={idx}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? (isFirst && accentFirstBeat ? '#ef4444' : '#10b981') : '#21262d',
                border: '1px solid #30363d',
                boxShadow: active ? (isFirst && accentFirstBeat ? '0 0 10px #ef4444' : '0 0 10px #10b981') : 'none',
                transform: active ? 'scale(1.25)' : 'scale(1)',
                transition: 'all 0.1s'
              }}
            />
          );
        })}
      </div>

      {/* 4x3 Grid of Circular Time Signature Buttons */}
      <div style={{ backgroundColor: '#1e242e', border: '1px solid #30363d', padding: '16px', borderRadius: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
          {TIME_SIGNATURES.map((ts) => {
            const isSelected = (timeSig[0] === ts[0] && timeSig[1] === ts[1]);
            return (
              <button
                key={`${ts[0]}/${ts[1]}`}
                onClick={() => handleTimeSigChange(ts)}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #ffffff' : '1px solid #4b5563',
                  backgroundColor: isSelected ? '#ffffff' : '#3c4553',
                  color: isSelected ? '#21262d' : '#ffffff',
                  boxShadow: isSelected ? '0 4px 14px rgba(255, 255, 255, 0.35)' : '0 2px 4px rgba(0,0,0,0.3)',
                  transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: '900', lineHeight: '16px' }}>{ts[0]}</span>
                <span style={{ width: '22px', height: '2px', backgroundColor: 'currentColor', margin: '2px 0' }} />
                <span style={{ fontSize: '18px', fontWeight: '900', lineHeight: '16px' }}>{ts[1]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rhythmic Subdivision Options */}
      <div style={{ backgroundColor: '#1e242e', border: '1px solid #30363d', padding: '14px', borderRadius: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '8px' }}>
        {timeSig[1] === 8 ? (
          /* For /8 signatures like 6/8: Dotted Quarter Note (♩.), 3 Eighths (♪♪♪), 6 Sixteenths */
          <>
            <button
              onClick={() => setSubdivision(1)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '14px',
                border: subdivision === 1 ? '2px solid #10b981' : '1px solid #30363d',
                backgroundColor: subdivision === 1 ? '#10b981/20' : '#2b333e',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="付点4分音符（基本拍）"
            >
              <svg viewBox="0 0 50 50" style={{ width: '40px', height: '40px', margin: '0 auto' }}>
                <ellipse cx="20" cy="38" rx="6" ry="4" transform="rotate(-20 20 38)" fill="currentColor" />
                <line x1="25" y1="37" x2="25" y2="12" stroke="currentColor" strokeWidth="3" />
                <circle cx="35" cy="36" r="3.5" fill="currentColor" />
              </svg>
            </button>

            <button
              onClick={() => setSubdivision(3)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '14px',
                border: subdivision === 3 ? '2px solid #10b981' : '1px solid #30363d',
                backgroundColor: subdivision === 3 ? '#10b981/20' : '#2b333e',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="8分音符 3連（各拍刻み）"
            >
              <svg viewBox="0 0 60 50" style={{ width: '44px', height: '40px', margin: '0 auto' }}>
                <ellipse cx="12" cy="38" rx="5" ry="3.5" transform="rotate(-20 12 38)" fill="currentColor" />
                <ellipse cx="28" cy="38" rx="5" ry="3.5" transform="rotate(-20 28 38)" fill="currentColor" />
                <ellipse cx="44" cy="38" rx="5" ry="3.5" transform="rotate(-20 44 38)" fill="currentColor" />
                <line x1="16" y1="37" x2="16" y2="15" stroke="currentColor" strokeWidth="3" />
                <line x1="32" y1="37" x2="32" y2="15" stroke="currentColor" strokeWidth="3" />
                <line x1="48" y1="37" x2="48" y2="15" stroke="currentColor" strokeWidth="3" />
                <path d="M 15 15 L 49 15" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </button>

            <button
              onClick={() => setSubdivision(6)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '14px',
                border: subdivision === 6 ? '2px solid #10b981' : '1px solid #30363d',
                backgroundColor: subdivision === 6 ? '#10b981/20' : '#2b333e',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="16分音符 分割"
            >
              <svg viewBox="0 0 60 50" style={{ width: '44px', height: '40px', margin: '0 auto' }}>
                <ellipse cx="14" cy="38" rx="5" ry="3.5" transform="rotate(-20 14 38)" fill="currentColor" />
                <ellipse cx="26" cy="38" rx="5" ry="3.5" transform="rotate(-20 26 38)" fill="currentColor" />
                <ellipse cx="38" cy="38" rx="5" ry="3.5" transform="rotate(-20 38 38)" fill="currentColor" />
                <ellipse cx="50" cy="38" rx="5" ry="3.5" transform="rotate(-20 50 38)" fill="currentColor" />
                <line x1="18" y1="37" x2="18" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <line x1="30" y1="37" x2="30" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <line x1="42" y1="37" x2="42" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <line x1="54" y1="37" x2="54" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <path d="M 17 15 L 55 15 M 17 22 L 55 22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : (
          /* For /4 signatures: Quarter Note (♩), 2 Eighths (♫), 3 Triplets (3連符), 4 Sixteenths (♬) */
          <>
            <button
              onClick={() => setSubdivision(1)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '14px',
                border: subdivision === 1 ? '2px solid #10b981' : '1px solid #30363d',
                backgroundColor: subdivision === 1 ? '#10b981/20' : '#2b333e',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="4分音符（♩）"
            >
              <svg viewBox="0 0 50 50" style={{ width: '36px', height: '36px', margin: '0 auto' }}>
                <ellipse cx="22" cy="38" rx="6" ry="4" transform="rotate(-20 22 38)" fill="currentColor" />
                <line x1="27" y1="37" x2="27" y2="12" stroke="currentColor" strokeWidth="3" />
              </svg>
            </button>

            <button
              onClick={() => setSubdivision(2)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '14px',
                border: subdivision === 2 ? '2px solid #10b981' : '1px solid #30363d',
                backgroundColor: subdivision === 2 ? '#10b981/20' : '#2b333e',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="8分音符（♫）"
            >
              <svg viewBox="0 0 50 50" style={{ width: '36px', height: '36px', margin: '0 auto' }}>
                <ellipse cx="16" cy="38" rx="5" ry="3.5" transform="rotate(-20 16 38)" fill="currentColor" />
                <ellipse cx="36" cy="38" rx="5" ry="3.5" transform="rotate(-20 36 38)" fill="currentColor" />
                <line x1="20" y1="37" x2="20" y2="15" stroke="currentColor" strokeWidth="3" />
                <line x1="40" y1="37" x2="40" y2="15" stroke="currentColor" strokeWidth="3" />
                <path d="M 19 15 L 41 15" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </button>

            <button
              onClick={() => setSubdivision(3)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '14px',
                border: subdivision === 3 ? '2px solid #10b981' : '1px solid #30363d',
                backgroundColor: subdivision === 3 ? '#10b981/20' : '#2b333e',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="3連符（各拍3連）"
            >
              <svg viewBox="0 0 60 50" style={{ width: '42px', height: '36px', margin: '0 auto' }}>
                <ellipse cx="12" cy="38" rx="5" ry="3.5" transform="rotate(-20 12 38)" fill="currentColor" />
                <ellipse cx="28" cy="38" rx="5" ry="3.5" transform="rotate(-20 28 38)" fill="currentColor" />
                <ellipse cx="44" cy="38" rx="5" ry="3.5" transform="rotate(-20 44 38)" fill="currentColor" />
                <line x1="16" y1="37" x2="16" y2="18" stroke="currentColor" strokeWidth="3" />
                <line x1="32" y1="37" x2="32" y2="18" stroke="currentColor" strokeWidth="3" />
                <line x1="48" y1="37" x2="48" y2="18" stroke="currentColor" strokeWidth="3" />
                <path d="M 15 18 L 49 18" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                <text x="30" y="13" textAnchor="middle" fontSize="13" fontWeight="900" fill="currentColor" fontFamily="serif">3</text>
              </svg>
            </button>

            <button
              onClick={() => setSubdivision(4)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '14px',
                border: subdivision === 4 ? '2px solid #10b981' : '1px solid #30363d',
                backgroundColor: subdivision === 4 ? '#10b981/20' : '#2b333e',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="16分音符（♬）"
            >
              <svg viewBox="0 0 60 50" style={{ width: '42px', height: '36px', margin: '0 auto' }}>
                <ellipse cx="14" cy="38" rx="5" ry="3.5" transform="rotate(-20 14 38)" fill="currentColor" />
                <ellipse cx="26" cy="38" rx="5" ry="3.5" transform="rotate(-20 26 38)" fill="currentColor" />
                <ellipse cx="38" cy="38" rx="5" ry="3.5" transform="rotate(-20 38 38)" fill="currentColor" />
                <ellipse cx="50" cy="38" rx="5" ry="3.5" transform="rotate(-20 50 38)" fill="currentColor" />
                <line x1="18" y1="37" x2="18" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <line x1="30" y1="37" x2="30" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <line x1="42" y1="37" x2="42" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <line x1="54" y1="37" x2="54" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <path d="M 17 15 L 55 15 M 17 22 L 55 22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Checkbox: 一拍目にアクセントをつける */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', color: '#f0f6fc', margin: '8px 4px 20px', textAlign: 'left', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={accentFirstBeat}
          onChange={(e) => setAccentFirstBeat(e.target.checked)}
          style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
        />
        <span>一拍目にアクセントをつける</span>
      </label>

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
