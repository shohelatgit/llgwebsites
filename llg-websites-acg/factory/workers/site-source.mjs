const SOURCE_IMAGE_FALLBACK = '/images/core/roof.avif';

const FORBIDDEN_SOURCE_PATTERNS = [
  { id: 'source-brand', pattern: /\bNeal(?:\s+Roofing)?(?:\s+(?:&|and)\s+Waterproofing)?\b/i },
  { id: 'source-domain', pattern: /nealrfg(?:\.com)?/i },
  { id: 'source-market-west-palm', pattern: /west(?:[\s_-]+)palm(?:[\s_-]+)beach/i },
  { id: 'source-market-palm-beach', pattern: /palm(?:[\s_-]+)beach/i },
  { id: 'source-market-boca-raton', pattern: /boca(?:[\s_-]+)raton/i },
  { id: 'source-market-delray-beach', pattern: /delray(?:[\s_-]+)beach/i },
  { id: 'source-market-palm-beach-gardens', pattern: /palm(?:[\s_-]+)beach(?:[\s_-]+)gardens/i },
  { id: 'source-market-jupiter', pattern: /\bJupiter(?:,\s*FL)?\b/i },
  { id: 'source-market-wellington', pattern: /\bWellington(?:,\s*FL)?\b/i },
  { id: 'source-address', pattern: /(?:2101\s+)?Centrepark|\b33409\b/i },
  { id: 'source-license', pattern: /CCC1332869/i },
  { id: 'source-email', pattern: /info@nealrfg\.com/i },
];

