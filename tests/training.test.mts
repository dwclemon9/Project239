import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays, addMonths, dailySummaries, daysBetween, easyShare, loadStatus,
  monthlySummaries, monthStart, readinessScore, resolveZones, sessionLoad,
  weeklySummaries, weekStart,
} from '../src/lib/training.ts';
import { formatPace, formatRepTime, parseTimeToSeconds, paceSecPerUnit } from '../src/lib/format.ts';
import type { Session } from '../src/lib/types.ts';

function session(over: Partial<Session>): Session {
  return {
    id: 1, date: '2026-08-18', slot: 'am', type: 'easy', title: null,
    distance_m: 16093.44, duration_sec: 4200, intensity: 'easy', rpe: 4,
    surface: null, shoes: null, avg_hr: null, max_hr: null, feel: null, notes: null,
    created_at: '', updated_at: '', ...over,
  };
}

test('weeks run Monday to Sunday', () => {
  assert.equal(weekStart('2026-08-18'), '2026-08-17'); // Tuesday -> Monday
  assert.equal(weekStart('2026-08-17'), '2026-08-17'); // Monday stays put
  assert.equal(weekStart('2026-08-16'), '2026-08-10'); // Sunday belongs to the week before
});

test('date arithmetic does not drift across month ends', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-08-01', '2026-08-18'), 17);
});

test('session load is minutes times RPE, with a per-type fallback', () => {
  assert.equal(sessionLoad(session({ duration_sec: 3600, rpe: 5 })), 300);
  // No RPE on a workout falls back to 8.
  assert.equal(sessionLoad(session({ type: 'workout', duration_sec: 3600, rpe: null })), 480);
  assert.equal(sessionLoad(session({ duration_sec: null })), 0);
});

test('acute:chronic ratio flags a spiked week', () => {
  // Four steady weeks, then a week at triple the usual load.
  const steady: Session[] = [];
  for (let d = 27; d >= 7; d--) {
    steady.push(session({ date: addDays('2026-08-18', -d), duration_sec: 3600, rpe: 5 }));
  }
  const spike: Session[] = [];
  for (let d = 6; d >= 0; d--) {
    spike.push(session({ date: addDays('2026-08-18', -d), duration_sec: 3600 * 3, rpe: 5 }));
  }

  const balanced = loadStatus(steady, '2026-08-18');
  assert.equal(balanced.zone, 'undertrained', 'a week with nothing logged reads as detraining');

  const spiked = loadStatus([...steady, ...spike], '2026-08-18');
  assert.equal(spiked.zone, 'spike');
  assert.ok(spiked.ratio! > 1.5);

  // No history at all must not produce a fake ratio.
  assert.equal(loadStatus([], '2026-08-18').ratio, null);
});

test('weekly summaries keep empty weeks and split by intensity', () => {
  const sessions = [
    session({ date: '2026-08-17', distance_m: 10000, intensity: 'easy' }),
    session({ date: '2026-08-18', distance_m: 5000, intensity: 'hard', type: 'workout' }),
    session({ date: '2026-08-18', slot: 'pm', distance_m: 4000, intensity: 'moderate' }),
  ];
  const weeks = weeklySummaries(sessions, 4, '2026-08-18');

  assert.equal(weeks.length, 4);
  assert.equal(weeks[0].distance_m, 0, 'weeks with nothing logged still appear');
  const current = weeks[3];
  assert.equal(current.start, '2026-08-17');
  assert.equal(current.title, 'Week of Aug 17');
  assert.equal(current.distance_m, 19000);
  assert.equal(current.easy_m, 10000);
  assert.equal(current.moderate_m, 4000);
  assert.equal(current.hard_m, 5000);
  assert.equal(current.sessions, 3);

  assert.equal(easyShare(weeks), 10000 / 19000);
  assert.equal(easyShare([]), null, 'no volume means no share to report');
});

test('month arithmetic wraps the year correctly', () => {
  assert.equal(monthStart('2026-08-18'), '2026-08-01');
  assert.equal(addMonths('2026-01-01', -1), '2025-12-01');
  assert.equal(addMonths('2026-12-01', 1), '2027-01-01');
  assert.equal(addMonths('2026-08-01', -12), '2025-08-01');
});

