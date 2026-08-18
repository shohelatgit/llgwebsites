(() => {
  const INTAKE_ENDPOINT = 'https://launch-lead-gen-integrations-staging.justin-b75.workers.dev/v1/website-leads';
  const TURNSTILE_REVIEW_SITE_KEY = '0x4AAAAAAETRwsS0xZHAMOhA';
  const ATTRIBUTION_KEYS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
    'campaign_id', 'campaign_name', 'ad_group_id', 'ad_group_name', 'ad_id', 'ad_name',
    'keyword', 'match_type', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'rdt_cid',
    'ttclid', 'li_fat_id', 'clarity_session_id',
  ];
  const wiredForms = new WeakSet();
  const root = document.documentElement;

  const safeStorage = (storage, action, fallback = null) => {
    try { return action(storage); } catch { return fallback; }
  };

  const stableId = (storage, key) => safeStorage(storage, (target) => {
    const existing = target.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    target.setItem(key, created);
    return created;
  }, crypto.randomUUID());

  const siteKey = () => (
    new URLSearchParams(window.location.search).get('site')
    || root.dataset.siteSourceId
    || ''
  ).trim().toLowerCase();

  const turnstileSiteKey = () => root.dataset.turnstileSiteKey || TURNSTILE_REVIEW_SITE_KEY;

  const currentAttribution = () => {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(ATTRIBUTION_KEYS
      .map((key) => [key, params.get(key)])
      .filter(([, value]) => value));
  };

  const firstTouch = () => {
    const key = `llg_first_touch:${siteKey() || 'unknown'}`;
    const current = {
      ...currentAttribution(),
      landing_page_url: window.location.href,
      referrer_url: document.referrer || '',
      captured_at: new Date().toISOString(),
    };
    return safeStorage(localStorage, (storage) => {
      const existing = storage.getItem(key);
      if (existing) return JSON.parse(existing);
      storage.setItem(key, JSON.stringify(current));
      return current;
    }, current);
  };

  const context = () => ({
    site_key: siteKey(),
    profile_id: root.dataset.siteProfile || new URLSearchParams(window.location.search).get('type') || '',
    page_path: window.location.pathname,
    theme_id: new URLSearchParams(window.location.search).get('theme') || root.dataset.siteTheme || '',
    visitor_id: stableId(localStorage, 'llg_visitor_id'),
    session_id: stableId(sessionStorage, 'llg_session_id'),
  });

  const track = (event, details = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...context(), ...details });
    window.dispatchEvent(new CustomEvent('llg:tracking', { detail: { event, ...context(), ...details } }));
  };

  const addHidden = (form, name, value) => {
    let input = form.querySelector(`input[type="hidden"][name="${CSS.escape(name)}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.append(input);
    }
    input.value = value || '';
  };

  const splitName = (value) => {
    const pieces = String(value || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: pieces.shift() || '',
      lastName: pieces.join(' ') || 'Not provided',
    };
  };

  const valueFor = (data, ...names) => {
    for (const name of names) {
      const value = data.get(name);
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };

  const buildPayload = (form) => {
    const data = new FormData(form);
    const name = splitName(valueFor(data, 'name', 'Name', 'fullName'));
    const service = valueFor(data, 'requestedService', 'Service', 'service') || 'Estimate request';
    const address = valueFor(data, 'address', 'fullAddress');
    const postalCode = valueFor(data, 'postalCode', 'zip') || (address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] || '');
    const projectStage = valueFor(data, 'projectStage');
    const timing = valueFor(data, 'timing');
    const messageParts = [
      `${service} estimate request.`,
      address ? `Property address: ${address}.` : '',
      projectStage ? `Project stage: ${projectStage}.` : '',
      timing ? `Timing: ${timing}.` : '',
    ].filter(Boolean);
    return {
      submissionId: crypto.randomUUID(),
      siteKey: siteKey(),
      pagePath: window.location.pathname,
      firstName: name.firstName,
      lastName: name.lastName,
      phone: valueFor(data, 'phone', 'Phone'),
      email: valueFor(data, 'email', 'Email'),
      zip: postalCode,
      address,
      service,
      message: messageParts.join(' '),
      smsConsent: data.get('consent') === 'on' || data.get('contactConsent') === 'on' || data.get('smsConsent') === 'on',
      consentText: form.querySelector('label:has(input[name="consent"]), .brand-route-consent')?.textContent?.trim() || '',
      company: valueFor(data, 'company'),
      turnstileToken: valueFor(data, 'cf-turnstile-response'),
      firstTouch: firstTouch(),
      lastTouch: {
        ...currentAttribution(),
        landing_page_url: window.location.href,
        referrer_url: document.referrer || '',
        visitor_id: stableId(localStorage, 'llg_visitor_id'),
        session_id: stableId(sessionStorage, 'llg_session_id'),
      },
      utm: currentAttribution(),
      referrer: document.referrer || null,
      landingPage: window.location.href,
    };
  };

  let turnstilePromise;
  const loadTurnstile = () => {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstilePromise) return turnstilePromise;
    turnstilePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-llg-turnstile]');
      const script = existing || document.createElement('script');
      const complete = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile_unavailable'));
      script.addEventListener('load', complete, { once: true });
      script.addEventListener('error', () => reject(new Error('turnstile_unavailable')), { once: true });
      if (!existing) {
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.llgTurnstile = '';
        document.head.append(script);
      }
    });
    return turnstilePromise;
  };

  const ensureTurnstile = async (form) => {
    let container = form.querySelector('[data-llg-turnstile]');
    if (!container) {
      container = document.createElement('div');
      container.className = 'brand-turnstile';
      container.dataset.llgTurnstile = '';
      const submit = form.querySelector('button[type="submit"]');
      (submit?.parentElement || submit || form).before(container);
    }
    if (container.dataset.widgetId) return container.dataset.widgetId;
    const turnstile = await loadTurnstile();
    const widgetId = turnstile.render(container, { sitekey: turnstileSiteKey(), action: 'lead_submit', theme: 'light' });
    container.dataset.widgetId = String(widgetId);
    return widgetId;
  };

  const statusNode = (form) => {
    let status = form.querySelector('[data-llg-form-status]');
    if (!status) {
      status = document.createElement('p');
      status.className = 'brand-form-status';
      status.dataset.llgFormStatus = '';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.append(status);
    }
    return status;
  };

  const wireForm = (form) => {
    if (wiredForms.has(form)) return;
    wiredForms.add(form);
    form.dataset.llgLeadForm = '';
    form.noValidate = false;
    const touch = firstTouch();
    addHidden(form, 'siteKey', siteKey());
    addHidden(form, 'landingPage', window.location.href);
    addHidden(form, 'referrer', document.referrer || '');
    addHidden(form, 'visitorId', stableId(localStorage, 'llg_visitor_id'));
    addHidden(form, 'sessionId', stableId(sessionStorage, 'llg_session_id'));
    for (const [key, value] of Object.entries({ ...touch, ...currentAttribution() })) {
      if (typeof value === 'string') addHidden(form, key, value);
    }
    const status = statusNode(form);
    ensureTurnstile(form).catch(() => { status.textContent = 'Security check could not load. Refresh the page and try again.'; });

    form.addEventListener('focusin', () => {
      if (form.dataset.trackingStarted) return;
      form.dataset.trackingStarted = 'true';
      track('llg_form_start', { form_name: form.getAttribute('name') || 'estimate-form' });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;
      const payload = buildPayload(form);
      if (!payload.siteKey) {
        status.textContent = 'This website is missing its tracking identity. Please call the number shown on the page.';
        track('llg_form_error', { form_name: form.getAttribute('name') || 'estimate-form', error_code: 'missing_site_key' });
        return;
      }
      if (!payload.turnstileToken) {
        status.textContent = 'Complete the security check before sending your request.';
        track('llg_form_error', { form_name: form.getAttribute('name') || 'estimate-form', error_code: 'turnstile_missing' });
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      status.textContent = 'Sending your request…';
      track('llg_form_submit', { form_name: form.getAttribute('name') || 'estimate-form', service: payload.service });
      try {
        const response = await fetch(INTAKE_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || result.error || 'request_failed');
        status.textContent = `Request received. Reference ${result.leadId || payload.submissionId}.`;
        status.dataset.state = 'success';
        track('llg_form_success', { form_name: form.getAttribute('name') || 'estimate-form', service: payload.service });
        form.reset();
        const widgetId = form.querySelector('[data-llg-turnstile]')?.dataset.widgetId;
        if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
      } catch (error) {
        status.textContent = 'We could not send the request. Please try again or call the number shown on the page.';
        status.dataset.state = 'error';
        track('llg_form_error', {
          form_name: form.getAttribute('name') || 'estimate-form',
          error_code: error instanceof Error ? error.message.slice(0, 80) : 'request_failed',
        });
      } finally {
        if (submit) submit.disabled = false;
      }
    }, { capture: true });
  };

  const wirePage = () => {
    document.querySelectorAll('form[name="hero-form"], form[data-contact-form]').forEach(wireForm);
  };

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    if (anchor.href.startsWith('tel:')) track('llg_phone_click', { link_location: anchor.closest('header') ? 'header' : anchor.closest('footer') ? 'footer' : 'body' });
    else if (anchor.matches('.brand-estimate-cta, [href="#contact"], [href$="#contact"]')) track('llg_cta_click', { cta_label: anchor.textContent.trim().slice(0, 80) });
  });

  document.addEventListener('DOMContentLoaded', wirePage);
  window.addEventListener('site-profile-ready', wirePage);
  wirePage();
  track('llg_page_view');
})();
