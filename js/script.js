document.addEventListener("DOMContentLoaded", () => {
  // Mobile menu
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.querySelector(".main-nav");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Header shadow after scrolling
  const header = document.querySelector(".site-header");

  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Fade-in on scroll
  const revealItems = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  // Contact form (demo only, not connected to a backend)
  const form = document.querySelector("#contactForm");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = form.querySelector('[name="name"]').value.trim() || "คุณ";
      const message = form.querySelector(".form-success");
      message.textContent =
        `ขอบคุณ ${name} ค่ะ ได้รับข้อมูลแล้ว ` +
        "โปรดติดต่อ 084-611-4668 หรือ LINE @facetimeclinic เพื่อยืนยันการนัดหมาย";
      message.hidden = false;
      form.reset();
    });
  }
});
