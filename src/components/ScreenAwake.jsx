import React, { useEffect, useState } from 'react';
import { readPreference, writePreference } from '../utils/preferences';

export default function ScreenAwake() {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState('requesting');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setEnabled(readPreference('keepAwake', true) !== false);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!restored) return;
    writePreference('keepAwake', enabled);
    let disposed = false;
    let lock = null;
    let requesting = false;
    const acquire = async () => {
      if (disposed || requesting || (lock && !lock.released)) return;
      if (!enabled) { setStatus('off'); return; }
      if (!navigator.wakeLock?.request) { setStatus('unavailable'); return; }
      if (document.visibilityState !== 'visible') { setStatus('released'); return; }
      requesting = true;
      setStatus('requesting');
      try {
        const result = await navigator.wakeLock.request('screen');
        if (disposed || document.visibilityState !== 'visible') {
          await result.release();
          return;
        }
        lock = result;
        setStatus('on');
        result.addEventListener('release', () => {
          if (!disposed) setStatus('released');
        });
      } catch {
        if (!disposed) setStatus('unavailable');
      } finally {
        requesting = false;
      }
    };
    const id = window.setTimeout(acquire, 0);
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', acquire);
      if (lock && !lock.released) lock.release().catch(() => {});
    };
  }, [enabled, restored]);

  const label = { on: '有効', off: 'OFF', requesting: '確認中', unavailable: '利用できません', released: '一時解除中' }[status];
  return (
    <div className="awake-bar">
      <div><span className={status === 'on' ? 'awake-dot active' : 'awake-dot'} />画面スリープ防止
        <small role="status">{label}</small>
      </div>
      <button type="button" aria-pressed={enabled} onClick={() => setEnabled(value => !value)}>
        {enabled ? 'OFFにする' : 'ONにする'}
      </button>
    </div>
  );
}
