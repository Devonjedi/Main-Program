// Each function returns the HTML for one screen. app.js decides which one to show.
(function (root) {
  const { plural } = root.Planner;
  const Dates = root.Dates;

  const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const DAY_OPTIONS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'],
    ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
  const STEPS = ['Course', 'Topics', 'Generate'];

  const fieldError = (errors, key) =>
    errors[key] ? `<p class="field-error" id="err-${key}" role="alert">${esc(errors[key])}</p>` : '';
  const invalid = (errors, key) => (errors[key] ? ` aria-invalid="true" aria-describedby="err-${key}"` : '');

  function home(model) {
    const resume = model.plan
      ? '<button class="secondary" data-go="plan">Open My Plan</button>' : '';
    return `
      <section class="hero">
        <h1>Know exactly what to study each day before your exam.</h1>
        <p class="lead">Course Study Coach turns your exam date, your topics, and the time you have
          into a day-by-day study plan. You'll always know what to study today and what's done and what's left,
          so nothing gets crammed the night before.</p>
        <div class="actions"><button class="primary" data-go="setup-1">Get started →</button>${resume}</div>
      </section>
      <section class="card">
        <h2>How it works: 3 steps</h2>
        <ol class="how">
          <li><strong>Course</strong>: name, exam date, and the days and hours you can study.</li>
          <li><strong>Topics</strong>: what you need to study and about how long each takes.</li>
          <li><strong>Generate</strong>: get your plan, then check off topics as you finish them.</li>
        </ol>
      </section>
      <section class="card costs">
        <h2>What it costs you</h2>
        <ul>
          <li><strong>Time:</strong> about 2 minutes to set up.</li>
          <li><strong>Money:</strong> free. No account or sign-up.</li>
          <li><strong>Privacy:</strong> your data is saved only in this browser on this device.
            Clearing your browser data deletes your plan.</li>
        </ul>
      </section>`;
  }

  function stepper(current) {
    const items = STEPS.map((name, index) => {
      const number = index + 1;
      const status = number < current ? 'done' : number === current ? 'current' : 'next';
      const mark = status === 'done' ? '✓' : number;
      const aria = status === 'current' ? ' aria-current="step"' : '';
      return `<li class="${status}"${aria}><span class="dot">${mark}</span>${name}</li>`;
    }).join('');
    return `<ol class="stepper">${items}</ol>
      <p class="step-meta">Step ${current} of 3 · About 2 minutes total</p>`;
  }

  function errorSummary(errors) {
    const list = Object.values(errors);
    if (list.length === 0) return '';
    return `<div class="error-box" role="alert"><strong>Please fix ${plural(list.length, 'thing')}:</strong>
      <ul>${list.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
  }

  function dayPicker(selected, errors) {
    const boxes = DAY_OPTIONS.map(([key, name]) => `
      <label class="day"><input type="checkbox" data-day="${key}" ${selected.includes(key) ? 'checked' : ''}>
        <span>${name}</span></label>`).join('');
    return `<fieldset${invalid(errors, 'days')}><legend>Days you can study</legend>
      <div class="days">${boxes}</div>${fieldError(errors, 'days')}</fieldset>`;
  }

  function step1(model, errors = {}) {
    const c = model.course;
    return `${stepper(1)}
      <h1>Step 1: Your course</h1>
      ${errorSummary(errors)}
      <form id="course-form" class="card" novalidate>
        <label for="f-name">Course name</label>
        <input id="f-name" maxlength="120" value="${esc(c.name)}" placeholder="e.g. Calculus I"${invalid(errors, 'name')}>
        ${fieldError(errors, 'name')}
        <label for="f-examDate">Exam date</label>
        <input id="f-examDate" type="date" min="${Dates.addDays(model.today, 1)}" value="${esc(c.examDate)}"${invalid(errors, 'examDate')}>
        ${fieldError(errors, 'examDate')}
        ${dayPicker(c.days, errors)}
        <label for="f-hours">Hours you can study per day</label>
        <input id="f-hours" class="short" type="number" min="0.5" max="12" step="0.5" value="${esc(c.hours)}"${invalid(errors, 'hours')}>
        <p class="hint">Between 0.5 and 12.</p>
        ${fieldError(errors, 'hours')}
        <div class="nav-buttons">
          <button type="button" class="secondary" data-action="course-back">← Back: Home</button>
          <button type="submit" class="primary">Next: Topics →</button>
        </div>
      </form>`;
  }

  function topicRows(model) {
    if (model.topics.length === 0) return '<p class="empty">No topics yet. Add one or paste a list.</p>';
    const rows = model.topics.map((t) => `
      <li><span class="topic-name">${esc(t.name)}</span>
        <span class="topic-hours">${plural(t.hours, 'hour')}</span>
        <button class="link danger" data-remove="${esc(t.id)}" aria-label="Remove ${esc(t.name)}">Remove</button></li>`).join('');
    return `<ul class="topics">${rows}</ul>`;
  }

  function undoBar(undo) {
    if (!undo) return '';
    return `<div class="notice" role="status">Removed “${esc(undo.topic.name)}”.
      <button class="link" data-action="undo-remove">Undo</button></div>`;
  }

  function oneTopicPanel(form, errors) {
    return `<form id="one-form" class="card panel" novalidate>
        <h2>Add one topic</h2>
        <label for="topic-name">Topic name</label>
        <input id="topic-name" maxlength="120" value="${esc(form.name)}" placeholder="e.g. Limits"${invalid(errors, 'name')}>
        ${fieldError(errors, 'name')}
        <label for="topic-hours">Estimated hours</label>
        <input id="topic-hours" class="short" type="number" min="0.5" max="12" step="0.5" value="${esc(form.hours)}"${invalid(errors, 'hours')}>
        ${fieldError(errors, 'hours')}
        <button type="submit" class="primary">Add topic</button>
        <p class="hint">Have a whole list? <button type="button" class="link" data-focus="#topic-list">Paste it instead →</button></p>
      </form>`;
  }

  function pastePanel(form, listErrors) {
    const errors = listErrors.length
      ? `<div class="field-error" role="alert">Nothing was added. Fix these lines and try again:
          <ul>${listErrors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
    return `<form id="list-form" class="card panel" novalidate>
        <h2>Paste a list</h2>
        <label for="topic-list">One topic per line: <code>Name, hours</code></label>
        <textarea id="topic-list" rows="6" placeholder="Limits, 2&#10;Derivatives, 3&#10;Integrals">${esc(form.list)}</textarea>
        <p class="hint">No hours means 1 hour. Avoid commas inside a topic name.</p>
        ${errors}
        <button type="submit" class="primary">Add list</button>
        <p class="hint">Prefer one at a time? <button type="button" class="link" data-focus="#topic-name">Add one topic →</button></p>
      </form>`;
  }

  function step2(model, extra = {}) {
    const total = plural(root.Planner.totalHours(model.topics), 'hour');
    return `${stepper(2)}
      <h1>Step 2: Topics for ${esc(model.course.name)}</h1>
      ${undoBar(extra.undo)}
      ${extra.navError ? `<div class="error-box" role="alert">${esc(extra.navError)}</div>` : ''}
      <div class="two-col">
        ${oneTopicPanel(extra.form || {}, extra.errors || {})}
        ${pastePanel(extra.form || {}, extra.listErrors || [])}
      </div>
      <section class="card">
        <h2>Your topics (${model.topics.length}) · ${total} total</h2>
        ${topicRows(model)}
      </section>
      <div class="nav-buttons">
        <button class="secondary" data-go="setup-1">← Back: Course</button>
        <button class="primary" data-action="topics-next">Next: Generate →</button>
      </div>`;
  }

  function summary(model) {
    const c = model.course;
    const days = DAY_OPTIONS.filter(([key]) => c.days.includes(key)).map(([, name]) => name).join(', ');
    const away = Dates.daysBetween(model.today, c.examDate);
    return `<dl class="summary card">
        <dt>Course</dt><dd>${esc(c.name)}</dd>
        <dt>Exam</dt><dd>${Dates.label(c.examDate)} (${plural(away, 'day')} from today)</dd>
        <dt>Study days</dt><dd>${days}, ${plural(Number(c.hours), 'hour')} per day</dd>
        <dt>Topics</dt><dd>${plural(model.topics.length, 'topic')}, ${plural(root.Planner.totalHours(model.topics), 'hour')} total</dd>
      </dl>`;
  }

  function problemBox(problems) {
    if (!problems || problems.length === 0) return '';
    return `<div class="error-box" role="alert"><strong>Your plan doesn't fit yet.</strong>
      <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <p>Change your <button class="link" data-go="setup-1">course days or hours</button> or your
        <button class="link" data-go="setup-2">topics</button>. Everything you entered is kept.</p></div>`;
  }

  function step3(model, extra = {}) {
    return `${stepper(3)}
      <h1>Step 3: Generate your plan</h1>
      ${problemBox(extra.problems)}
      ${summary(model)}
      <details class="card">
        <summary>How your plan is made</summary>
        <p>Topics are scheduled in the order you entered them, starting today. Each one goes on the next
          study day with enough hours left, and a topic is never split across days. Only the days you
          selected are used, and nothing is scheduled on or after the exam date. It takes less than a second.</p>
      </details>
      <div class="nav-buttons">
        <button class="secondary" data-go="setup-2">← Back: Topics</button>
        <button class="primary" data-action="generate">Generate plan</button>
      </div>`;
  }

  function noPlan() {
    return `<h1>My Plan</h1>
      <section class="card"><p>You don't have a plan yet. Setup takes about 2 minutes.</p>
        <button class="primary" data-go="setup-1">Go to Setup →</button></section>`;
  }

  function itemRow(item, day, open) {
    const details = open ? `<p class="details" id="d-${esc(item.id)}">${plural(item.hours, 'hour')} · scheduled ${Dates.label(day.date)}</p>` : '';
    const undo = item.done ? '<span class="undo-hint">Done. Click again to undo.</span>' : '';
    return `<li class="item${item.done ? ' done' : ''}">
        <input type="checkbox" data-done="${esc(item.id)}" ${item.done ? 'checked' : ''} aria-label="Mark ${esc(item.name)} done">
        <button class="topic-toggle" data-toggle="${esc(item.id)}" aria-expanded="${open}">${esc(item.name)}</button>
        ${undo}${details}</li>`;
  }

  function dayCard(day, model) {
    const isToday = day.date === model.today;
    const badge = isToday ? '<span class="badge">Today</span>' : '';
    const items = day.items.map((item) => itemRow(item, day, model.open.has(item.id))).join('');
    return `<article class="day-card${isToday ? ' today' : ''}">
        <h3>${Dates.label(day.date)} ${badge}</h3><ul>${items}</ul></article>`;
  }

  const speedText = (ms) => `This plan appeared ${ms} ms after Generate was clicked.`;

  function plan(model) {
    const p = model.plan;
    const items = root.Planner.planItems(p);
    const done = items.filter((i) => i.done);
    const left = root.Planner.totalHours(items.filter((i) => !i.done));
    return `<h1>My Plan: ${esc(p.courseName)}</h1>
      <p class="lead">Exam ${Dates.label(p.examDate)}. ${done.length} of ${plural(items.length, 'topic')} done · ${plural(left, 'hour')} left.</p>
      <p class="hint">Click a topic to see its details. Check it off when you finish it.</p>
      <div class="days-grid">${p.days.map((day) => dayCard(day, model)).join('')}</div>
      <div class="nav-buttons">
        <button class="secondary" data-go="setup-1">Edit setup</button>
        <button class="secondary" data-action="regenerate">Regenerate plan</button>
      </div>
      <p class="speed">${p.buildMs ? speedText(p.buildMs) : ''}</p>`;
  }

  function dialog(message, confirmLabel) {
    return `<div class="backdrop"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-msg">
        <p id="dlg-msg">${esc(message)}</p>
        <div class="nav-buttons">
          <button class="secondary" data-dialog="cancel">Cancel</button>
          <button class="primary warn" data-dialog="confirm">${esc(confirmLabel)}</button>
        </div></div></div>`;
  }

  root.Views = { home, step1, step2, step3, noPlan, plan, dialog, speedText };
})(this);
