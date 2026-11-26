// Saves everything in this browser's localStorage. Nothing is sent anywhere.
(function (root) {
  const KEY = 'course-study-coach-v1';

  const empty = () => ({
    course: { name: '', examDate: '', days: [], hours: '' },
    topics: [],
    plan: null
  });

  function load() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(KEY));
      return saved && saved.course ? { ...empty(), ...saved } : empty();
    } catch (error) {
      return empty();
    }
  }

  function save(state) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      // Storage can be full or blocked (private windows). The app keeps working for this visit.
    }
  }

  root.Store = { KEY, empty, load, save };
})(this);