const SOURCE_SERVICE_PATHS = [
  ['residential-roof-installation', 0],
  ['commercial-roof-installation', 1],
  ['roof-replacement', 2],
  ['roof-repair', 3],
  ['waterproofing-palm-beach-county-fl', 4],
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncate(value, maxLength) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function titleWithBrand(subject, businessName, maxLength = 60) {
  const suffix = ` | ${businessName}`;
  const full = `${subject}${suffix}`;
  if (full.length <= maxLength) return full;
  const available = Math.max(12, maxLength - suffix.length);
  const shortenedSubject = truncate(subject, available);
  return `${shortenedSubject}${suffix}`;
}

function normalizedDomain(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

function normalizePath(pathname) {
  const value = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
  if (value === '/home' || value === '/home/') return '/';
  return value === '/' ? '/' : `/${value.replace(/^\/+|\/+$/g, '')}`;
}

function primaryCategory(site) {
  const raw = String(site.serviceGroupLabel || site.niche || 'Local Services')
    .replace(/\s+services?$/i, '')
    .trim();
  return ({
    Tree: 'Tree Service',
    Pool: 'Pool Service',
    Foundation: 'Foundation Repair',
  }[raw] || raw).replace(/\s*&\s*/g, ' and ');
}

function generatedHeroH1(site) {
  const services = Array.isArray(site.services) ? site.services : [];
  const focused = services.filter((service) => !/^(Residential|Commercial)\b/i.test(service.label || ''));
  const pool = focused.length >= 2 ? focused : services;
  const first = pool[0]?.label || site.serviceSingular || primaryCategory(site);
  const second = pool[1]?.label || first;
  const market = site.primaryMarket || 'Your Area';
  const possessive = market.endsWith('s') ? `${market}'` : `${market}'s`;
  const category = primaryCategory(site);
  const variants = [
    `${possessive} #1 Solution for ${category} and ${first}`,
    `${possessive} First Choice for ${first} and ${second}`,
    `Expert ${category} Solutions Built for ${market} Properties`,
    `${possessive} Local Experts for ${first} and ${second}`,
    `Complete ${category} Solutions for ${market} Homes and Businesses`,
  ];
  const variant = Math.min(5, Math.max(1, Number(site.heroH1Variant) || 1));
  return variants[variant - 1];
}

function pageContext(pathname, site) {
  const path = normalizePath(pathname);
  const services = Array.isArray(site.services) ? site.services : [];
  const types = Array.isArray(site.types) ? site.types : [];
  const market = site.primaryMarket || 'Your Area';
  const state = site.state ? `, ${site.state}` : '';
  const marketIntro = site.marketCopy?.homeHeroIntro
    || `Serving property owners across ${market} and nearby communities with locally focused ${String(site.tradeTerm || 'service').toLowerCase()} support.`;

  if (path === '/') {
    return {
      kind: 'home',
      subject: `${site.serviceGroupLabel || site.niche} in ${market}${state}`,
      h1: generatedHeroH1(site),
      description: marketIntro,
    };
  }
  if (path === '/services') {
    return {
      kind: 'service-hub',
      subject: `${site.serviceGroupLabel || site.niche} in ${market}${state}`,
      h1: `${site.serviceGroupLabel || site.niche} in ${market}`,
      description: `Explore ${String(site.serviceGroupLabel || site.niche).toLowerCase()} for properties in ${market}${state}.`,
    };
  }
  if (path.startsWith('/services/')) {
    const slug = path.split('/').filter(Boolean).at(-1);
    const service = services.find((item) => item.slug === slug);
    const label = service?.label || titleCase(slug);
    return {
      kind: 'service',
      subject: `${label} in ${market}${state}`,
      h1: `${label} in ${market}${state}`,
      description: `Learn about ${label.toLowerCase()} for ${market} properties, including project considerations and estimate preparation.`,
    };
  }
  if (path === '/types') {
    return {
      kind: 'type-hub',
      subject: `${site.typesLabel || 'Project Types'} in ${market}${state}`,
      h1: `Explore ${site.typesLabel || 'Project Types'}`,
      description: `Compare ${String(site.typesLabel || 'project types').toLowerCase()} available for ${market} properties.`,
    };
  }
  if (path.startsWith('/types/')) {
    const slug = path.split('/').filter(Boolean).at(-1);
    const type = types.find((item) => item.slug === slug);
    const label = type?.label || titleCase(slug);
    return {
      kind: 'type',
      subject: `${label} in ${market}${state}`,
      h1: `${label} in ${market}${state}`,
      description: `Review ${label.toLowerCase()} options and project considerations for ${market} properties.`,
    };
  }
  if (path === '/locations') {
    return {
      kind: 'location-hub',
      subject: `Service Areas Near ${market}${state}`,
      h1: site.marketCopy?.areaHubH1 || `Areas We Serve Near ${market}`,
      description: site.marketCopy?.areaHubIntro || `Explore the communities served throughout the ${market} area.`,
    };
  }
  if (path.startsWith('/locations/')) {
    const slug = path.split('/').filter(Boolean).at(-1);
    const stateSuffix = site.state ? new RegExp(`-${escapeRegExp(site.state)}$`, 'i') : null;
    const location = titleCase(stateSuffix ? slug.replace(stateSuffix, '') : slug);
    return {
      kind: 'location',
      subject: `${site.serviceGroupLabel || site.niche} in ${location}${state}`,
      h1: `${site.serviceGroupLabel || site.niche} in ${location}${state}`,
      description: `${site.serviceGroupLabel || site.niche} for property owners in ${location}${state}, coordinated through the ${market} market.`,
    };
  }
  if (path === '/gallery') {
    return {
      kind: 'gallery',
      subject: `${site.niche} Gallery`,
      h1: `${site.niche} Gallery`,
      description: `Explore project conditions, systems, and service options commonly involved in ${String(site.tradeTerm || site.niche).toLowerCase()} work.`,
    };
  }
  if (path === '/blog') {
    return {
      kind: 'resource-hub',
      subject: `${site.niche} Guides and Resources`,
      h1: `${site.niche} Guides and Resources`,
      description: `Practical guides for planning ${String(site.tradeTerm || site.niche).toLowerCase()} work and preparing for an estimate.`,
    };
  }
  if (path.startsWith('/blog/')) {
    const label = titleCase(path.split('/').filter(Boolean).at(-1));
    return {
      kind: 'resource',
      subject: label,
      h1: label,
      description: `${label}: a practical guide from ${site.businessName}.`,
    };
  }
  const label = titleCase(path.split('/').filter(Boolean).at(-1) || site.niche);
  return {
    kind: 'content',
    subject: label,
    h1: label,
    description: `Learn more about ${label.toLowerCase()} from ${site.businessName}.`,
  };
}

function replacementPairs(site) {
  const services = Array.isArray(site.services) ? site.services : [];
  const types = Array.isArray(site.types) ? site.types : [];
  const service = (index, fallback) => services[index]?.label || fallback;
  const type = (index, fallback) => types[index]?.label || fallback;
  return [
    ['DrainScape Solutions', site.businessName],
    ['Drainscape Solutions', site.businessName],
    ['Neal Roofing & Waterproofing', site.businessName],
    ['Neal Roofing and Waterproofing', site.businessName],
    ['Neal Roofing', site.businessName],
    ['Residential Roofing', service(0, site.serviceGroupLabel)],
    ['Commercial Roofing', service(1, site.serviceGroupLabel)],
    ['Roof Replacement', service(2, site.serviceSingular)],
    ['Roof Repair', service(3, site.serviceSingular)],
    ['Waterproofing', service(4, site.serviceSingular)],
    ['Roofing Services', site.serviceGroupLabel],
    ['Roofing Service', site.serviceSingular],
    ['Roofing Company', titleCase(site.companyNoun)],
    ['Roofing Contractor', titleCase(site.companyNoun)],
    ['Roof Types', site.typesLabel],
    ['Types of Roofings', site.typesLabel],
    ['Roof Inspection/Estimate', `${titleCase(site.projectNoun)} Consultation/Estimate`],
    ['Shingle Roofs', type(0, site.typesLabel)],
    ['Metal Roofs', type(1, site.typesLabel)],
    ['Clay Tile Roofs', type(2, site.typesLabel)],
    ['Concrete Tile Roofs', type(3, site.typesLabel)],
    ['Flat Roofs', type(4, site.typesLabel)],
    ['Cedar Shake Roofs', type(5, site.typesLabel)],
    ['Shingle Roofing', type(0, site.typesLabel)],
    ['Shingle', type(0, site.typesLabel)],
    ['Metal Roofing', type(1, site.typesLabel)],
    ['Tile Roofing', type(2, site.typesLabel)],
    ['roofing services', String(site.serviceGroupLabel || '').toLowerCase()],
    ['roofing service', String(site.serviceSingular || '').toLowerCase()],
    ['roofing company', site.companyNoun],
    ['roofing contractor', site.companyNoun],
    ['roof types', String(site.typesLabel || '').toLowerCase()],
    ['roofers', 'service professionals'],
    ['shingles', String(type(0, site.typesLabel)).toLowerCase()],
    ['Roofing', titleCase(site.tradeTerm)],
    ['Roofs', titleCase(site.projectNounPlural)],
    ['Roof', titleCase(site.projectNoun)],
    ['roofing', site.tradeTerm],
    ['roofs', site.projectNounPlural],
    ['roof', site.projectNoun],
  ]
    .filter(([source, replacement]) => source && replacement)
    .sort((left, right) => right[0].length - left[0].length);
}

function textReplacer(site) {
  const pairs = replacementPairs(site);
  const exact = new Map(pairs);
  const insensitive = new Map(pairs.map(([source, replacement]) => [source.toLowerCase(), replacement]));
  const pattern = new RegExp(`\\b(?:${pairs.map(([source]) => escapeRegExp(source)).join('|')})\\b`, 'gi');
  return (value) => String(value || '').replace(pattern, (match) => exact.get(match) || insensitive.get(match.toLowerCase()) || match);
}

function replaceIdentityAndGeography(value, site) {
  const market = site.primaryMarket || 'the local area';
  const state = site.state ? `, ${site.state}` : '';
  return String(value || '')
    .replace(/Neal Roofing (?:&|and) Waterproofing|Neal Roofing/gi, site.businessName)
    .replace(/info@nealrfg\.com/gi, site.contactEmail || 'justin@aryocg.com')
    .replace(/(?:2101\s+)?Centrepark\s+W\s+Dr\s+STE\s+100,?\s*/gi, '')
    .replace(/Palm\s+Beach\s+County(?:,\s*FL)?/gi, `${market} area`)
    .replace(/Palm\s+Beach\s+Gardens(?:,\s*FL)?/gi, `${market}${state}`)
    .replace(/West\s+Palm\s+Beach(?:,\s*FL)?/gi, `${market}${state}`)
    .replace(/Boca\s+Raton(?:,\s*FL)?/gi, `${market}${state}`)
    .replace(/Delray\s+Beach(?:,\s*FL)?/gi, `${market}${state}`)
    .replace(/Jupiter(?:,\s*FL)?/gi, `${market}${state}`)
    .replace(/Wellington(?:,\s*FL)?/gi, `${market}${state}`)
    .replace(/Palm\s+Beach(?:,\s*FL)?/gi, `${market}${state}`)
    .replace(/South\s+Florida/gi, `${market}${state}`)
    .replace(/\bFlorida\b/gi, site.stateName || site.state || market)
    .replace(/\b33409\b/g, '')
    .replace(/\+1\s*561[-.\s]473[-.\s]0192|\(?561\)?[-.\s]473[-.\s]0192/gi, site.phoneDisplay || '')
    .replace(/800\+\s*CUSTOMERS/gi, '500+ CUSTOMER REVIEWS')
    .replace(/200\+\s*5-star reviews/gi, '500+ customer reviews');
}

function rewriteHref(value, site) {
  const href = String(value || '');
  if (/^mailto:/i.test(href)) return `mailto:${site.contactEmail || 'justin@aryocg.com'}`;
  if (/^tel:/i.test(href)) return site.phoneE164 ? `tel:${site.phoneE164}` : '#contact';
  if (/maps\.app\.goo\.gl|google\.com\/maps|comfortlyllc|instagram\.com\/neal|facebook\.com\/NealRoofing|youtube\.com\/channel/i.test(href)) {
    return '#contact';
  }
  for (const [sourceSlug, serviceIndex] of SOURCE_SERVICE_PATHS) {
    if (href.toLowerCase().includes(sourceSlug)) {
      const target = site.services?.[serviceIndex]?.slug;
      return target ? `/services/${target}` : '/services';
    }
  }
  if (/(?:boca-raton|west-palm-beach|palm-beach|delray-beach|jupiter-fl|wellington-fl)/i.test(href)) return '/locations';
  if (/^https?:\/\/(?:www\.)?nealrfg\.com/i.test(href)) {
    return href.replace(/^https?:\/\/(?:www\.)?nealrfg\.com/i, `https://${site.domain}`);
  }
  return replaceIdentityAndGeography(href, site);
}

function rewriteSrc(value, site) {
  const source = String(value || '');
  if (/(?:neal|west[_-]?palm|palm[_-]?beach|boca[_-]?raton)/i.test(source)) return SOURCE_IMAGE_FALLBACK;
  if (/google\.com\/maps|instagram\.com\/neal/i.test(source)) return 'about:blank';
  return source;
}

function rewriteAttributes(tag, site, replaceTerms) {
  return tag.replace(/([:\w-]+\s*=\s*)(["'])([\s\S]*?)\2/g, (match, prefix, quote, value) => {
    const nameMatch = prefix.match(/([:\w-]+)\s*=\s*$/);
    const name = nameMatch?.[1]?.toLowerCase() || '';
    let next = value;
    if (name === 'href' || name === 'action') next = rewriteHref(value, site);
    else if (name === 'src' || name === 'srcset') next = rewriteSrc(value, site);
    else next = replaceIdentityAndGeography(value, site);
    if (['alt', 'aria-label', 'title', 'placeholder', 'value'].includes(name)) next = replaceTerms(next);
    return `${prefix}${quote}${next}${quote}`;
  });
}

function stripLegacyMetadata(html) {
  let output = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '');
  output = output.replace(/<meta\b[^>]*>/gi, (tag) => {
    const key = tag.match(/\b(?:name|property)\s*=\s*(["'])(.*?)\1/i)?.[2]?.toLowerCase();
    if (!key) return tag;
    if (
      key === 'description'
      || key === 'robots'
      || key === 'google-site-verification'
      || key === 'site-factory-canonical'
      || key === 'site-factory-index-state'
      || key.startsWith('og:')
      || key.startsWith('twitter:')
    ) return '';
    return tag;
  });
  output = output.replace(/<link\b[^>]*\brel\s*=\s*(["'])canonical\1[^>]*>\s*/gi, '');
  output = output.replace(/<script\b[^>]*\btype\s*=\s*(["'])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>\s*/gi, '');
  return output;
}

function metadataMarkup(site, context, pathname, indexState) {
  const path = normalizePath(pathname);
  const canonical = `https://${site.domain}${path === '/' ? '/' : path}`;
  const title = titleWithBrand(context.subject, site.businessName, 60);
  const description = truncate(context.description, 155);
  const production = indexState === 'production';
  const organizationId = `https://${site.domain}/#organization`;
  const graph = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: site.businessName,
      url: `https://${site.domain}/`,
      ...(site.phoneE164 ? { telephone: site.phoneE164 } : {}),
      areaServed: {
        '@type': 'AdministrativeArea',
        name: `${site.primaryMarket}${site.state ? `, ${site.state}` : ''}`,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `https://${site.domain}/#website`,
      url: `https://${site.domain}/`,
      name: site.businessName,
      publisher: { '@id': organizationId },
    },
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `https://${site.domain}/#website` },
      about: { '@id': organizationId },
    },
  ];
  if (['service', 'type', 'location'].includes(context.kind)) {
    graph.push({
      '@type': 'Service',
      name: context.subject,
      serviceType: context.subject,
      provider: { '@id': organizationId },
      areaServed: `${site.primaryMarket}${site.state ? `, ${site.state}` : ''}`,
    });
  }
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${production ? 'index,follow' : 'noindex,nofollow'}">
    <meta name="site-factory-canonical" content="${escapeHtml(canonical)}">
    <meta name="site-factory-index-state" content="${production ? 'production-index' : 'preview-noindex'}">
    <meta name="site-factory-source" content="server-rendered">
    ${production ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
    <meta property="og:locale" content="en_US">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:site_name" content="${escapeHtml(site.businessName)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <script type="application/ld+json" data-llg-source-schema>${schema}</script>
  `;
}

function rewriteDocumentContent(html, site, context) {
  const replaceTerms = textReplacer(site);
  let output = html
    .replace(/<!--([\s\S]*?)-->/g, (comment) => (
      FORBIDDEN_SOURCE_PATTERNS.some(({ pattern }) => pattern.test(comment)) ? '' : comment
    ))
    .replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i, `$1${escapeHtml(context.h1)}$2`)
    .replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>\s*)<p(\b[^>]*)>[\s\S]*?<\/p>/i, `$1<p$2>${escapeHtml(context.description)}</p>`)
    .replace(/<p([^>]*)>\s*Roofing\s+License:\s*(?:<br\s*\/?>)?\s*<strong>?#?CCC1332869<\/strong>?\s*<\/p>/gi,
      `<p$1>Locally Licensed and Bonded ${escapeHtml(titleCase(site.tradeTerm))} Professional</p>`);

  output = output.replace(
    /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<noscript\b[\s\S]*?<\/noscript>|<template\b[\s\S]*?<\/template>|<[^>]+>|[^<]+/gi,
    (token) => {
      if (/^<(?:script|style|noscript|template)\b/i.test(token)) return token;
      if (token.startsWith('<')) return rewriteAttributes(token, site, replaceTerms);
      return replaceTerms(replaceIdentityAndGeography(token, site));
    },
  );

  output = output
    .replace(/https?:\/\/(?:www\.)?nealrfg\.com\/[^"'()\s<>]*/gi, `https://${site.domain}/`)
    .replace(/\bneal_roofing\b/gi, String(site.businessName).toLowerCase().replace(/[^a-z0-9]+/g, '_'))
    .replace(/\b(?:west|palm|boca)[_-](?:palm|beach|raton)(?:[_-](?:beach|county))?\b/gi, String(site.primaryMarket).toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .replace(/CCC1332869/gi, '')
    .replace(/info@nealrfg\.com/gi, site.contactEmail || 'justin@aryocg.com');
  return output;
}

export function findForbiddenSourceTerms(html) {
  return FORBIDDEN_SOURCE_PATTERNS
    .filter(({ pattern }) => pattern.test(String(html || '')))
    .map(({ id }) => id);
}

export function parseSiteConfig(env) {
  if (env?.SITE_CONFIG) {
    const parsed = JSON.parse(env.SITE_CONFIG);
    parsed.domain = normalizedDomain(parsed.domain);
    return parsed;
  }
  return {
    sourceId: env?.SITE_ID || '',
    profileId: env?.PROFILE_ID || '',
    themeId: env?.THEME_ID || 'deep-blue-white',
    businessName: env?.BUSINESS_NAME || 'Local Service Professionals',
    domain: normalizedDomain(env?.DOMAIN),
    primaryMarket: env?.PRIMARY_MARKET || 'Your Area',
    state: env?.STATE || '',
    phoneDisplay: env?.PHONE_DISPLAY || '',
    phoneE164: env?.PHONE_E164 || '',
    contactEmail: env?.CONTACT_EMAIL || 'justin@aryocg.com',
    niche: env?.NICHE || 'Local Services',
    tradeTerm: env?.TRADE_TERM || 'service',
    projectNoun: env?.PROJECT_NOUN || 'project',
    projectNounPlural: env?.PROJECT_NOUN_PLURAL || 'projects',
    companyNoun: env?.COMPANY_NOUN || 'service company',
    serviceGroupLabel: env?.SERVICE_GROUP_LABEL || 'Local Services',
    serviceSingular: env?.SERVICE_SINGULAR || 'Service',
    typesLabel: env?.TYPES_LABEL || 'Project Types',
    services: [],
    types: [],
  };
}

export function sanitizeHtml(rawHtml, rawSite, pathname = '/', indexState = 'preview', runtime = {}) {
  const site = {
    ...rawSite,
    domain: normalizedDomain(rawSite.domain),
    contactEmail: rawSite.contactEmail || 'justin@aryocg.com',
  };
  if (!site.businessName || !site.domain || !site.primaryMarket || !site.profileId) {
    throw new Error('Site source configuration is incomplete.');
  }
  const context = pageContext(pathname, site);
  let html = stripLegacyMetadata(String(rawHtml || ''));
  html = rewriteDocumentContent(html, site, context);
  html = html.replace(/<html\b([^>]*)>/i, (match, attributes) => `<html${attributes}
    data-site-source-id="${escapeHtml(site.sourceId)}"
    data-site-profile="${escapeHtml(site.profileId)}"
    data-site-theme="${escapeHtml(site.themeId || 'deep-blue-white')}"
    data-site-domain="${escapeHtml(site.domain)}"
    data-turnstile-site-key="${escapeHtml(runtime.turnstileSiteKey || '')}"
  >`);
  html = html.replace(/<\/head>/i, `${metadataMarkup(site, context, pathname, indexState)}</head>`);
  const forbidden = findForbiddenSourceTerms(html);
  return {
    html,
    forbidden,
    context,
    indexState: indexState === 'production' ? 'production' : 'preview',
  };
}

export const sourceSanitizerInternals = {
  generatedHeroH1,
  pageContext,
  replacementPairs,
};
