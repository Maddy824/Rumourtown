/** Expand the original daytime score into a repeating, authored seven-night week. */
import type { Dossier, ScheduleEntry } from '../../sim/types.js';

export const wakeMinute = (d: Dossier): number => 420 - Math.round(90 * d.traits.conscientiousness);
const week = [0, 1, 2, 3, 4, 5, 6];
const special = ['mira', 'rosa', 'dag', 'rook', 'cass', 'fen', 'lio'];

export function withNight(cast: Dossier[]): Dossier[] {
  const regulars = cast.filter(d => d.communities.includes('inn') && !special.includes(d.id));
  return cast.map(d => {
    const wake = d.id === 'mira' ? 270 : wakeMinute(d);
    const sleep = 930 + Math.round(60 * (1 - d.traits.conscientiousness));
    const schedule: ScheduleEntry[] = [{ start: 0, place: d.home, activity: wake > 360 ? 'sleep' : 'rest' }];
    if (wake > 360) schedule.push({ start: wake - 360, place: d.home, activity: 'rest' });
    for (const e of d.schedule) {
      if (e.start === 0 || e.start + 60 >= 870) continue;
      schedule.push({ ...e, start: e.start + 60, activity: e.activity === 'sleep' ? 'rest' : e.activity });
    }
    const add = (start: number, place: string, activity: ScheduleEntry['activity'], days?: number[]) => schedule.push({ start, place, activity, night: true, ...(days ? { days } : {}) });
    const regularIndex = regulars.findIndex(r => r.id === d.id);
    const nights = regularIndex < 0 ? [] : week.filter(day => (regularIndex - day * 3 + regulars.length * 7) % regulars.length < 5);
    if (d.id === 'rosa') {
      add(900, 'inn', 'work'); add(1110, d.home, 'sleep');
    } else if (d.id === 'dag') {
      add(910, 'bridge', 'work'); add(960, 'square', 'work'); add(990, 'bridge', 'work');
      add(1050, 'bridge-south', 'work'); add(1110, 'square', 'work'); add(1170, 'bridge', 'work'); add(1200, d.home, 'sleep');
    } else if (d.id === 'rook' || d.id === 'cass') {
      add(870, d.home, 'rest'); add(sleep, d.home, 'sleep'); add(960, d.workplace, 'errand', [1, 4]); add(1080, d.home, 'sleep', [1, 4]);
    } else if (d.id === 'fen' || d.id === 'lio') {
      add(920, d.id === 'fen' ? d.workplace : 'bridge', 'secret'); add(1060, d.home, 'sleep');
    } else if (nights.length) {
      add(870, d.home, 'rest', week.filter(day => !nights.includes(day)));
      add(sleep, d.home, 'sleep', week.filter(day => !nights.includes(day)));
      add(910, 'inn', 'talk', nights); add(1110, d.home, 'sleep', nights);
    } else { add(870, d.home, 'rest'); add(sleep, d.home, 'sleep'); }
    if (d.id === 'mira') add(1320, 'bakery', 'work'); // Leave at 04:00; the oven is lit by 04:30.
    else if (wake < 360) add(wake + 1080, d.home, 'rest');
    const secrets = d.secrets.map(s => ({ ...s, window: [s.window[0] + 60, s.window[1] + 60] as [number, number] }));
    if (d.id === 'lio') secrets.push({ id: 'lio-midnight-meeting', kind: 'meeting', description: 'Lio meets a travelling fiddler by the bridge at eleven to exchange a new tune', place: 'bridge', window: [1020, 1040], nightOnly: true, confirms: [], contradicts: [] });
    if (d.id === 'fen') secrets.push({ id: 'fen-late-flock', kind: 'practice', description: 'Fen checks the flock by lantern light and settles a restless lamb', place: d.workplace, window: [1020, 1040], nightOnly: true, confirms: [], contradicts: [] });
    return { ...d, schedule: schedule.sort((a, b) => a.start - b.start), secrets };
  });
}
