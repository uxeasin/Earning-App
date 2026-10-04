/* Notemind motion timeline.
 *
 * Flow (mirrors the reference video):
 *   1. Splash   — one phone, camera pushed in, content builds top → bottom
 *   2. Home     — camera pulls back, splash slides left, Home builds beside it
 *   3. Artwork  — camera settles on the full row, Artwork canvas opens
 *   4. Hold     — final Figma composition, then a soft loop
 *
 * The 12 principles are called out inline where they're applied.
 */
(() => {
  gsap.registerPlugin(CustomEase);

  // Apple-style curves.
  CustomEase.create("apple", "M0,0 C0.32,0.72 0,1 1,1");      // iOS sheet / spring-like decel
  CustomEase.create("glide", "M0,0 C0.65,0 0.35,1 1,1");      // camera: symmetric slow-in/slow-out
  CustomEase.create("soft", "M0,0 C0.25,0.1 0.25,1 1,1");     // gentle ease-out for fades
  CustomEase.create("press", "M0,0 C0.4,0 0.2,1 1,1");
  const pop = "back.out(1.5)";      // measured overshoot, never bouncy
  const settle = "back.out(1.15)";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------------------------------------------------- build DOM */
  const statusTpl = $("#statusTpl");
  $$("[data-sb]").forEach((el) => el.append(statusTpl.content.cloneNode(true)));
  const homeTpl = $("#homeTpl");
  $$(".home-slot").forEach((el) => el.append(homeTpl.content.cloneNode(true)));

  // Wrap words / chars in masks for reveal-from-baseline.
  function split(el, mode) {
    const text = el.textContent;
    el.textContent = "";
    const parts = mode === "chars" ? [...text] : text.split(" ");
    const inners = [];
    parts.forEach((p, i) => {
      const m = document.createElement("span");
      m.className = "mask";
      const s = document.createElement("span");
      s.textContent = p;
      m.append(s);
      el.append(m);
      inners.push(s);
      if (mode !== "chars" && i < parts.length - 1) el.append(" ");
    });
    return inners;
  }
  const wordmarkChars = split($("[data-split=chars]"), "chars");
  const titleWords = split($("[data-split=words]"), "words");

  // Home headline words get masks too.
  $$(".h-title").forEach((t) => {
    $$(".w", t).forEach((w) => {
      const m = document.createElement("span");
      m.className = "mask";
      w.replaceWith(m);
      m.append(w);
      w.style.display = "inline-block";
    });
  });

  // Fit each note line to its highlight bar so selection reads cleanly
  // whatever rounded font the device resolves (SF Pro Rounded / Nunito).
  function fitNoteLines() {
    $$(".card-front").forEach((card) => {
      const bars = $$(".hl-bars i", card);
      $$(".note-text .ln", card).forEach((ln, i) => {
        ln.style.letterSpacing = "0px";
        const target = parseFloat(bars[i].style.width) - 11;
        const natural = ln.offsetWidth;
        const chars = ln.textContent.length || 1;
        const ls = Math.max(-0.6, Math.min(0.6, (target - natural) / chars));
        ln.style.letterSpacing = ls.toFixed(3) + "px";
      });
    });
  }

  /* --------------------------------------------------- stage scaling */
  const stage = $("#stage");
  let currentScale = 1;
  function fit() {
    const pad = window.innerWidth < 600 ? 0.98 : 0.94;
    currentScale = Math.min(window.innerWidth / 1600, window.innerHeight / 1200) * pad;
    if (document.documentElement.classList.contains("recording")) currentScale = 1;
    stage.style.transform = `scale(${currentScale})`;
  }
  fit();
  window.addEventListener("resize", fit);

  /* ------------------------------------------------------- references */
  const world = $("#world");
  const p1 = $("#phone1"), p2 = $("#phone2"), p3 = $("#phone3");
  const H = (phone, key) => $$(`[data-h=${key}]`, phone);
  const h = (phone, key) => H(phone, key)[0];

  // Camera helper: put world-x `cx` at stage centre with scale `s`.
  const cam = (cx, s) => ({ x: (800 - cx) * s, scale: s });

  /* --------------------------------------------- the reusable builders */

  // Phone shell entering as frosted glass (reference: empty glass phone first).
  function shellIn(tl, phone, at, fromX = 70) {
    tl.fromTo(phone,
      { autoAlpha: 0, x: fromX, scale: 0.94, filter: "blur(14px)" },
      { autoAlpha: 1, x: 0, scale: 1, filter: "blur(0px)", duration: 1.1, ease: "apple" }, at);
  }

  function statusIn(tl, phone, at) {
    tl.fromTo($$(".statusbar, .home-indicator", phone),
      { autoAlpha: 0, y: -6 },
      { autoAlpha: 1, y: 0, duration: 0.6, ease: "soft", stagger: 0.05 }, at);
  }

  // Full Home screen build — staging: header → headline → controls → card → footer.
  function buildHome(tl, phone, t) {
    // Header: avatar pops (exaggeration, small), menu fades with a turn.
    tl.fromTo(h(phone, "avatar"), { scale: 0.4, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.7, ease: pop }, t);
    tl.fromTo(h(phone, "menu"), { scale: 0.6, rotation: -90, autoAlpha: 0 },
      { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.7, ease: "apple" }, t + 0.08);

    // Headline: words rise from their baseline, overlapping.
    tl.fromTo($$(".h-title .w", phone), { yPercent: 110 },
      { yPercent: 0, duration: 0.8, ease: "apple", stagger: 0.07 }, t + 0.15);

    // Side pill grows down from its top (squash & stretch on the container).
    tl.fromTo(h(phone, "pill"), { scaleY: 0.2, scaleX: 0.85, autoAlpha: 0 },
      { scaleY: 1, scaleX: 1, autoAlpha: 1, duration: 0.75, ease: "apple" }, t + 0.3);
    tl.fromTo(H(phone, "pillbtn"), { scale: 0.5, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.55, ease: pop, stagger: 0.08 }, t + 0.45);

    // Tabs: the active pill fills in from the left, the second follows.
    tl.fromTo(h(phone, "tabNotes"), { clipPath: "inset(0 100% 0 0 round 120px)", autoAlpha: 1 },
      { clipPath: "inset(0 0% 0 0 round 120px)", duration: 0.7, ease: "apple" }, t + 0.4);
    tl.fromTo(h(phone, "tabArt"), { autoAlpha: 0, x: -12 },
      { autoAlpha: 1, x: 0, duration: 0.6, ease: "apple" }, t + 0.52);

    // Card stack: the front card lifts in; the two behind lag and fan out
    // afterwards (follow-through & overlapping action, arcs via rotation).
    const front = h(phone, "cardFront"), mid = h(phone, "cardMid"), back = h(phone, "cardBack");
    tl.fromTo(front, { y: 70, autoAlpha: 0, scale: 0.96 },
      { y: 0, autoAlpha: 1, scale: 1, duration: 0.95, ease: "apple" }, t + 0.55);
    tl.fromTo(mid, { y: 70, autoAlpha: 0, rotation: 0 },
      { y: 0, autoAlpha: 1, duration: 0.95, ease: "apple" }, t + 0.6);
    tl.fromTo(back, { y: 70, autoAlpha: 0, rotation: 0 },
      { y: 0, autoAlpha: 1, duration: 0.95, ease: "apple" }, t + 0.65);
    tl.to(mid, { rotation: 4.34, duration: 0.9, ease: settle }, t + 1.0);
    tl.to(back, { rotation: 9.29, duration: 1.0, ease: settle }, t + 1.08);

    // Toolbar: buttons pop one after another.
    tl.fromTo(H(phone, "tbtn"), { scale: 0.4, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.5, ease: pop, stagger: 0.06 }, t + 0.95);
    tl.fromTo(h(phone, "toolbar"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: "soft" }, t + 0.9);
    tl.fromTo(h(phone, "enlarge"), { scale: 0.4, autoAlpha: 0, rotation: -45 },
      { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.6, ease: "apple" }, t + 1.1);

    // Note text lines settle in, then the selection sweeps across them
    // (secondary action: the selection is what makes the card feel alive).
    const lines = $$(".note-text .ln", phone);
    tl.fromTo(lines, { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.55, ease: "soft", stagger: 0.045 }, t + 1.1);
    tl.fromTo(h(phone, "hStart"), { scaleY: 0, autoAlpha: 0 },
      { scaleY: 1, autoAlpha: 1, duration: 0.45, ease: pop }, t + 1.5);
    tl.fromTo($$(".hl-bars i", phone), { scaleX: 0 },
      { scaleX: 1, duration: 0.5, ease: "apple", stagger: 0.075 }, t + 1.58);
    tl.fromTo(h(phone, "hEnd"), { scaleY: 0, autoAlpha: 0 },
      { scaleY: 1, autoAlpha: 1, duration: 0.45, ease: pop }, t + 2.1);

    // Footer: caret + placeholder, AI Edit button.
    tl.fromTo(h(phone, "tap"), { autoAlpha: 0, x: -8 },
      { autoAlpha: 1, x: 0, duration: 0.6, ease: "apple" }, t + 1.55);
    tl.fromTo(h(phone, "ai"), { scale: 0.7, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.6, ease: pop }, t + 1.65);

    // Image note: card slides up, photo stack lands with a little tilt.
    tl.fromTo(h(phone, "imgNote"), { y: 40, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.9, ease: "apple" }, t + 1.35);
    tl.fromTo(h(phone, "imgStack"), { y: 40, rotation: -8, scale: 0.8, autoAlpha: 0 },
      { y: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.9, ease: settle }, t + 1.5);
  }

  // Micro-interaction: a tap. Anticipation dip → release with slight overshoot.
  function tap(tl, el, at, depth = 0.92) {
    tl.to(el, { scale: depth, duration: 0.16, ease: "press" }, at);
    tl.to(el, { scale: 1, duration: 0.55, ease: "back.out(2)" }, at + 0.16);
  }

  /* ------------------------------------------------------ the timeline */
  const tl = gsap.timeline({ paused: true });

  // Initial state
  tl.set(world, { ...cam(320, 1.1), autoAlpha: 1 }, 0);
  tl.set([p2, p3], { autoAlpha: 0 }, 0);
  tl.set(document.documentElement, { "--lx": "25%", "--ly": "15%" }, 0);

  // Secondary action: the ambient light drifts slowly across the whole piece.
  tl.to(document.documentElement, { "--lx": "75%", "--ly": "35%", duration: 14, ease: "none" }, 0);

  /* ===== Scene 1 · Splash (0 → 3.7s) ===== */
  shellIn(tl, p1, 0.1, 0);
  statusIn(tl, p1, 0.45);

  // Logo: icon pops with a small turn, wordmark letters rise behind it.
  tl.fromTo(".logo-icon", { scale: 0.5, rotation: -12, autoAlpha: 0 },
    { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.8, ease: pop }, 0.55);
  tl.fromTo(wordmarkChars, { yPercent: 110 },
    { yPercent: 0, duration: 0.7, ease: "apple", stagger: 0.03 }, 0.68);

  // Notebook: travels in on an arc (x and y on different curves), tilted,
  // then lands — squash on contact, stretch back (squash & stretch, arcs).
  const nb = $("[data-notebook]");
  tl.fromTo(nb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "soft" }, 0.8);
  tl.fromTo(nb, { x: -46 }, { x: 0, duration: 1.0, ease: "soft" }, 0.8);
  tl.fromTo(nb, { y: 90 }, { y: 0, duration: 1.0, ease: "apple" }, 0.8);
  tl.fromTo(nb, { rotation: -7, scale: 0.9 }, { rotation: 0, scale: 1, duration: 1.1, ease: settle }, 0.8);
  tl.to(nb, { scaleY: 0.985, scaleX: 1.012, duration: 0.18, ease: "press" }, 1.62);
  tl.to(nb, { scaleY: 1, scaleX: 1, duration: 0.6, ease: "back.out(2.2)" }, 1.8);

  // Tagline tracks in from wide letter-spacing.
  tl.fromTo("[data-tagline]", { autoAlpha: 0, letterSpacing: "2px" },
    { autoAlpha: 1, letterSpacing: "0px", duration: 1.0, ease: "apple" }, 1.0);

  // Title words + subtitle.
  tl.fromTo(titleWords, { yPercent: 110 },
    { yPercent: 0, duration: 0.8, ease: "apple", stagger: 0.07 }, 1.35);
  tl.fromTo("[data-splash-sub]", { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.8, ease: "soft" }, 1.6);

  // Wait pill: container rises, the fill grows (timing), counter rolls 7→5.
  tl.fromTo("[data-wait]", { autoAlpha: 0, y: 20, scale: 0.97 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "apple" }, 1.75);
  tl.fromTo("[data-wait-fill]", { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: "glide" }, 1.95);
  tl.fromTo("[data-roll]", { y: 0 }, { y: -19, duration: 0.45, ease: "apple" }, 2.45);
  tl.to("[data-roll]", { y: -38, duration: 0.45, ease: "apple" }, 3.0);
  tl.fromTo("[data-almost]", { autoAlpha: 0, y: 6 },
    { autoAlpha: 1, y: 0, duration: 0.6, ease: "soft" }, 1.95);
  tl.fromTo("[data-almost]", { backgroundPosition: "200% 0" },
    { backgroundPosition: "-100% 0", duration: 1.6, ease: "none" }, 2.2);

  /* ===== Scene 2 · Home (3.7 → 7.4s) ===== */
  // Anticipation: the splash phone sinks a touch before the camera moves.
  tl.to(p1, { scale: 0.985, duration: 0.3, ease: "press" }, 3.7);
  tl.to(p1, { scale: 1, duration: 0.9, ease: "apple" }, 4.0);
  // Camera pulls back to frame two phones (staging).
  tl.to(world, { ...cam(560, 1.0), duration: 1.3, ease: "glide" }, 3.8);
  shellIn(tl, p2, 4.15);
  statusIn(tl, p2, 4.55);
  buildHome(tl, p2, 4.6);

  // AI Edit tap with a sparkle twist (micro-interaction).
  tap(tl, h(p2, "ai"), 7.0);
  tl.fromTo(h(p2, "aiIcon"), { rotation: 0 }, { rotation: 360, duration: 0.8, ease: "apple" }, 7.05);

  /* ===== Scene 3 · Artwork (7.5 → 11.2s) ===== */
  tl.to(world, { ...cam(800, 1.0), duration: 1.3, ease: "glide" }, 7.5);
  // Phone 3 arrives already showing Home (it's the same screen, one step on).
  shellIn(tl, p3, 7.85);
  tl.set(H(p3, "cardMid"), { rotation: 4.34 }, 0);
  tl.set(H(p3, "cardBack"), { rotation: 9.29 }, 0);
  tl.fromTo($$(".statusbar, .home-indicator", p3), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 8.2);

  // Tap the Artwork tab → the background frosts → the note card grows into the canvas.
  tap(tl, h(p3, "tabArt"), 8.75, 0.9);
  const frost = $("[data-frost]");
  tl.fromTo(frost, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: "soft" }, 9.0);

  const canvas = $("[data-canvas]");
  // Start exactly over the front note card (13.44px lower, 192px shorter), then open.
  tl.fromTo(canvas,
    { autoAlpha: 0, clipPath: "inset(13.44px 0px 179.07px 0px round 31.44px)", y: 0 },
    { autoAlpha: 1, duration: 0.25, ease: "soft" }, 9.0);
  tl.to(canvas, { clipPath: "inset(0px 0px 0px 0px round 32px)", duration: 1.0, ease: "apple" }, 9.08);
  tl.fromTo(canvas, { scale: 0.985 }, { scale: 1, duration: 1.1, ease: settle }, 9.08);

  // Canvas tools pop, dot grid ripples out from the top-left tool.
  tl.fromTo($$("[data-ctool]"), { scale: 0.4, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.55, ease: pop, stagger: 0.07 }, 9.4);
  const dots = $("[data-dots]");
  tl.fromTo(dots, { "--r": "-120px" }, { "--r": "700px", duration: 1.5, ease: "soft" }, 9.55);

  // Done button: anticipation-free pop with stretch, then the check draws on.
  tl.fromTo("[data-done]", { scale: 0, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.7, ease: "back.out(1.8)" }, 10.0);
  tl.fromTo("[data-done-check]", { clipPath: "inset(0 100% 0 0)" },
    { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "apple" }, 10.3);

  /* ===== Scene 4 · Hold (11.2 → 14.2s) ===== */
  // Gentle caret blink on the Home phone while we hold on the final frame.
  [11.4, 12.4, 13.4].forEach((t) => {
    tl.to(H(p2, "caret"), { autoAlpha: 0, duration: 0.12, ease: "none" }, t);
    tl.to(H(p2, "caret"), { autoAlpha: 1, duration: 0.12, ease: "none" }, t + 0.5);
  });
  // Soft fade out to loop.
  tl.to(world, { autoAlpha: 0, scale: 0.985, duration: 0.8, ease: "glide" }, 13.8);
  tl.set({}, {}, 14.6);

  /* ------------------------------------------------------ playback */
  const DURATION = tl.duration();
  const controls = $("#controls"), btnPlay = $("#btnPlay"), scrub = $("#scrub");
  let scrubbing = false;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);

  function syncScrub() {
    if (!scrubbing) scrub.value = Math.round((tl.time() / DURATION) * 1000);
  }
  gsap.ticker.add(syncScrub);

  function setPaused(p) {
    tl.paused(p);
    controls.classList.toggle("paused", p);
    btnPlay.setAttribute("aria-label", p ? "Play" : "Pause");
  }
  btnPlay.addEventListener("click", () => setPaused(!tl.paused()));
  $("#btnReplay").addEventListener("click", () => { tl.restart(); setPaused(false); });
  scrub.addEventListener("input", () => {
    scrubbing = true;
    tl.pause();
    tl.time((scrub.value / 1000) * DURATION);
    controls.classList.add("paused");
  });
  scrub.addEventListener("change", () => { scrubbing = false; });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); setPaused(!tl.paused()); }
    if (e.key === "r") { tl.restart(); setPaused(false); }
  });

  // Loop: when the timeline ends, start again.
  tl.eventCallback("onComplete", () => { if (!params.has("record")) tl.restart(); });

  // Hook for the frame-accurate recorder (tools/record.mjs).
  window.__motion = { duration: DURATION, seek: (t) => tl.pause().time(t, false) };

  document.fonts.ready.then(() => {
    fitNoteLines();
    if (params.has("record")) {
      document.documentElement.classList.add("recording");
      fit();
      tl.time(0);
      window.__motionReady = true;
    } else if (reduced) {
      tl.time(12.5); // show the final composition, no motion
      setPaused(true);
    } else {
      setPaused(false);
      tl.play(0);
    }
  });
})();
