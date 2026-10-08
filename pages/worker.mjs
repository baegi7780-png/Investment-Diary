// Keep the original URL and Origin so login cookies and CSRF checks stay same-origin.
export default {
  fetch(request, env) {
    return env.JOURNAL.fetch(request);
  },
};
