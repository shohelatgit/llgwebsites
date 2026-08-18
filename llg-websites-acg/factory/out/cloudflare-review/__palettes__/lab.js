(async () => {
  const [themeResponse, typeResponse, rosterResponse] = await Promise.all([
    fetch('/__palettes__/palettes.json'),
    fetch('/__palettes__/website-profiles.json'),
    fetch('/__palettes__/airtable-websites.json'),
  ]);
  const themes = await themeResponse.json();
  const websiteTypes = await typeResponse.json();
  const websiteRosterData = await rosterResponse.json();
  const websiteRoster = websiteRosterData.sites;
  const readyWebsites = websiteRoster.filter((site) => site.profileId);
  const params = new URLSearchParams(window.location.search);
  const grid = document.querySelector('#gradient-grid');
  const colorEditorGrid = document.querySelector('#color-editor-grid');
  const foregroundEditorGrid = document.querySelector('#foreground-editor-grid');
  const frame = document.querySelector('#homepage-preview');
  const activeName = document.querySelector('#active-name');
  const activeMood = document.querySelector('#active-mood');
  const previewName = document.querySelector('#preview-name');
  const openPreview = document.querySelector('#open-preview');
  const resetColors = document.querySelector('#reset-colors');
  const websiteTypeSelect = document.querySelector('#website-type');
  const profileBrandName = document.querySelector('#profile-brand-name');
  const profileDomain = document.querySelector('#profile-domain');
  const profileMarket = document.querySelector('#profile-market');
  const profileLocations = document.querySelector('#profile-locations');
  const profileServices = document.querySelector('#profile-services');
  const profileH1Variant = document.querySelector('#profile-h1-variant');
  const previewAddress = document.querySelector('#preview-address');
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  const heroButtons = [...document.querySelectorAll('[data-hero]')];
  const estimatePanelButtons = [...document.querySelectorAll('[data-estimate-panel]')];
  const surfaceColorFields = ['primary', 'deep', 'accent', 'background', 'surface', 'estimate'];
  const foregroundColorFields = ['text', 'lightText', 'estimateText', 'caret'];
  const allColorFields = [...surfaceColorFields, ...foregroundColorFields];
  const colorLabels = {
    primary: 'Primary brand color',
    deep: 'Deep brand color',
    accent: 'Accent color',
    background: 'Page background',
    surface: 'Cards / form fields',
    estimate: 'Estimate CTA',
  };
  const foregroundLabels = {
    text: 'Text / icons on light',
    lightText: 'Text / icons on dark',
    estimateText: 'Estimate CTA text',
    caret: 'Carets / form arrows',
  };
  const defaultTheme = themes.find((item) => item.id === 'cream-red-light-blue') || themes[0];
  const requestedTheme = params.get('theme') || params.get('gradient') || params.get('palette');
  const requestedType = params.get('type');
  const requestedSite = params.get('site');
  const validHex = (value) => /^#[0-9a-f]{6}$/i.test(value || '');
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const fallbackColor = (field, theme) => {
    if (field === 'text') return theme.deep;
    if (field === 'lightText') return theme.surface;
    if (field === 'estimateText') return theme.lightText || theme.surface;
    if (field === 'estimate' || field === 'caret') return theme.primary;
    return theme.surface;
  };
  const colorsFromTheme = (theme) => Object.fromEntries(allColorFields.map((field) => {
    const fallback = fallbackColor(field, theme);
    return [field, (theme[field] || fallback).toUpperCase()];
  }));
  const defaultAppearances = (colors) => Object.fromEntries(surfaceColorFields.map((field) => [field, {
    mode: 'solid',
    end: colors[field],
    opacity: 100,
    angle: 135,
  }]));

  let website = readyWebsites.find((site) => site.sourceId === requestedSite)
    || readyWebsites.find((site) => site.profileId === requestedType)
    || readyWebsites[0];
  let websiteType = websiteTypes.find((item) => item.id === website.profileId) || websiteTypes[0];
  let active = themes.find((item) => item.id === requestedTheme)
    || themes.find((item) => item.id === website.themeId)
    || defaultTheme;
  let colors = colorsFromTheme(active);
  allColorFields.forEach((field) => {
    const override = params.get(field);
    if (validHex(override)) colors[field] = override.toUpperCase();
  });
  let appearances = defaultAppearances(colors);
  surfaceColorFields.forEach((field) => {
    const modeValue = params.get(`${field}Mode`);
    const endValue = params.get(`${field}End`);
    const opacityValue = Number(params.get(`${field}Opacity`));
    const angleValue = Number(params.get(`${field}Angle`));
    appearances[field] = {
      mode: modeValue === 'gradient' ? 'gradient' : 'solid',
      end: validHex(endValue) ? endValue.toUpperCase() : colors[field],
      opacity: Number.isFinite(opacityValue) && params.has(`${field}Opacity`) ? clamp(opacityValue, 0, 100) : 100,
      angle: Number.isFinite(angleValue) && params.has(`${field}Angle`) ? clamp(angleValue, 0, 360) : 135,
    };
  });
  let mode = params.has('mode')
    ? params.get('mode') === 'dark' ? 'dark' : 'light'
    : active.mode === 'dark' ? 'dark' : 'light';
  let hero = ['cream-solid', 'navy-photo'].includes(params.get('hero'))
    ? params.get('hero')
    : active.hero || (active.id === 'cream-red-light-blue' ? 'cream-solid' : 'navy-photo');
  let estimatePanel = ['brand', 'soft-gray', 'black'].includes(params.get('estimatePanel'))
    ? params.get('estimatePanel')
    : active.estimatePanel || 'brand';

  const isCustom = () => allColorFields.some((field) => colors[field] !== colorsFromTheme(active)[field])
    || surfaceColorFields.some((field) => {
    const appearance = appearances[field];
    return appearance.mode !== 'solid'
      || appearance.opacity !== 100
      || appearance.angle !== 135
      || appearance.end !== colors[field];
  });

  const previewUrl = () => {
    const query = new URLSearchParams({
      theme: active.id,
      mode,
      hero,
      estimatePanel,
      type: websiteType.id,
      site: website.sourceId,
      ...colors,
    });
    surfaceColorFields.forEach((field) => {
      query.set(`${field}Mode`, appearances[field].mode);
      query.set(`${field}End`, appearances[field].end);
      query.set(`${field}Opacity`, String(appearances[field].opacity));
      query.set(`${field}Angle`, String(appearances[field].angle));
    });
    return `/__site__/${websiteType.id}/?${query}`;
  };

  const syncUrl = () => {
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set('theme', active.id);
    pageUrl.searchParams.set('mode', mode);
    pageUrl.searchParams.set('hero', hero);
    pageUrl.searchParams.set('estimatePanel', estimatePanel);
    pageUrl.searchParams.set('type', websiteType.id);
    pageUrl.searchParams.set('site', website.sourceId);
    allColorFields.forEach((field) => {
      pageUrl.searchParams.set(field, colors[field]);
    });
    surfaceColorFields.forEach((field) => {
      pageUrl.searchParams.set(`${field}Mode`, appearances[field].mode);
      pageUrl.searchParams.set(`${field}End`, appearances[field].end);
      pageUrl.searchParams.set(`${field}Opacity`, String(appearances[field].opacity));
      pageUrl.searchParams.set(`${field}Angle`, String(appearances[field].angle));
    });
    pageUrl.searchParams.delete('gradient');
    pageUrl.searchParams.delete('palette');
    window.history.replaceState({}, '', pageUrl);
  };

  const syncColorEditor = () => {
    surfaceColorFields.forEach((field) => {
      const card = document.querySelector(`[data-color-card="${field}"]`);
      if (!card) return;
      card.dataset.paintMode = appearances[field].mode;
      card.querySelector('[data-color]').value = colors[field];
      card.querySelector('[data-color-value]').textContent = colors[field];
      card.querySelector('[data-paint-mode]').value = appearances[field].mode;
      card.querySelector('[data-gradient-end]').value = appearances[field].end;
      card.querySelector('[data-gradient-end-value]').textContent = appearances[field].end;
      card.querySelector('[data-opacity]').value = String(appearances[field].opacity);
      card.querySelector('[data-opacity-value]').textContent = `${appearances[field].opacity}%`;
      card.querySelector('[data-angle]').value = String(appearances[field].angle);
      card.querySelector('[data-angle-value]').textContent = `${appearances[field].angle}°`;
    });
    foregroundColorFields.forEach((field) => {
      const card = document.querySelector(`[data-foreground-card="${field}"]`);
      if (!card) return;
      card.querySelector('[data-foreground-color]').value = colors[field];
      card.querySelector('[data-foreground-value]').textContent = colors[field];
    });
  };

  const sendLiveStyleUpdate = () => {
    frame.contentWindow?.postMessage({
      type: 'brand-style-update',
      colors,
      appearances,
      estimatePanel,
    }, window.location.origin);
  };

  const refreshPreview = ({ reload = true } = {}) => {
    const url = previewUrl();
    const rosterPosition = websiteRoster.findIndex((site) => site.sourceId === website.sourceId);
    const heroH1Variant = rosterPosition >= 0 ? (rosterPosition % 5) + 1 : 1;
    const heroName = hero === 'cream-solid' ? 'Solid background' : 'Dark overlay / photo';
    const estimatePanelName = estimatePanel === 'soft-gray'
      ? 'Soft gray estimate panel'
      : estimatePanel === 'black' ? 'Black estimate panel' : 'Brand estimate panel';
    if (reload) frame.src = url;
    else sendLiveStyleUpdate();
    openPreview.href = url;
    activeName.textContent = active.name;
    activeMood.textContent = isCustom() ? 'Custom color treatments' : active.mood;
    previewName.textContent = `${website.sourceId} / ${website.domain || websiteType.name} / H1 V${heroH1Variant} / ${active.name}${isCustom() ? ' / Custom' : ''} / ${mode === 'dark' ? 'Dark' : 'Light'} / ${heroName} / ${estimatePanelName}`;
    websiteTypeSelect.value = website.sourceId;
    profileBrandName.textContent = website.businessName || website.website || website.sourceId;
    profileDomain.textContent = website.domain || website.website;
    profileMarket.textContent = `${website.marketDisplayName || website.primaryMarket || 'Unassigned'}${website.state ? `, ${website.state}` : ''}`;
    profileLocations.textContent = `${website.featuredLocations?.length || 0} footer / ${website.recommendedLocationCount || 0} recommended`;
    profileH1Variant.textContent = `Variant ${heroH1Variant} of 5 · roster #${rosterPosition + 1}`;
    profileServices.textContent = `${websiteType.name} · ${websiteType.services.length} services / ${websiteType.types.length} types`;
    previewAddress.textContent = website.domain || websiteType.name;
    document.querySelectorAll('.gradient-card').forEach((card) => {
      const selected = card.dataset.theme === active.id;
      card.classList.toggle('is-active', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    modeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
    heroButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.hero === hero));
    });
    estimatePanelButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.estimatePanel === estimatePanel));
    });
    syncColorEditor();
    syncUrl();
  };

  themes.forEach((theme) => {
    const card = document.createElement('button');
    card.className = 'gradient-card';
    card.type = 'button';
    card.dataset.theme = theme.id;
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', `Use the ${theme.name} color scheme`);
    const colorBlocks = theme.colors
      .map((color) => `<i style="background:${color}" title="${color}"></i>`)
      .join('');
    card.innerHTML = `
      <span class="gradient-swatch" aria-hidden="true">${colorBlocks}</span>
      <span class="gradient-card__body">
        <strong>${theme.name}</strong>
        <span>${theme.mode === 'dark' ? 'Dark' : 'Light'} · 5 colors</span>
      </span>`;
    card.addEventListener('click', () => {
      active = theme;
      colors = colorsFromTheme(theme);
      appearances = defaultAppearances(colors);
      mode = theme.mode === 'dark' ? 'dark' : 'light';
      hero = theme.hero || (theme.id === 'cream-red-light-blue' ? 'cream-solid' : 'navy-photo');
      estimatePanel = theme.estimatePanel || 'brand';
      refreshPreview();
    });
    grid.append(card);
  });

  surfaceColorFields.forEach((field) => {
    const card = document.createElement('article');
    card.className = 'color-token-card';
    card.dataset.colorCard = field;
    card.dataset.paintMode = 'solid';
    card.innerHTML = `
      <header><strong>${colorLabels[field]}</strong><output data-color-value></output></header>
      <div class="color-token-card__primary">
        <input type="color" data-color="${field}" aria-label="${colorLabels[field]} start color">
        <select data-paint-mode aria-label="${colorLabels[field]} treatment">
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>
      </div>
      <label class="token-slider">
        <span>Opacity <output data-opacity-value></output></span>
        <input type="range" min="0" max="100" step="1" data-opacity aria-label="${colorLabels[field]} opacity">
      </label>
      <label class="gradient-only gradient-end">
        <span>End <output data-gradient-end-value></output></span>
        <input type="color" data-gradient-end aria-label="${colorLabels[field]} gradient end color">
      </label>
      <label class="gradient-only token-slider">
        <span>Angle <output data-angle-value></output></span>
        <input type="range" min="0" max="360" step="1" data-angle aria-label="${colorLabels[field]} gradient angle">
      </label>`;
    colorEditorGrid.append(card);
  });

  foregroundColorFields.forEach((field) => {
    const card = document.createElement('article');
    card.className = 'color-token-card foreground-token-card';
    card.dataset.foregroundCard = field;
    card.innerHTML = `
      <header><strong>${foregroundLabels[field]}</strong><output data-foreground-value></output></header>
      <label class="foreground-token-card__picker">
        <input type="color" data-foreground-color="${field}" aria-label="${foregroundLabels[field]} color">
        <span>${field === 'text'
          ? 'Headings, body copy, and line icons'
          : field === 'lightText'
            ? 'Copy and icons on dark or saturated surfaces'
            : field === 'estimateText'
              ? 'Label color used only on estimate buttons'
              : 'Dropdown and form-select indicators'}</span>
      </label>`;
    foregroundEditorGrid.append(card);
  });

  const nicheLabels = {
    'Drainage & French Drains': 'Drainage',
    'Outdoor Living / Multi-service': 'Outdoor Living',
    'Landscaping & Lawn Care': 'Landscaping & Lawn Care',
    'Concrete & Pavers': 'Concrete & Pavers',
    'Irrigation & Sprinklers': 'Irrigation & Sprinklers',
  };
  const preferredNicheOrder = ['Drainage', 'Crawlspace'];
  const websitesByNiche = new Map();
  websiteRoster.forEach((site) => {
    const groupLabel = nicheLabels[site.niche] || site.niche || 'Needs Review';
    if (!websitesByNiche.has(groupLabel)) websitesByNiche.set(groupLabel, []);
    websitesByNiche.get(groupLabel).push(site);
  });

  [...websitesByNiche.entries()]
    .sort(([firstLabel], [secondLabel]) => {
      const firstPriority = preferredNicheOrder.indexOf(firstLabel);
      const secondPriority = preferredNicheOrder.indexOf(secondLabel);
      if (firstPriority !== -1 || secondPriority !== -1) {
        if (firstPriority === -1) return 1;
        if (secondPriority === -1) return -1;
        return firstPriority - secondPriority;
      }
      return firstLabel.localeCompare(secondLabel);
    })
    .forEach(([groupLabel, sites]) => {
      const group = document.createElement('optgroup');
      group.label = `${groupLabel} (${sites.length})`;
      sites
        .sort((first, second) => {
          const firstLabel = first.marketDisplayName || first.primaryMarket || first.businessName || first.sourceId;
          const secondLabel = second.marketDisplayName || second.primaryMarket || second.businessName || second.sourceId;
          return firstLabel.localeCompare(secondLabel);
        })
        .forEach((site) => {
          const option = document.createElement('option');
          const market = site.marketDisplayName || site.primaryMarket || site.state || 'Market pending';
          const businessName = site.businessName || site.website || site.domain || site.sourceId;
          option.value = site.sourceId;
          option.textContent = `${market} — ${businessName}${site.profileId ? '' : ' — profile pending'}`;
          option.title = site.domain || site.website || businessName;
          option.disabled = !site.profileId;
          group.append(option);
        });
      websiteTypeSelect.append(group);
    });

  websiteTypeSelect.addEventListener('change', () => {
    const selectedWebsite = readyWebsites.find((item) => item.sourceId === websiteTypeSelect.value);
    if (!selectedWebsite) return;
    website = selectedWebsite;
    websiteType = websiteTypes.find((item) => item.id === website.profileId) || websiteTypes[0];
    active = themes.find((item) => item.id === website.themeId) || defaultTheme;
    colors = colorsFromTheme(active);
    appearances = defaultAppearances(colors);
    mode = active.mode === 'dark' ? 'dark' : 'light';
    hero = active.hero || (active.id === 'cream-red-light-blue' ? 'cream-solid' : 'navy-photo');
    estimatePanel = active.estimatePanel || 'brand';
    refreshPreview();
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      refreshPreview();
    });
  });

  heroButtons.forEach((button) => {
    button.addEventListener('click', () => {
      hero = button.dataset.hero;
      refreshPreview();
    });
  });

  estimatePanelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      estimatePanel = button.dataset.estimatePanel;
      refreshPreview({ reload: false });
    });
  });

  colorEditorGrid.addEventListener('input', (event) => {
    const card = event.target.closest('[data-color-card]');
    if (!card) return;
    const field = card.dataset.colorCard;
    if (event.target.matches('[data-color]')) colors[field] = event.target.value.toUpperCase();
    if (event.target.matches('[data-gradient-end]')) appearances[field].end = event.target.value.toUpperCase();
    if (event.target.matches('[data-opacity]')) appearances[field].opacity = Number(event.target.value);
    if (event.target.matches('[data-angle]')) appearances[field].angle = Number(event.target.value);
    refreshPreview({ reload: false });
  });

  colorEditorGrid.addEventListener('change', (event) => {
    const card = event.target.closest('[data-color-card]');
    if (!card || !event.target.matches('[data-paint-mode]')) return;
    appearances[card.dataset.colorCard].mode = event.target.value === 'gradient' ? 'gradient' : 'solid';
    refreshPreview({ reload: false });
  });

  foregroundEditorGrid.addEventListener('input', (event) => {
    if (!event.target.matches('[data-foreground-color]')) return;
    const field = event.target.dataset.foregroundColor;
    colors[field] = event.target.value.toUpperCase();
    refreshPreview({ reload: false });
  });

  resetColors.addEventListener('click', () => {
    colors = colorsFromTheme(active);
    appearances = defaultAppearances(colors);
    refreshPreview({ reload: false });
  });

  frame.addEventListener('load', sendLiveStyleUpdate);
  refreshPreview();
})();
