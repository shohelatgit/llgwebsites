// Trip's Windows clone — interactions
(function () {
  'use strict';

  /* Mobile nav toggle */
  var mobileToggle = document.querySelector('.nav-mobile-toggle');
  var navLinks = document.querySelector('nav.site .links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', function () {
      var open = mobileToggle.getAttribute('aria-expanded') === 'true';
      mobileToggle.setAttribute('aria-expanded', !open);
      navLinks.classList.toggle('open');
    });
  }

  /* Mobile dropdown toggles (desktop uses CSS :hover) */
  document.querySelectorAll('.nav-dropdown__toggle').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (window.innerWidth <= 760) {
        e.preventDefault();
        var dd = btn.closest('.nav-dropdown');
        var wasOpen = dd.classList.contains('open');
        document.querySelectorAll('.nav-dropdown').forEach(function (d) { d.classList.remove('open'); });
        if (!wasOpen) { dd.classList.add('open'); }
        btn.setAttribute('aria-expanded', String(!wasOpen));
      }
    });
  });

  /* Close dropdowns / mobile nav when clicking outside */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-dropdown') && !e.target.closest('.nav-mobile-toggle')) {
      document.querySelectorAll('.nav-dropdown').forEach(function (d) { d.classList.remove('open'); });
      if (navLinks) { navLinks.classList.remove('open'); }
      if (mobileToggle) { mobileToggle.setAttribute('aria-expanded', 'false'); }
    }
  });

  /* Forms (front-end only) */
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var success = form.querySelector('.form-success');
      if (success) { success.style.display = 'block'; }
      form.reset();
    });
  });
})();
