import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { readPreference, writePreference } from '../utils/preferences';

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Standard tuning. Charango strings are arranged in five double-string courses.
const guitarTuning = [
  { label: "1弦", note: "E4", midi: [64] },
  { label: "2弦", note: "B3", midi: [59] },
  { label: "3弦", note: "G3", midi: [55] },
  { label: "4弦", note: "D3", midi: [50] },
  { label: "5弦", note: "A2", midi: [45] },
  { label: "6弦", note: "E2", midi: [40] }
];

const charangoTuning = [
  { label: "1コース", note: "E5", midi: [76] },
  { label: "2コース", note: "A4", midi: [69] },
  { label: "3高", note: "E5", midi: [76] },
  { label: "3低", note: "E4", midi: [64] },
  { label: "4コース", note: "C5", midi: [72] },
  { label: "5コース", note: "G4", midi: [67] }
];

function getCharangoCourse(noteNumber) {
  if (noteNumber === null) return null;

  const matches = charangoTuning.filter(({ midi }) => midi.includes(noteNumber));
  if (matches.length === 0) return null;

  // E5 is shared by the first course and the high string of the third course.
  if (noteNumber === 76) return "1・3コース";
  if (noteNumber === 64) return "3コース（低音弦）";
  return matches[0].label;
}

function TuningGuide({ instrument, title, tuning, detectedNote, playingKey, onPlay }) {
  return (
    <div className="tuning-guide">
      <div className="tuning-guide-title">{title}</div>
      <div className="tuning-strings" style={{ '--string-count': tuning.length }}>
        {tuning.map((string) => {
          const isActive = detectedNote !== null && string.midi.includes(detectedNote);
          const stringKey = `${instrument}-${string.label}`;
          const isPlaying = playingKey === stringKey;
          return (
            <button
              type="button"
              key={string.label}
              onClick={() => onPlay(string.midi, stringKey)}
              className={`tuning-string${isActive ? ' tuning-string-active' : ''}${isPlaying ? ' tuning-string-playing' : ''}`}
              aria-label={`${instrument} ${string.label} ${string.note} の基準音を再生`}
              aria-pressed={isPlaying}
              title={`${string.note}を鳴らす`}
            >
              <span className="tuning-string-number">{string.label}</span>
              <span className="tuning-string-note">{string.note}</span>
            </button>
          );
        })}
      </div>
      <div className="tuning-guide-hint">タップして基準音を再生</div>
    </div>
  );
}

