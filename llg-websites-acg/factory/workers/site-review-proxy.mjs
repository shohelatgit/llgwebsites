import { findForbiddenSourceTerms, parseSiteConfig, sanitizeHtml } from './site-source.mjs';

const REVIEW_ORIGIN = 'https://llg-site-factory-review.aryo-cg-preview.pages.dev';

const PASSTHROUGH_ROOTS = [
  '/__palettes__',
  '/__site__',
  '/__rendered__',
  '/images',
  '/favicon.ico',
  '/robots.txt',
];

function isPassthroughPath(pathname) {
  if (PASSTHROUGH_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return true;
  return /\.(?:css|js|mjs|json|map|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|xml|txt)$/i.test(pathname);
}

function sitePath(pathname, profileId) {
  if (pathname === '/' || pathname === '/home' || pathname === '/home/') {
    return `/__site__/${profileId}/`;
  }

  if (isPassthroughPath(pathname)) return pathname;
  return `/__site__/${profileId}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function logicalSitePath(pathname, profileId) {
  const prefix = `/__site__/${profileId}`;
  if (pathname === prefix || pathname === `${prefix}/`) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || '/';
  return pathname;
}

function addSiteDefaults(url, env, force = false) {
  const set = (key, value) => {
    if (force || !url.searchParams.has(key)) url.searchParams.set(key, value);
  };
  set('site', env.SITE_ID);
  set('type', env.PROFILE_ID);
  set('theme', env.THEME_ID);
  set('mode', 'light');
  set('estimatePanel', 'brand');
  if (force || !url.searchParams.has('hero')) {
    const cream = env.THEME_ID === 'cream-red-light-blue' && env.PROFILE_ID !== 'concrete-pavers';
    url.searchParams.set('hero', cream ? 'cream-solid' : 'navy-photo');
  }
}

function isProductionHostname(hostname, site) {
  const candidate = String(hostname || '').toLowerCase();
  return candidate === site.domain || candidate === `www.${site.domain}`;
}

function sitemapXml(site) {
  const paths = [
    '/',
    '/services',
    ...(site.services || []).map((service) => `/services/${service.slug}`),
    '/types',
    ...(site.types || []).map((type) => `/types/${type.slug}`),
    '/locations',
    '/gallery',
    '/blog',
  ];
  const urls = [...new Set(paths)].map((pathname) => (
    `  <url><loc>https://${site.domain}${pathname}</loc></url>`
  )).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function isSitePage(pathname) {
  if (pathname === '/' || pathname === '/home' || pathname === '/home/') return true;
  if (pathname === '/__site__' || pathname.startsWith('/__site__/')) return true;
  return !isPassthroughPath(pathname);
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    let site;
    try {
      site = parseSiteConfig(env);
    } catch {
      return new Response('This site is missing its release configuration.', {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
      });
    }
    const productionHostname = isProductionHostname(incoming.hostname, site);
    const liveHostname = productionHostname && env.INDEX_STATE === 'production';
    const indexState = liveHostname && site.productionApproved === true ? 'production' : 'preview';

    if (liveHostname && incoming.hostname.toLowerCase().startsWith('www.')) {
      const canonical = new URL(incoming);
      canonical.hostname = site.domain;
      return Response.redirect(canonical.toString(), 301);
    }

    if (incoming.pathname === '/robots.txt') {
      const body = indexState === 'production'
        ? `User-agent: *\nAllow: /\nSitemap: https://${site.domain}/sitemap.xml\n`
        : 'User-agent: *\nDisallow: /\n';
      return new Response(body, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=300',
          'x-robots-tag': indexState === 'production' ? 'index, follow' : 'noindex, nofollow',
        },
      });
    }

    if (incoming.pathname === '/sitemap.xml') {
      if (indexState !== 'production') {
        return new Response('Not found', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
        });
      }
      return new Response(sitemapXml(site), {
        headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' },
      });
    }

    if ((request.method === 'GET' || request.method === 'HEAD')
      && !liveHostname
      && !['/', '/home', '/home/'].includes(incoming.pathname)
      && !isPassthroughPath(incoming.pathname)) {
      incoming.pathname = `/__site__/${env.PROFILE_ID}${incoming.pathname.startsWith('/') ? incoming.pathname : `/${incoming.pathname}`}`;
      addSiteDefaults(incoming, env);
      return Response.redirect(incoming.toString(), 302);
    }

    if ((request.method === 'GET' || request.method === 'HEAD')
      && !liveHostname
      && isSitePage(incoming.pathname)
      && !incoming.searchParams.has('site')) {
      addSiteDefaults(incoming, env);
      return Response.redirect(incoming.toString(), 302);
    }

    const upstream = new URL(REVIEW_ORIGIN);
    upstream.pathname = sitePath(incoming.pathname, env.PROFILE_ID);
    upstream.search = incoming.search;
    addSiteDefaults(upstream, env, liveHostname);

    const headers = new Headers(request.headers);
    headers.delete('host');

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

    const originResponse = await fetch(upstream, init);
    const responseHeaders = new Headers(originResponse.headers);
    responseHeaders.set('X-Robots-Tag', indexState === 'production' ? 'index, follow' : 'noindex, nofollow');
    responseHeaders.set('X-LLG-Review-Site', env.SITE_ID);
    responseHeaders.set('X-LLG-Site-ID', env.SITE_ID);
    responseHeaders.set('X-LLG-Launch-State', indexState === 'production' ? 'production-index' : liveHostname ? 'live-noindex' : 'preview-noindex');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');

    const location = responseHeaders.get('location');
    if (location && location.startsWith(REVIEW_ORIGIN)) {
      responseHeaders.set('location', location.slice(REVIEW_ORIGIN.length) || '/');
    }

    const contentType = responseHeaders.get('content-type') || '';
    if (
      request.method === 'GET'
      && originResponse.status === 200
      && contentType.includes('text/html')
    ) {
      try {
        const publicPath = logicalSitePath(incoming.pathname, env.PROFILE_ID);
        const source = sanitizeHtml(await originResponse.text(), site, publicPath, indexState, {
          turnstileSiteKey: liveHostname ? site.turnstileSiteKey : '',
        });
        const forbidden = findForbiddenSourceTerms(source.html);
        if (forbidden.length) {
          return new Response('This review page failed the source-identity release gate.', {
            status: 502,
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'x-robots-tag': 'noindex, nofollow',
              'x-llg-review-site': env.SITE_ID,
              'x-llg-source-sanitized': 'failed',
              'x-content-type-options': 'nosniff',
            },
          });
        }
        responseHeaders.delete('content-length');
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('etag');
        responseHeaders.delete('last-modified');
        if (indexState !== 'production') responseHeaders.set('Cache-Control', 'private, no-store');
        responseHeaders.set('X-LLG-Source-Sanitized', 'true');
        responseHeaders.set('X-LLG-Index-State', source.indexState);
        return new Response(source.html, {
          status: originResponse.status,
          statusText: originResponse.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        console.error('Site source generation failed', {
          siteId: env.SITE_ID,
          profileId: env.PROFILE_ID,
          message: error instanceof Error ? error.message : String(error),
        });
        return new Response('This review page could not be generated safely.', {
          status: 502,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'x-robots-tag': 'noindex, nofollow',
            'x-llg-review-site': env.SITE_ID,
            'x-llg-source-sanitized': 'failed',
            'x-content-type-options': 'nosniff',
          },
        });
      }
    }

    responseHeaders.set('X-LLG-Source-Sanitized', 'not-html');
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders,
    });
  },
};
