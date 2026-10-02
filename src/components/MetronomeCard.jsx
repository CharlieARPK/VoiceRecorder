import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Plus, Minus } from 'lucide-react';
import { readPreference, writePreference } from '../utils/preferences';
import { TIME_SIGNATURES, isCompound, isOddEighth, subdivisionsFor, groupsFor, beatUnit, timingFor, beatFor } from '../utils/rhythm';

const MIN_BPM = 30;
const MAX_BPM = 350;
function resolveTempo(text, fallback) {
  if (text.trim() === '') return fallback;
  const value = Number(text);
  return Number.isFinite(value) ? Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value))) : fallback;
}

export default function MetronomeCard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [bpmDraft, setBpmDraft] = useState('90');
  const [tempoMessage, setTempoMessage] = useState('');
  const bpmInputRef = useRef(null);
  const [timeSig, setTimeSig] = useState([6, 8]);
  const [subdivision, setSubdivision] = useState(1);
  const [accentFirstBeat, setAccentFirstBeat] = useState(true);
  const [grouping, setGrouping] = useState('');
  const [currentStep, setCurrentStep] = useState(-1);
  const [pendulumAngle, setPendulumAngle] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const timerIDRef = useRef(null);
  const isPlayingRef = useRef(false);
  const bpmRef = useRef(90);
  const timeSigRef = useRef([6, 8]);
  const subRef = useRef(1);
  const accentRef = useRef(true);
  const groupingRef = useRef('');
  const settingsReadyRef = useRef(false);
  const tapTimesRef = useRef([]);
  const tapResetRef = useRef(null);
  const nodesRef = useRef(new Set());
  const visualsRef = useRef(new Set());
  const sessionRef = useRef(0);
  const startingRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = readPreference('metronome', {});
      const ts = TIME_SIGNATURES.find(ts => Array.isArray(stored.timeSig) && ts[0] === stored.timeSig[0] && ts[1] === stored.timeSig[1]) || [6, 8];
      const value = resolveTempo(String(stored.bpm ?? 90), 90);
      setBpm(value);
      setBpmDraft(String(value));
      bpmRef.current = value;
      setTimeSig(ts);
      timeSigRef.current = ts;
      const sub = subdivisionsFor(ts).includes(stored.subdivision) ? stored.subdivision : 1;
      setSubdivision(sub);
      subRef.current = sub;
      setAccentFirstBeat(stored.accentFirstBeat !== false);
      accentRef.current = stored.accentFirstBeat !== false;
      const group = groupsFor(ts).includes(stored.grouping) ? stored.grouping : groupsFor(ts)[0] || '';
      setGrouping(group);
      groupingRef.current = group;
      settingsReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    bpmRef.current = bpm;
    timeSigRef.current = timeSig;
    subRef.current = subdivision;
    accentRef.current = accentFirstBeat;
    groupingRef.current = grouping;
    if (settingsReadyRef.current) writePreference('metronome', { bpm, timeSig, subdivision, accentFirstBeat, grouping });
  }, [bpm, timeSig, subdivision, accentFirstBeat, grouping]);

  const applyTempo = value => {
    bpmRef.current = value;
    setBpm(value);
    setBpmDraft(String(value));
  };
  const commitTempo = () => {
    const next = resolveTempo(bpmDraft, bpmRef.current);
    const empty = bpmDraft.trim() === '';
    const clamped = !empty && Number(bpmDraft) !== next;
    applyTempo(next);
    setTempoMessage(empty ? `空欄のため ${next} BPM を維持しました`
      : clamped ? `設定範囲は30〜350 BPMです。${next} BPMに調整しました` : '');
  };
  const adjustTempo = delta => {
    applyTempo(resolveTempo(String(resolveTempo(bpmDraft, bpmRef.current) + delta), bpmRef.current));
    setTempoMessage('');
  };

  const clearScheduled = () => {
    nodesRef.current.forEach(({ osc, gain }) => {
      try { osc.stop(); } catch { /* Already finished. */ }
      osc.disconnect();
      gain.disconnect();
    });
    nodesRef.current.clear();
    visualsRef.current.forEach(id => clearTimeout(id));
    visualsRef.current.clear();
  };
  const restartMeasure = () => {
    clearScheduled();
    currentStepRef.current = 0;
    if (audioContextRef.current) nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
  };
  const handleTimeSigChange = ts => {
    setTimeSig(ts);
    timeSigRef.current = ts;
    const sub = subdivisionsFor(ts).includes(subRef.current) ? subRef.current : 1;
    setSubdivision(sub);
    subRef.current = sub;
    const group = groupsFor(ts)[0] || '';
    setGrouping(group);
    groupingRef.current = group;
    restartMeasure();
  };
  const chooseSubdivision = sub => {
    setSubdivision(sub);
    subRef.current = sub;
    restartMeasure();
  };
  const chooseGrouping = group => {
    setGrouping(group);
    groupingRef.current = group;
    restartMeasure();
  };

  const scheduleNote = (stepNum, time) => {
    const audioCtx = audioContextRef.current;
    const beat = beatFor(stepNum, timeSigRef.current, subRef.current, groupingRef.current);
    const { stepInMeasure, isDownbeat, isMainBeat, groupAccent } = beat;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const accented = accentRef.current && (isDownbeat || groupAccent);
    osc.frequency.value = accented ? (isDownbeat ? 1200 : 1000) : isMainBeat ? 880 : 600;
    gain.gain.setValueAtTime(accented ? 0.7 : isMainBeat ? 0.5 : 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const nodes = { osc, gain };
    nodesRef.current.add(nodes);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      nodesRef.current.delete(nodes);
    };
    osc.start(time);
    osc.stop(time + 0.04);
    const session = sessionRef.current;
    const id = setTimeout(() => {
      visualsRef.current.delete(id);
      if (isPlayingRef.current && session === sessionRef.current) {
        setCurrentStep(stepInMeasure);
        if (isMainBeat) setPendulumAngle(previous => previous <= 0 ? 34 : -34);
      }
    }, Math.max(0, (time - audioCtx.currentTime) * 1000));
    visualsRef.current.add(id);
  };

  const scheduler = () => {
    if (!audioContextRef.current || !isPlayingRef.current) return;
    const ctx = audioContextRef.current;
    // Resume from the present after background throttling instead of playing a backlog.
    if (nextNoteTimeRef.current < ctx.currentTime - 0.2) {
      currentStepRef.current = 0;
      nextNoteTimeRef.current = ctx.currentTime + 0.05;
    }
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      scheduleNote(currentStepRef.current++, nextNoteTimeRef.current);
      nextNoteTimeRef.current += timingFor(timeSigRef.current, subRef.current, bpmRef.current).secondsPerStep;
    }
    timerIDRef.current = setTimeout(scheduler, 25);
  };

  const togglePlay = async () => {
    if (isPlayingRef.current) {
      sessionRef.current++;
      isPlayingRef.current = false;
      setIsPlaying(false);
      clearTimeout(timerIDRef.current);
      clearScheduled();
      setCurrentStep(-1);
      setPendulumAngle(0);
      return;
    }
    if (startingRef.current) return;
    startingRef.current = true;
    setIsStarting(true);
    const session = ++sessionRef.current;
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      if (session !== sessionRef.current) return;
      commitTempo();
      isPlayingRef.current = true;
      setIsPlaying(true);
      restartMeasure();
      setPendulumAngle(-34);
      scheduler();
    } catch {
      setTempoMessage('音を再生できませんでした。もう一度「再生」を押してください。');
    } finally {
      startingRef.current = false;
      if (session === sessionRef.current) setIsStarting(false);
    }
  };

  const tapTempo = event => {
    const now = event.timeStamp;
    const taps = tapTimesRef.current;
    if (taps.length && now - taps[taps.length - 1] > 2500) taps.length = 0;
    taps.push(now);
    if (taps.length > 6) taps.shift();
    setTapCount(taps.length);
    if (taps.length > 1) {
      const interval = (now - taps[0]) / (taps.length - 1);
      applyTempo(resolveTempo(String(Math.round(60000 / interval)), bpmRef.current));
      setTempoMessage('');
    }
    clearTimeout(tapResetRef.current);
    tapResetRef.current = setTimeout(() => { tapTimesRef.current = []; setTapCount(0); }, 2500);
  };

  useEffect(() => () => {
    sessionRef.current++;
    isPlayingRef.current = false;
    clearTimeout(timerIDRef.current);
    clearTimeout(tapResetRef.current);
    clearScheduled();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close().catch(() => {});
  }, []);

  const { totalStepsInMeasure } = timingFor(timeSig, subdivision, bpm);

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
      <div className="tempo-controls">
        <button
          type="button"
          onClick={() => adjustTempo(-1)}
          className="btn-plus-minus"
          title="-1"
          aria-label="テンポを1 BPM下げる"
        >
          <Minus style={{ width: '22px', height: '22px' }} />
        </button>

        <div className="tempo-field">
          <input
            ref={bpmInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            autoComplete="off"
            aria-label="テンポ（BPM）"
            aria-describedby="tempo-help"
            value={bpmDraft}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const text = e.target.value.normalize('NFKC');
              if (/^[0-9]*$/.test(text)) {
                setBpmDraft(text);
                setTempoMessage('');
              }
            }}
            onBlur={commitTempo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#9ca3af' }}>BPM</span>
        </div>

        <button
          type="button"
          onClick={() => adjustTempo(1)}
          className="btn-plus-minus"
          title="+1"
          aria-label="テンポを1 BPM上げる"
        >
          <Plus style={{ width: '22px', height: '22px' }} />
        </button>
      </div>
      <div className="tempo-edit-actions">
        <span id="tempo-help">30〜350 BPM・入力後に決定</span>
        <button type="button" className="tempo-done" onClick={() => {
          commitTempo();
          bpmInputRef.current?.blur();
        }}>決定</button>
      </div>
      <p className="tempo-feedback" role="status">{tempoMessage}</p>
      <p className="beat-unit">BPMの基準：{beatUnit(timeSig)}</p>
      <button type="button" className="tap-tempo" onClick={tapTempo}>
        タップでテンポ設定{tapCount ? `（${tapCount}回）` : ''}
      </button>
      <p className="tuning-guide-hint">一定のリズムで2回以上タップ・設定はこの端末に記憶します</p>

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
                  width: '100%',
                  maxWidth: '60px',
                  aspectRatio: '1',
                  minHeight: '44px',
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

      <div className="rhythm-options" role="group" aria-label="音の刻み">
        {subdivisionsFor(timeSig).map(sub => {
          const labels = isCompound(timeSig)
            ? { 1: '♩. 基本拍', 3: '♪ 8分音符', 6: '♬ 16分音符' }
            : isOddEighth(timeSig) ? { 1: '♪ 8分音符', 2: '♬ 16分音符' }
            : { 1: '♩ 4分音符', 2: '♫ 8分音符', 3: '3連符', 4: '♬ 16分音符' };
          return <button type="button" key={sub} aria-pressed={subdivision === sub}
            onClick={() => chooseSubdivision(sub)}>{labels[sub]}</button>;
        })}
      </div>
      {groupsFor(timeSig).length > 0 && <div className="rhythm-grouping">
        <span>拍のまとまり</span>
        <div className="rhythm-options" role="group" aria-label="拍のまとまり">
          {groupsFor(timeSig).map(group => <button key={group} type="button"
            aria-pressed={grouping === group} onClick={() => chooseGrouping(group)}>{group}</button>)}
        </div>
      </div>}

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
        disabled={isStarting}
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