test('daily summaries cover Monday through Sunday, empty days included', () => {
  const sessions = [
    session({ date: '2026-08-17', distance_m: 10000, intensity: 'easy' }),
    session({ date: '2026-08-19', distance_m: 8000, intensity: 'hard', type: 'workout' }),
    session({ date: '2026-08-19', slot: 'pm', distance_m: 5000, intensity: 'easy' }),
    // Belongs to the following week and must not leak into this one.
    session({ date: '2026-08-24', distance_m: 9999, intensity: 'easy' }),
  ];
  const days = dailySummaries(sessions, '2026-08-19');

  assert.equal(days.length, 7);
  assert.deepEqual(days.map((d) => d.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(days[0].start, '2026-08-17');
  assert.equal(days[6].start, '2026-08-23');

  assert.equal(days[0].distance_m, 10000);
  assert.equal(days[1].distance_m, 0, 'a day off still gets a bucket');
  assert.equal(days[2].distance_m, 13000, 'both halves of a double land on the same day');
  assert.equal(days[2].hard_m, 8000);
  assert.equal(days[2].easy_m, 5000);
  assert.equal(days[2].sessions, 2);
  assert.equal(days.reduce((sum, d) => sum + d.distance_m, 0), 23000, 'next week stays out');
  assert.equal(days[2].title, 'Wed, Aug 19');
});

test('monthly summaries bucket by calendar month and label the year turn', () => {
  const sessions = [
    session({ date: '2025-12-31', distance_m: 6000, intensity: 'easy' }),
    session({ date: '2026-01-01', distance_m: 7000, intensity: 'easy' }),
    session({ date: '2026-01-15', distance_m: 3000, intensity: 'hard', type: 'workout' }),
  ];
  const months = monthlySummaries(sessions, 3, '2026-02-10');

  assert.deepEqual(months.map((m) => m.start), ['2025-12-01', '2026-01-01', '2026-02-01']);
  assert.equal(months[0].distance_m, 6000, 'Dec 31 belongs to December, not January');
  assert.equal(months[1].distance_m, 10000);
  assert.equal(months[1].hard_m, 3000);
  assert.equal(months[2].distance_m, 0);
  assert.equal(months[1].label, "Jan '26", 'January carries the year on the axis');
  assert.equal(months[0].label, 'Dec');
  assert.equal(months[1].title, 'Jan 2026');
});

test('readiness needs enough inputs before it reports a number', () => {
  const base = {
    date: '2026-08-18', sleep_hours: null, sleep_quality: null, soreness: null,
    fatigue: null, stress: null, motivation: null, resting_hr: null,
    body_mass_kg: null, note: null,
  };
  assert.equal(readinessScore({ ...base, sleep_hours: 8 }), null, 'one input is not a score');
  assert.equal(readinessScore(undefined), null);

  const great = readinessScore({ ...base, sleep_hours: 9, sleep_quality: 5, fatigue: 1, soreness: 1 });
  const rough = readinessScore({ ...base, sleep_hours: 4, sleep_quality: 1, fatigue: 5, soreness: 5 });
  assert.equal(great, 100);
  assert.ok(rough! < 30, `a rough morning should score low, got ${rough}`);
});

test('pace zones sit either side of threshold pace', () => {
  const zones = resolveZones(330); // 5:30 /mi threshold
  const threshold = zones.find((z) => z.key === 'threshold')!;
  const easy = zones.find((z) => z.key === 'easy')!;
  const rep = zones.find((z) => z.key === 'rep')!;

  assert.ok(threshold.fastSec < 330 && threshold.slowSec > 330);
  assert.ok(easy.fastSec > threshold.slowSec, 'easy is slower than threshold');
  assert.ok(rep.slowSec < threshold.fastSec, 'reps are faster than threshold');
  // Every zone's "fast" end is genuinely the faster (smaller) number.
  for (const zone of zones) assert.ok(zone.fastSec < zone.slowSec, zone.key);
});

test('time parsing and pace formatting round-trip', () => {
  assert.equal(parseTimeToSeconds('3:18.4'), 198.4);
  assert.equal(parseTimeToSeconds('1:02:30'), 3750);
  assert.equal(parseTimeToSeconds('58'), 58);
  assert.equal(parseTimeToSeconds(''), null);
  assert.equal(parseTimeToSeconds('abc'), null);
  assert.equal(parseTimeToSeconds('1:2:3:4'), null);

  assert.equal(formatRepTime(198.4), '3:18.4');
  assert.equal(formatRepTime(59.97), '1:00', 'rounding must carry into the minute');
  assert.equal(formatRepTime(66), '1:06');

  // A mile in 5:30 is 5:30 per mile.
  assert.equal(formatPace(1609.344, 330, 'mi'), '5:30 /mi');
  assert.equal(formatPace(0, 330, 'mi'), '—', 'no distance means no pace');
  assert.ok(Math.abs(paceSecPerUnit(1000, 200, 'km') - 200) < 1e-9);
});
