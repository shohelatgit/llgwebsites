(async () => {
  const [profileResponse, rosterResponse, phoneDirectoryResponse, generatedMediaResponse, pulledHeroResponse, siteMediaResponse, comparisonMediaResponse] = await Promise.all([
    fetch('/__palettes__/website-profiles.json'),
    fetch('/__palettes__/airtable-websites.json'),
    fetch('/__palettes__/phone-directory.json'),
    fetch('/__palettes__/generated-media/uncovered-sites/manifest.json'),
    fetch('/__palettes__/generated-media/site-heroes/manifest.json'),
    fetch('/__palettes__/generated-media/site-media/manifest.json'),
    fetch('/__palettes__/generated-media/before-after/manifest.json'),
  ]);
  const profiles = await profileResponse.json();
  const websiteRosterData = await rosterResponse.json();
  const phoneDirectoryData = await phoneDirectoryResponse.json();
  const generatedMediaData = await generatedMediaResponse.json();
  const pulledHeroData = await pulledHeroResponse.json();
  const siteMediaData = await siteMediaResponse.json();
  const comparisonMediaData = await comparisonMediaResponse.json();
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const injectedProfile = document.querySelector('meta[name="site-profile-id"]')?.content;
  const requestedProfile = injectedProfile || params.get('type') || root.dataset.siteProfile || 'roofing';
  const baseProfile = profiles.find((item) => item.id === requestedProfile) || profiles[0];
  const requestedSiteId = params.get('site') || root.dataset.siteSourceId;
  const requestedRosterSite = websiteRosterData.sites.find((site) => site.sourceId === requestedSiteId);
  const selectedSite = requestedRosterSite?.profileId === baseProfile.id ? requestedRosterSite : null;
  const mediaSite = selectedSite
    || websiteRosterData.sites.find((site) => site.sourceId === baseProfile.sourceId && site.profileId === baseProfile.id)
    || websiteRosterData.sites.find((site) => site.profileId === baseProfile.id)
    || null;
  let selectedContact = phoneDirectoryData.sites?.[selectedSite?.sourceId] || null;
  const selectedGeneratedMedia = generatedMediaData.sites?.[mediaSite?.sourceId]
    || pulledHeroData.sites?.[mediaSite?.sourceId]
    || null;
  const selectedSiteMedia = siteMediaData.sites?.[mediaSite?.sourceId] || null;
  const selectedComparisonPairs = comparisonMediaData.profiles?.[baseProfile.id] || [];
  const profile = {
    ...baseProfile,
    businessName: selectedSite?.businessName || baseProfile.businessName,
    domain: selectedSite?.domain || baseProfile.domain,
    websiteSourceId: selectedSite?.sourceId || baseProfile.id,
  };
  const previewPath = document.querySelector('meta[name="site-preview-path"]')?.content || '/';
  const normalizedPath = previewPath === '/home/' ? '/' : previewPath.replace(/\/+$/, '') || '/';
  const areaHubPage = normalizedPath === '/locations';
  const locationDetailPage = normalizedPath.startsWith('/locations/');
  const locationPage = areaHubPage || locationDetailPage;
  const locationSite = locationPage ? (selectedSite || mediaSite) : selectedSite;
  if (locationSite) {
    profile.businessName = locationSite.businessName || profile.businessName;
    profile.domain = locationSite.domain || profile.domain;
    profile.websiteSourceId = locationSite.sourceId || profile.websiteSourceId;
    selectedContact = phoneDirectoryData.sites?.[locationSite.sourceId] || selectedContact;
  }
  const seoEntityName = profile.businessName;

  if (root.dataset.brandPaletteReady !== 'true') {
    await new Promise((resolve) => window.addEventListener('brand-palette-ready', resolve, { once: true }));
  }

  const titleCase = (value) => value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => {
      if (word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
      return word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');

  const stateNames = {
    AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CT: 'Connecticut',
    FL: 'Florida', GA: 'Georgia', IA: 'Iowa', IL: 'Illinois', IN: 'Indiana', KY: 'Kentucky',
    LA: 'Louisiana', MD: 'Maryland', MO: 'Missouri', MS: 'Mississippi', NC: 'North Carolina',
    NJ: 'New Jersey', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    SC: 'South Carolina', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VA: 'Virginia',
    WA: 'Washington', WV: 'West Virginia',
  };
  const primaryMarket = locationSite?.marketDisplayName || locationSite?.primaryMarket || '';
  const primaryState = locationSite?.state || '';
  const primaryStateName = stateNames[primaryState] || primaryState;
  const requestedLocationSlug = locationDetailPage ? normalizedPath.split('/').filter(Boolean).at(-1) : '';
  const selectedLocation = locationSite?.serviceAreas?.find((area) => area.slug === requestedLocationSlug);
  const fallbackLocationName = requestedLocationSlug
    ? titleCase(requestedLocationSlug.replace(new RegExp(`-${primaryState.toLowerCase()}$`), ''))
    : primaryMarket;
  const locationName = selectedLocation?.name || fallbackLocationName;
  const locationState = selectedLocation?.state || primaryState;
  const locationStateName = stateNames[locationState] || locationState;
  const selectedRosterIndex = selectedSite
    ? websiteRosterData.sites.findIndex((site) => site.sourceId === selectedSite.sourceId)
    : -1;
  const assignedHeroH1Variant = selectedRosterIndex >= 0 ? (selectedRosterIndex % 5) + 1 : null;
  const rawPrimaryCategory = profile.serviceGroupLabel.replace(/\s+services?$/i, '').trim();
  const primaryCategory = ({
    Tree: 'Tree Service',
    Pool: 'Pool Service',
    Foundation: 'Foundation Repair',
  }[rawPrimaryCategory] || rawPrimaryCategory).replace(/\s*&\s*/g, ' and ');
  const focusedHeroServices = profile.services.filter((service) => (
    !/^(Residential|Commercial)\b/i.test(service.label)
  ));
  const heroServicePool = focusedHeroServices.length >= 2 ? focusedHeroServices : profile.services;
  const primaryHeroService = heroServicePool[0]?.label || profile.serviceSingular;
  const secondaryHeroService = heroServicePool[1]?.label || primaryHeroService;
  const possessiveMarket = primaryMarket ? `${primaryMarket}'s` : 'Your Area’s';
  const homepageHeroH1Variants = [
    `${possessiveMarket} #1 Solution for ${primaryCategory} and ${primaryHeroService}`,
    `${possessiveMarket} First Choice for ${primaryHeroService} and ${secondaryHeroService}`,
    `Expert ${primaryCategory} Solutions Built for ${primaryMarket || 'Local'} Properties`,
    `${possessiveMarket} Local Experts for ${primaryHeroService} and ${secondaryHeroService}`,
    `Complete ${primaryCategory} Solutions for ${primaryMarket || 'Local'} Homes and Businesses`,
  ];
  const assignedHomepageHeroH1 = assignedHeroH1Variant
    ? homepageHeroH1Variants[assignedHeroH1Variant - 1]
    : profile.heroH1;

  const applyGeneratedHeroMedia = () => {
    if (!selectedGeneratedMedia || normalizedPath !== '/') return;
    const hero = document.querySelector('[data-brand-hero], section[class*="bg-[url(images/core/roof.avif)]"]');
    if (!hero) return;
    hero.style.backgroundImage = `url("${selectedGeneratedMedia.webUrl}")`;
    hero.dataset.generatedMediaAsset = selectedGeneratedMedia.assetKey;
    hero.dataset.generatedMediaSource = selectedGeneratedMedia.source;
    hero.dataset.generatedMediaApproval = selectedGeneratedMedia.approvalStatus;
    hero.dataset.generatedMediaUsage = selectedGeneratedMedia.usage;
  };

  const applyAdaptableHomepageMedia = () => {
    if (!selectedSite || normalizedPath !== '/') return;
    const generatedFallback = selectedGeneratedMedia ? [selectedGeneratedMedia] : [];
    const serviceMedia = selectedSiteMedia?.serviceCards?.length
      ? selectedSiteMedia.serviceCards
      : generatedFallback;
    const serviceSourcePattern = /images\/core\/(residential\.jpeg|waterproofing\.webp|replacement\.webp|residential-roofing\.webp|commercial-roofing\.webp|metal\.png)$/i;
    const serviceImages = [...document.querySelectorAll('img[src]')]
      .filter((image) => serviceSourcePattern.test(image.getAttribute('src') || ''));

    if (serviceMedia.length) {
      serviceImages.forEach((image, index) => {
        const asset = serviceMedia[index % serviceMedia.length];
        image.src = asset.webUrl;
        image.removeAttribute('srcset');
        image.alt = '';
        image.dataset.siteMediaAsset = asset.assetKey;
        image.dataset.siteMediaSource = asset.source;
        image.dataset.siteMediaApproval = asset.approvalStatus;
        image.dataset.siteMediaUsage = asset.usage;

        const card = image.closest('.max-w-sm');
        const body = image.closest('a')?.nextElementSibling;
        card?.classList.add('brand-service-card');
        body?.classList.add('brand-service-card__body');
        body?.querySelector('h5')?.classList.add('brand-service-card__title');
        body?.querySelector(':scope > a:last-child')?.classList.add('brand-service-card__cta');
      });
    }

    const processImage = document.querySelector('img[src*="images/core/truck.webp"]');
    const processAsset = selectedSiteMedia?.processImage || serviceMedia[0];
    if (processImage && processAsset) {
      processImage.src = processAsset.webUrl;
      processImage.removeAttribute('srcset');
      processImage.alt = '';
      processImage.dataset.siteMediaAsset = processAsset.assetKey;
      processImage.dataset.siteMediaSource = processAsset.source;
      processImage.dataset.siteMediaApproval = processAsset.approvalStatus;
      processImage.dataset.siteMediaUsage = processAsset.usage;
      processImage.classList.add('brand-process-image');
      processImage.parentElement?.classList.add('brand-process-media');
    }
  };

  const truncate = (value, maximum) => {
    if (value.length <= maximum) return value;
    return `${value.slice(0, maximum - 1).replace(/\s+\S*$/, '')}…`;
  };

  const updateMeta = (selector, attributes) => {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      document.head.append(element);
    }
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  };

  const styleQuery = () => {
    const query = new URLSearchParams(window.location.search);
    query.delete('type');
    return query.toString();
  };

  const siteUrl = (path) => {
    const cleanPath = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;
    const query = styleQuery();
    return `/__site__/${profile.id}${cleanPath}${query ? `?${query}` : ''}`;
  };

  const servicePath = (service) => `/services/${service.slug}`;
  const typePath = (type) => `/types/${type.slug}`;

  const sourceServices = [
    /residential-roofing/i,
    /commercial-roofing/i,
    /roof-replacement/i,
    /roof-repair/i,
    /waterproofing/i,
  ];
  const sourceTypes = [
    /shingle/i,
    /metal/i,
    /clay-tile/i,
    /concrete-tile/i,
    /flat/i,
    /cedar-shake/i,
  ];

  const setAnchor = (anchor, item, path) => {
    if (!anchor || !item) return;
    anchor.textContent = item.label;
    anchor.href = siteUrl(path(item));
  };

  const rewriteNavigation = () => {
    const desktopServices = [...document.querySelectorAll('.services-dropdown-menu a')];
    const mobileServices = [...document.querySelectorAll('.service-link')];
    [desktopServices, mobileServices].forEach((collection) => {
      profile.services.forEach((service, index) => setAnchor(collection[index], service, servicePath));
      const allServices = collection[profile.services.length];
      if (allServices) {
        allServices.textContent = 'View All Services';
        allServices.href = siteUrl('/services');
      }
    });

    const desktopTypes = [...document.querySelectorAll('.roof-type-menu a')];
    const mobileTypes = [...document.querySelectorAll('.roof-type-link')];
    [desktopTypes, mobileTypes].forEach((collection) => {
      profile.types.forEach((type, index) => setAnchor(collection[index], type, typePath));
    });

    document.querySelectorAll('.btn-roof-type button, [data-btn-roof-types]').forEach((button) => {
      const svg = button.querySelector('svg');
      button.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = ` ${profile.typesLabel} `;
      });
      if (!button.textContent.trim() && !svg) button.textContent = profile.typesLabel;
      button.setAttribute('aria-label', profile.typesLabel);
    });

    document.querySelectorAll('a[href^="/services"]').forEach((anchor) => {
      const rawHref = anchor.getAttribute('href') || '';
      if (/^\/services\/?$/.test(rawHref)) {
        anchor.href = siteUrl('/services');
        return;
      }
      if (/shingle-metal-tile/i.test(rawHref)) {
        const heading = anchor.querySelector('h5');
        if (heading) heading.textContent = profile.typesLabel;
        else if (anchor.textContent.trim()) anchor.textContent = profile.typesLabel;
        anchor.href = siteUrl(`/types/${profile.types[0].slug}`);
        return;
      }
      const index = sourceServices.findIndex((pattern) => pattern.test(rawHref));
      if (index >= 0 && profile.services[index]) anchor.href = siteUrl(servicePath(profile.services[index]));
    });

    document.querySelectorAll('a[href^="/roof-types"]').forEach((anchor) => {
      const rawHref = anchor.getAttribute('href') || '';
      const index = sourceTypes.findIndex((pattern) => pattern.test(rawHref));
      if (index >= 0 && profile.types[index]) anchor.href = siteUrl(typePath(profile.types[index]));
    });
  };

  const setLocationAnchor = (anchor, area) => {
    if (!anchor || !area) return;
    anchor.textContent = `${area.name}, ${area.state}`;
    anchor.href = siteUrl(`/locations/${area.slug}`);
  };

  const rewriteLocationNavigation = () => {
    const featured = locationSite?.featuredLocations || [];
    const mobileLocations = [...document.querySelectorAll('.location-link')];
    featured.forEach((area, index) => setLocationAnchor(mobileLocations[index], area));
    mobileLocations.slice(featured.length, 5).forEach((anchor) => {
      anchor.hidden = true;
      anchor.style.setProperty('display', 'none', 'important');
    });
    const mobileAll = mobileLocations.find((anchor) => /view all locations/i.test(anchor.textContent));
    if (mobileAll) mobileAll.href = siteUrl('/locations');

    document.querySelectorAll('footer h3').forEach((heading) => {
      if (!/^locations$/i.test(heading.textContent.trim())) return;
      const group = heading.parentElement;
      const anchors = [...(group?.querySelectorAll('a') || [])];
      const areaAnchors = anchors.filter((anchor) => !/view all locations/i.test(anchor.textContent));
      featured.forEach((area, index) => setLocationAnchor(areaAnchors[index], area));
      areaAnchors.slice(featured.length).forEach((anchor) => {
        anchor.closest('li')?.remove();
      });
      const viewAll = anchors.find((anchor) => /view all locations/i.test(anchor.textContent));
      if (viewAll) viewAll.href = siteUrl('/locations');
    });
  };

  const rewriteAreaHub = () => {
    if (!areaHubPage || !locationSite || document.querySelector('[data-route-archetype]')) return;
    const heroHeading = document.querySelector('h1');
    const section = heroHeading?.closest('section');
    const heroIntro = heroHeading?.parentElement?.querySelector('p');
    if (heroHeading) heroHeading.textContent = locationSite.marketCopy?.areaHubH1;
    if (heroIntro) heroIntro.textContent = locationSite.marketCopy?.areaHubIntro;

    const cards = [...(section?.querySelectorAll('a[href^="/locations/"]') || [])]
      .map((anchor) => anchor.closest('[data-aos="fade-up"]'))
      .filter((card, index, collection) => card && collection.indexOf(card) === index);
    const areas = locationSite.serviceAreas || [];
    cards.forEach((card, index) => {
      const area = areas[index];
      if (!area) {
        card.hidden = true;
        card.style.setProperty('display', 'none', 'important');
        return;
      }
      const anchor = card.querySelector('a');
      const heading = card.querySelector('h5');
      const image = card.querySelector('img');
      card.dataset.marketLocationCard = area.slug;
      if (anchor) {
        anchor.href = siteUrl(`/locations/${area.slug}`);
        anchor.style.width = '100%';
        anchor.style.minHeight = '6rem';
      }
      if (heading) heading.textContent = `${area.name}, ${area.state}`;
      if (image) {
        image.alt = '';
        image.parentElement.hidden = true;
        image.parentElement.style.setProperty('display', 'none', 'important');
      }
    });
  };

  const rewriteLocationDetail = () => {
    if (!locationDetailPage) return;
    const heroHeading = document.querySelector('h1');
    const heroSection = heroHeading?.closest('section');
    const heroIntro = heroSection?.querySelector('p');
    if (heroHeading) {
      heroHeading.textContent = selectedLocation?.heroH1 || `${profile.serviceGroupLabel} in ${locationName}, ${locationState}`;
    }
    if (heroIntro) {
      heroIntro.textContent = selectedLocation?.heroIntro
        || `${profile.serviceGroupLabel} for homes and businesses in ${locationName}, ${locationStateName}.`;
    }
    root.dataset.locationName = locationName;
    root.dataset.locationState = locationState;
    root.dataset.locationPageStatus = selectedLocation?.pageStatus || 'draft';
  };

  const slugify = (value) => value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const internalRouteKind = () => {
    if (normalizedPath === '/services') return 'service-hub';
    if (normalizedPath.startsWith('/services/')) return 'service-detail';
    if (normalizedPath === '/types') return 'type-hub';
    if (normalizedPath.startsWith('/types/')) return 'type-detail';
    if (areaHubPage) return 'location-hub';
    if (locationDetailPage) return 'location-detail';
    if (normalizedPath === '/gallery') return 'gallery';
    if (normalizedPath === '/blog') return 'blog-hub';
    if (normalizedPath.startsWith('/blog/')) return 'blog-detail';
    return '';
  };

  const nicheGuidance = {
    roofing: {
      diagnostic: 'surface condition, flashing, drainage paths, ventilation, and signs of active water entry',
      planning: 'repairability, material compatibility, weather exposure, and long-term maintenance',
      outcome: 'a weather-ready roof with a clearly defined repair or replacement scope',
    },
    fencing: {
      diagnostic: 'property lines, grade changes, access points, privacy goals, and existing post condition',
      planning: 'height, material, gate placement, maintenance, and local installation requirements',
      outcome: 'a fence plan that balances privacy, security, access, and curb appeal',
    },
    'retaining-walls': {
      diagnostic: 'slope movement, wall lean, drainage, soil conditions, and the load behind the wall',
      planning: 'excavation access, base preparation, reinforcement, drainage, and finish material',
      outcome: 'a retaining-wall plan built around grade support and controlled water movement',
    },
    'drainage-french-drains': {
      diagnostic: 'where water starts, how it crosses the property, low areas, soil conditions, and a safe outlet',
      planning: 'grading, collection points, pipe routing, discharge, and protection of nearby structures',
      outcome: 'a drainage plan that moves water away from vulnerable areas of the property',
    },
    'landscaping-lawn-care': {
      diagnostic: 'sun exposure, soil condition, drainage, traffic patterns, and the way the property is used',
      planning: 'plant selection, bed layout, lawn needs, hardscape connections, and ongoing care',
      outcome: 'an outdoor plan that is attractive, practical, and maintainable',
    },
    'concrete-pavers': {
      diagnostic: 'surface damage, grade, drainage, vehicle or foot traffic, and base stability',
      planning: 'demolition, base preparation, reinforcement, finish, joints, and water runoff',
      outcome: 'a durable surface plan matched to use, drainage, and the surrounding property',
    },
    'foundation-repair': {
      diagnostic: 'crack patterns, settlement, moisture, floor movement, and changes around doors or windows',
      planning: 'the cause of movement, stabilization options, water control, access, and monitoring',
      outcome: 'a repair plan focused on stabilizing the structure and addressing contributing conditions',
    },
    hvac: {
      diagnostic: 'temperature consistency, airflow, equipment condition, controls, filtration, and energy use',
      planning: 'system capacity, efficiency, ductwork, indoor-air goals, and maintenance needs',
      outcome: 'a comfort plan matched to the building, equipment condition, and operating priorities',
    },
    painting: {
      diagnostic: 'surface condition, peeling or staining, moisture exposure, previous coatings, and preparation needs',
      planning: 'surface repair, primer, coating type, color, access, protection, and drying conditions',
      outcome: 'a prepared and consistently finished surface designed for the way the space is used',
    },
    'tree-service': {
      diagnostic: 'tree health, dead or damaged limbs, lean, clearance, nearby structures, and site access',
      planning: 'risk, equipment access, rigging, debris handling, stump needs, and property protection',
      outcome: 'a tree-care plan that prioritizes safety, property access, and the health of remaining trees',
    },
    'pool-service': {
      diagnostic: 'water condition, surface wear, circulation, equipment performance, and signs of leakage',
      planning: 'cleaning, repair, equipment compatibility, finish options, and ongoing maintenance',
      outcome: 'a pool-service plan focused on reliable operation, water quality, and usable outdoor space',
    },
    'irrigation-sprinklers': {
      diagnostic: 'dry or saturated zones, pressure, coverage, valves, controls, leaks, and plant needs',
      planning: 'zone layout, head selection, controller settings, water use, and repair access',
      outcome: 'an irrigation plan that improves coverage while reducing waste and recurring trouble spots',
    },
  };

  const guidance = nicheGuidance[profile.id] || {
    diagnostic: `the condition of the existing ${profile.projectNoun}, access, and the property owner's priorities`,
    planning: 'scope, materials, scheduling, site protection, and ongoing maintenance',
    outcome: `a clearly scoped ${profile.projectNoun} project matched to the property`,
  };

  const currentService = () => {
    const slug = normalizedPath.split('/').filter(Boolean).at(-1);
    return profile.services.find((item) => item.slug === slug) || profile.services[0];
  };

  const currentType = () => {
    const slug = normalizedPath.split('/').filter(Boolean).at(-1);
    return profile.types.find((item) => item.slug === slug) || profile.types[0];
  };

  const allRouteMedia = () => {
    const candidates = [
      selectedGeneratedMedia,
      ...(selectedSiteMedia?.serviceCards || []),
      selectedSiteMedia?.processImage,
      ...selectedComparisonPairs.flatMap((pair) => [pair.before, pair.after]),
    ].filter(Boolean);
    return candidates.filter((asset, index, collection) => (
      collection.findIndex((candidate) => candidate.webUrl === asset.webUrl) === index
    ));
  };

  const imageMarkup = (asset, alt, className = '') => {
    if (!asset?.webUrl) return '';
    return `<img class="${escapeHtml(className)}" src="${escapeHtml(asset.webUrl)}" alt="${escapeHtml(alt)}" width="${Number(asset.width) || 1600}" height="${Number(asset.height) || 1000}" loading="lazy" decoding="async" data-site-media-asset="${escapeHtml(asset.assetKey || '')}" data-site-media-source="${escapeHtml(asset.source || '')}" data-site-media-approval="${escapeHtml(asset.approvalStatus || '')}" data-site-media-usage="${escapeHtml(asset.usage || '')}">`;
  };

  const routeArticles = () => {
    const serviceOne = profile.services[0];
    const serviceTwo = profile.services[1] || serviceOne;
    const typeOne = profile.types[0];
    const typeTwo = profile.types[1] || typeOne;
    const titles = [
      `How to Plan a ${titleCase(profile.projectNoun)} Project`,
      `When to Schedule ${serviceOne.label}`,
      `What to Expect from ${serviceTwo.label}`,
      `${typeOne.label} vs. ${typeTwo.label}`,
      `What Affects ${titleCase(profile.tradeTerm)} Project Cost?`,
      `Questions to Ask Before Hiring a ${titleCase(profile.companyNoun)}`,
    ];
    return titles.map((title, index) => ({
      title,
      slug: slugify(title),
      excerpt: [
        `Build a clear scope by reviewing ${guidance.diagnostic}.`,
        `Learn which property conditions can make ${serviceOne.label.toLowerCase()} worth evaluating.`,
        `Understand the assessment, planning, and site-preparation steps behind ${serviceTwo.label.toLowerCase()}.`,
        `Compare how ${typeOne.label.toLowerCase()} and ${typeTwo.label.toLowerCase()} differ in use, upkeep, and project fit.`,
        `See how access, existing conditions, materials, preparation, and scope can change a ${profile.tradeTerm} estimate.`,
        `Use practical questions to compare scope, communication, site protection, scheduling, and follow-up.`,
      ][index],
    }));
  };

  const serviceCardMarkup = (service, index, media) => {
    const asset = media[index % Math.max(media.length, 1)];
    return `
      <article class="brand-route-card" data-route-service="${escapeHtml(service.slug)}">
        <a class="brand-route-card__media" href="${escapeHtml(siteUrl(servicePath(service)))}" aria-label="Explore ${escapeHtml(service.label)}">
          ${imageMarkup(asset, `${service.label} service`, 'brand-route-card__image')}
        </a>
        <div class="brand-route-card__body">
          <h3><a href="${escapeHtml(siteUrl(servicePath(service)))}">${escapeHtml(service.label)}</a></h3>
          <p>Review the property conditions, available options, and next steps for ${escapeHtml(service.label.toLowerCase())}.</p>
          <a class="brand-route-text-link" href="${escapeHtml(siteUrl(servicePath(service)))}">Explore ${escapeHtml(service.label)} <span aria-hidden="true">→</span></a>
        </div>
      </article>`;
  };

  const typeLinkMarkup = (type) => `
    <a class="brand-route-option" href="${escapeHtml(siteUrl(typePath(type)))}">
      <strong>${escapeHtml(type.label)}</strong>
      <span>Compare fit, upkeep, and project considerations.</span>
    </a>`;

  const locationLinkMarkup = (area) => `
    <a class="brand-route-location" href="${escapeHtml(siteUrl(`/locations/${area.slug}`))}">
      <strong>${escapeHtml(area.name)}, ${escapeHtml(area.state)}</strong>
      <span>${escapeHtml(profile.serviceGroupLabel)}</span>
    </a>`;

  const stableStringHash = (value) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  };

  const locationCardMarkup = (area, media) => {
    const asset = media.length
      ? media[stableStringHash(`${profile.websiteSourceId}-${area.slug}`) % media.length]
      : null;
    return `
      <article class="brand-route-location-card" data-location-placeholder-photo="true">
        <a href="${escapeHtml(siteUrl(`/locations/${area.slug}`))}">
          <h3>${escapeHtml(area.name)}, ${escapeHtml(area.state)}</h3>
          ${imageMarkup(asset, '', 'brand-route-location-card__image')}
        </a>
      </article>`;
  };

  const routeHeroMarkup = ({ title, intro, asset, actionLabel = 'Start My Project Quiz', actionHref = '#contact', showSecondary = true }) => `
    <section class="brand-route-hero" data-brand-route-hero style="--brand-route-hero-image: url('${escapeHtml(asset?.webUrl || '')}')">
      <div class="brand-route-hero__overlay"></div>
      <div class="brand-route-shell brand-route-hero__inner">
        <div class="brand-route-hero__copy">
          <div class="brand-route-proof" aria-label="Service and trust details">
            <span><strong>${Math.round(Number(phoneDirectoryData.reviewPortfolio?.minimumCount) || 500)}+</strong> Customer Reviews</span>
            <span><strong>Local</strong> ${escapeHtml(titleCase(profile.tradeTerm))} professional</span>
            <span>${escapeHtml(locationDetailPage ? `${locationName}, ${locationState}` : `${primaryMarket || 'Local'}${primaryState ? `, ${primaryState}` : ''}`)} service area</span>
          </div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(intro)}</p>
          <div class="brand-route-actions">
            <a class="brand-route-button brand-route-button--primary" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>
            ${showSecondary ? `<a class="brand-route-button brand-route-button--secondary" href="${escapeHtml(siteUrl('/services'))}">View Services</a>` : ''}
          </div>
        </div>
      </div>
    </section>`;

  const routeQuizMarkup = ({ showContactInfo = false } = {}) => {
    const options = profile.services.slice(0, 4).map((service) => `
      <label class="brand-route-quiz-option"><input type="radio" name="requestedService" value="${escapeHtml(service.label)}" required><span>${escapeHtml(service.label)}</span></label>`).join('');
    const phone = selectedContact?.phone || {};
    const contactArea = locationDetailPage
      ? `${locationName}${locationState ? `, ${locationState}` : ''}`
      : `${primaryMarket || 'Local'}${primaryState ? `, ${primaryState}` : ''}`;
    const contactDetails = showContactInfo ? `
      <div class="brand-route-location-contact">
        <h3>Contact information</h3>
        ${phone.e164 && phone.display ? `<a href="tel:${escapeHtml(phone.e164)}">${escapeHtml(phone.display)}</a>` : ''}
        <p>${escapeHtml(contactArea)} service area</p>
      </div>` : '';
    return `
      <section class="brand-route-quiz-section" id="contact">
        <div class="brand-route-shell brand-route-quiz-layout">
          <div class="brand-route-quiz-copy">
            <h2>Plan your ${escapeHtml(profile.projectNoun)} project.</h2>
            <p>Answer three quick questions so the first conversation can focus on the right service, project stage, and timing.</p>
            <ul>
              <li>Choose the service that best matches the property.</li>
              <li>Tell us whether you are diagnosing, repairing, or planning.</li>
              <li>Share your preferred timing and contact details.</li>
            </ul>
            ${contactDetails}
          </div>
          <form class="brand-route-quiz-card" data-route-quiz data-contact-form action="${escapeHtml(siteUrl('/success'))}" method="POST" name="route-project-quiz">
            <input type="hidden" name="leadSource" value="${escapeHtml(profile.id)} internal page quiz">
            <input type="hidden" name="pagePath" value="${escapeHtml(normalizedPath)}">
            <p class="brand-route-quiz-progress" data-route-quiz-progress>Step 1 of 4</p>
            <fieldset data-route-quiz-panel>
              <legend>Which service do you need?</legend>
              <div class="brand-route-quiz-options">${options}</div>
              <p class="brand-route-quiz-error" data-route-quiz-error hidden>Choose a service to continue.</p>
              <button class="brand-route-quiz-next" type="button" data-route-quiz-next>Next: Project stage</button>
            </fieldset>
            <fieldset data-route-quiz-panel hidden>
              <legend>What stage is the project in?</legend>
              <div class="brand-route-quiz-options">
                <label class="brand-route-quiz-option"><input type="radio" name="projectStage" value="Inspection or diagnosis" required><span>Need an inspection or diagnosis</span></label>
                <label class="brand-route-quiz-option"><input type="radio" name="projectStage" value="Repair" required><span>Repairing an existing ${escapeHtml(profile.projectNoun)}</span></label>
                <label class="brand-route-quiz-option"><input type="radio" name="projectStage" value="New installation or replacement" required><span>Installing or replacing a ${escapeHtml(profile.projectNoun)}</span></label>
                <label class="brand-route-quiz-option"><input type="radio" name="projectStage" value="Not sure" required><span>Not sure yet</span></label>
              </div>
              <p class="brand-route-quiz-error" data-route-quiz-error hidden>Choose a project stage to continue.</p>
              <div class="brand-route-quiz-nav"><button type="button" data-route-quiz-back>Back</button><button class="brand-route-quiz-next" type="button" data-route-quiz-next>Next: Timing</button></div>
            </fieldset>
            <fieldset data-route-quiz-panel hidden>
              <legend>When would you like help?</legend>
              <div class="brand-route-quiz-options">
                <label class="brand-route-quiz-option"><input type="radio" name="timing" value="Urgent" required><span>Urgent — active damage or safety concern</span></label>
                <label class="brand-route-quiz-option"><input type="radio" name="timing" value="Within two weeks" required><span>Within 1–2 weeks</span></label>
                <label class="brand-route-quiz-option"><input type="radio" name="timing" value="Within 30 days" required><span>Within 30 days</span></label>
                <label class="brand-route-quiz-option"><input type="radio" name="timing" value="Planning" required><span>Planning or comparing options</span></label>
              </div>
              <p class="brand-route-quiz-error" data-route-quiz-error hidden>Choose a timeline to continue.</p>
              <div class="brand-route-quiz-nav"><button type="button" data-route-quiz-back>Back</button><button class="brand-route-quiz-next" type="button" data-route-quiz-next>Next: Contact details</button></div>
            </fieldset>
            <fieldset data-route-quiz-panel hidden>
              <legend>Where should we send your estimate follow-up?</legend>
              <div class="brand-route-contact-grid">
                <label><span>Name</span><input type="text" name="name" autocomplete="name" required placeholder="Full name"></label>
                <label><span>Email</span><input type="email" name="email" autocomplete="email" required placeholder="Email address"></label>
                <label><span>Phone</span><input type="tel" name="phone" autocomplete="tel" required placeholder="Phone number"></label>
                <label><span>Property ZIP</span><input type="text" name="postalCode" autocomplete="postal-code" inputmode="numeric" required placeholder="ZIP code"></label>
              </div>
              <label class="brand-route-consent"><input type="checkbox" name="contactConsent" required><span>By submitting, you agree that ${escapeHtml(profile.businessName)} may contact you about this request by phone, email, or text. Message and data rates may apply. Consent is not a condition of purchase.</span></label>
              <div class="brand-route-quiz-nav"><button type="button" data-route-quiz-back>Back</button><button class="brand-route-quiz-submit brand-estimate-cta" type="submit">Request My Free Estimate</button></div>
            </fieldset>
          </form>
        </div>
      </section>`;
  };

  const routeFaqMarkup = (subject, { preserveSubjectCase = false } = {}) => {
    const sentenceSubject = preserveSubjectCase ? subject : subject.toLowerCase();
    const faqs = [
      [`How do I know if I need ${sentenceSubject}?`, `Start with an assessment of ${guidance.diagnostic}. The recommendation should connect the observed conditions to a clearly defined scope.`],
      [`What affects the cost of ${sentenceSubject}?`, 'Access, existing conditions, preparation, materials or equipment, project size, disposal, permits where required, and site protection can all affect an estimate.'],
      [`How long does a ${profile.projectNoun} project take?`, 'Timing depends on the scope, access, preparation, material or equipment availability, weather where relevant, and inspection requirements. A written scope should include an expected schedule.'],
      [`What should I compare before choosing a provider?`, 'Compare the written scope, exclusions, communication plan, site protection, scheduling, follow-up, and how clearly each recommendation addresses the property conditions.'],
    ];
    return `
      <section class="brand-route-section brand-route-section--surface" data-route-faqs>
        <div class="brand-route-shell brand-route-faq-layout">
          <div><h2>Questions about ${escapeHtml(subject)}</h2><p>Use these answers to prepare for an assessment and compare project scopes.</p></div>
          <div class="brand-route-faq-list">
            ${faqs.map(([question, answer]) => `<details><summary>${escapeHtml(question)}<span aria-hidden="true">+</span></summary><p>${escapeHtml(answer)}</p></details>`).join('')}
          </div>
        </div>
      </section>`;
  };

  const initializeRouteQuiz = (main) => {
    main.querySelectorAll('[data-route-quiz]').forEach((quiz) => {
      const panels = [...quiz.querySelectorAll('[data-route-quiz-panel]')];
      const progress = quiz.querySelector('[data-route-quiz-progress]');
      let current = 0;
      const showPanel = (index) => {
        current = Math.max(0, Math.min(index, panels.length - 1));
        panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== current; });
        if (progress) progress.textContent = `Step ${current + 1} of ${panels.length}`;
        panels[current]?.querySelector('legend, input')?.focus({ preventScroll: true });
      };
      quiz.querySelectorAll('[data-route-quiz-next]').forEach((button) => {
        button.addEventListener('click', () => {
          const panel = panels[current];
          const requiredRadios = [...panel.querySelectorAll('input[type="radio"][required]')];
          const error = panel.querySelector('[data-route-quiz-error]');
          if (requiredRadios.length && !requiredRadios.some((input) => input.checked)) {
            if (error) error.hidden = false;
            requiredRadios[0]?.focus();
            return;
          }
          if (error) error.hidden = true;
          showPanel(current + 1);
        });
      });
      quiz.querySelectorAll('[data-route-quiz-back]').forEach((button) => {
        button.addEventListener('click', () => showPanel(current - 1));
      });
      quiz.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.addEventListener('change', () => {
          const error = input.closest('fieldset')?.querySelector('[data-route-quiz-error]');
          if (error) error.hidden = true;
        });
      });
      showPanel(0);
    });
  };

  const renderInternalPageArchetype = () => {
    const kind = internalRouteKind();
    if (!kind) return;
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    if (!header || !footer) return;

    let sibling = header.nextElementSibling;
    while (sibling && sibling !== footer) {
      const next = sibling.nextElementSibling;
      sibling.remove();
      sibling = next;
    }

    const media = allRouteMedia();
    const heroAsset = media[0];
    const service = currentService();
    const type = currentType();
    const marketLabel = primaryMarket ? `${primaryMarket}${primaryState ? `, ${primaryState}` : ''}` : 'Your Area';
    const main = document.createElement('main');
    main.className = 'brand-route-main';
    main.dataset.routeArchetype = kind;
    let html = '';
    let description = '';

    if (kind === 'service-hub') {
      const title = `${profile.serviceGroupLabel} in ${marketLabel}`;
      const intro = `Explore ${profile.serviceGroupLabel.toLowerCase()} for homes and businesses across ${primaryMarket || 'the service area'}, with recommendations based on the property and project scope.`;
      description = intro;
      html = `${routeHeroMarkup({ title, intro, asset: heroAsset })}
        <section class="brand-route-section"><div class="brand-route-shell"><div class="brand-route-heading"><h2>Services built around the property.</h2><p>Each service page explains what to inspect, what can affect the scope, and which next step may fit.</p></div><div class="brand-route-card-grid">${profile.services.map((item, index) => serviceCardMarkup(item, index, media.slice(1))).join('')}</div></div></section>
        <section class="brand-route-section brand-route-section--deep"><div class="brand-route-shell brand-route-split"><div><h2>Compare ${escapeHtml(profile.typesLabel.toLowerCase())} before deciding.</h2><p>Material, system, and finish choices can change installation requirements, maintenance, appearance, and cost.</p></div><div class="brand-route-option-grid">${profile.types.map(typeLinkMarkup).join('')}</div></div></section>
        ${routeFaqMarkup(profile.serviceGroupLabel)}${routeQuizMarkup()}`;
    } else if (kind === 'service-detail') {
      const title = `${service.label}${primaryMarket ? ` in ${primaryMarket}` : ''}`;
      const intro = `Get a clear assessment and project scope for ${service.label.toLowerCase()}, with attention to ${guidance.diagnostic}.`;
      description = intro;
      const related = profile.services.filter((item) => item.slug !== service.slug).slice(0, 3);
      html = `${routeHeroMarkup({ title, intro, asset: heroAsset })}
        <section class="brand-route-section"><div class="brand-route-shell brand-route-media-split"><div class="brand-route-media-frame">${imageMarkup(media[1] || heroAsset, service.label, 'brand-route-feature-image')}</div><div class="brand-route-prose"><h2>A scope based on the existing conditions.</h2><p>${escapeHtml(service.label)} should begin with a review of ${escapeHtml(guidance.diagnostic)}.</p><p>The plan can then compare ${escapeHtml(guidance.planning)} so the written estimate reflects the property instead of a one-size-fits-all package.</p><a class="brand-route-text-link" href="#contact">Answer three project questions <span aria-hidden="true">→</span></a></div></div></section>
        <section class="brand-route-section brand-route-section--canvas"><div class="brand-route-shell"><div class="brand-route-heading"><h2>What the process should cover.</h2><p>A practical project moves from assessment to a documented plan and a clear handoff.</p></div><div class="brand-route-process"><article><h3>Assess the property</h3><p>Review visible conditions, access, contributing issues, and the owner's priorities.</p></article><article><h3>Define the scope</h3><p>Explain recommended work, options, exclusions, timing, and site preparation.</p></article><article><h3>Complete and review</h3><p>Protect the work area, communicate progress, and review the completed scope with the owner.</p></article></div></div></section>
        <section class="brand-route-section"><div class="brand-route-shell"><div class="brand-route-heading"><h2>Related ${escapeHtml(profile.serviceGroupLabel.toLowerCase())}.</h2><p>Compare adjacent services when the source of the problem or the full scope is still unclear.</p></div><div class="brand-route-card-grid brand-route-card-grid--three">${related.map((item, index) => serviceCardMarkup(item, index + 2, media)).join('')}</div></div></section>
        ${routeFaqMarkup(service.label)}${routeQuizMarkup()}`;
    } else if (kind === 'type-hub' || kind === 'type-detail') {
      const detail = kind === 'type-detail';
      const title = detail ? `${type.label}${primaryMarket ? ` in ${primaryMarket}` : ''}` : `${profile.typesLabel}: Compare Your Options`;
      const intro = detail
        ? `Compare how ${type.label.toLowerCase()} fits the property's use, existing conditions, maintenance priorities, and project budget.`
        : `Compare the ${profile.typesLabel.toLowerCase()} available for ${profile.projectNounPlural}, including project fit, upkeep, and installation considerations.`;
      description = intro;
      const optionTypes = detail ? profile.types.filter((item) => item.slug !== type.slug) : profile.types;
      html = `${routeHeroMarkup({ title, intro, asset: heroAsset })}
        <section class="brand-route-section"><div class="brand-route-shell brand-route-media-split"><div class="brand-route-media-frame">${imageMarkup(media[2] || media[1] || heroAsset, detail ? type.label : profile.typesLabel, 'brand-route-feature-image')}</div><div class="brand-route-prose"><h2>${detail ? `Is ${escapeHtml(type.label)} a fit?` : `Choose by property fit, not name alone.`}</h2><p>Compare ${escapeHtml(guidance.planning)} before selecting a system or material.</p><p>A useful recommendation should explain tradeoffs, preparation requirements, ongoing care, and how the option connects to the desired outcome: ${escapeHtml(guidance.outcome)}.</p><a class="brand-route-text-link" href="#contact">Start the project quiz <span aria-hidden="true">→</span></a></div></div></section>
        <section class="brand-route-section brand-route-section--canvas"><div class="brand-route-shell"><div class="brand-route-heading"><h2>${detail ? `Other ${escapeHtml(profile.typesLabel.toLowerCase())} to compare.` : `Explore every ${escapeHtml(profile.typesLabel.toLowerCase().replace(/s$/, ''))}.`}</h2><p>Open an option to review where it may fit and what to discuss during an estimate.</p></div><div class="brand-route-option-grid brand-route-option-grid--light">${optionTypes.map(typeLinkMarkup).join('')}</div></div></section>
        ${routeFaqMarkup(detail ? type.label : profile.typesLabel)}${routeQuizMarkup()}`;
    } else if (kind === 'location-hub') {
      const seenAreaSlugs = new Set();
      const areas = [...(locationSite?.serviceAreas || [])]
        .sort((left, right) => left.name.localeCompare(right.name))
        .filter((area) => area.slug && !seenAreaSlugs.has(area.slug) && seenAreaSlugs.add(area.slug));
      const title = `Areas We Serve Near ${primaryMarket || 'You'}`;
      const intro = `Explore the communities served throughout the ${primaryMarket || 'local'} area.`;
      description = intro;
      html = `${routeHeroMarkup({ title, intro, asset: heroAsset, actionLabel: 'View Locations', actionHref: '#service-locations', showSecondary: false })}
        <section class="brand-route-section brand-route-location-section" id="service-locations"><div class="brand-route-shell"><div class="brand-route-location-card-grid">${areas.map((area) => locationCardMarkup(area, media)).join('')}</div></div></section>
        ${routeQuizMarkup({ showContactInfo: true })}`;
    } else if (kind === 'location-detail') {
      const areas = (locationSite?.serviceAreas || []).filter((area) => area.slug !== requestedLocationSlug).slice(0, 8);
      const title = selectedLocation?.heroH1 || `${profile.serviceGroupLabel} in ${locationName}, ${locationState}`;
      const intro = selectedLocation?.heroIntro || `${profile.serviceGroupLabel} for property owners in ${locationName}, with service coordinated through the ${primaryMarket || 'local'} market.`;
      const locationFaqSubject = `${profile.serviceGroupLabel.toLowerCase()} in ${locationName}, ${locationState}`;
      description = selectedLocation?.metaDescription || intro;
      html = `${routeHeroMarkup({ title, intro, asset: heroAsset })}
        <section class="brand-route-section"><div class="brand-route-shell brand-route-media-split"><div class="brand-route-media-frame">${imageMarkup(media[1] || heroAsset, `${profile.serviceGroupLabel} in ${locationName}`, 'brand-route-feature-image')}</div><div class="brand-route-prose"><h2>Project planning for ${escapeHtml(locationName)} properties.</h2><p>Start by documenting ${escapeHtml(guidance.diagnostic)}. The assessment should connect those conditions to a practical scope, available options, and the expected schedule.</p><p>${escapeHtml(profile.businessName)} coordinates service for ${escapeHtml(locationName)} through the ${escapeHtml(primaryMarket || 'local')} market.</p><a class="brand-route-text-link" href="#contact">Tell us about the property <span aria-hidden="true">→</span></a></div></div></section>
        <section class="brand-route-section brand-route-section--canvas"><div class="brand-route-shell"><div class="brand-route-heading"><h2>${escapeHtml(profile.serviceGroupLabel)} in ${escapeHtml(locationName)}.</h2><p>Open a service to review project considerations and estimate preparation.</p></div><div class="brand-route-card-grid">${profile.services.map((item, index) => serviceCardMarkup(item, index, media.slice(1))).join('')}</div></div></section>
        <section class="brand-route-section brand-route-section--surface"><div class="brand-route-shell"><div class="brand-route-heading"><h2>Nearby service areas.</h2><p>Browse other communities supported from the ${escapeHtml(primaryMarket || 'local')} market.</p></div><div class="brand-route-location-grid">${areas.map(locationLinkMarkup).join('')}</div></div></section>
        ${routeFaqMarkup(locationFaqSubject, { preserveSubjectCase: true })}${routeQuizMarkup({ showContactInfo: true })}`;
    } else if (kind === 'gallery') {
      const galleryMedia = media.slice(0, 10);
      const title = `${profile.niche} Gallery`;
      const intro = `Explore the systems, materials, work areas, and property conditions commonly involved in ${profile.tradeTerm} projects.`;
      description = intro;
      html = `${routeHeroMarkup({ title, intro, asset: heroAsset })}
        <section class="brand-route-section"><div class="brand-route-shell"><div class="brand-route-heading"><h2>Explore project details and service options.</h2><p>Use the gallery to identify the services and systems you want to discuss during an estimate.</p></div><div class="brand-route-gallery">${galleryMedia.map((asset, index) => `<figure>${imageMarkup(asset, `${profile.niche} ${profile.services[index % profile.services.length].label.toLowerCase()}`, 'brand-route-gallery__image')}<figcaption>${escapeHtml(profile.services[index % profile.services.length].label)}</figcaption></figure>`).join('')}</div></div></section>
        <section class="brand-route-section brand-route-section--canvas"><div class="brand-route-shell"><div class="brand-route-heading"><h2>Open the service behind the image.</h2><p>Each service page explains common conditions, scope decisions, and next steps.</p></div><div class="brand-route-option-grid brand-route-option-grid--light">${profile.services.map((item) => `<a class="brand-route-option" href="${escapeHtml(siteUrl(servicePath(item)))}"><strong>${escapeHtml(item.label)}</strong><span>Review service details and project considerations.</span></a>`).join('')}</div></div></section>
        ${routeQuizMarkup()}`;
    } else if (kind === 'blog-hub' || kind === 'blog-detail') {
      const articles = routeArticles();
      const slug = normalizedPath.split('/').filter(Boolean).at(-1);
      const article = articles.find((item) => item.slug === slug) || articles[0];
      const detail = kind === 'blog-detail';
      const title = detail ? article.title : `${profile.niche} Guides & Resources`;
      const intro = detail ? article.excerpt : `Practical guides for planning ${profile.tradeTerm} work, comparing services, and preparing for an estimate.`;
      description = intro;
      if (detail) {
        const related = articles.filter((item) => item.slug !== article.slug).slice(0, 3);
        html = `${routeHeroMarkup({ title, intro, asset: heroAsset, actionLabel: 'Plan My Project' })}
          <article class="brand-route-article"><div class="brand-route-shell brand-route-article__layout"><div class="brand-route-article__body"><p class="brand-route-article__lede">A useful ${escapeHtml(profile.tradeTerm)} plan starts with the property conditions and a written explanation of the recommended scope.</p><h2>Start with the property, not a package.</h2><p>Document ${escapeHtml(guidance.diagnostic)}. Photos, measurements, access notes, and a description of when the problem appears can make the first assessment more productive.</p><h2>Compare scope and options.</h2><p>Ask how the recommendation accounts for ${escapeHtml(guidance.planning)}. If multiple options are available, compare preparation, expected upkeep, exclusions, and how each option addresses the observed conditions.</p><h2>Prepare for a clear estimate.</h2><p>A written estimate should define the work area, included materials or equipment, preparation, site protection, cleanup, schedule assumptions, and follow-up. The goal is ${escapeHtml(guidance.outcome)}.</p><h2>Questions worth bringing to the estimate.</h2><ul><li>What conditions are driving the recommendation?</li><li>Which work is included, and which work is excluded?</li><li>How will the property and access areas be protected?</li><li>What can change the schedule or final scope?</li><li>What maintenance or follow-up should happen afterward?</li></ul></div><aside class="brand-route-article__aside">${imageMarkup(media[1] || heroAsset, article.title, 'brand-route-article__image')}<h3>Related services</h3>${profile.services.slice(0, 4).map((item) => `<a href="${escapeHtml(siteUrl(servicePath(item)))}">${escapeHtml(item.label)} <span aria-hidden="true">→</span></a>`).join('')}</aside></div></article>
          <section class="brand-route-section brand-route-section--canvas"><div class="brand-route-shell"><div class="brand-route-heading"><h2>Keep reading.</h2><p>Explore related planning guides for the same property.</p></div><div class="brand-route-article-grid">${related.map((item, index) => `<article><div class="brand-route-article-card__media">${imageMarkup(media[(index + 2) % Math.max(media.length, 1)], item.title, 'brand-route-article-card__image')}</div><div><h3><a href="${escapeHtml(siteUrl(`/blog/${item.slug}`))}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.excerpt)}</p><a class="brand-route-text-link" href="${escapeHtml(siteUrl(`/blog/${item.slug}`))}">Read guide <span aria-hidden="true">→</span></a></div></article>`).join('')}</div></div></section>
          ${routeQuizMarkup()}`;
      } else {
        html = `${routeHeroMarkup({ title, intro, asset: heroAsset, actionLabel: 'Plan My Project' })}
          <section class="brand-route-section"><div class="brand-route-shell"><div class="brand-route-heading"><h2>Make the next project decision with better context.</h2><p>Choose a guide to compare services, project factors, and estimate questions.</p></div><div class="brand-route-article-grid">${articles.map((item, index) => `<article><div class="brand-route-article-card__media">${imageMarkup(media[index % Math.max(media.length, 1)], item.title, 'brand-route-article-card__image')}</div><div><h3><a href="${escapeHtml(siteUrl(`/blog/${item.slug}`))}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.excerpt)}</p><a class="brand-route-text-link" href="${escapeHtml(siteUrl(`/blog/${item.slug}`))}">Read guide <span aria-hidden="true">→</span></a></div></article>`).join('')}</div></div></section>
          <section class="brand-route-section brand-route-section--deep"><div class="brand-route-shell brand-route-split"><div><h2>Ready to move from research to a scope?</h2><p>Use the project quiz to identify the service, project stage, timing, and best contact information.</p></div><a class="brand-route-button brand-route-button--primary" href="#contact">Start My Project Quiz</a></div></section>
          ${routeQuizMarkup()}`;
      }
    }

    main.innerHTML = html;
    main.dataset.routeDescription = description;
    if (heroAsset) {
      const hero = main.querySelector('[data-brand-route-hero]');
      hero.dataset.siteMediaAsset = heroAsset.assetKey || '';
      hero.dataset.siteMediaSource = heroAsset.source || '';
      hero.dataset.siteMediaApproval = heroAsset.approvalStatus || '';
      hero.dataset.siteMediaUsage = heroAsset.usage || '';
    }
    footer.before(main);
    initializeRouteQuiz(main);
    root.dataset.routeArchetype = kind;
  };

  const replacementPairs = [
    ['DrainScape Solutions', profile.businessName],
    ['Drainscape Solutions', profile.businessName],
    ['Neal Roofing & Waterproofing', profile.businessName],
    ['Neal Roofing and Waterproofing', profile.businessName],
    ['Neal Roofing', profile.businessName],
    ['Drainscape', profile.businessName],
    ['Residential Roofing', profile.services[0].label],
    ['Commercial Roofing', profile.services[1].label],
    ['Roof Replacement', profile.services[2].label],
    ['Roof Repair', profile.services[3].label],
    ['Waterproofing', profile.services[4].label],
    ['Roofing Services', profile.serviceGroupLabel],
    ['Roofing Service', profile.serviceSingular],
    ['Roofing Company', titleCase(profile.companyNoun)],
    ['Roofing Contractor', titleCase(profile.companyNoun)],
    ['Roof Types', profile.typesLabel],
    ['Roof Inspection/Estimate', `${titleCase(profile.projectNoun)} Consultation/Estimate`],
    ['See the Roofing Transformation', `See the ${profile.niche} Transformation`],
    ['roofers', 'service professionals'],
    ['shingles', profile.types[0].label.toLowerCase()],
    ['Shingle Roofs', profile.types[0].label],
    ['Metal Roofs', profile.types[1].label],
    ['Clay Tile Roofs', profile.types[2].label],
    ['Concrete Tile Roofs', profile.types[3].label],
    ['Flat Roofs', profile.types[4].label],
    ['Cedar Shake Roofs', profile.types[5].label],
    ['Shingle Roofing', profile.types[0].label],
    ['Metal Roofing', profile.types[1].label],
    ['Tile Roofing', profile.types[2].label],
    ['roofing services', profile.serviceGroupLabel.toLowerCase()],
    ['roofing service', profile.serviceSingular.toLowerCase()],
    ['roofing company', profile.companyNoun],
    ['roofing contractor', profile.companyNoun],
    ['roof types', profile.typesLabel.toLowerCase()],
    ['Roofing', titleCase(profile.tradeTerm)],
    ['Roofs', titleCase(profile.projectNounPlural)],
    ['Roof', titleCase(profile.projectNoun)],
    ['roofing', profile.tradeTerm],
    ['roofs', profile.projectNounPlural],
    ['roof', profile.projectNoun],
  ].sort((left, right) => right[0].length - left[0].length);

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const replacementLookup = new Map(
    replacementPairs.map(([source, replacement]) => [source.toLowerCase(), replacement]),
  );
  const exactReplacementLookup = new Map(replacementPairs);
  const terminologyPattern = new RegExp(
    `\\b(?:${replacementPairs.map(([source]) => escapeRegExp(source)).join('|')})\\b`,
    'gi',
  );
  const replaceTerminology = (value) => value.replace(
    terminologyPattern,
    (match) => exactReplacementLookup.get(match) || replacementLookup.get(match.toLowerCase()) || match,
  );

  const geographicPairs = locationSite ? [
    ['Palm Beach County, FL', `${primaryMarket} area`],
    ['Palm Beach County', `${primaryMarket} area`],
    ['West Palm Beach, FL', `${primaryMarket}, ${primaryState}`],
    ['West Palm Beach', primaryMarket],
    ['Boca Raton, FL', `${locationDetailPage ? locationName : primaryMarket}, ${locationDetailPage ? locationState : primaryState}`],
    ['Boca Raton', locationDetailPage ? locationName : primaryMarket],
    ['South Florida', primaryStateName],
    ['Florida', primaryStateName],
  ].filter(([, replacement]) => replacement) : [];
  const geographicLookup = new Map(
    geographicPairs.map(([source, replacement]) => [source.toLowerCase(), replacement]),
  );
  const geographicPattern = geographicPairs.length
    ? new RegExp(`\\b(?:${geographicPairs.map(([source]) => escapeRegExp(source)).join('|')})\\b`, 'gi')
    : null;
  const replaceGeography = (value) => geographicPattern
    ? value.replace(geographicPattern, (match) => geographicLookup.get(match.toLowerCase()) || match)
    : value;
  const replaceSourceMarketFallbacks = (value) => locationSite
    ? value
      .replace(/Boca\s+Raton(?:,\s*FL)?/gi, locationDetailPage ? `${locationName}, ${locationState}` : primaryMarket)
      .replace(/West\s+Palm\s+Beach(?:,\s*FL)?/gi, primaryMarket)
      .replace(/Palm\s+Beach\s+County(?:,\s*FL)?/gi, `${primaryMarket} area`)
    : value;

  const preserveEndorsements = () => {
    document.querySelectorAll('blockquote').forEach((quote) => {
      quote.dataset.preserveEndorsements = '';
    });
  };

  const rewritePageWording = () => {
    preserveEndorsements();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript, template, [data-preserve-endorsements]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      node.textContent = replaceTerminology(replaceSourceMarketFallbacks(replaceGeography(node.textContent)));
    });

    document.querySelectorAll('[alt], [aria-label], [title], [placeholder]').forEach((element) => {
      ['alt', 'aria-label', 'title', 'placeholder'].forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          element.setAttribute(
            attribute,
            replaceTerminology(replaceSourceMarketFallbacks(replaceGeography(element.getAttribute(attribute)))),
          );
        }
      });
    });

    const heroHeading = document.querySelector('main h1, body > section h1, h1');
    if (normalizedPath === '/' && heroHeading) {
      heroHeading.textContent = selectedSite ? assignedHomepageHeroH1 : profile.heroH1;
      if (selectedSite) {
        heroHeading.dataset.heroH1Variant = String(assignedHeroH1Variant);
        heroHeading.dataset.heroH1RosterPosition = String(selectedRosterIndex + 1);
      }
    }
    if (areaHubPage && heroHeading && !document.querySelector('[data-route-archetype]')) {
      heroHeading.textContent = locationSite?.marketCopy?.areaHubH1 || `${profile.serviceGroupLabel} in ${primaryMarket}`;
    }
    if (locationDetailPage && heroHeading && !document.querySelector('[data-route-archetype]')) {
      heroHeading.textContent = selectedLocation?.heroH1 || `${profile.serviceGroupLabel} in ${locationName}, ${locationState}`;
    }

    if (normalizedPath.startsWith('/services/') && heroHeading && !document.querySelector('[data-route-archetype]')) {
      const slug = normalizedPath.split('/').filter(Boolean).at(-1);
      const service = profile.services.find((item) => item.slug === slug);
      if (service) heroHeading.textContent = service.label;
    }

    if (normalizedPath.startsWith('/types/') && heroHeading && !document.querySelector('[data-route-archetype]')) {
      const slug = normalizedPath.split('/').filter(Boolean).at(-1);
      const type = profile.types.find((item) => item.slug === slug);
      if (type) heroHeading.textContent = type.label;
    }

    if (normalizedPath === '/') {
      const heroIntro = [...document.querySelectorAll('p')].find((paragraph) => (
        /over 50 years|ready to answer your questions|finished product/i.test(paragraph.textContent)
      ));
      if (heroIntro) heroIntro.textContent = selectedSite?.marketCopy?.homeHeroIntro || profile.intro;

      document.querySelectorAll('.brand-hero-service').forEach((service, index) => {
        const textNode = [...service.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode && profile.services[index]) textNode.textContent = ` ${profile.services[index].label} `;
      });

      [...document.querySelectorAll('h2')].forEach((heading) => {
        if (/transformation/i.test(heading.textContent)) {
          heading.textContent = `See the ${profile.niche} Transformation`;
        }
        if (/residents choose us|customers choose/i.test(heading.textContent)) {
          heading.textContent = `Why Customers Choose ${profile.businessName}`;
        }
      });

      document.querySelectorAll('.comparison-card').forEach((card, index) => {
        const type = profile.types[index === 0 ? 0 : Math.min(2, profile.types.length - 1)];
        const caption = card.querySelector('figcaption strong, strong');
        if (caption) caption.textContent = `${type.label} comparison`;
        const range = card.querySelector('.comparison-range');
        if (range) range.setAttribute('aria-label', `Compare the before and after ${type.label.toLowerCase()} photos`);
      });

      const servicesBadge = [...document.querySelectorAll('p')].find((element) => (
        /OUR SERVICES.*TYPES OF/i.test(element.textContent.trim())
      ));
      if (servicesBadge) {
        const label = servicesBadge.querySelector('span') || document.createElement('span');
        label.textContent = 'OUR SERVICES';
        servicesBadge.replaceChildren(label, document.createTextNode(` ・ ${profile.typesLabel.toUpperCase()}`));
      }
    }

    document.querySelectorAll('select option').forEach((option) => {
      const original = option.value || option.textContent;
      const index = sourceServices.findIndex((pattern) => pattern.test(original));
      if (index >= 0 && profile.services[index]) {
        option.value = profile.services[index].label;
        option.textContent = profile.services[index].label;
      }
    });

    document.querySelectorAll('button, a').forEach((element) => {
      if (/schedule\s+free\s+estimate/i.test(element.textContent)) {
        element.classList.add('brand-estimate-cta');
      }
    });
  };

  const rewriteBrandLockups = () => {
    document.querySelectorAll('[data-brand-lockup]').forEach((lockup) => {
      lockup.setAttribute('aria-label', profile.businessName);
      const wordmark = lockup.querySelector('.brand-preview-wordmark');
      if (!wordmark) return;
      const words = profile.businessName.trim().split(/\s+/);
      const split = Math.max(1, Math.ceil(words.length / 2));
      wordmark.innerHTML = `<strong>${words.slice(0, split).join(' ')}</strong><small>${words.slice(split).join(' ') || profile.niche}</small>`;
    });
  };

  const replaceSelectOptions = (select, items) => {
    if (!select) return;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose Service*';
    placeholder.disabled = true;
    placeholder.selected = true;
    const options = items.map((item) => {
      const option = document.createElement('option');
      option.value = item.label;
      option.textContent = item.label;
      return option;
    });
    select.replaceChildren(placeholder, ...options);
  };

  const setQuizOptions = (panel, name, labels) => {
    const container = panel?.querySelector('.quiz-options');
    if (!container) return;
    const options = labels.map((label) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = label;
      input.required = true;
      wrapper.append(input, document.createTextNode(label));
      return wrapper;
    });
    container.replaceChildren(...options);
  };

  const rewriteEstimateExperience = () => {
    document.querySelectorAll('form select[name="Service"]').forEach((select) => {
      replaceSelectOptions(select, profile.services);
    });

    document.querySelectorAll('form').forEach((form) => {
      const action = form.getAttribute('action') || '';
      if (action && !/^https?:\/\//i.test(action)) form.action = siteUrl('/success');
      const leadSource = form.querySelector('input[name="leadSource"]');
      if (leadSource) leadSource.value = `${profile.id} Website`;
      const subject = form.querySelector('input[name="_subject"]');
      if (subject) subject.value = `New ${profile.businessName} estimate request`;
      const redirect = form.querySelector('input[name="_next"]');
      if (redirect) redirect.value = `https://${profile.domain}/success/`;
    });

    const quiz = document.querySelector('[data-estimate-quiz]');
    if (!quiz) return;
    const region = quiz.closest('.quiz-layout') || quiz.parentElement;
    const heading = region?.querySelector('h2');
    const intro = region?.querySelector('.launch-lede');
    if (heading) heading.textContent = `Plan your ${profile.projectNoun} project in three quick questions.`;
    if (intro) {
      intro.textContent = `Choose the service, project stage, and timing. A ${profile.tradeTerm} professional will use your answers to prepare for the call.`;
    }
    quiz.dataset.leadSource = `${profile.id}-estimate-quiz`;
    const panels = [...quiz.querySelectorAll('[data-quiz-panel]')];
    if (panels[0]) {
      panels[0].querySelector('legend').textContent = 'Which service do you need?';
      setQuizOptions(panels[0], 'requestedService', profile.services.slice(0, 4).map((service) => service.label));
      const next = panels[0].querySelector('[data-quiz-next]');
      if (next) next.textContent = 'Next: Project stage';
    }
    if (panels[1]) {
      panels[1].querySelector('legend').textContent = 'What stage is the project in?';
      setQuizOptions(panels[1], 'projectStage', [
        'Need an inspection or diagnosis',
        `Repairing an existing ${profile.projectNoun}`,
        `Replacing or installing a new ${profile.projectNoun}`,
        'Not sure yet',
      ]);
      const next = panels[1].querySelector('[data-quiz-next]');
      if (next) next.textContent = 'Next: Timing';
    }
    if (panels[2]) {
      panels[2].querySelector('legend').textContent = 'When would you like help?';
      setQuizOptions(panels[2], 'timing', [
        'Urgent — active damage or safety concern',
        'Within 1–2 weeks',
        'Within 30 days',
        'Planning or comparing options',
      ]);
    }
    if (panels[3]) {
      panels[3].querySelector('legend').textContent = 'Where should we send your estimate follow-up?';
      const consent = panels[3].querySelector('.launch-help');
      if (consent) {
        consent.textContent = `By submitting, you agree that ${profile.businessName} may contact you about this request by phone or text. Message and data rates may apply. Consent is not a condition of purchase.`;
      }
      const submit = panels[3].querySelector('button[type="submit"]');
      if (submit) submit.textContent = 'Request My Free Estimate';
    }
  };

  const placeHeroEstimateTrust = () => {
    if (normalizedPath !== '/') return;
    const trustPortfolio = phoneDirectoryData.trustPortfolio || {};
    const form = document.querySelector('form[name="hero-form"]');
    const submit = form?.querySelector('button[type="submit"]');
    if (!trustPortfolio.displayApproved || !form || !submit) return;

    let trust = form.querySelector('[data-estimate-form-trust]');
    if (!trust) {
      trust = document.createElement('div');
      trust.className = 'brand-estimate-form-trust';
      trust.dataset.estimateFormTrust = '';
      trust.dataset.portfolioTrust = '';
      trust.setAttribute('aria-label', 'Trusted platforms and credentials');
      trust.innerHTML = `
        <img src="/__palettes__/assets/platform-ratings.png" alt="" width="1046" height="93" loading="eager" decoding="async">
        <ul class="sr-only">
          <li data-trust-item="google" data-trust-claim-source="${escapeHtml(trustPortfolio.source || 'Operator')}">Google 4.9 rating</li>
          <li data-trust-item="facebook" data-trust-claim-source="${escapeHtml(trustPortfolio.source || 'Operator')}">Facebook 4.9 rating</li>
          <li data-trust-item="bbb" data-trust-claim-source="${escapeHtml(trustPortfolio.source || 'Operator')}">Rated and trusted by BBB</li>
        </ul>`;
    }

    const submitRow = submit.parentElement;
    if (submitRow && submitRow !== form) submitRow.after(trust);
    else submit.after(trust);
  };

  const rewriteFaqs = () => {
    const faqItems = [...document.querySelectorAll('.faq-item')];
    if (!faqItems.length) return;
    const faqSection = faqItems[0].closest('section');
    const localQualifier = locationDetailPage ? ` in ${locationName}` : '';
    const sectionIntro = [...(faqSection?.querySelectorAll('p') || [])].find((paragraph) => (
      /answering your questions/i.test(paragraph.textContent)
    ));
    if (sectionIntro) sectionIntro.textContent = `Answering common questions about ${profile.tradeTerm}${localQualifier}.`;
    const faqs = [
      {
        question: `How do I know which ${profile.serviceSingular.toLowerCase()} I need${localQualifier}?`,
        answer: `An on-site assessment${localQualifier} should compare the condition of the existing ${profile.projectNoun}, your priorities, access, and budget. The recommendation should explain why a specific service is appropriate.`,
      },
      {
        question: `What affects the cost of ${profile.tradeTerm}${localQualifier}?`,
        answer: 'Scope, existing conditions, access, materials or equipment, preparation, permitting, and site constraints can all affect price. A written estimate should define what is included before work begins.',
      },
      {
        question: `How long does a typical ${profile.projectNoun} project take${localQualifier}?`,
        answer: 'Timing depends on scope, access, preparation, material availability, weather where relevant, and inspection or permit requirements. The project team should confirm a schedule after the assessment.',
      },
      {
        question: `Should I repair or replace my ${profile.projectNoun}${localQualifier}?`,
        answer: `Repair can make sense when damage is isolated and the surrounding ${profile.projectNoun} remains serviceable. Replacement may be more practical when problems are widespread, recurring, or near the end of useful life.`,
      },
      {
        question: `How should I prepare for a ${profile.projectNoun} project${localQualifier}?`,
        answer: 'Clear work areas, protect valuables, identify access restrictions, keep pets and children away from the work zone, and review utilities or site concerns with the crew. The provider should give project-specific instructions.',
      },
    ];
    faqItems.forEach((item, index) => {
      const faq = faqs[index];
      if (!faq) return;
      const question = item.querySelector('.faq-button > span:first-child');
      const answer = item.querySelector('.faq-answer p');
      if (question) question.textContent = faq.question;
      if (answer) answer.textContent = faq.answer;
    });
    const closingCopy = [...(faqSection?.querySelectorAll('p') || [])].find((paragraph) => (
      /expert advice|contact us today/i.test(paragraph.textContent)
    ));
    if (closingCopy) closingCopy.textContent = `For practical guidance about ${profile.tradeTerm}, request a free estimate.`;
  };

  const hideElement = (element) => {
    if (!element) return;
    element.hidden = true;
    element.style.setProperty('display', 'none', 'important');
  };

  const hideSectionByHeading = (pattern) => {
    [...document.querySelectorAll('section h2, section h3')].forEach((heading) => {
      if (pattern.test(heading.textContent.trim())) hideElement(heading.closest('section'));
    });
  };

  const cleanComparisonPresentation = () => {
    document.querySelectorAll('.comparison-card').forEach((card) => {
      card.removeAttribute('data-pair-status');
      const beforeLabel = card.querySelector('.comparison-label--before');
      const afterLabel = card.querySelector('.comparison-label--after');
      const beforeImage = card.querySelector('.comparison-image--before');
      if (beforeLabel) beforeLabel.textContent = 'Before';
      if (afterLabel) afterLabel.textContent = 'After';
      if (beforeImage) beforeImage.alt = `Before view of the ${profile.projectNoun} project`;
    });
    document.querySelectorAll('.comparison-asset-note').forEach((note) => note.remove());
  };

  const applyComparisonMedia = () => {
    if (normalizedPath !== '/' || selectedComparisonPairs.length < 2) return;
    document.querySelectorAll('.comparison-card').forEach((card, index) => {
      const pair = selectedComparisonPairs[index];
      if (!pair?.before || !pair?.after) return;
      card.dataset.pairStatus = 'illustrative-matched';
      card.dataset.comparisonProfile = baseProfile.id;

      [
        ['before', pair.before],
        ['after', pair.after],
      ].forEach(([state, asset]) => {
        const image = card.querySelector(`.comparison-image--${state}`);
        if (!image) return;
        image.src = asset.webUrl;
        image.removeAttribute('srcset');
        image.width = asset.width;
        image.height = asset.height;
        image.alt = `${state === 'before' ? 'Before' : 'After'} view of ${profile.projectNoun}`;
        image.dataset.comparisonAsset = asset.assetKey;
        image.dataset.comparisonSource = asset.source;
        image.dataset.comparisonApproval = asset.approvalStatus;
        image.dataset.comparisonUsage = asset.usage;
      });

      const caption = card.querySelector('figcaption span');
      if (caption) caption.remove();
      const title = card.querySelector('figcaption strong');
      if (title) title.textContent = `${profile.serviceGroupLabel} comparison ${index + 1}`;
      const range = card.querySelector('.comparison-range');
      if (range) range.setAttribute('aria-label', `Compare before and after ${profile.projectNoun} views`);
    });
  };

  const hideUnsupportedWebsiteSpecificContent = () => {
    hideSectionByHeading(/^As seen on$/i);
    hideElement(document.querySelector('#testimonials'));
    hideElement(document.querySelector('blockquote.instagram-media, blockquote[data-instgrm-permalink]')?.closest('section'));

    document.querySelectorAll('img[src*="reviews.webp"]').forEach(hideElement);
    document.querySelectorAll('iframe[src*="google.com/maps"], iframe[src*="maps.google"], footer iframe').forEach(hideElement);
    document.querySelectorAll('footer img[src*="google.png"], footer img[src*="star-icon.svg"]').forEach((image) => {
      hideElement(image.closest('.flex') || image);
    });

    document.querySelectorAll('a').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      if (
        /comfortlyllc|google\.com\/maps\/d\/embed|google\.com\/maps\/place\/Neal|instagram\.com\/neal_roofing|youtube\.com\/channel|facebook\.com\/NealRoofing/i.test(href)
        || /(?:^|\/)(?:financing|refer)(?:[/?#]|$)/i.test(href)
        || anchor.querySelector('img[alt*="Google My Business"], img[alt^="Instagram"], img[alt^="Youtube"], img[alt^="Facebook"]')
      ) {
        hideElement(anchor);
      } else if (locationPage && /^https?:\/\//i.test(href)) {
        anchor.removeAttribute('href');
        anchor.removeAttribute('target');
        anchor.removeAttribute('rel');
      }
    });
  };

  const rewriteHeroProofSignals = () => {
    const reviews = selectedContact?.reviews || {};
    const reviewPortfolio = phoneDirectoryData.reviewPortfolio || {};
    const approvedReviews = reviews.displayApproved
      && Number.isFinite(Number(reviews.rating))
      && Number.isFinite(Number(reviews.count))
      && Number(reviews.rating) > 0
      && Number(reviews.count) > 0;
    const approvedPortfolioReviews = reviewPortfolio.displayApproved
      && Number.isFinite(Number(reviewPortfolio.minimumCount))
      && Number(reviewPortfolio.minimumCount) > 0;
    const reviewHtml = approvedReviews
      ? `<span class="font-bold">${Number(reviews.rating).toFixed(1)}-STAR</span> RATED BY ${Math.round(Number(reviews.count)).toLocaleString()} CUSTOMERS`
      : approvedPortfolioReviews
        ? `<span class="font-bold">${Math.round(Number(reviewPortfolio.minimumCount)).toLocaleString()}+</span> CUSTOMER REVIEWS`
        : '<span class="font-bold">CUSTOMER</span> REVIEWS';
    const credentials = selectedContact?.credentials || {};
    const approvedCredentials = credentials.displayApproved
      && typeof credentials.headline === 'string'
      && typeof credentials.detail === 'string'
      && credentials.headline.trim()
      && credentials.detail.trim();
    const professionalHeadline = approvedCredentials ? credentials.headline.trim() : 'LOCAL';
    const professionalDetail = approvedCredentials
      ? credentials.detail.trim()
      : `${titleCase(profile.tradeTerm)} professional`;

    document.querySelectorAll('p').forEach((paragraph) => {
      const text = paragraph.textContent.trim();
      if (/STAR RATED BY|800\+ CUSTOMERS/i.test(text)) {
        paragraph.innerHTML = reviewHtml;
        paragraph.dataset.reviewClaimState = approvedReviews || approvedPortfolioReviews ? 'approved' : 'label-only';
        if (approvedPortfolioReviews && !approvedReviews) {
          paragraph.dataset.reviewClaimSource = reviewPortfolio.provider || 'Portfolio';
        }
      }
      if (/50-YEAR PRODUCT|WARRANTIES/i.test(text)) {
        paragraph.replaceChildren();
        const strong = document.createElement('span');
        strong.className = 'font-bold';
        strong.textContent = professionalHeadline;
        paragraph.append(strong, document.createElement('br'), document.createTextNode(professionalDetail));
        paragraph.dataset.credentialClaimState = approvedCredentials ? 'approved' : 'neutral';
      }
    });
  };

  const removeEmailsAndLicenses = () => {
    document.querySelectorAll('a[href^="mailto:"]').forEach((anchor) => {
      const row = anchor.closest('dd, li');
      (row || anchor).remove();
    });

    document.querySelectorAll('input[type="email"], input[autocomplete="email"]').forEach((input) => {
      const heroForm = input.closest('form[name="hero-form"]');
      if (input.closest('[data-contact-form]') || heroForm) {
        input.required = true;
        input.name = 'email';
        if (heroForm) {
          input.id = 'hero-email';
          input.placeholder = 'Email*';
          input.autocomplete = 'email';
          input.setAttribute('aria-label', 'Email address');
        }
        return;
      }
      input.required = false;
      const id = input.id;
      const labelledContainer = id
        ? [...document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)]
          .map((label) => label.parentElement)
          .find((container) => container?.contains(input))
        : null;
      const wrapper = labelledContainer || input.closest('form > div') || input.parentElement;
      (wrapper || input).remove();
    });

    document.querySelectorAll('label').forEach((label) => {
      if (
        /^\s*email\s*$/i.test(label.textContent)
        && !label.closest('[data-contact-form], form[name="hero-form"]')
      ) label.remove();
    });

    const emailTextWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest('script, style, noscript, template, [data-contact-form]')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    const emailTextNodes = [];
    while (emailTextWalker.nextNode()) emailTextNodes.push(emailTextWalker.currentNode);
    emailTextNodes.forEach((node) => {
      node.textContent = node.textContent
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
        .replace(/\bemails?\b/gi, 'messages');
    });

    document.querySelectorAll('p, dd, li').forEach((element) => {
      if (/\b(?:roofing\s+)?licen[cs](?:e|ed|ing)|\bbonded\b|CCC1332869/i.test(element.textContent)) {
        if (element.dataset.credentialClaimState === 'approved') return;
        element.remove();
      }
    });
  };

  const applyContactDetails = () => {
    const phone = selectedContact?.phone || {};
    const hasPhone = Boolean(phone.e164 && phone.display);
    const contactArea = locationDetailPage
      ? `${locationName}${locationState ? `, ${locationState}` : ''}`
      : `${primaryMarket || 'Local'}${primaryState ? `, ${primaryState}` : ''}`;
    const serviceAreaLabel = `${contactArea} service area`;

    const credentialPortfolio = phoneDirectoryData.credentialPortfolio || {};
    const approvedCredential = credentialPortfolio.displayApproved
      && typeof credentialPortfolio.headline === 'string'
      && credentialPortfolio.headline.trim();
    const topBanner = document.querySelector('body > section.sticky.bg-banner');
    if (topBanner && approvedCredential) {
      let credential = topBanner.querySelector('[data-portfolio-credential]');
      if (!credential) {
        credential = document.createElement('p');
        credential.className = 'text-base leading-6 text-center text-white brand-top-credential';
        credential.dataset.portfolioCredential = '';
        topBanner.querySelector(':scope > div')?.prepend(credential);
      }
      credential.textContent = credentialPortfolio.headline.trim();
      credential.dataset.credentialClaimState = 'approved';
      credential.dataset.credentialClaimSource = credentialPortfolio.source || 'Operator';
    }
    document.querySelectorAll('a[href^="tel:"]').forEach((anchor) => {
      if (!hasPhone) {
        anchor.textContent = 'Call for an estimate';
        anchor.href = '#contact';
        return;
      }
      anchor.href = `tel:${phone.e164}`;
      const icon = anchor.querySelector('svg, img');
      if (icon) {
        [...anchor.childNodes].forEach((node) => {
          if (node !== icon) node.remove();
        });
        anchor.append(document.createTextNode(` ${phone.display}`));
      } else {
        anchor.textContent = phone.display;
      }
    });
    document.querySelectorAll('a[href*="maps.app.goo.gl"]').forEach((anchor) => {
      anchor.textContent = serviceAreaLabel;
      anchor.href = '#contact';
      anchor.removeAttribute('target');
    });
    document.querySelectorAll('a').forEach((anchor) => {
      if (/Service-area office|Centrepark|\b33409\b/i.test(anchor.textContent)) {
        anchor.textContent = serviceAreaLabel;
        anchor.href = '#contact';
        anchor.removeAttribute('target');
      }
    });
    document.querySelectorAll('p').forEach((paragraph) => {
      if (/Centrepark|West Palm Beach, FL 33409|\b33409\b/i.test(paragraph.textContent)) {
        hideElement(paragraph);
      }
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest('script, style, noscript, template')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      node.textContent = node.textContent.replace(
        /To\s+unsubscribe,\s+text\s+STOP\s+to\s+\(\d{3}\)\s+\d{3}-\d{4}\./gi,
        'To unsubscribe, text STOP.',
      );
    });

    const footer = document.querySelector('footer');
    if (footer) {
      let ownership = footer.querySelector('[data-portfolio-owner]');
      if (!ownership) {
        ownership = document.createElement('p');
        ownership.className = 'brand-portfolio-owner';
        ownership.dataset.portfolioOwner = '';
        (footer.querySelector(':scope > div') || footer).append(ownership);
      }
      ownership.textContent = 'A property of DrainScape Solutions.';
    }
  };

  const rewriteInternalLinks = () => {
    document.querySelectorAll('a[href^="/"]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      if (/^\/(?:__site__|__palettes__|images)(?:\/|$)/.test(href)) return;
      if (href === '/home' || href === '/home/') anchor.href = siteUrl('/');
      else anchor.href = siteUrl(href);
    });
  };

  const removeSourceMarketTraces = () => {
    const cleanSourceIdentityAndMarket = (value) => replaceSourceMarketFallbacks(replaceGeography(value))
      .replace(/Neal Roofing (?:&|and) Waterproofing|Neal Roofing/gi, profile.businessName);
    const sourceServiceRoutes = [
      ['residential-roof-installation', profile.services[0]?.slug],
      ['commercial-roof-installation', profile.services[1]?.slug],
      ['roof-replacement', profile.services[2]?.slug],
      ['roof-repair', profile.services[3]?.slug],
    ];

    document.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      if (!/(?:boca-raton-fl|west-palm-beach|palm-beach-county)/i.test(href)) return;
      const matchedService = sourceServiceRoutes.find(([sourceSlug]) => href.includes(sourceSlug));
      const targetPath = matchedService?.[1]
        ? `/services/${matchedService[1]}`
        : selectedLocation
          ? `/locations/${selectedLocation.slug}`
          : '/locations';
      anchor.href = siteUrl(targetPath);
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return node.parentElement?.closest('script, style, noscript, template')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      node.textContent = cleanSourceIdentityAndMarket(node.textContent);
    });

    document.querySelectorAll('[alt], [aria-label], [title]').forEach((element) => {
      ['alt', 'aria-label', 'title'].forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          element.setAttribute(
            attribute,
            cleanSourceIdentityAndMarket(element.getAttribute(attribute)),
          );
        }
      });
    });
  };

  const pageContext = () => {
    if (normalizedPath === '/') return { kind: 'home', subject: profile.serviceGroupLabel };
    if (normalizedPath === '/services') return { kind: 'service-hub', subject: profile.serviceGroupLabel };
    if (normalizedPath.startsWith('/services/')) {
      const slug = normalizedPath.split('/').filter(Boolean).at(-1);
      const service = profile.services.find((item) => item.slug === slug);
      return { kind: 'service', subject: service?.label || titleCase(slug) };
    }
    if (normalizedPath.startsWith('/types/')) {
      const slug = normalizedPath.split('/').filter(Boolean).at(-1);
      const type = profile.types.find((item) => item.slug === slug);
      return { kind: 'type', subject: type?.label || titleCase(slug) };
    }
    if (normalizedPath === '/types') return { kind: 'type-hub', subject: profile.typesLabel };
    if (areaHubPage) return { kind: 'area-hub', subject: `${profile.serviceGroupLabel} in ${primaryMarket}` };
    if (locationDetailPage) {
      return {
        kind: 'location-draft',
        subject: `${profile.serviceGroupLabel} in ${locationName}, ${locationState}`,
      };
    }
    if (normalizedPath === '/gallery') return { kind: 'gallery', subject: `${profile.niche} Gallery` };
    if (normalizedPath === '/blog') return { kind: 'resource-hub', subject: `${profile.niche} Guides & Resources` };
    if (normalizedPath.startsWith('/blog/')) {
      return { kind: 'resource', subject: document.querySelector('h1')?.textContent.trim() || 'Project Guide' };
    }
    return {
      kind: 'content',
      subject: document.querySelector('h1')?.textContent.trim() || titleCase(normalizedPath.split('/').filter(Boolean).at(-1) || profile.niche),
    };
  };

  const applySeo = () => {
    const context = pageContext();
    const pageTitle = context.kind === 'home'
      ? `${profile.serviceGroupLabel}${primaryMarket ? ` in ${primaryMarket}, ${primaryState}` : ''} | ${seoEntityName}`
      : `${context.subject} | ${seoEntityName}`;
    let description = context.kind === 'home'
      ? selectedSite?.marketCopy?.homeHeroIntro || profile.intro
      : `Explore ${context.subject.toLowerCase()} from ${seoEntityName}. Review service information, project options, and next steps.`;
    const routeDescription = document.querySelector('[data-route-archetype]')?.dataset.routeDescription;
    if (routeDescription) description = routeDescription;
    if (context.kind === 'area-hub' && locationSite?.marketCopy?.areaHubIntro) {
      description = locationSite.marketCopy.areaHubIntro;
    }
    if (context.kind === 'location-draft' && selectedLocation?.metaDescription) {
      description = selectedLocation.metaDescription;
    }
    const intendedCanonical = `https://${profile.domain}${normalizedPath === '/' ? '/' : normalizedPath}`;

    document.title = truncate(pageTitle, 60);
    updateMeta('meta[name="description"]', { name: 'description', content: truncate(description, 155) });
    updateMeta('meta[name="robots"]', { name: 'robots', content: 'noindex,nofollow' });
    updateMeta('meta[property="og:title"]', { property: 'og:title', content: document.title });
    updateMeta('meta[property="og:description"]', { property: 'og:description', content: truncate(description, 155) });
    updateMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: seoEntityName });
    updateMeta('meta[property="og:url"]', { property: 'og:url', content: intendedCanonical });
    updateMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: document.title });
    updateMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: truncate(description, 155) });
    updateMeta('meta[property="twitter:url"]', { property: 'twitter:url', content: intendedCanonical });
    updateMeta('meta[property="twitter:domain"]', { property: 'twitter:domain', content: profile.domain });
    updateMeta('meta[name="site-factory-canonical"]', { name: 'site-factory-canonical', content: intendedCanonical });
    updateMeta('meta[name="site-factory-index-state"]', {
      name: 'site-factory-index-state',
      content: 'preview-noindex',
    });
    document.querySelectorAll('link[rel="canonical"]').forEach((link) => link.remove());
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]').forEach((meta) => meta.remove());
    document.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove());
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = '/images/brand/drainscape-mark.svg';
    document.head.append(favicon);

    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => script.remove());
    const organizationId = `https://${profile.domain}/#organization`;
    const graph = [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: seoEntityName,
        url: `https://${profile.domain}/`,
      },
      {
        '@type': 'WebPage',
        '@id': `${intendedCanonical}#webpage`,
        url: intendedCanonical,
        name: pageTitle,
        description: truncate(description, 155),
        isPartOf: { '@id': organizationId },
      },
    ];
    if (['service', 'type', 'location-draft'].includes(context.kind)) {
      graph.push({
        '@type': 'Service',
        name: context.subject,
        serviceType: context.subject,
        provider: { '@id': organizationId },
        areaServed: {
          '@type': 'Place',
          name: locationDetailPage
            ? `${locationName}, ${locationState}`
            : `${primaryMarket}${primaryState ? `, ${primaryState}` : ''}`,
        },
      });
    }
    if (context.kind === 'resource') {
      graph.push({
        '@type': 'Article',
        headline: context.subject,
        description: truncate(description, 155),
        mainEntityOfPage: { '@id': `${intendedCanonical}#webpage` },
        publisher: { '@id': organizationId },
      });
    }
    const faqEntities = [...document.querySelectorAll('[data-route-faqs] details')]
      .map((item) => ({
        '@type': 'Question',
        name: item.querySelector('summary')?.childNodes[0]?.textContent.trim(),
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.querySelector('p')?.textContent.trim(),
        },
      }))
      .filter((item) => item.name && item.acceptedAnswer.text);
    if (faqEntities.length) graph.push({ '@type': 'FAQPage', mainEntity: faqEntities });

    const schema = document.createElement('script');
    schema.id = 'site-profile-schema';
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
    document.head.append(schema);

    root.dataset.seoPageType = context.kind;
    root.dataset.seoIndexState = 'preview-noindex';
  };

  root.dataset.websiteType = profile.id;
  root.dataset.siteProfile = profile.id;
  root.dataset.siteProfileDomain = profile.domain;
  root.dataset.siteSourceId = profile.websiteSourceId;
  root.dataset.primaryMarket = primaryMarket;
  root.dataset.primaryState = primaryState;
  root.dataset.heroH1Variant = assignedHeroH1Variant ? String(assignedHeroH1Variant) : 'profile-default';
  root.dataset.heroH1RosterPosition = selectedRosterIndex >= 0 ? String(selectedRosterIndex + 1) : '';
  renderInternalPageArchetype();
  rewritePageWording();
  rewriteAreaHub();
  rewriteLocationDetail();
  cleanComparisonPresentation();
  applyComparisonMedia();
  rewriteEstimateExperience();
  placeHeroEstimateTrust();
  rewriteFaqs();
  rewriteNavigation();
  rewriteLocationNavigation();
  rewriteBrandLockups();
  rewriteInternalLinks();
  rewriteHeroProofSignals();
  hideUnsupportedWebsiteSpecificContent();
  removeEmailsAndLicenses();
  applyContactDetails();
  applyGeneratedHeroMedia();
  applyAdaptableHomepageMedia();
  removeSourceMarketTraces();
  applySeo();
  root.dataset.siteProfileReady = 'true';
  window.dispatchEvent(new CustomEvent('site-profile-ready', { detail: { profile, path: normalizedPath } }));
})();
