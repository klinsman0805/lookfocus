const cfg = window.LOOKFOCUS || {};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Config: price, checkout, support ---------- */
const price = cfg.price || "9.90";
$$("[data-price]").forEach((el) => (el.textContent = `$${price}`));
$("#priceNum").textContent = price;
$("#year").textContent = new Date().getFullYear();

const buyBtn = $("#buyBtn");
if (cfg.checkoutUrl) {
  buyBtn.href = cfg.checkoutUrl;
  buyBtn.rel = "noopener";
} else {
  buyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    buyBtn.textContent = "Checkout opens soon ✨";
  });
}
if (cfg.supportEmail) $("#supportLink").href = `mailto:${cfg.supportEmail}`;

const platform = navigator.userAgentData?.platform || navigator.platform || "";
if (!/mac/i.test(platform) || /iphone|ipad/i.test(navigator.userAgent)) $("#macNote").hidden = false;

const nav = $("#nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive: true });

/* ---------- Hero: eyes that follow you ---------- */
const eyes = $$("#face [data-eye]");
let lastPointer = 0;
// One gaze direction from the midpoint between the eyes, applied to both pupils, so they move
// together (aiming each eye separately makes the nearer one barely move and looks laggy).
function lookAt(x, y) {
  const [a, b] = eyes.map((e) => e.querySelector(".sclera").getBoundingClientRect());
  const cx = (a.left + a.right + b.left + b.right) / 4, cy = (a.top + a.bottom + b.top + b.bottom) / 4;
  const angle = Math.atan2(y - cy, x - cx);
  const d = Math.min(1, Math.hypot(x - cx, y - cy) / 300);
  const t = `translate(${Math.cos(angle) * 20 * d}px, ${Math.sin(angle) * 24 * d}px)`;
  eyes.forEach((e) => (e.querySelector(".pupil").style.transform = t));
}
addEventListener("pointermove", (e) => { lastPointer = performance.now(); lookAt(e.clientX, e.clientY); }, { passive: true });
function blink() {
  eyes.forEach((e) => e.classList.add("blink"));
  setTimeout(() => eyes.forEach((e) => e.classList.remove("blink")), 120);
  setTimeout(blink, 2500 + Math.random() * 3500);
}
if (!reduceMotion) {
  setTimeout(blink, 1800);
  // When the pointer rests (or on touch screens), the eyes glance around on their own.
  setInterval(() => {
    if (performance.now() - lastPointer < 4000) return;
    const r = $("#face").getBoundingClientRect();
    lookAt(r.left + Math.random() * r.width * 2 - r.width / 2, r.top + Math.random() * r.height);
  }, 1600);
}

/* ---------- Click-tax calculator ---------- */
const hops = $("#hops");
function updateTax() {
  const n = +hops.value;
  const clicks = n * 230;
  const hours = (clicks * 1.5) / 3600;
  const cents = (parseFloat(price) / hours) * 100;
  $("#hopsOut").textContent = n;
  $("#clicksYear").textContent = clicks.toLocaleString();
  $("#hoursYear").textContent = hours < 10 ? hours.toFixed(1) : Math.round(hours);
  $("#perHour").textContent =
    cents < 1 ? "<1¢" : cents < 100 ? `${Math.round(cents)}¢` : `$${(cents / 100).toFixed(2)}`;
}
hops.addEventListener("input", updateTax);
updateTax();

/* ---------- Demo desk ---------- */
const desk = $("#desk");
const mons = $$(".mon", desk);
const editors = mons.map((m) => m.querySelector(".editor"));
editors.forEach((ed) => (ed.textContent = ed.dataset.text + "\n"));
const gazeDot = $("#gazeDot");
const status = $("#demoStatus");
const youHead = $("#youHead");
const DWELL = 300;

const demo = { focused: 1, candidate: 1, since: 0, mode: "mouse", hovering: false, touched: false };

function setFocus(i) {
  if (i === demo.focused) return;
  demo.focused = i;
  mons.forEach((m, j) => m.classList.toggle("focused", j === i));
  const m = mons[i];
  m.classList.remove("flash");
  void m.offsetWidth; // restart the flash animation
  m.classList.add("flash");
  youHead.style.transform = `translateX(${(i - 1) * 18}px) rotate(${(i - 1) * 10}deg)`;
  $$(".you-eye", youHead).forEach((e) => e.style.setProperty("--look", `${(i - 1) * 3}px`));
}
mons[1].classList.add("focused");

/** Feed a gaze estimate (monitor index) in; focus follows once it has held for DWELL ms. */
function gaze(i) {
  const now = performance.now();
  if (i !== demo.candidate) { demo.candidate = i; demo.since = now; }
  if (i !== demo.focused && now - demo.since >= DWELL) setFocus(i);
}
setInterval(() => gaze(demo.candidate), 50);

function monitorAtX(clientX) {
  let best = 0, bestD = Infinity;
  mons.forEach((m, i) => {
    const r = m.getBoundingClientRect();
    const d = Math.abs(clientX - (r.left + r.width / 2));
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function moveDot(x, y) {
  const r = desk.getBoundingClientRect();
  gazeDot.style.left = `${x - r.left}px`;
  gazeDot.style.top = `${y - r.top}px`;
}

desk.addEventListener("pointermove", (e) => {
  if (demo.mode !== "mouse") return;
  stopAutoplay();
  demo.hovering = true;
  desk.classList.add("looking");
  moveDot(e.clientX, e.clientY);
  gaze(monitorAtX(e.clientX));
  status.textContent = `Looking at screen ${demo.candidate + 1} · now type something`;
});
desk.addEventListener("pointerleave", () => { demo.hovering = false; desk.classList.remove("looking"); });
desk.addEventListener("pointerdown", (e) => {
  stopAutoplay();
  desk.focus({ preventScroll: true });
  // Touch screens can't hover: a tap is a look.
  if (e.pointerType !== "mouse" && demo.mode === "mouse") {
    const i = monitorAtX(e.clientX);
    demo.candidate = i;
    demo.since = performance.now() - DWELL;
    setFocus(i);
    status.textContent = `Looking at screen ${i + 1}`;
  }
});
if (matchMedia("(hover: none)").matches) status.textContent = "Tap a screen to look at it";

// Typing goes to the focused monitor while you're playing with the demo.
function typeInto(i, key) {
  const ed = editors[i];
  if (key === "Backspace") ed.textContent = ed.textContent.slice(0, -1);
  else if (key === "Enter") ed.textContent += "\n";
  else ed.textContent += key;
  // Keep the newest text visible.
  const lines = ed.textContent.split("\n");
  if (lines.length > 7) ed.textContent = lines.slice(-7).join("\n");
}
addEventListener("keydown", (e) => {
  const active = demo.hovering || document.activeElement === desk || demo.mode === "camera";
  if (!active || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.("input, textarea, select, button, summary")) return;
  if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
    e.preventDefault();
    stopAutoplay();
    typeInto(demo.focused, e.key);
  }
});

/* Autoplay: while nobody is playing, the demo shows itself off. */
const phrases = [" glance → type", " no click needed", " focus followed me!", " ✨ magic"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let autoplay = null;
function startAutoplay() {
  if (reduceMotion || demo.touched || autoplay) return;
  let step = 0;
  const token = (autoplay = { stop: false });
  (async function loop() {
    while (!token.stop) {
      const target = [0, 2, 1, 2, 0, 1][step % 6];
      const r = mons[target].querySelector(".screen").getBoundingClientRect();
      desk.classList.add("looking");
      moveDot(r.left + r.width / 2, r.top + r.height / 2);
      gaze(target);
      await sleep(DWELL + 150);
      if (token.stop) break;
      gaze(target);
      for (const ch of phrases[step % phrases.length]) {
        if (token.stop) break;
        typeInto(demo.focused, ch);
        await sleep(55);
      }
      if (!token.stop) typeInto(demo.focused, "Enter");
      step++;
      await sleep(900);
    }
  })();
}
function stopAutoplay() {
  demo.touched = true;
  if (autoplay) { autoplay.stop = true; autoplay = null; desk.classList.remove("looking"); }
}
new IntersectionObserver(([e]) => {
  if (e.isIntersecting) startAutoplay();
  else if (autoplay) { autoplay.stop = true; autoplay = null; }
}, { threshold: 0.5 }).observe(desk);

/* Webcam mode: real head tracking in the browser with MediaPipe, loaded only on request. */
const video = $("#cam");
let cam = null;
$$(".chip[data-mode]").forEach((chip) =>
  chip.addEventListener("click", async () => {
    const mode = chip.dataset.mode;
    if (mode === demo.mode) return;
    stopAutoplay();
    setModeChips(mode);
    demo.mode = mode;
    if (mode === "camera") await startCamera();
    else stopCamera("Hover the desk, then type");
  })
);
function setModeChips(mode) {
  $$(".chip[data-mode]").forEach((c) => {
    const on = c.dataset.mode === mode;
    c.classList.toggle("active", on);
    c.setAttribute("aria-checked", on);
  });
}

async function startCamera() {
  status.textContent = "Loading the face tracker…";
  try {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
    const files = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    const landmarker = await vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    if (demo.mode !== "camera") { stream.getTracks().forEach((t) => t.stop()); return; }
    video.srcObject = stream;
    await video.play();
    desk.classList.add("camera", "looking");
    cam = { stream, landmarker, base: null, samples: [], flip: 1, lastTime: -1, raf: 0 };
    status.textContent = "Look at the middle screen for a second…";
    trackFrame();
  } catch (err) {
    console.warn(err);
    demo.mode = "mouse";
    setModeChips("mouse");
    stopCamera(err?.name === "NotAllowedError" ? "Camera blocked. Using the mouse instead." : "Couldn't start the camera. Using the mouse instead.");
  }
}

function trackFrame() {
  if (!cam) return;
  cam.raf = requestAnimationFrame(trackFrame);
  if (video.currentTime === cam.lastTime) return;
  cam.lastTime = video.currentTime;
  const lm = cam.landmarker.detectForVideo(video, performance.now()).faceLandmarks?.[0];
  if (!lm) { status.textContent = "Can't see your face. Is the camera pointing at you?"; return; }
  // Head turn: nose tip offset from the midpoint of the outer eye corners, in eye-widths.
  const nose = lm[1], l = lm[33], r = lm[263];
  const yaw = (nose.x - (l.x + r.x) / 2) / Math.max(Math.abs(r.x - l.x), 0.01);
  if (cam.base === null) {
    cam.samples.push(yaw);
    if (cam.samples.length >= 20) {
      cam.base = cam.samples.reduce((a, b) => a + b, 0) / cam.samples.length;
      status.textContent = "Turn your head toward a screen, then type. ";
      const flip = document.createElement("button");
      flip.className = "linkish";
      flip.textContent = "Backwards? Flip";
      flip.addEventListener("click", () => (cam.flip *= -1));
      status.append(flip);
    }
    return;
  }
  // In the raw (unmirrored) camera image, turning to your right moves the nose toward smaller x.
  const right = -(yaw - cam.base) * cam.flip;
  gaze(right > 0.14 ? 2 : right < -0.14 ? 0 : 1);
  const box = mons[1].querySelector(".screen").getBoundingClientRect();
  const span = mons[2].getBoundingClientRect().left - mons[1].getBoundingClientRect().left;
  const t = Math.max(-1.6, Math.min(1.6, right / 0.14));
  moveDot(box.left + box.width / 2 + t * span * 0.75, box.top + box.height / 2);
}

function stopCamera(message) {
  if (cam) {
    cancelAnimationFrame(cam.raf);
    cam.stream.getTracks().forEach((t) => t.stop());
    cam.landmarker.close?.();
    cam = null;
  }
  video.srcObject = null;
  desk.classList.remove("camera", "looking");
  status.textContent = message;
}

/* ---------- Setup tour ---------- */
const shots = ["welcome", "camera", "accessibility", "calibrate", "try-it", "all-set"];
const tabs = $$(".tour-tabs [role=tab]");
const shot = $("#tourShot");
const bar = $("#tourBar");
let tourIndex = 0, tourTimer = null, tourAuto = true;
function showShot(i) {
  tourIndex = i;
  tabs.forEach((t, j) => t.setAttribute("aria-selected", j === i));
  shot.style.opacity = 0;
  setTimeout(() => {
    shot.src = `assets/setup-${i}-${shots[i]}.png`;
    shot.alt = `LookFocus setup guide: ${tabs[i].textContent} step`;
    shot.style.opacity = 1;
  }, 180);
  bar.style.transition = "none";
  bar.style.width = "0";
  if (tourAuto && !reduceMotion) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = "width 3.6s linear";
      bar.style.width = "100%";
    }));
  }
}
tabs.forEach((t, i) => t.addEventListener("click", () => { tourAuto = false; clearInterval(tourTimer); showShot(i); }));
shots.forEach((name, i) => { new Image().src = `assets/setup-${i}-${name}.png`; });
new IntersectionObserver(([e]) => {
  clearInterval(tourTimer);
  if (e.isIntersecting && tourAuto && !reduceMotion) {
    showShot(tourIndex);
    tourTimer = setInterval(() => showShot((tourIndex + 1) % shots.length), 3600);
  }
}, { threshold: 0.4 }).observe(shot);

/* ---------- Pricing card tilt ---------- */
const card = $("#priceCard");
if (!reduceMotion && matchMedia("(hover: hover)").matches) {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  });
  card.addEventListener("pointerleave", () => (card.style.transform = ""));
}

/* ---------- Scroll reveals: native IntersectionObserver + CSS, so a section is never left
   hidden (jumping via nav links reveals immediately; siblings get a small stagger). ---------- */
if (!reduceMotion && "IntersectionObserver" in window) {
  document.documentElement.classList.add("anim");
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, n) => {
      e.target.style.transitionDelay = `${Math.min(n, 4) * 70}ms`;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));
}

/* ---------- Sticker pop + parallax (GSAP), purely decorative; the hero text animates in CSS ---------- */
if (window.gsap && !reduceMotion) {
  gsap.from(".sticker", { scale: 0, rotate: -30, duration: 0.7, stagger: 0.15, delay: 0.7, ease: "back.out(2)" });
  if (window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.to(".face", { y: 80, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  }
}
