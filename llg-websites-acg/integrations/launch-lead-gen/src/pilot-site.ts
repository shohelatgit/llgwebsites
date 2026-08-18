import type { PilotSiteConfig } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatUsPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return value;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function brandMark(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const first = words[0] || "LLG";
  if (/^[a-z0-9]{1,3}$/i.test(first)) return first.toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "LLG";
}

export function pilotSiteHtml(config: PilotSiteConfig, smsEnabled: boolean): string {
  const name = escapeHtml(config.display_name);
  const mark = escapeHtml(brandMark(config.display_name));
  const city = escapeHtml(config.city);
  const state = escapeHtml(config.state_region);
  const siteKey = escapeHtml(config.property_key);
  const phoneHref = escapeHtml(config.primary_phone);
  const phoneLabel = escapeHtml(formatUsPhone(config.primary_phone));
  const smsHref = escapeHtml(config.sms_phone);
  const smsLabel = escapeHtml(formatUsPhone(config.sms_phone));
  const primaryService = escapeHtml(config.services[0]?.name || "Home services");
  const serviceItems = config.services.length
    ? config.services.map((service) => `<li>${escapeHtml(service.name)}</li>`).join("")
    : "<li>Tell us about your project</li>";
  const textAction = smsEnabled
    ? `<a class="button button-secondary" href="sms:${smsHref}" data-contact="text">Text ${smsLabel}</a>`
    : "";
  const mobileTextAction = smsEnabled
    ? `<a href="sms:${smsHref}" data-contact="text">Text</a>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="description" content="Request ${primaryService.toLowerCase()} help in ${city}, ${state}.">
  <title>${name} | ${city}, ${state}</title>
  <link rel="stylesheet" href="/pilot/site.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="top">
    <div class="shell header-inner">
      <a class="brand" href="#top" aria-label="${name} home">
        <span class="brand-mark" aria-hidden="true">${mark}</span>
        <span>${name}</span>
      </a>
      <a class="header-phone" href="tel:${phoneHref}">Call ${phoneLabel}</a>
    </div>
  </header>

  <main id="main">
    <section class="hero">
      <div class="shell hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">${city}, ${state} · ${primaryService}</p>
          <h1>A simple way to start your project.</h1>
          <p class="lede">Tell ${name} what you need. This pilot captures the details so your request can be reviewed and routed correctly.</p>
          <div class="actions">
            <button class="button button-primary" type="button" data-open-quote>Get a free quote</button>
            <a class="button button-secondary" href="tel:${phoneHref}" data-contact="call">Call ${phoneLabel}</a>
            ${textAction}
          </div>
          <p class="microcopy">No payment required. This test page does not make contractor, pricing, or availability guarantees.</p>
        </div>
        <aside class="project-card" aria-labelledby="project-card-title">
          <p class="card-kicker">Currently accepting test requests</p>
          <h2 id="project-card-title">What can you ask about?</h2>
          <ul>${serviceItems}</ul>
          <p>Share your project type, location, timeline, and preferred contact details in the quote form.</p>
          <button class="text-button" type="button" data-open-quote>Open the project form →</button>
        </aside>
      </div>
    </section>

    <section class="facts" aria-label="Service details">
      <div class="shell facts-grid">
        <article><span>Service area</span><strong>${city}, ${state}</strong></article>
        <article><span>Service category</span><strong>${primaryService}</strong></article>
        <article><span>Contact options</span><strong>${smsEnabled ? "Call, text, or form" : "Call or form"}</strong></article>
      </div>
    </section>

    <section class="process">
      <div class="shell">
        <p class="eyebrow">How this pilot works</p>
        <h2>One request, kept with the right website.</h2>
        <ol class="steps">
          <li><span>1</span><div><strong>Tell us what you need</strong><p>Use the popup form, including your service address and preferred contact information.</p></div></li>
          <li><span>2</span><div><strong>Your source is preserved</strong><p>The site identity and advertising attribution travel with the request.</p></div></li>
          <li><span>3</span><div><strong>The request is reviewed</strong><p>The test workflow stores it in Supabase and prepares it for the correct delivery path.</p></div></li>
        </ol>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="shell footer-inner">
      <p><strong>${name}</strong><br>${city}, ${state}</p>
      <p>Staging integration test · Not indexed by search engines</p>
    </div>
  </footer>

  <button class="quote-launcher" type="button" data-open-quote aria-label="Open the quote form">Get a quote</button>
  <nav class="mobile-actions" aria-label="Contact options">
    <a href="tel:${phoneHref}" data-contact="call">Call</a>
    ${mobileTextAction}
    <button type="button" data-open-quote>Quote</button>
  </nav>

  <dialog class="quote-dialog" id="quote-dialog" aria-labelledby="quote-title">
    <div class="dialog-header">
      <div><p class="eyebrow">${city}, ${state}</p><h2 id="quote-title">Tell us about your project</h2></div>
      <button class="dialog-close" type="button" data-close-quote aria-label="Close quote form">×</button>
    </div>
    <div id="llg-quote-form" class="quote-form" aria-live="polite"></div>
  </dialog>

  <script async src="/embed/llg.js" data-site-key="${siteKey}" data-mount="#llg-quote-form" data-min-height="620px"></script>
  <script defer src="/pilot/site.js"></script>
</body>
</html>`;
}

