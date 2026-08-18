(() => {
  const root = document.documentElement;
  const endpoint = root.dataset.leadEndpoint;
  const params = new URLSearchParams(location.search);
  const attribution = Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'].map(k => [k, params.get(k)]).filter(([,v]) => v));
  document.querySelectorAll('form[data-llg-lead-form]').forEach((form) => {
    const status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!endpoint) { status.textContent = 'This preview is not connected to the lead service yet.'; return; }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      status.textContent = 'Sending your request…';
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = {
        submissionId: crypto.randomUUID(),
        siteKey: root.dataset.siteKey,
        pagePath: location.pathname,
        firstName: data.firstName || '', lastName: data.lastName || '',
        phone: data.phone || '', email: data.email || '', zip: data.zip || '',
        service: data.service || '', message: data.message || '',
        smsConsent: data.smsConsent === 'on', company: data.company || '',
        turnstileToken: data['cf-turnstile-response'] || '',
        utm: attribution, referrer: document.referrer || null, landingPage: location.href,
      };
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'We could not send the request.');
        status.textContent = `Request received. Reference ${result.leadId || payload.submissionId}.`;
        form.reset();
        if (window.turnstile) window.turnstile.reset();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'We could not send the request. Please try again.';
      } finally { submit.disabled = false; }
    });
  });
})();
