// Wires the screens together: routing, saving, and every button and form.
(function (root) {
  const { Planner, Views, Store, Dates } = root;
  const app = document.getElementById('app');
  const dialogRoot = document.getElementById('dialog-root');

  let state = Store.load();
  let current = '';
  let pending = {};          // extra info (errors, kept form values) for the next screen
  let clickedAt = 0;         // when Generate was clicked, for the on-screen timing
  let onConfirm = null;      // what the open dialog's confirm button does
  const open = new Set();    // topics on My Plan whose details are showing
  let lastRemoved = null;    // the last removed topic, so Undo can put it back
  let idCount = 0;

  const SCREENS = ['home', 'setup-1', 'setup-2', 'setup-3', 'plan'];
  const model = () => ({ ...state, today: Dates.localToday(), open });
  const save = () => Store.save(state);
  const courseErrors = () => Planner.validateCourse(state.course, Dates.localToday());

  function go(name, extra = {}) {
    pending = extra;
    if (location.hash === `#${name}`) show();
    else location.hash = name;
  }

  // Setup steps can't be skipped: an incomplete earlier step sends you back to it.
  function guard(name) {
    if ((name === 'setup-2' || name === 'setup-3') && Object.keys(courseErrors()).length) {
      return ['setup-1', { errors: courseErrors() }];
    }
    if (name === 'setup-3' && state.topics.length === 0) {
      return ['setup-2', { navError: 'Add at least one topic first.' }];
    }
    return [name, null];
  }

  function show() {
    if (current === 'setup-1') readCourseForm();
    const asked = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    const [name, redirect] = guard(asked);
    const extra = redirect || pending;
    pending = {};
    if (name !== asked) history.replaceState(null, '', `#${name}`);
    render(name, extra);
  }

  function render(name, extra = {}) {
    current = name;
    const m = model();
    const html = {
      home: () => Views.home(m),
      'setup-1': () => Views.step1(m, extra.errors),
      'setup-2': () => Views.step2(m, extra),
      'setup-3': () => Views.step3(m, extra),
      plan: () => (state.plan ? Views.plan(m) : Views.noPlan())
    }[name]();
    app.innerHTML = html;
    markNav(name);
    afterRender(name, extra);
  }

  function markNav(name) {
    const section = name.startsWith('setup') ? 'setup-1' : name;
    document.querySelectorAll('nav a').forEach((link) => {
      if (link.getAttribute('href') === `#${section}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function afterRender(name, extra) {
    const target = extra.focus && app.querySelector(extra.focus);
    const firstError = app.querySelector('[aria-invalid="true"]');
    if (firstError) firstError.focus();
    else if (target) target.focus();
    if (!extra.keepScroll) window.scrollTo(0, 0);
    if (name === 'plan') stampSpeed();
  }

  // Responsiveness: measures from the Generate click until the plan is laid out on screen.
  function stampSpeed() {
    if (!clickedAt || !state.plan) return;
    app.getBoundingClientRect();
    state.plan.buildMs = Math.max(1, Math.round(performance.now() - clickedAt));
    clickedAt = 0;
    save();
    app.querySelector('.speed').textContent = Views.speedText(state.plan.buildMs);
  }

  function readCourseForm() {
    const form = app.querySelector('#course-form');
    if (!form) return;
    state.course = {
      name: form.querySelector('#f-name').value.trim(),
      examDate: form.querySelector('#f-examDate').value,
      days: [...form.querySelectorAll('[data-day]:checked')].map((box) => box.dataset.day),
      hours: form.querySelector('#f-hours').value.trim()
    };
    save();
  }

  function submitCourse() {
    readCourseForm();
    const errors = courseErrors();
    if (Object.keys(errors).length) return render('setup-1', { errors });
    go('setup-2', { focus: '#topic-name' });
  }

  function submitOneTopic() {
    const name = app.querySelector('#topic-name').value;
    const hours = app.querySelector('#topic-hours').value;
    const errors = Planner.validateTopic(name, hours);
    const list = app.querySelector('#topic-list').value;
    if (Object.keys(errors).length) return render('setup-2', { errors, form: { name, hours, list }, keepScroll: true });
    state.topics.push({ id: `t${Date.now().toString(36)}-${idCount++}`, name: name.trim(), hours: Planner.parseHours(hours) });
    save();
    render('setup-2', { form: { list }, focus: '#topic-name', keepScroll: true });
  }

  function submitList() {
    const list = app.querySelector('#topic-list').value;
    const form = { name: app.querySelector('#topic-name').value, hours: app.querySelector('#topic-hours').value };
    const result = Planner.parseTopicList(list);
    if (result.errors.length) {
      return render('setup-2', { listErrors: result.errors, form: { ...form, list }, focus: '#topic-list', keepScroll: true });
    }
    state.topics.push(...result.topics);
    save();
    render('setup-2', { form, keepScroll: true });
  }

  function removeTopic(id) {
    const index = state.topics.findIndex((topic) => topic.id === id);
    if (index === -1) return;
    const [topic] = state.topics.splice(index, 1);
    save();
    lastRemoved = { topic, index };
    render('setup-2', { undo: lastRemoved, keepScroll: true });
  }

  function undoRemove() {
    if (!lastRemoved) return;
    state.topics.splice(lastRemoved.index, 0, lastRemoved.topic);
    lastRemoved = null;
    save();
    render('setup-2', { keepScroll: true });
  }

  function generate() {
    const started = performance.now();
    const result = Planner.buildPlan(state.course, state.topics, Dates.localToday());
    if (!result.ok) return go('setup-3', { problems: result.problems });
    clickedAt = started;
    state.plan = result.plan;
    open.clear();
    save();
    go('plan');
  }

  function askBeforeGenerate() {
    if (!state.plan) return generate();
    openDialog('Regenerating replaces your current plan and clears your completed marks. Continue?',
      'Regenerate', generate);
  }

  function openDialog(message, confirmLabel, action) {
    onConfirm = action;
    dialogRoot.innerHTML = Views.dialog(message, confirmLabel);
    dialogRoot.querySelector('[data-dialog="cancel"]').focus();
  }

  function closeDialog(confirmed) {
    const action = onConfirm;
    onConfirm = null;
    dialogRoot.innerHTML = '';
    if (confirmed && action) action();
  }

  function toggleDone(id) {
    const item = Planner.planItems(state.plan).find((i) => i.id === id);
    if (!item) return;
    item.done = !item.done;
    save();
    render('plan', { keepScroll: true, focus: `[data-done="${CSS.escape(id)}"]` });
  }

  function toggleDetails(id) {
    if (open.has(id)) open.delete(id);
    else open.add(id);
    render('plan', { keepScroll: true, focus: `[data-toggle="${CSS.escape(id)}"]` });
  }

  const ACTIONS = {
    'course-back': () => { readCourseForm(); go('home'); },
    'topics-next': () => go('setup-3'),
    'undo-remove': undoRemove,
    generate: askBeforeGenerate,
    regenerate: askBeforeGenerate
  };

  function onClick(event) {
    const el = event.target.closest('button, a');
    if (!el) return;
    const d = el.dataset;
    if (d.go) go(d.go);
    else if (d.action) ACTIONS[d.action]();
    else if (d.remove) removeTopic(d.remove);
    else if (d.toggle) toggleDetails(d.toggle);
    else if (d.focus) app.querySelector(d.focus).focus();
  }

  function onSubmit(event) {
    event.preventDefault();
    const handlers = { 'course-form': submitCourse, 'one-form': submitOneTopic, 'list-form': submitList };
    const handler = handlers[event.target.id];
    if (handler) handler();
  }

  function onChange(event) {
    if (event.target.dataset.done) toggleDone(event.target.dataset.done);
  }

  function onDialogClick(event) {
    const button = event.target.closest('[data-dialog]');
    if (button) closeDialog(button.dataset.dialog === 'confirm');
  }

  function onKey(event) {
    if (event.key === 'Escape' && onConfirm) closeDialog(false);
  }

  app.addEventListener('click', onClick);
  app.addEventListener('submit', onSubmit);
  app.addEventListener('change', onChange);
  dialogRoot.addEventListener('click', onDialogClick);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', show);
  show();
})(this);