export function pilotSiteCss(): string {
  return String.raw`:root{--ink:#17251f;--muted:#5d6b64;--paper:#f7f5ef;--surface:#fff;--accent:#bd552f;--accent-dark:#8f3b21;--line:#d8d8cd;--sage:#dfe6dc;--shadow:0 24px 60px rgba(23,37,31,.16)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.5}button,a{font:inherit}.skip-link{position:absolute;left:1rem;top:-5rem;background:var(--ink);color:#fff;padding:.75rem 1rem;z-index:20}.skip-link:focus{top:1rem}.shell{width:min(1120px,calc(100% - 40px));margin-inline:auto}.site-header{border-bottom:1px solid rgba(23,37,31,.12);background:rgba(247,245,239,.96)}.header-inner{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:2rem}.brand{display:flex;align-items:center;gap:.8rem;color:var(--ink);font-weight:800;text-decoration:none;letter-spacing:-.02em}.brand-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--ink);color:#fff;font-size:.9rem}.header-phone{color:var(--ink);font-weight:800;text-underline-offset:4px}.hero{padding:clamp(4rem,9vw,7.5rem) 0;background:radial-gradient(circle at 90% 10%,rgba(189,85,47,.18),transparent 35%),linear-gradient(140deg,#f7f5ef 50%,#e5eadf)}.hero-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(290px,.65fr);gap:clamp(2.5rem,7vw,6rem);align-items:center}.eyebrow,.card-kicker{margin:0 0 1rem;color:var(--accent-dark);font-size:.78rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.hero h1{max-width:780px;margin:0;font-family:Georgia,'Times New Roman',serif;font-size:clamp(3rem,7vw,6.3rem);font-weight:500;letter-spacing:-.055em;line-height:.94}.lede{max-width:660px;margin:1.7rem 0 0;color:var(--muted);font-size:clamp(1.05rem,2vw,1.3rem)}.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2rem}.button{display:inline-flex;min-height:50px;align-items:center;justify-content:center;border:1px solid var(--ink);border-radius:8px;padding:.8rem 1.1rem;font-weight:800;text-decoration:none;cursor:pointer}.button-primary{background:var(--accent);border-color:var(--accent);color:#fff}.button-primary:hover{background:var(--accent-dark);border-color:var(--accent-dark)}.button-secondary{background:transparent;color:var(--ink)}.button-secondary:hover{background:var(--ink);color:#fff}.microcopy{max-width:660px;margin:1rem 0 0;color:var(--muted);font-size:.8rem}.project-card{padding:clamp(1.6rem,4vw,2.5rem);border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.82);box-shadow:var(--shadow)}.project-card h2,.process h2{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:clamp(2rem,4vw,3.3rem);font-weight:500;letter-spacing:-.035em;line-height:1.05}.project-card ul{margin:1.5rem 0;padding:0;list-style:none}.project-card li{padding:.75rem 0;border-bottom:1px solid var(--line);font-weight:800}.project-card p{color:var(--muted)}.text-button{border:0;background:transparent;color:var(--accent-dark);padding:.4rem 0;font-weight:900;cursor:pointer}.facts{background:var(--ink);color:#fff}.facts-grid{display:grid;grid-template-columns:repeat(3,1fr)}.facts article{padding:1.6rem 2rem;border-left:1px solid rgba(255,255,255,.16)}.facts article:last-child{border-right:1px solid rgba(255,255,255,.16)}.facts span,.facts strong{display:block}.facts span{margin-bottom:.4rem;color:#b8c3bc;font-size:.78rem;text-transform:uppercase;letter-spacing:.11em}.process{padding:clamp(4rem,9vw,7rem) 0}.process h2{max-width:680px}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:3rem 0 0;padding:0;list-style:none}.steps li{display:flex;gap:1rem;padding:1.4rem;border-top:1px solid var(--line)}.steps li>span{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:50%;background:var(--sage);font-weight:900}.steps strong{display:block}.steps p{margin:.4rem 0 0;color:var(--muted)}.site-footer{padding:2.5rem 0;border-top:1px solid var(--line)}.footer-inner{display:flex;justify-content:space-between;gap:2rem;color:var(--muted);font-size:.9rem}.quote-launcher{position:fixed;right:24px;bottom:24px;z-index:9;border:0;border-radius:999px;background:var(--accent);color:#fff;padding:1rem 1.25rem;box-shadow:0 12px 32px rgba(23,37,31,.28);font-weight:900;cursor:pointer}.quote-dialog{width:min(760px,calc(100% - 28px));max-height:calc(100dvh - 28px);padding:0;border:0;border-radius:18px;background:#fff;box-shadow:var(--shadow)}.quote-dialog::backdrop{background:rgba(13,23,18,.72);backdrop-filter:blur(3px)}.dialog-header{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.2rem 1.3rem;border-bottom:1px solid var(--line);background:#fff}.dialog-header .eyebrow{margin-bottom:.25rem}.dialog-header h2{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:1.6rem}.dialog-close{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:#fff;color:var(--ink);font-size:1.8rem;line-height:1;cursor:pointer}.quote-form{min-height:620px;padding:.5rem}.mobile-actions{display:none}button:focus-visible,a:focus-visible{outline:3px solid #f3a785;outline-offset:3px}@media(max-width:800px){body{padding-bottom:64px}.shell{width:min(100% - 28px,1120px)}.header-inner{min-height:68px}.brand span:last-child{max-width:210px;font-size:.9rem;line-height:1.15}.header-phone{display:none}.hero{padding:4rem 0}.hero-grid{grid-template-columns:1fr}.hero h1{font-size:clamp(3rem,15vw,4.6rem)}.facts-grid,.steps{grid-template-columns:1fr}.facts article,.facts article:last-child{border:0;border-bottom:1px solid rgba(255,255,255,.16);padding:1.2rem 0}.steps{gap:0}.footer-inner{display:block}.quote-launcher{display:none}.mobile-actions{position:fixed;inset:auto 0 0;z-index:10;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;border-top:1px solid var(--line);background:#fff}.mobile-actions a,.mobile-actions button{display:grid;place-items:center;min-height:58px;border:0;border-right:1px solid var(--line);background:#fff;color:var(--ink);font-weight:900;text-decoration:none}.mobile-actions button{background:var(--accent);color:#fff}.quote-dialog{width:100%;max-width:none;max-height:96dvh;margin:auto 0 0;border-radius:18px 18px 0 0}.actions .button{width:100%}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;
}

export function pilotSiteScript(): string {
  return String.raw`(function(){"use strict";var dialog=document.getElementById("quote-dialog");if(!dialog)return;function openDialog(){if(typeof dialog.showModal==="function"){dialog.showModal();}else{dialog.setAttribute("open","");}document.body.style.overflow="hidden";window.dispatchEvent(new Event("resize"));}function closeDialog(){if(typeof dialog.close==="function"){dialog.close();}else{dialog.removeAttribute("open");}document.body.style.overflow="";}document.querySelectorAll("[data-open-quote]").forEach(function(button){button.addEventListener("click",openDialog);});document.querySelectorAll("[data-close-quote]").forEach(function(button){button.addEventListener("click",closeDialog);});dialog.addEventListener("click",function(event){if(event.target===dialog)closeDialog();});dialog.addEventListener("close",function(){document.body.style.overflow="";});})();`;
}
