/**
 * Pure Path — internal patient booking (Calendly-style)
 * Client-side scheduler for Pure Path medical / telehealth patients.
 * Bookings persist in localStorage for this browser.
 */
(() => {
  const STORAGE_KEY = "purepath_bookings_v1";
  const SLOT_MINUTES = 30;
  const DAY_START = 10; // 10:00
  const DAY_END = 18; // 18:00 exclusive last start 17:30
  const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat (JS: 0=Sun)

  const SERVICES = [
    {
      id: "telehealth-initial",
      name: "Telehealth initial consultation",
      duration: 30,
      price: "From $80",
      blurb: "Private video/phone consult with a Pure Path medical practitioner.",
      mode: "Telehealth",
    },
    {
      id: "telehealth-followup",
      name: "Telehealth follow-up",
      duration: 15,
      price: "From $80",
      blurb: "Review consult for existing Pure Path patients.",
      mode: "Telehealth",
    },
    {
      id: "clinic-initial",
      name: "In-clinic consultation (Nerang)",
      duration: 30,
      price: "From $80",
      blurb: "Face-to-face at Earle Plaza, Shop G3/52 Price St, Nerang.",
      mode: "In person",
    },
  ];

  const roots = document.querySelectorAll("[data-pp-booking]");
  if (!roots.length) return;

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveBooking(b) {
    const all = loadBookings();
    all.push(b);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseKey(key) {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day);
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function isPastDay(d) {
    return startOfDay(d) < startOfDay(new Date());
  }

  function isOpenDay(d) {
    return OPEN_DAYS.includes(d.getDay());
  }

  function formatDisplayDate(key) {
    const d = parseKey(key);
    return d.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    return `${h12}:${pad(m)} ${ampm}`;
  }

  function slotTimes(duration) {
    const slots = [];
    const endLimit = DAY_END * 60 - duration;
    for (let t = DAY_START * 60; t <= endLimit; t += SLOT_MINUTES) {
      slots.push(t);
    }
    return slots;
  }

  function isSlotTaken(dateKey, timeMins, duration) {
    const bookings = loadBookings();
    const start = timeMins;
    const end = timeMins + duration;
    return bookings.some((b) => {
      if (b.date !== dateKey || b.status === "cancelled") return false;
      const bStart = b.timeMins;
      const bEnd = bStart + (b.duration || 30);
      return start < bEnd && end > bStart;
    });
  }

  /** Light capacity: block some near-term random-looking slots for realism */
  function isSlotSoftBlocked(dateKey, timeMins) {
    const today = toKey(new Date());
    if (dateKey === today) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes() + 60; // 1h lead time
      if (timeMins < nowMins) return true;
    }
    // deterministic pseudo-busy pattern
    const hash = (dateKey + timeMins).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return hash % 11 === 0;
  }

  function availableSlots(dateKey, duration) {
    if (!dateKey) return [];
    const d = parseKey(dateKey);
    if (isPastDay(d) || !isOpenDay(d)) return [];
    return slotTimes(duration).filter(
      (t) => !isSlotTaken(dateKey, t, duration) && !isSlotSoftBlocked(dateKey, t)
    );
  }

  function refCode() {
    const n = Math.floor(Math.random() * 900000) + 100000;
    return `PP-${n}`;
  }

  function mount(root) {
    const state = {
      step: 1,
      serviceId: SERVICES[0].id,
      month: startOfDay(new Date()),
      date: null,
      timeMins: null,
      form: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        notes: "",
        consent: false,
      },
      confirmation: null,
      error: "",
    };

    function service() {
      return SERVICES.find((s) => s.id === state.serviceId) || SERVICES[0];
    }

    function setMonth(delta) {
      const m = new Date(state.month);
      m.setMonth(m.getMonth() + delta);
      // don't go before current month
      const now = new Date();
      const floor = new Date(now.getFullYear(), now.getMonth(), 1);
      if (m < floor) return;
      state.month = m;
      render();
    }

    function daysInMonthGrid(monthDate) {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();
      const first = new Date(y, m, 1);
      const startPad = (first.getDay() + 6) % 7; // Mon-first
      const days = new Date(y, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push(null);
      for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
      return cells;
    }

    function go(step) {
      state.error = "";
      state.step = step;
      render();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function validateDetails() {
      const f = state.form;
      if (!f.firstName.trim() || !f.lastName.trim()) return "Please enter your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "Please enter a valid email.";
      if (f.phone.replace(/\D/g, "").length < 8) return "Please enter a valid phone number.";
      if (!f.consent) return "Please confirm you understand this is a consultation request.";
      return "";
    }

    function confirmBooking() {
      const err = validateDetails();
      if (err) {
        state.error = err;
        render();
        return;
      }
      if (!state.date || state.timeMins == null) {
        state.error = "Please choose a date and time.";
        state.step = 2;
        render();
        return;
      }
      const svc = service();
      const slots = availableSlots(state.date, svc.duration);
      if (!slots.includes(state.timeMins)) {
        state.error = "That time is no longer available. Please pick another.";
        state.step = 2;
        state.timeMins = null;
        render();
        return;
      }

      const booking = {
        id: refCode(),
        createdAt: new Date().toISOString(),
        serviceId: svc.id,
        serviceName: svc.name,
        mode: svc.mode,
        duration: svc.duration,
        date: state.date,
        timeMins: state.timeMins,
        timeLabel: formatTime(state.timeMins),
        dateLabel: formatDisplayDate(state.date),
        ...state.form,
        firstName: state.form.firstName.trim(),
        lastName: state.form.lastName.trim(),
        email: state.form.email.trim(),
        phone: state.form.phone.trim(),
        notes: state.form.notes.trim(),
        status: "confirmed",
      };
      saveBooking(booking);
      state.confirmation = booking;
      state.step = 5;
      render();
    }

    function bind() {
      root.querySelectorAll("[data-action]").forEach((el) => {
        el.addEventListener("click", (e) => {
          const action = el.getAttribute("data-action");
          if (action === "prev-month") setMonth(-1);
          if (action === "next-month") setMonth(1);
          if (action === "step") go(Number(el.getAttribute("data-step")));
          if (action === "pick-service") {
            state.serviceId = el.getAttribute("data-id");
            state.date = null;
            state.timeMins = null;
            render();
          }
          if (action === "pick-date") {
            state.date = el.getAttribute("data-date");
            state.timeMins = null;
            render();
          }
          if (action === "pick-time") {
            state.timeMins = Number(el.getAttribute("data-time"));
            render();
          }
          if (action === "to-details") {
            if (!state.date || state.timeMins == null) {
              state.error = "Select a date and time to continue.";
              render();
              return;
            }
            go(3);
          }
          if (action === "to-review") {
            const err = validateDetails();
            if (err) {
              state.error = err;
              render();
              return;
            }
            // pull form values
            const form = root.querySelector("#pp-booking-form");
            if (form) {
              const fd = new FormData(form);
              state.form.firstName = String(fd.get("firstName") || "");
              state.form.lastName = String(fd.get("lastName") || "");
              state.form.email = String(fd.get("email") || "");
              state.form.phone = String(fd.get("phone") || "");
              state.form.notes = String(fd.get("notes") || "");
              state.form.consent = form.querySelector('[name="consent"]')?.checked || false;
            }
            const err2 = validateDetails();
            if (err2) {
              state.error = err2;
              render();
              return;
            }
            go(4);
          }
          if (action === "confirm") confirmBooking();
          if (action === "restart") {
            state.step = 1;
            state.date = null;
            state.timeMins = null;
            state.confirmation = null;
            state.error = "";
            render();
          }
        });
      });

      const form = root.querySelector("#pp-booking-form");
      if (form) {
        form.addEventListener("input", () => {
          const fd = new FormData(form);
          state.form.firstName = String(fd.get("firstName") || "");
          state.form.lastName = String(fd.get("lastName") || "");
          state.form.email = String(fd.get("email") || "");
          state.form.phone = String(fd.get("phone") || "");
          state.form.notes = String(fd.get("notes") || "");
          state.form.consent = form.querySelector('[name="consent"]')?.checked || false;
        });
      }
    }

    function stepsNav() {
      const labels = ["Service", "Date & time", "Details", "Confirm"];
      return `
        <ol class="ppb-steps" aria-label="Booking progress">
          ${labels
            .map((label, i) => {
              const n = i + 1;
              const active = state.step === n || (state.step === 5 && n === 4);
              const done = state.step > n || state.step === 5;
              return `<li class="${done ? "is-done" : ""} ${active ? "is-active" : ""}"><span>${n}</span>${label}</li>`;
            })
            .join("")}
        </ol>`;
    }

    function renderServiceStep() {
      return `
        <div class="ppb-panel">
          <h3 class="ppb-title">Choose your consultation</h3>
          <p class="ppb-sub">Pure Path medical &amp; telehealth bookings only. Chiropractic and psychology book via their own profiles.</p>
          <div class="ppb-services">
            ${SERVICES.map((s) => {
              const on = s.id === state.serviceId;
              return `
              <button type="button" class="ppb-service ${on ? "is-selected" : ""}" data-action="pick-service" data-id="${s.id}">
                <div class="ppb-service-top">
                  <strong>${s.name}</strong>
                  <span class="ppb-pill">${s.mode}</span>
                </div>
                <p>${s.blurb}</p>
                <div class="ppb-service-meta">
                  <span>${s.duration} min</span>
                  <span>${s.price}</span>
                </div>
              </button>`;
            }).join("")}
          </div>
          <div class="ppb-actions">
            <button type="button" class="btn btn-primary" data-action="step" data-step="2">Continue to date &amp; time</button>
          </div>
          <p class="ppb-note">Other care: <a href="chiropractor.html">Dr Shakira (chiro)</a> · <a href="psychologist.html">Sarah-Jane (psychologist)</a></p>
        </div>`;
    }

    function renderCalendarStep() {
      const svc = service();
      const monthLabel = state.month.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
      const cells = daysInMonthGrid(state.month);
      const slots = state.date ? availableSlots(state.date, svc.duration) : [];

      return `
        <div class="ppb-panel">
          <h3 class="ppb-title">Pick a date &amp; time</h3>
          <p class="ppb-sub"><strong>${svc.name}</strong> · ${svc.duration} min · ${svc.mode}</p>
          <div class="ppb-datetime">
            <div class="ppb-cal">
              <div class="ppb-cal-head">
                <button type="button" class="ppb-icon-btn" data-action="prev-month" aria-label="Previous month">‹</button>
                <strong>${monthLabel}</strong>
                <button type="button" class="ppb-icon-btn" data-action="next-month" aria-label="Next month">›</button>
              </div>
              <div class="ppb-cal-dow" aria-hidden="true">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
              <div class="ppb-cal-grid">
                ${cells
                  .map((d) => {
                    if (!d) return `<span class="ppb-day is-empty"></span>`;
                    const key = toKey(d);
                    const closed = !isOpenDay(d) || isPastDay(d);
                    const hasSlots = !closed && availableSlots(key, svc.duration).length > 0;
                    const selected = state.date === key;
                    const disabled = closed || !hasSlots;
                    return `<button type="button" class="ppb-day ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""} ${hasSlots ? "has-slots" : ""}" data-action="pick-date" data-date="${key}" ${disabled ? "disabled" : ""} aria-label="${key}">${d.getDate()}</button>`;
                  })
                  .join("")}
              </div>
              <p class="ppb-cal-legend">Open Mon–Sat · 10:00 am – 6:00 pm (AEST)</p>
            </div>
            <div class="ppb-times">
              <h4>${state.date ? formatDisplayDate(state.date) : "Select a day"}</h4>
              ${
                !state.date
                  ? `<p class="ppb-empty">Choose an available day on the calendar.</p>`
                  : slots.length === 0
                    ? `<p class="ppb-empty">No times left this day — try another date.</p>`
                    : `<div class="ppb-time-grid">
                        ${slots
                          .map((t) => {
                            const on = state.timeMins === t;
                            return `<button type="button" class="ppb-time ${on ? "is-selected" : ""}" data-action="pick-time" data-time="${t}">${formatTime(t)}</button>`;
                          })
                          .join("")}
                      </div>`
              }
            </div>
          </div>
          ${state.error ? `<p class="ppb-error" role="alert">${state.error}</p>` : ""}
          <div class="ppb-actions">
            <button type="button" class="btn btn-ghost" data-action="step" data-step="1">Back</button>
            <button type="button" class="btn btn-primary" data-action="to-details">Continue</button>
          </div>
        </div>`;
    }

    function renderDetailsStep() {
      const f = state.form;
      const svc = service();
      return `
        <div class="ppb-panel">
          <h3 class="ppb-title">Your details</h3>
          <p class="ppb-sub">${svc.name} · ${state.date ? formatDisplayDate(state.date) : ""} · ${state.timeMins != null ? formatTime(state.timeMins) : ""}</p>
          <form id="pp-booking-form" class="ppb-form" novalidate>
            <div class="ppb-form-row">
              <label><span>First name</span><input name="firstName" required autocomplete="given-name" value="${escapeAttr(f.firstName)}" placeholder="Alex"></label>
              <label><span>Last name</span><input name="lastName" required autocomplete="family-name" value="${escapeAttr(f.lastName)}" placeholder="Smith"></label>
            </div>
            <label><span>Email</span><input type="email" name="email" required autocomplete="email" value="${escapeAttr(f.email)}" placeholder="you@email.com"></label>
            <label><span>Phone</span><input type="tel" name="phone" required autocomplete="tel" value="${escapeAttr(f.phone)}" placeholder="04xx xxx xxx"></label>
            <label><span>Anything we should know? <em>(optional)</em></span><textarea name="notes" rows="3" placeholder="Goals, preferred contact method…">${escapeHtml(f.notes)}</textarea></label>
            <label class="ppb-check">
              <input type="checkbox" name="consent" ${f.consent ? "checked" : ""} required>
              <span>I am 18+ and understand this books a Pure Path clinical consultation / assessment.</span>
            </label>
          </form>
          ${state.error ? `<p class="ppb-error" role="alert">${state.error}</p>` : ""}
          <div class="ppb-actions">
            <button type="button" class="btn btn-ghost" data-action="step" data-step="2">Back</button>
            <button type="button" class="btn btn-primary" data-action="to-review">Review booking</button>
          </div>
        </div>`;
    }

    function renderReviewStep() {
      const svc = service();
      const f = state.form;
      return `
        <div class="ppb-panel">
          <h3 class="ppb-title">Confirm your booking</h3>
          <p class="ppb-sub">Please check everything looks right.</p>
          <dl class="ppb-summary">
            <div><dt>Consultation</dt><dd>${svc.name}</dd></div>
            <div><dt>Mode</dt><dd>${svc.mode}</dd></div>
            <div><dt>Duration</dt><dd>${svc.duration} minutes</dd></div>
            <div><dt>Date</dt><dd>${formatDisplayDate(state.date)}</dd></div>
            <div><dt>Time</dt><dd>${formatTime(state.timeMins)} <span class="ppb-muted">(AEST)</span></dd></div>
            <div><dt>Name</dt><dd>${escapeHtml(f.firstName)} ${escapeHtml(f.lastName)}</dd></div>
            <div><dt>Email</dt><dd>${escapeHtml(f.email)}</dd></div>
            <div><dt>Phone</dt><dd>${escapeHtml(f.phone)}</dd></div>
            ${f.notes ? `<div><dt>Notes</dt><dd>${escapeHtml(f.notes)}</dd></div>` : ""}
          </dl>
          ${state.error ? `<p class="ppb-error" role="alert">${state.error}</p>` : ""}
          <div class="ppb-actions">
            <button type="button" class="btn btn-ghost" data-action="step" data-step="3">Back</button>
            <button type="button" class="btn btn-primary" data-action="confirm">Confirm booking</button>
          </div>
        </div>`;
    }

    function renderDone() {
      const b = state.confirmation;
      return `
        <div class="ppb-panel ppb-done">
          <div class="ppb-done-badge" aria-hidden="true">✓</div>
          <h3 class="ppb-title">You're booked</h3>
          <p class="ppb-sub">Reference <strong>${b.id}</strong> — save this for your records.</p>
          <dl class="ppb-summary">
            <div><dt>Consultation</dt><dd>${escapeHtml(b.serviceName)}</dd></div>
            <div><dt>When</dt><dd>${escapeHtml(b.dateLabel)} at ${escapeHtml(b.timeLabel)}</dd></div>
            <div><dt>Mode</dt><dd>${escapeHtml(b.mode)}</dd></div>
            <div><dt>Patient</dt><dd>${escapeHtml(b.firstName)} ${escapeHtml(b.lastName)}</dd></div>
            <div><dt>Email</dt><dd>${escapeHtml(b.email)}</dd></div>
          </dl>
          <p class="ppb-note">A confirmation copy is stored on this device. Our team may also contact you on <strong>${escapeHtml(b.phone)}</strong> if needed. For changes call <a href="tel:+61756328124">(07) 5632 8124</a>.</p>
          <div class="ppb-actions">
            <button type="button" class="btn btn-primary" data-action="restart">Book another</button>
            <a class="btn btn-ghost" href="services.html">View services</a>
          </div>
        </div>`;
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    function escapeAttr(s) {
      return escapeHtml(s).replace(/'/g, "&#39;");
    }

    function render() {
      let body = "";
      if (state.step === 1) body = renderServiceStep();
      else if (state.step === 2) body = renderCalendarStep();
      else if (state.step === 3) body = renderDetailsStep();
      else if (state.step === 4) body = renderReviewStep();
      else body = renderDone();

      root.innerHTML = `
        <div class="pp-booking">
          <div class="ppb-brand">
            <img src="assets/logo-nav.png" alt="Pure Path" class="ppb-logo" width="140" height="32">
            <span class="ppb-brand-tag">Patient booking</span>
          </div>
          ${state.step < 5 ? stepsNav() : ""}
          ${body}
        </div>`;
      bind();
    }

    render();
  }

  roots.forEach(mount);
})();
