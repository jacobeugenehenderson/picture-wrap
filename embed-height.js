/* ============================================================================
   embed-height.js — paste into any product that gets embedded in
   jacobhenderson.studio. Same file in all three; do not fork it.

   WHY
   An iframe has a fixed height. These apps do not: action up top, menus folding
   out below. Any height the embedding page picks is wrong twice — dead space
   when collapsed, clipped or nested-scrolling when expanded. Only the app knows
   how tall it currently is, so the app says so and the frame follows.

   HOW TO USE
   Load it last, after the app has built its UI:

       <script src="embed-height.js"></script>

   or paste the IIFE inline at the end of <body>. It does nothing at all when
   the page is not framed, so it is safe to ship unconditionally.

   The receiving end is in js/site.js on the site, which trusts only known
   origins and clamps the height it is given.
   ========================================================================= */

(function () {
  'use strict';

  /* Not embedded — nothing to report, and postMessage to self would be noise. */
  if (window.parent === window) return;

  var last = 0;
  var queued = false;

  function measure() {
    /* ⚠ NOT documentElement.scrollHeight. <html> fills the iframe viewport, and
       scrollHeight returns max(content, viewport) — so once the parent grows the
       frame to fit, the document can never report anything SHORTER than the
       frame it is already in. Heights ratcheted up and never came back down: a
       drawer opened, the frame grew, the drawer closed, and the frame stayed
       tall forever. Reported by Jacob on the Codedesk embed, 17 Aug 2026.

       The body sizes to its content, so measure that, plus its own margins,
       which sit outside the border box. */
    var body = document.body;
    if (!body) return 0;
    var box = body.getBoundingClientRect().height;
    var cs = window.getComputedStyle(body);
    return Math.ceil(box + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom));
  }

  function report() {
    queued = false;
    var height = measure();
    if (!height) return;

    /* A pixel of jitter would otherwise ping the parent forever. */
    if (Math.abs(height - last) < 2) return;
    last = height;

    window.parent.postMessage({ type: 'embed-height', height: height }, '*');
  }

  /* Coalesce into one frame: a ResizeObserver can fire many times per gesture
     and the parent only needs the settled number. */
  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(report);
  }

  /* Observe the BODY for the same reason: documentElement stops changing size
     once the parent has pinned the frame, so it would never fire again. */
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(schedule).observe(document.body);
  }

  /* Belt and braces: fonts and images landing after first paint change the
     height without resizing the observed element in every browser. */
  window.addEventListener('load', schedule);
  document.addEventListener('transitionend', schedule);

  schedule();
}());
