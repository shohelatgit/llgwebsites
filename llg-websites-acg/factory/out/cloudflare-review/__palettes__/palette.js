(async () => {
  const themeResponse = await fetch('/__palettes__/palettes.json');
  const themes = await themeResponse.json();
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const defaultTheme = themes.find((item) => item.id === 'cream-red-light-blue') || themes[0];
  const requested = params.get('theme') || params.get('gradient') || params.get('palette') || root.dataset.siteTheme || defaultTheme.id;
  const theme = themes.find((item) => item.id === requested) || defaultTheme;
  const websiteType = { name: 'Site profile' };
  const mode = params.has('mode')
    ? params.get('mode') === 'dark' ? 'dark' : 'light'
    : theme.mode === 'dark' ? 'dark' : 'light';
  const hero = ['cream-solid', 'navy-photo'].includes(params.get('hero'))
    ? params.get('hero')
    : root.dataset.siteProfile === 'concrete-pavers'
      ? 'navy-photo'
      : theme.hero || (theme.id === 'cream-red-light-blue' ? 'cream-solid' : 'navy-photo');
  const estimatePanel = ['brand', 'soft-gray', 'black'].includes(params.get('estimatePanel'))
    ? params.get('estimatePanel')
    : theme.estimatePanel || 'brand';
  const surfaceColorFields = ['primary', 'deep', 'accent', 'background', 'surface', 'estimate'];
  const foregroundColorFields = ['text', 'lightText', 'estimateText', 'caret'];
  const allColorFields = [...surfaceColorFields, ...foregroundColorFields];
  const cssNames = {
    primary: 'primary',
    deep: 'deep',
    accent: 'accent',
    background: 'canvas',
    surface: 'surface',
    estimate: 'estimate',
  };
  const validHex = (value) => /^#[0-9a-f]{6}$/i.test(value || '');
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const fallbackColor = (field) => {
    if (field === 'text') return theme.deep;
    if (field === 'lightText') return theme.surface;
    if (field === 'estimateText') return theme.lightText || theme.surface;
    if (field === 'estimate' || field === 'caret') return theme.primary;
    return theme.surface;
  };

  const hexToRgb = (hex) => {
    const value = hex.replace('#', '');
    return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  };

  const rgba = (hex, opacity, multiplier = 1) => {
    const [red, green, blue] = hexToRgb(hex);
    const alpha = Math.round(clamp((opacity / 100) * multiplier, 0, 1) * 1000) / 1000;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };

  const normalizedAppearance = (field, colors, candidate = {}) => ({
    mode: candidate.mode === 'gradient' ? 'gradient' : 'solid',
    end: validHex(candidate.end) ? candidate.end.toUpperCase() : colors[field],
    opacity: Number.isFinite(Number(candidate.opacity)) ? clamp(Number(candidate.opacity), 0, 100) : 100,
    angle: Number.isFinite(Number(candidate.angle)) ? clamp(Number(candidate.angle), 0, 360) : 135,
  });

  const paint = (field, colors, appearances, multiplier = 1) => {
    const appearance = appearances[field];
    const start = rgba(colors[field], appearance.opacity, multiplier);
    if (appearance.mode === 'gradient') {
      const end = rgba(appearance.end, appearance.opacity, multiplier);
      return `linear-gradient(${appearance.angle}deg, ${start}, ${end})`;
    }
    return start;
  };

  const initialColors = Object.fromEntries(allColorFields.map((field) => {
    const override = params.get(field);
    const fallback = fallbackColor(field);
    return [field, validHex(override) ? override.toUpperCase() : (theme[field] || fallback).toUpperCase()];
  }));
  const initialAppearances = Object.fromEntries(surfaceColorFields.map((field) => [field, normalizedAppearance(field, initialColors, {
    mode: params.get(`${field}Mode`),
    end: params.get(`${field}End`),
    opacity: params.has(`${field}Opacity`) ? Number(params.get(`${field}Opacity`)) : 100,
    angle: params.has(`${field}Angle`) ? Number(params.get(`${field}Angle`)) : 135,
  })]));

  const applyBrandStyles = (candidateColors, candidateAppearances) => {
    const colors = Object.fromEntries(allColorFields.map((field) => {
      const fallback = fallbackColor(field);
      return [
        field,
        validHex(candidateColors?.[field]) ? candidateColors[field].toUpperCase() : (theme[field] || fallback).toUpperCase(),
      ];
    }));
    const appearances = Object.fromEntries(surfaceColorFields.map((field) => [
      field,
      normalizedAppearance(field, colors, candidateAppearances?.[field]),
    ]));

    surfaceColorFields.forEach((field) => {
      const cssName = cssNames[field];
      const [red, green, blue] = hexToRgb(colors[field]);
      root.style.setProperty(`--brand-${cssName}`, colors[field]);
      root.style.setProperty(`--brand-${cssName}-rgb`, `${red}, ${green}, ${blue}`);
      root.style.setProperty(`--brand-${cssName}-color`, rgba(colors[field], appearances[field].opacity));
      root.style.setProperty(`--brand-${cssName}-paint`, paint(field, colors, appearances));
      [10, 40, 60, 85, 90, 97].forEach((percent) => {
        root.style.setProperty(`--brand-${cssName}-paint-${percent}`, paint(field, colors, appearances, percent / 100));
      });
      root.dataset[`${field}Paint`] = appearances[field].mode;
    });
    root.style.setProperty('--brand-ink', colors.text);
    root.style.setProperty('--brand-light-text', colors.lightText);
    root.style.setProperty('--brand-estimate-text', colors.estimateText);
    root.style.setProperty('--brand-icon', colors.text);
    root.style.setProperty('--brand-icon-on-dark', colors.lightText);
    root.style.setProperty('--brand-caret', colors.caret);
    root.dataset.customColors = allColorFields.some((field) => {
      const fallback = fallbackColor(field);
      return colors[field] !== (theme[field] || fallback).toUpperCase();
    }) || surfaceColorFields.some((field) => {
      const appearance = appearances[field];
      return appearance.mode !== 'solid'
        || appearance.opacity !== 100
        || appearance.angle !== 135
        || appearance.end !== colors[field];
    }) ? 'true' : 'false';
  };

  root.style.setProperty('--brand-gradient-start', theme.start);
  root.style.setProperty('--brand-gradient-mid', theme.mid);
  root.style.setProperty('--brand-gradient-end', theme.end);
  root.style.setProperty('--brand-gradient-angle', `${theme.angle}deg`);
  root.dataset.theme = theme.id;
  root.dataset.gradient = theme.id;
  root.dataset.mode = mode;
  root.dataset.hero = hero;
  root.dataset.estimatePanel = estimatePanel;
  applyBrandStyles(initialColors, initialAppearances);

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== 'brand-style-update') return;
    applyBrandStyles(event.data.colors, event.data.appearances);
    if (['brand', 'soft-gray', 'black'].includes(event.data.estimatePanel)) {
      root.dataset.estimatePanel = event.data.estimatePanel;
    }
  });

  const heroElement = document.querySelector('section[class*="bg-[url("][class*="bg-cover"][class*="bg-center"]');
  if (heroElement) {
    heroElement.dataset.brandHero = '';
    heroElement.querySelector(':scope > .absolute.inset-0.bg-dark')?.classList.add('brand-hero-overlay');
    heroElement.querySelector('.lg\\:col-span-6')?.classList.add('brand-hero-copy');
    heroElement.querySelector('.bg-dark\\/60')?.classList.add('brand-schedule-card');
    heroElement.querySelectorAll('.bg-dark\\/90').forEach((item) => item.classList.add('brand-hero-service'));
  }

  document.querySelectorAll('img[src*="images/core/logo"]').forEach((logo) => {
    const lockup = logo.parentElement;
    if (!lockup) return;
    logo.src = '/images/brand/drainscape-mark.svg';
    logo.alt = '';
    logo.classList.add('brand-preview-logo');
    lockup.dataset.brandLockup = '';
    lockup.setAttribute('aria-label', 'DrainScape Solutions');
    if (!lockup.querySelector('.brand-preview-wordmark')) {
      const wordmark = document.createElement('span');
      wordmark.className = 'brand-preview-wordmark';
      wordmark.setAttribute('aria-hidden', 'true');
      wordmark.innerHTML = '<strong>DRAINSCAPE</strong><small>SOLUTIONS</small>';
      lockup.append(wordmark);
    }
  });

  document.querySelectorAll('[data-services-icon], [data-roof-types-icon], [data-locations-icon]').forEach((icon) => {
    icon.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/%3E';
    icon.alt = '';
    icon.classList.add('brand-caret-icon');
  });

  root.dataset.brandPaletteReady = 'true';
  window.dispatchEvent(new CustomEvent('brand-palette-ready'));

  document.title = `${websiteType.name} / ${theme.name} / ${mode === 'dark' ? 'Dark' : 'Light'} — DrainScape homepage preview`;
})();
