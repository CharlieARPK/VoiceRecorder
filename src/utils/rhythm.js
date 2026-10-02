export const TIME_SIGNATURES = [
  [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [3, 8], [5, 8], [6, 8], [7, 8], [9, 8], [12, 8],
];
export const isCompound = ts => ts[1] === 8 && ts[0] % 3 === 0;
export const isOddEighth = ts => ts[1] === 8 && !isCompound(ts);
export const subdivisionsFor = ts => isCompound(ts) ? [1, 3, 6] : isOddEighth(ts) ? [1, 2] : [1, 2, 3, 4];
export const groupsFor = ts => ts[1] !== 8 ? [] : ts[0] === 5 ? ['2+3', '3+2'] : ts[0] === 7 ? ['2+2+3', '2+3+2', '3+2+2'] : [];
export const beatUnit = ts => isCompound(ts) ? '♩.（付点4分音符）' : isOddEighth(ts) ? '♪（8分音符）' : '♩（4分音符）';

export function timingFor(ts, subdivision, bpm) {
  const sub = subdivisionsFor(ts).includes(subdivision) ? subdivision : 1;
  const mainBeatsCount = isCompound(ts) ? ts[0] / 3 : ts[0];
  return {
    secondsPerStep: 60 / bpm / sub,
    totalStepsInMeasure: mainBeatsCount * sub,
    mainBeatsCount,
    subdivision: sub,
  };
}

export function beatFor(step, ts, subdivision, grouping) {
  const timing = timingFor(ts, subdivision, 90);
  const stepInMeasure = step % timing.totalStepsInMeasure;
  const isMainBeat = stepInMeasure % timing.subdivision === 0;
  const beat = stepInMeasure / timing.subdivision;
  let groupAccent = false;
  if (isMainBeat && groupsFor(ts).includes(grouping)) {
    let offset = 0;
    for (const count of grouping.split('+').map(Number)) {
      if (beat === offset) groupAccent = true;
      offset += count;
    }
  }
  return { stepInMeasure, isDownbeat: stepInMeasure === 0, isMainBeat, groupAccent };
}
