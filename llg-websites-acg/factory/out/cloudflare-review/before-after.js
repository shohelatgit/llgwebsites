(() => {
  const sliders = document.querySelectorAll('[data-before-after]');

  sliders.forEach((slider) => {
    const range = slider.querySelector('.comparison-range');
    if (!range) return;

    const update = () => {
      const value = Number(range.value);
      slider.style.setProperty('--comparison-position', `${value}%`);
      range.setAttribute('aria-valuetext', `${value}% of the before photo shown`);
    };

    range.addEventListener('input', update);
    update();
  });
})();
