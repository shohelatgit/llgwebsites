// Next Generation Windows & Doors clone — interactions
(function () {
  'use strict';

  /* ---------- Countdown (anniversary sale — ends last day of current month) ---------- */
  var now = new Date();
  var target = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0); // midnight, first of next month

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tick() {
    var diff = target - new Date();
    if (diff < 0) { diff = 0; }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor(diff % 86400000 / 3600000);
    var m = Math.floor(diff % 3600000 / 60000);
    var s = Math.floor(diff % 60000 / 1000);
    var el = function (id) { return document.getElementById(id); };
    if (el('cd-days')) { el('cd-days').textContent = pad(d); }
    if (el('cd-hours')) { el('cd-hours').textContent = pad(h); }
    if (el('cd-minutes')) { el('cd-minutes').textContent = pad(m); }
    if (el('cd-seconds')) { el('cd-seconds').textContent = pad(s); }
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Mobile nav ---------- */
  var menuToggle = document.getElementById('menuToggle');
  var mobileNav = document.getElementById('mobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', function () {
      mobileNav.classList.toggle('open');
    });
    mobileNav.querySelectorAll('.has-sub > a').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        this.parentElement.classList.toggle('open');
      });
    });
  }

  /* ---------- Desktop dropdowns (touch support) ---------- */
  var isTouch = window.matchMedia('(hover: none)').matches;
  if (isTouch) {
    document.querySelectorAll('.main-nav .has-dropdown > a').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (!this.parentElement.classList.contains('open')) {
          e.preventDefault();
          document.querySelectorAll('.main-nav .has-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
          this.parentElement.classList.add('open');
        }
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.has-dropdown')) {
        document.querySelectorAll('.has-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
      }
    });
  }

  /* ---------- Tabs ---------- */
  document.querySelectorAll('.tabs').forEach(function (tabs) {
    var links = tabs.querySelectorAll('.tab-link');
    var panes = tabs.querySelectorAll('.tab-pane');
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        links.forEach(function (l) { l.classList.remove('active'); });
        panes.forEach(function (p) { p.classList.remove('active'); });
        this.classList.add('active');
        var pane = tabs.querySelector(this.getAttribute('data-tab'));
        if (pane) { pane.classList.add('active'); }
      });
    });
  });

  /* ---------- Accordion ---------- */
  document.querySelectorAll('.accordion-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var item = this.parentElement;
      var wasOpen = item.classList.contains('open');
      item.parentElement.querySelectorAll('.accordion-item').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) { item.classList.add('open'); }
    });
  });

  /* ---------- Forms (front-end only) ---------- */
  document.querySelectorAll('form.est-form, form.newsletter-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var success = form.querySelector('.form-success');
      if (success) { success.style.display = 'block'; }
      form.reset();
    });
  });
})();
