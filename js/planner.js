// Planning rules: validation, list parsing, and building the day-by-day plan.
// No DOM code lives here, so tests/planner.test.js can run it with Node.
(function (root) {
  const Dates = typeof module !== 'undefined' && module.exports ? require('./dates.js') : root.Dates;

  const MIN_HOURS = 0.5;
  const MAX_HOURS = 12;
  const MAX_NAME = 120;

  const round = (n) => Math.round(n * 100) / 100;
  const plural = (n, word) => `${round(n)} ${word}${round(n) === 1 ? '' : 's'}`;

  function parseHours(text) {
    const trimmed = String(text ?? '').trim();
    const hours = Number(trimmed);
    return trimmed !== '' && hours >= MIN_HOURS && hours <= MAX_HOURS ? round(hours) : NaN;
  }

  function validateCourse(course, today) {
    const errors = {};
    const name = (course.name || '').trim();
    if (!name) errors.name = 'Enter a course name.';
    else if (name.length > MAX_NAME) errors.name = `Use ${MAX_NAME} characters or fewer.`;
    if (!Dates.isValid(course.examDate)) errors.examDate = 'Enter the exam date.';
    else if (course.examDate <= today) errors.examDate = 'Pick an exam date after today.';
    if (!course.days || course.days.length === 0) errors.days = 'Select at least one day you can study.';
    if (Number.isNaN(parseHours(course.hours))) {
      errors.hours = `Hours per day must be a number between ${MIN_HOURS} and ${MAX_HOURS}.`;
    }
    return errors;
  }

  function validateTopic(name, hoursText) {
    const errors = {};
    const trimmed = (name || '').trim();
    if (!trimmed) errors.name = 'Enter a topic name.';
    else if (trimmed.length > MAX_NAME) errors.name = `Use ${MAX_NAME} characters or fewer.`;
    if (Number.isNaN(parseHours(hoursText))) {
      errors.hours = `Hours must be a number between ${MIN_HOURS} and ${MAX_HOURS}.`;
    }
    return errors;
  }

  let idCounter = 0;
  const newId = () => `t${Date.now().toString(36)}${(idCounter++).toString(36)}`;

  // One topic per line: "Name, hours" or just "Name" (counts as 1 hour).
  // The text after the LAST comma is the hours, so a name may not end in a comma-separated word.
  function parseLine(line, number) {
    const comma = line.lastIndexOf(',');
    const name = (comma === -1 ? line : line.slice(0, comma)).trim();
    const hoursText = comma === -1 ? '1' : line.slice(comma + 1);
    const errors = validateTopic(name, hoursText);
    if (errors.name) return { error: `Line ${number}: ${errors.name.toLowerCase().replace(/\.$/, '')}.` };
    if (errors.hours) return { error: `Line ${number}: hours must be a number between ${MIN_HOURS} and ${MAX_HOURS}.` };
    return { topic: { id: newId(), name, hours: parseHours(hoursText) } };
  }

  function parseTopicList(text) {
    const topics = [];
    const errors = [];
    String(text || '').split(/\r?\n/).forEach((line, index) => {
      if (line.trim() === '') return;
      const result = parseLine(line, index + 1);
      if (result.error) errors.push(result.error);
      else topics.push(result.topic);
    });
    if (topics.length === 0 && errors.length === 0) errors.push('Paste at least one topic, one per line.');
    return { topics, errors };
  }

  // Study dates run from today up to (not including) the exam, on the selected weekdays only.
  function studyDates(course, today) {
    const dates = [];
    for (let date = today; date < course.examDate; date = Dates.addDays(date, 1)) {
      if (course.days.includes(Dates.weekday(date))) dates.push(date);
    }
    return dates;
  }

  const totalHours = (topics) => round(topics.reduce((sum, topic) => sum + Number(topic.hours), 0));
  const usedHours = (day) => round(day.items.reduce((sum, item) => sum + item.hours, 0));
  const planItems = (plan) => plan.days.flatMap((day) => day.items);

  function upfrontProblems(course, topics, dates) {
    const daily = parseHours(course.hours);
    if (topics.length === 0) return ['Add at least one topic before generating a plan.'];
    if (dates.length === 0) return ['There are no selected study days before the exam. Select more days or move the exam date.'];
    return topics.filter((topic) => topic.hours > daily).map((topic) =>
      `“${topic.name}” takes ${plural(topic.hours, 'hour')}, but each study day has only ${plural(daily, 'hour')}. ` +
      'Split it into smaller topics or raise your hours per day.');
  }

  // Fills days in order: each topic goes on the earliest study day that still has room for it,
  // never before the topic ahead of it, so the plan follows the order the topics were entered.
  function fillDays(topics, dates, daily) {
    const days = dates.map((date) => ({ date, items: [] }));
    let dayIndex = 0;
    const leftover = [];
    topics.forEach((topic) => {
      while (dayIndex < days.length && usedHours(days[dayIndex]) + topic.hours > daily) dayIndex++;
      if (dayIndex === days.length) return leftover.push(topic);
      days[dayIndex].items.push({ id: topic.id, name: topic.name, hours: Number(topic.hours), done: false });
    });
    return { days: days.filter((day) => day.items.length > 0), leftover };
  }

  function buildPlan(course, topics, today) {
    const dates = studyDates(course, today);
    const problems = upfrontProblems(course, topics, dates);
    if (problems.length) return { ok: false, problems };
    const { days, leftover } = fillDays(topics, dates, parseHours(course.hours));
    if (leftover.length) {
      const short = totalHours(leftover);
      return { ok: false, problems: [`You need ${plural(short, 'more hour')} of study time before the exam. ` +
        'Add study days, raise your hours per day, move the exam date later, or remove topics.'] };
    }
    return { ok: true, plan: { courseName: course.name, examDate: course.examDate, createdOn: today, days } };
  }

  const api = {
    MIN_HOURS, MAX_HOURS, MAX_NAME, round, plural, parseHours, validateCourse, validateTopic,
    parseTopicList, studyDates, totalHours, usedHours, planItems, buildPlan
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planner = api;
})(this);
