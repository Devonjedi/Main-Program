# Course Study Coach

Turns an exam date, topics, and study time into a day-by-day study plan.

**Milestone #1 (v0.1.0)** for CS 361. Plain HTML, CSS, and JavaScript. No build step, no server,
no account. Data is saved only in your browser's localStorage.

## Run it

Open `index.html` in a browser (double-click it). That's it.

To run the planning checks (needs Node.js):

```
node tests/planner.test.js
```

## Milestone #1 user stories

1. **Create course**: As a student, I want to create a course with its name, exam date, and the days and hours I can study, so that my plan fits my deadline and my real schedule.
2. **Add topics manually**: As a student, I want to add the topics I need to study, one at a time or by pasting a list, each with an estimated number of hours, so that my course material is broken into pieces I can schedule.
3. **Generate study plan**: As a student, I want to generate a day-by-day study plan from my topics, exam date, and study time, so that I know exactly what to study each day.
4. **Mark topic complete** (also working): check a topic off on My Plan and click again to undo.

## Quality attributes

- **Usability**: a navigation bar with the links Home, Setup, and My Plan appears in the same position and order on every screen, and each link opens its screen in 1 click.
- **Accuracy**: topic names and hours are saved and shown exactly as entered, and a pasted list of 10 lines creates exactly 10 topics. Every generated plan schedules each topic exactly once, never over-fills a day, and never uses an unselected day or a date on or after the exam (5 scenarios in `tests/planner.test.js`).
- **Responsiveness**: with 30 one-hour topics, all 7 days at 2 hours per day, and an exam 60 days away, the plan appears within 2 seconds of clicking Generate plan. My Plan shows the measured time.

## Files

| File | What it does |
|---|---|
| `index.html` | The page and navigation bar |
| `css/style.css` | All styles |
| `js/dates.js` | Date helpers (time-zone safe) |
| `js/planner.js` | Validation, list parsing, and the planning rules |
| `js/store.js` | Saves to localStorage |
| `js/views.js` | HTML for each screen |
| `js/app.js` | Routing, buttons, and forms |
| `tests/planner.test.js` | Planning, accuracy, and responsiveness checks |