export default function TunerCard() {
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState(null);
  const [noteName, setNoteName] = useState("--");
  const [detectedNote, setDetectedNote] = useState(null);
  const [cents, setCents] = useState(0);
  const [a4Freq, setA4Freq] = useState(440);
  const [a4Draft, setA4Draft] = useState('440');
  const [tunerMessage, setTunerMessage] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [playingKey, setPlayingKey] = useState(null);
  const a4Ref = useRef(440);
  const lastSignalRef = useRef(0);
  const hasSignalRef = useRef(false);
  const lastAnalysisRef = useRef(-Infinity);
  const listenRequestRef = useRef(0);
  const toneRequestRef = useRef(0);
  const listeningRef = useRef(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const bufferRef = useRef(null);
  const toneAudioContextRef = useRef(null);
  const toneOscillatorsRef = useRef([]);
  const toneGainRef = useRef(null);
  const toneTimerRef = useRef(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = readPreference('a4', 440);
      const value = Number.isFinite(stored) && stored >= 400 && stored <= 480 ? stored : 440;
      a4Ref.current = value;
      setA4Freq(value);
      setA4Draft(String(value));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const commitA4 = () => {
    const parsed = a4Draft.trim() === '' ? a4Ref.current : Number(a4Draft);
    const value = Number.isFinite(parsed) ? Math.max(400, Math.min(480, Math.round(parsed * 10) / 10)) : a4Ref.current;
    a4Ref.current = value;
    setA4Freq(value);
    setA4Draft(String(value));
    writePreference('a4', value);
    setTunerMessage(parsed !== value ? '基準周波数は400〜480 Hzで設定してください。' : '');
  };

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
    if (T0 < 1 || T0 >= SIZE - 1 || c[0] <= 0) return -1;
    // Normalize the overlapping samples: raw correlation shrinks at long lags
    // and would incorrectly reject low guitar strings such as E2.
    let leftEnergy = 0, rightEnergy = 0;
    for (let i = 0; i < SIZE - T0; i++) {
      leftEnergy += buf[i] * buf[i];
      rightEnergy += buf[i + T0] * buf[i + T0];
    }
    const overlapEnergy = Math.sqrt(leftEnergy * rightEnergy);
    if (overlapEnergy <= 0 || maxval / overlapEnergy < 0.8) return -1;
    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
  }

  function noteFromPitch(frequency, A4 = a4Ref.current) {
    let noteNum = 12 * (Math.log(frequency / A4) / Math.log(2));
    return Math.round(noteNum) + 69;
  }

  function frequencyFromNoteNumber(note, A4 = a4Ref.current) {
    return A4 * Math.pow(2, (note - 69) / 12);
  }

  function centsOffFromPitch(frequency, note, A4 = a4Ref.current) {
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note, A4)) / Math.log(2));
  }

  const stopReferenceTone = () => {
    toneRequestRef.current++;
    if (toneTimerRef.current) {
      clearTimeout(toneTimerRef.current);
      toneTimerRef.current = null;
    }

    toneOscillatorsRef.current.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may already have stopped naturally.
      }
      oscillator.disconnect();
    });
    toneOscillatorsRef.current = [];

    if (toneGainRef.current) {
      toneGainRef.current.disconnect();
      toneGainRef.current = null;
    }
  };

  const playReferenceTone = async (midiNotes, stringKey) => {
    const ToneAudioContext = window.AudioContext || window.webkitAudioContext;
    if (!ToneAudioContext) return;

    stopReferenceTone();
    const request = toneRequestRef.current;
    setPlayingKey(null);

    if (!toneAudioContextRef.current || toneAudioContextRef.current.state === 'closed') {
      toneAudioContextRef.current = new ToneAudioContext();
    }

    const audioCtx = toneAudioContextRef.current;
    try {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
    } catch {
      setTunerMessage('基準音を再生できませんでした。もう一度タップしてください。');
      return;
    }
    if (request !== toneRequestRef.current || audioCtx.state === 'closed') return;

    const now = audioCtx.currentTime;
    const duration = 1;
    const gain = audioCtx.createGain();
    const peakVolume = 0.16 / Math.sqrt(Math.max(1, midiNotes.length));

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakVolume, now + 0.03);
    gain.gain.setValueAtTime(peakVolume, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(audioCtx.destination);
    toneGainRef.current = gain;

    toneOscillatorsRef.current = midiNotes.map((midiNote) => {
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequencyFromNoteNumber(midiNote), now);
      oscillator.connect(gain);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
      return oscillator;
    });

    setPlayingKey(stringKey);
    toneTimerRef.current = setTimeout(() => {
      toneOscillatorsRef.current.forEach((oscillator) => oscillator.disconnect());
      toneOscillatorsRef.current = [];
      if (toneGainRef.current) toneGainRef.current.disconnect();
      toneGainRef.current = null;
      toneTimerRef.current = null;
      setPlayingKey(null);
    }, (duration + 0.08) * 1000);
  };

  const stopListening = () => {
      listenRequestRef.current++;
      listeningRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
      hasSignalRef.current = false;
  };

  const toggleListening = async () => {
    if (listeningRef.current) {
      stopListening();
      setIsListening(false);
      setPitch(null);
      setNoteName("--");
      setDetectedNote(null);
      setCents(0);
      return;
    }
    if (isStarting) return;
    setIsStarting(true);
    setTunerMessage('');
    const request = ++listenRequestRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false }
      });
      if (request !== listenRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      if (request !== listenRequestRef.current) return;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      bufferRef.current = new Float32Array(analyser.fftSize);
      setIsListening(true);
      listeningRef.current = true;
      lastAnalysisRef.current = -Infinity;
      lastSignalRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(updateTuner);
    } catch {
      if (request === listenRequestRef.current) {
        stopListening();
        setTunerMessage('チューナーを開始できませんでした。ブラウザのマイク許可を確認してください。');
      }
    } finally {
      if (request === listenRequestRef.current || !listeningRef.current) setIsStarting(false);
    }
  };

  const updateTuner = (now) => {
    if (!analyserRef.current || !bufferRef.current || !audioContextRef.current) return;
    if (now - lastAnalysisRef.current < 50) {
      animationFrameRef.current = requestAnimationFrame(updateTuner);
      return;
    }
    lastAnalysisRef.current = now;

    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    const ac = autoCorrelate(bufferRef.current, audioContextRef.current.sampleRate);

    if (Number.isFinite(ac) && ac >= 60 && ac <= 2000) {
      lastSignalRef.current = now;
      hasSignalRef.current = true;
      const frequency = ac;
      const noteNum = noteFromPitch(frequency);
      const note = noteStrings[noteNum % 12];
      const centDiff = centsOffFromPitch(frequency, noteNum);

      setPitch(Math.round(frequency * 10) / 10);
      setNoteName(note || "--");
      setDetectedNote(noteNum);
      setCents(centDiff);
    } else if (hasSignalRef.current && now - lastSignalRef.current >= 300) {
      hasSignalRef.current = false;
      setPitch(null);
      setNoteName('--');
      setDetectedNote(null);
      setCents(0);
    }

    animationFrameRef.current = requestAnimationFrame(updateTuner);
  };

  useEffect(() => {
    return () => {
      stopListening();
      stopReferenceTone();
      if (toneAudioContextRef.current && toneAudioContextRef.current.state !== 'closed') {
        toneAudioContextRef.current.close();
      }
    };
  }, []);

  const inTune = pitch !== null && Math.abs(cents) <= 6;
  const isFlat = pitch !== null && cents < -6;
  const isSharp = pitch !== null && cents > 6;

  const activeColor = !pitch ? "#6e7681" : inTune ? "#10b981" : "#ef4444";
  const needleAngle = !pitch ? 0 : Math.max(-55, Math.min(55, (cents / 50) * 55));
  const charangoCourse = getCharangoCourse(detectedNote);

  return (
    <div className="hardware-card">
      <div className="card-header">
        <h2 className="card-title">チューナー</h2>
        <button
          onClick={toggleListening}
          disabled={isStarting}
          className="btn-green"
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          {isListening ? <MicOff style={{ width: '16px', height: '16px' }} /> : <Mic style={{ width: '16px', height: '16px' }} />}
          <span>{isStarting ? "準備中…" : isListening ? "停止" : "起動"}</span>
        </button>
      </div>
      {isListening && !pitch && <p className="recorder-status">音を待っています…</p>}
      {tunerMessage && <p className="recorder-status" role="status">{tunerMessage}</p>}

      {/* Screen Box with exact SVG viewBox so layout NEVER overlaps or shifts */}
      <div className="screen-box" style={{ padding: '24px 16px', marginBottom: '20px' }}>
        <svg viewBox="0 0 400 210" style={{ width: '100%', maxWidth: '420px', margin: '0 auto', display: 'block' }}>
          
          {/* Left triangle ▶ (FLAT indicator) exactly to the left of the arc */}
          <text 
            x="20" 
            y="145" 
            fontSize="36" 
            fontWeight="bold" 
            fill={isFlat ? "#ef4444" : "#21262d"}
            style={{ filter: isFlat ? 'drop-shadow(0 0 8px #ef4444)' : 'none', transition: 'all 0.15s' }}
          >
            ▶
          </text>

          {/* Right triangle ◀ (SHARP indicator) exactly to the right of the arc */}
          <text 
            x="348" 
            y="145" 
            fontSize="36" 
            fontWeight="bold" 
            fill={isSharp ? "#ef4444" : "#21262d"}
            style={{ filter: isSharp ? 'drop-shadow(0 0 8px #ef4444)' : 'none', transition: 'all 0.15s' }}
          >
            ◀
          </text>

          {/* Circular Arc (`円弧`) */}
          <path
            d="M 60 140 A 140 140 0 0 1 340 140"
            fill="none"
            stroke={pitch ? activeColor : "#30363d"}
            strokeWidth="6"
            strokeLinecap="round"
            style={{ transition: 'stroke 0.15s' }}
          />

          {/* Center target mark along the arc (`真ん中`) */}
          <circle
            cx="200"
            cy="0"
            r="8"
            fill={inTune ? "#10b981" : "#4b5563"}
            style={{ filter: inTune ? 'drop-shadow(0 0 10px #10b981)' : 'none', transition: 'all 0.15s' }}
          />
          <line
            x1="200"
            y1="0"
            x2="200"
            y2="15"
            stroke={inTune ? "#10b981" : "#4b5563"}
            strokeWidth="4"
          />

          {/* Moving Indicator Needle pivoting right along the curve (`インジケーターが動いて`) */}
          <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '200px 140px', transition: 'transform 0.12s ease-out' }}>
            <line
              x1="200"
              y1="140"
              x2="200"
              y2="10"
              stroke={activeColor}
              strokeWidth="5"
              strokeLinecap="round"
              style={{ filter: pitch ? `drop-shadow(0 0 8px ${activeColor})` : 'none' }}
            />
            <circle cx="200" cy="140" r="12" fill="#d1d5db" stroke="#0b0e14" strokeWidth="4" />
          </g>

          {/* Note Name & Frequency Display below the gauge */}
          <text x="200" y="195" textAnchor="middle" fontSize="46" fontWeight="900" fill={activeColor} fontFamily="monospace">
            {noteName}
          </text>
        </svg>

        {pitch && (
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#9ca3af', fontFamily: 'monospace', marginTop: '4px' }}>
            {pitch} Hz
          </div>
        )}

        {pitch && charangoCourse && (
          <div className="charango-course-badge">
            Charango {charangoCourse}
          </div>
        )}
      </div>

      <div className="tuning-guides" aria-label="ギターとチャランゴの標準調弦表">
        <TuningGuide instrument="ギター" title="ギター（標準調弦）" tuning={guitarTuning} detectedNote={detectedNote} playingKey={playingKey} onPlay={playReferenceTone} />
        <TuningGuide instrument="チャランゴ" title="チャランゴ（標準調弦）" tuning={charangoTuning} detectedNote={detectedNote} playingKey={playingKey} onPlay={playReferenceTone} />
      </div>

      {/* Reference frequency */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold' }}>
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          aria-label="A4基準周波数（400〜480 Hz）"
          value={a4Draft}
          onFocus={event => event.currentTarget.select()}
          onChange={event => {
            const text = event.target.value.normalize('NFKC');
            if (/^[0-9]*[.]?[0-9]*$/.test(text)) setA4Draft(text);
          }}
          onBlur={commitA4}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          className="input-dark"
          style={{ width: '80px', textAlign: 'center', fontWeight: 'bold' }}
        />
        <span>Hz</span>
        <button type="button" className="tempo-done" onClick={commitA4}>決定</button>
      </div>
      <p className="tuning-guide-hint">A4基準 {a4Freq} Hz・設定はこの端末に記憶します</p>
    </div>
  );
}
