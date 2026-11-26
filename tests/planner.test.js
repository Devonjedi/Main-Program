// Run with: node tests/planner.test.js
// Checks the planning rules, including the Accuracy and Responsiveness requirements.
const assert = require('node:assert/strict');
const Planner = require('../js/planner.js');
const Dates = require('../js/dates.js');

const TODAY = '2026-10-19'; // a Monday
const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const makeTopics = (names, hours) => names.map((name, index) => ({ id: `m${index}`, name, hours }));
const numbered = (count) => Array.from({ length: count }, (_, index) => `Topic ${index + 1}`);
const course = { name: 'Calculus I', examDate: '2026-11-02', days: ['mon', 'wed', 'fri'], hours: '2' };

// Five scenarios with different exam dates, study days, hours per day, and topic counts.
// The third exactly fills the available time (3 study days x 2 hours = 6 hours of topics).
const SCENARIOS = [
  { label: '14 days, Mon/Wed/Fri, 2h, 6 topics', course, topics: makeTopics(numbered(6), 1.5) },
  { label: '7 days, every day, 1h, 5 topics', course: { name: 'B', examDate: '2026-10-26', days: ALL_DAYS, hours: '1' }, topics: makeTopics(numbered(5), 1) },
  { label: 'exact fill: 3 days x 2h, 3 topics x 2h', course: { name: 'C', examDate: '2026-10-24', days: ['mon', 'wed', 'fri'], hours: '2' }, topics: makeTopics(numbered(3), 2) },
  { label: '30 days, weekends, 4h, 8 topics', course: { name: 'D', examDate: '2026-11-18', days: ['sat', 'sun'], hours: '4' }, topics: makeTopics(numbered(8), 2) },
  { label: '60 days, Tue/Thu, 0.5h, 9 topics', course: { name: 'E', examDate: '2026-12-18', days: ['tue', 'thu'], hours: '0.5' }, topics: makeTopics(numbered(9), 0.5) }
];

// Accuracy rules: every topic scheduled exactly once, no day over its hours,
// no topic on an unselected day, and nothing on or after the exam date.
function checkPlan(plan, scenario) {
  const placed = Planner.planItems(plan).map((item) => item.id).sort();
  assert.deepEqual(placed, scenario.topics.map((topic) => topic.id).sort(), `${scenario.label}: each topic once`);
  plan.days.forEach((day) => {
    assert.ok(Planner.usedHours(day) <= Number(scenario.course.hours), `${scenario.label}: day not over-filled`);
    assert.ok(scenario.course.days.includes(Dates.weekday(day.date)), `${scenario.label}: selected days only`);
    assert.ok(day.date >= TODAY && day.date < scenario.course.examDate, `${scenario.label}: before the exam`);
  });
}

const tests = {
  'course validation catches each missing field': () => {
    const errors = Planner.validateCourse({ name: '', examDate: '', days: [], hours: '' }, TODAY);
    assert.deepEqual(Object.keys(errors).sort(), ['days', 'examDate', 'hours', 'name']);
    assert.deepEqual(Planner.validateCourse(course, TODAY), {});
  },
  'the exam must be after today': () => {
    assert.ok(Planner.validateCourse({ ...course, examDate: TODAY }, TODAY).examDate);
  },
  'a single topic needs a name and hours from 0.5 to 12': () => {
    assert.deepEqual(Object.keys(Planner.validateTopic('', '0')), ['name', 'hours']);
    assert.deepEqual(Object.keys(Planner.validateTopic('Limits', '13')), ['hours']);
    assert.deepEqual(Object.keys(Planner.validateTopic('Limits', 'abc')), ['hours']);
    assert.deepEqual(Planner.validateTopic('Limits', '3'), {});
  },
  'a pasted list reads "Name, hours" and defaults to 1 hour': () => {
    const result = Planner.parseTopicList('Derivatives, 4\n\nSeries');
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.topics.map((t) => [t.name, t.hours]), [['Derivatives', 4], ['Series', 1]]);
  },
  'a pasted line with bad hours is reported by line number': () => {
    const result = Planner.parseTopicList('Limits, 20');
    assert.deepEqual(result.errors, ['Line 1: hours must be a number between 0.5 and 12.']);
  },
  'Story 3: four 2-hour topics land on today and the next three days': () => {
    const all = { name: 'Calculus I', examDate: '2026-11-02', days: ALL_DAYS, hours: '2' };
    const four = makeTopics(['Limits', 'Derivatives', 'Integrals', 'Series'], 2);
    const days = Planner.buildPlan(all, four, TODAY).plan.days.slice(0, 4);
    assert.deepEqual(days.map((day) => [day.date, day.items[0].name]), [
      ['2026-10-19', 'Limits'], ['2026-10-20', 'Derivatives'], ['2026-10-21', 'Integrals'], ['2026-10-22', 'Series']
    ]);
  },
  'Story 3: exam tomorrow with 8 hours of topics needs 6 more hours': () => {
    const rushed = { name: 'Calculus I', examDate: '2026-10-20', days: ALL_DAYS, hours: '2' };
    const result = Planner.buildPlan(rushed, makeTopics(['A', 'B', 'C', 'D'], 2), TODAY);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /^You need 6 more hours/);
  },
  'Story 3: a 3-hour topic does not fit a 2-hour day': () => {
    const result = Planner.buildPlan(course, makeTopics(['Proofs'], 3), TODAY);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /“Proofs” takes 3 hours, but each study day has only 2 hours/);
  },
  'Accuracy: names are kept character for character and 10 lines make 10 topics': () => {
    const long = 'L'.repeat(100);
    const names = ["Ohm's Law (Ch. 2)", 'Week 3: Limits & Derivatives', long, 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const result = Planner.parseTopicList(names.join('\n'));
    assert.equal(result.topics.length, 10);
    assert.deepEqual(result.topics.map((topic) => topic.name), names);
  },
  'Accuracy: 5 scenarios, every plan obeys all four rules': () => {
    SCENARIOS.forEach((scenario) => {
      const result = Planner.buildPlan(scenario.course, scenario.topics, TODAY);
      assert.equal(result.ok, true, scenario.label);
      checkPlan(result.plan, scenario);
    });
  },
  'Responsiveness: 30 one-hour topics, 7 days at 2h, exam 60 days away, under 2 seconds': () => {
    const big = { name: 'Big', examDate: Dates.addDays(TODAY, 60), days: ALL_DAYS, hours: '2' };
    const started = performance.now();
    const result = Planner.buildPlan(big, makeTopics(numbered(30), 1), TODAY);
    const elapsed = performance.now() - started;
    assert.equal(result.ok, true);
    assert.equal(Planner.planItems(result.plan).length, 30);
    assert.ok(elapsed < 2000, `took ${elapsed} ms`);
  }
};

let failed = 0;
Object.entries(tests).forEach(([name, test]) => {
  try {
    test();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
});
console.log(`\n${Object.keys(tests).length - failed} of ${Object.keys(tests).length} checks passed.`);
process.exitCode = failed ? 1 : 0;
