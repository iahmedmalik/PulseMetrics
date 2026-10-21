/*
 * PulseMetrics snippet. Built to web/public/p.js (minified, under 1 KB) by scripts/build-snippet.mjs.
 *
 * What it does:  pulse.track("queue_joined") sends { key, anon, name } to the API.
 * What it never does (rule P-1): read the page address, the referrer, the browser or the language;
 * set a cookie; send anything but those three fields; throw an error or slow the page down.
 * For a visitor who has asked not to be tracked it does nothing at all, not even touching storage.
 *
 *   key   the public site key from the script tag (data-key)
 *   anon  a random browser id kept in localStorage (a-z and 0-9 only), or per page load if storage is blocked
 *   name  a fixed event name chosen in the host app's code
 *
 * The body is a plain string, so the browser sends it as text/plain: no pre-flight request, and no cookies
 * (a cross-site request carries none by default).
 */
(function () {
  var s = document.currentScript;
  var w = window;
  var queued = w.pulse?.q || [];
  var KEY = s?.dataset.key;
  var API = s?.dataset.api;
  var NAME = /^[a-z][a-z0-9_]{1,39}$/;

  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl || !KEY || !API) {
    w.pulse = { track: function () {} };
    return;
  }

  var store;
  try {
    store = w.localStorage;
  } catch (e) {}

  function read(k) {
    try {
      return store.getItem(k);
    } catch (e) {}
  }
  function write(k, v) {
    try {
      store.setItem(k, v);
    } catch (e) {}
  }

  var id = read("pm_id");
  if (!id) {
    id = "";
    while (id.length < 20) id += Math.random().toString(36).slice(2);
    id = id.slice(0, 20);
    write("pm_id", id);
  }

  // Events that could not be sent (the free server may be asleep) wait here, as names only, and go out on the next page view.
  function waiting() {
    try {
      return JSON.parse(read("pm_q") || "[]");
    } catch (e) {
      return [];
    }
  }

  function later(name) {
    write("pm_q", JSON.stringify(waiting().concat(name).slice(-20)));
  }

  function send(name) {
    try {
      var c = new AbortController();
      setTimeout(function () {
        c.abort();
      }, 5000);
      fetch(API + "/v1/track", {
        method: "POST",
        body: JSON.stringify({ key: KEY, anon: id, name: name }),
        keepalive: true,
        signal: c.signal,
      }).then(
        function (r) {
          if (r.status >= 500) later(name);
        },
        function () {
          later(name);
        },
      );
    } catch (e) {}
  }

  function track(name) {
    try {
      // a string check first: RegExp.test turns undefined or null into the text "undefined" or "null"
      if (typeof name === "string" && NAME.test(name)) send(name);
    } catch (e) {}
  }

  w.pulse = { track: track };
  var retry = waiting();
  write("pm_q", "[]");
  retry.concat(queued).forEach(track);
})();
