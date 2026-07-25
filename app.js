/* Pure Path interactions */
(() => {
  const header = document.querySelector(".site-header");
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector("#mobile-menu");
  const form = document.querySelector("#booking-form");
  const success = document.querySelector("#form-success");

  // Sticky header shadow
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Highlight current page in nav
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const page =
    path === "" || path === "index.html"
      ? "index.html"
      : path;
  document.querySelectorAll(".nav-links a, .mobile-menu a[data-nav]").forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    if (href === page || (page === "index.html" && (href === "./" || href === "index.html"))) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });

  // Mobile nav
  if (menuToggle && mobileMenu) {
    const setOpen = (open) => {
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) mobileMenu.removeAttribute("hidden");
      else mobileMenu.setAttribute("hidden", "");
      document.body.style.overflow = open ? "hidden" : "";
    };

    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      setOpen(open);
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // FAQ accordion
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      faqItems.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  // Scroll reveal
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  // Booking form (demo — stores request locally)
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const key = "purepath_booking_requests";
        const prev = JSON.parse(localStorage.getItem(key) || "[]");
        prev.push({ ...data, submittedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(prev));
      } catch (_) {
        /* ignore storage errors */
      }

      form.reset();
      if (success) {
        success.hidden = false;
        success.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "Request sent ✓";
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2800);
      }
    });
  }
})();
