# PulseMetrics: lessons learned

Things that went wrong or surprised me while building, and what I do differently now.

1. **A test database that is reused keeps its data.** The first test runs passed, then a repeat run failed because the same site key already existed. Tests now use random keys and ids, so any number of runs in a row behave the same.
2. **Chrome blocks a web page on a made-up address from calling `localhost`** (its "Private Network Access" rule). My first snippet test faked a customer's website and was blocked for that reason, not because of a bug. The snippet tests now serve the page from a real local server, which is also closer to what a customer does.
3. **The privacy promise has to be checked where the data lands, not only where it enters.** Refusing extra fields in the request was not enough on its own: the sign-in library also records an IP address by default. I turned that off and wrote a test that reads the stored rows, so the rule "no IP address kept" is proven rather than assumed.
4. **Every state-changing call checks the request's origin.** I left the library's origin check on and wrote the API guide's examples to send an `origin` header, so the manual tests behave like the real dashboard.
5. **A commit must build on its own.** With one commit per feature, it was easy to import a file that was only in the next commit. Before committing I check that the commit's files import nothing that is not in it, and a fresh clone is installed, type-checked, tested and built at the end.
6. **Free hosting sleeps.** The API sleeps after 15 quiet minutes and the database after 5. The snippet never makes a page wait (5-second timeout, unsent names retried on the next page view), and the dashboard shows a "waking up" screen that retries by itself.
7. **Accessibility tests find real things.** The contrast test on the palette showed the edge of fields and buttons was only 2:1 against the page. They now use a stronger `--line-strong` border token (at least 3:1), and the test keeps it that way.
8. **A statistics screen should be harder to misread than to read.** The A/B verdict can only say "B did better" when the test supports it; otherwise it says "not enough evidence", and the AI answers inherit the same rule through the tool result, not through trust in the model.
9. **Say what is not tested.** The real language model is not exercised by any automated test, and its 10-question eval has not been run. The test report says so instead of quoting a number.
