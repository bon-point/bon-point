import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('cloudflare-v2/src/operations.js','utf8');
const {schedulingPolicy}=await import('../cloudflare-v2/src/operations.js');
const {parisToUTC,acceptedSchedule,validSlot}=schedulingPolicy;

assert.equal(parisToUTC('2026-10-15','13:30'),'2026-10-15T11:30:00.000Z','Paris summer time');
assert.equal(parisToUTC('2026-12-17','18:00'),'2026-12-17T17:00:00.000Z','Paris winter time');
assert.equal(parisToUTC('2026-10-25','09:00'),'2026-10-25T08:00:00.000Z','Paris DST change');
assert.equal(parisToUTC('2026-02-30','18:00'),null,'Reject impossible date');
assert.equal(parisToUTC('2026-10-15','13:15'),null,'Half-hour increments required');
assert.equal(acceptedSchedule('2026-10-15','13:30'),true,'Thursday 13:30 available as proposal');
assert.equal(acceptedSchedule('2026-10-15','13:00'),false,'Thursday before 13:30 rejected');
assert.equal(acceptedSchedule('2026-10-12','18:00'),true,'Weekday 18:00');
assert.equal(acceptedSchedule('2026-10-12','17:30'),false,'Weekday before 18:00');
assert.equal(acceptedSchedule('2026-10-17','10:00'),true,'Saturday proposed');
assert.equal(acceptedSchedule('2026-10-18','18:00'),false,'The weekend ends at 18:00, not a start time');
assert.equal(acceptedSchedule('2026-10-18','17:00','course'),true,'Last one-hour weekend course starts at 17:00');
assert.equal(acceptedSchedule('2026-10-18','17:30','course'),false,'One-hour course must finish by 18:00');
assert.equal(acceptedSchedule('2026-10-18','17:30','intro'),true,'20-minute intro may start at 17:30');
assert.equal(acceptedSchedule('2026-10-18','18:30'),false,'No weekend courses after 18:00');
assert.equal(acceptedSchedule('2026-10-17','08:00'),true,'Weekend starts at 08:00');
assert.equal(acceptedSchedule('2026-10-17','07:30'),false,'No weekend courses before 08:00');

function isoDay(d){return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-')}
const far=new Date(Date.now()+10*86400000);const futureDay=isoDay(far);
const clock=new Date(futureDay+'T12:00:00Z').getUTCDay();
const time=clock===4?'14:00':clock===0||clock===6?'10:00':'18:00';
assert.ok(validSlot(futureDay,time),'Valid future slot');
assert.equal(validSlot('2020-01-01','18:00'),null,'Past slot rejected');

const html=fs.readFileSync('reserver.html','utf8');
const lib=fs.readFileSync('calendrier.js','utf8');
assert.match(html,/id="calendar"/);
assert.match(html,/id="slots"/);
assert.match(html,/id="time"/);
assert.match(html,/name="session_type"/);
assert.match(lib,/Europe\/Paris/);
assert.match(lib,/addDays\(today,3\)/,'Calendar conservatively starts 3 days ahead');
assert.match(src,/\+48\*3600000/,'Server enforces minimum 48 h lead');
assert.match(src,/bookingReminders/);
assert.match(src,/admin_sessions/);
assert.match(src,/session_file_blobs/);
const main=fs.readFileSync('cloudflare-v2/src/index.js','utf8');
assert.match(main,/REQUIRE_CONFIRMED_BOOKING/);
assert.match(main,/slot\.status!=="confirmed"/);
assert.match(main,/bookingReminders\(/);
console.log('OK Paris times, Thursday/weekday/weekend hours, 48 h notice and private services');
