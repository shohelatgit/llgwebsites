export function websiteTextWidgetScript(): string {
  return String.raw`(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || script.dataset.llgTextMounted === "true") return;
  script.dataset.llgTextMounted = "true";
  var siteKey = (script.getAttribute("data-site-key") || "").trim();
  if (!siteKey) { console.error("LLG text widget: data-site-key is required"); return; }
  var businessName = (script.getAttribute("data-business-name") || "Our team").trim();
  var endpoint = new URL("/v1/website-text-starts", script.src).toString();
  var accent = (script.getAttribute("data-accent") || "#12664f").trim();
  if (!/^#[0-9a-f]{6}$/i.test(accent)) accent = "#12664f";
  var position = script.getAttribute("data-position") === "left" ? "left" : "right";
  var services = (script.getAttribute("data-services") || "Get a quote|Other")
    .split("|").map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 20);
  var turnstileSiteKey = (location.hostname.endsWith(".pages.dev")
    ? script.getAttribute("data-test-sitekey")
    : script.getAttribute("data-sitekey")) || "";
  var consentText = "By checking this box, I agree to receive automated service-related text messages from " + businessName + " at the number provided. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out.";
  function escapeHtml(value) { var holder = document.createElement("div"); holder.textContent = value; return holder.innerHTML; }
  var root = document.createElement("div");
  root.setAttribute("data-llg-text-widget", siteKey);
  document.body.appendChild(root);
  var shadow = root.attachShadow({ mode: "open" });
  var instanceId = "llg-text-" + crypto.randomUUID();
  var panelId = instanceId + "-panel";
  var options = services.map(function (service) {
    var option = document.createElement("option");
    option.value = service;
    option.textContent = service;
    return option.outerHTML;
  }).join("");
  shadow.innerHTML = '<style>' +
    ':host{all:initial}*{box-sizing:border-box}.wrap{--accent:' + accent + ';font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d}' +
    '.launcher{position:fixed;z-index:2147483000;bottom:22px;' + position + ':22px;display:flex;align-items:center;gap:10px;border:0;border-radius:999px;background:var(--accent);color:white;padding:13px 18px 13px 14px;box-shadow:0 14px 40px rgba(18,34,27,.26);font:700 15px/1 inherit;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}.launcher:hover{transform:translateY(-2px);box-shadow:0 18px 48px rgba(18,34,27,.32)}.launcher:focus-visible,.close:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible{outline:3px solid color-mix(in srgb,var(--accent),white 58%);outline-offset:2px}.bubble{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18);font-size:18px}.online{width:8px;height:8px;border-radius:50%;background:#8ef0be;box-shadow:0 0 0 3px rgba(142,240,190,.18)}' +
    '.panel{position:fixed;z-index:2147483001;bottom:88px;' + position + ':22px;width:min(390px,calc(100vw - 24px));max-height:min(690px,calc(100vh - 112px));overflow:auto;border:1px solid rgba(28,48,40,.11);border-radius:24px;background:#fff;box-shadow:0 26px 75px rgba(17,34,27,.24);opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .2s ease,transform .2s ease}.panel.open{opacity:1;transform:none;pointer-events:auto}' +
    '.head{position:relative;padding:24px 52px 20px 24px;background:linear-gradient(145deg,var(--accent),color-mix(in srgb,var(--accent),#0d241b 26%));color:#fff;border-radius:23px 23px 0 0}.eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 9px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.88}.head h2{margin:0;font:760 25px/1.08 inherit;letter-spacing:-.025em}.head p{margin:9px 0 0;color:rgba(255,255,255,.82);font-size:14px;line-height:1.45}.close{position:absolute;right:15px;top:15px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:22px;line-height:1;cursor:pointer}' +
    '.body{padding:22px 24px 24px}.trust{display:flex;gap:9px;align-items:center;padding:10px 12px;margin:0 0 18px;border-radius:12px;background:#f1f7f4;color:#315648;font-size:12px;font-weight:650}.trust span:first-child{font-size:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:grid;gap:7px}.field.full{grid-column:1/-1}label{font-size:13px;font-weight:760;color:#243c33}input,select,textarea{width:100%;border:1px solid #cfdad5;border-radius:12px;background:#fff;color:#17211d;padding:12px 13px;font:500 15px/1.35 inherit;box-shadow:0 1px 0 rgba(20,38,30,.02)}input:hover,select:hover,textarea:hover{border-color:#9cafaa}textarea{min-height:82px;resize:vertical}.consent{grid-column:1/-1;display:grid;grid-template-columns:18px 1fr;gap:9px;align-items:start;color:#596a63;font-size:10.5px;line-height:1.42}.consent input{width:17px;height:17px;margin:1px 0 0;accent-color:var(--accent)}.hp{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}.turnstile{grid-column:1/-1;min-height:65px}.submit{grid-column:1/-1;border:0;border-radius:13px;background:var(--accent);color:#fff;padding:14px 18px;font:800 15px/1 inherit;cursor:pointer;box-shadow:0 8px 20px color-mix(in srgb,var(--accent),transparent 72%)}.submit[disabled]{opacity:.62;cursor:wait}.status{grid-column:1/-1;min-height:18px;margin:0;color:#9b2c2c;font-size:12px;line-height:1.4}.success{display:none;text-align:center;padding:15px 6px 10px}.success.show{display:block}.success-mark{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;display:grid;place-items:center;background:#e7f6ee;color:var(--accent);font-size:28px;font-weight:900}.success h3{margin:0 0 8px;font:780 23px/1.2 inherit}.success p{margin:0;color:#5c6e66;font-size:14px;line-height:1.55}.powered{margin:17px 0 0;text-align:center;color:#8a9691;font-size:10px}.powered strong{color:#5c6e66}' +
    '@media(max-width:540px){.launcher{bottom:14px;' + position + ':14px}.launcher .label{display:none}.launcher{padding:12px}.panel{bottom:78px;' + position + ':12px;width:calc(100vw - 24px);max-height:calc(100vh - 96px);border-radius:20px}.head{border-radius:19px 19px 0 0}.grid{grid-template-columns:1fr}.field.full,.consent,.turnstile,.submit,.status{grid-column:1}}@media(prefers-reduced-motion:reduce){.launcher,.panel{transition:none}}' +
    '</style><div class="wrap"><button class="launcher" type="button" aria-expanded="false" aria-controls="' + panelId + '"><span class="bubble" aria-hidden="true">↗</span><span class="label">Text with us</span><span class="online" aria-hidden="true"></span></button>' +
    '<section class="panel" id="' + panelId + '" role="dialog" aria-modal="false" aria-labelledby="' + instanceId + '-title"><header class="head"><button class="close" type="button" aria-label="Close texting form">×</button><p class="eyebrow"><span class="online"></span> Text assistant online</p><h2 id="' + instanceId + '-title">Start with a quick text</h2><p>Share a few details and our assistant will text you right away.</p></header><div class="body"><div class="form-view"><p class="trust"><span aria-hidden="true">⚡</span><span>Usually replies in under a minute</span></p><form class="grid" novalidate>' +
    '<div class="field full"><label for="' + instanceId + '-name">Your name</label><input id="' + instanceId + '-name" name="fullName" autocomplete="name" required maxlength="200" placeholder="Jamie Smith"></div>' +
    '<div class="field"><label for="' + instanceId + '-phone">Mobile number</label><input id="' + instanceId + '-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(555) 555-0123"></div>' +
    '<div class="field"><label for="' + instanceId + '-zip">ZIP code <span style="font-weight:500;color:#7b8a84">(optional)</span></label><input id="' + instanceId + '-zip" name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" placeholder="78701"></div>' +
    '<div class="field full"><label for="' + instanceId + '-service">What can we help with?</label><select id="' + instanceId + '-service" name="service" required><option value="">Choose a service</option>' + options + '</select></div>' +
    '<div class="field full"><label for="' + instanceId + '-message">Tell us a little about the project</label><textarea id="' + instanceId + '-message" name="message" required maxlength="5000" placeholder="What are you seeing, and when would you like help?"></textarea></div>' +
    '<div class="hp" aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div>' +
    '<label class="consent"><input name="smsConsent" type="checkbox" required><span>' + escapeHtml(consentText) + '</span></label><div class="turnstile"></div>' +
    '<button class="submit" type="submit">Start texting</button><p class="status" role="status" aria-live="polite"></p></form></div>' +
    '<div class="success" tabindex="-1"><div class="success-mark">✓</div><h3>Check your messages</h3><p>Our automated assistant is starting the conversation now. Reply to the text to share the rest of your project details.</p></div><p class="powered">Text delivery by <strong>TextMagic</strong></p></div></section></div>';

  var launcher = shadow.querySelector(".launcher");
  var panel = shadow.querySelector(".panel");
  var close = shadow.querySelector(".close");
  var form = shadow.querySelector("form");
  var status = shadow.querySelector(".status");
  var submit = shadow.querySelector(".submit");
  var turnstileMount = shadow.querySelector(".turnstile");
  var widgetId = null;

  function setOpen(open) {
    panel.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open) setTimeout(function () { shadow.querySelector('input[name="fullName"]').focus(); }, 0);
    else launcher.focus();
  }
  launcher.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
  close.addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape" && panel.classList.contains("open")) setOpen(false); });

  function stableId(storage, key) {
    try { var found = storage.getItem(key); if (found) return found; var made = crypto.randomUUID(); storage.setItem(key, made); return made; }
    catch (_) { return crypto.randomUUID(); }
  }
  var tracked = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id","campaign_id","campaign_name","ad_group_id","ad_group_name","ad_id","ad_name","keyword","match_type","gclid","gbraid","wbraid","fbclid","msclkid","rdt_cid","ttclid","li_fat_id"];
  var pageParams = new URLSearchParams(location.search);
  var currentTouch = {};
  tracked.forEach(function (key) { var value = pageParams.get(key); if (value) currentTouch[key] = value; });
  currentTouch.landing_page_url = location.href;
  currentTouch.referrer_url = document.referrer || "";
  currentTouch.visitor_id = stableId(localStorage, "llg:visitor-id");
  currentTouch.session_id = stableId(sessionStorage, "llg:session-id");
  var firstTouch = currentTouch;
  try { var stored = localStorage.getItem("llg:first-touch:" + siteKey); if (stored) firstTouch = JSON.parse(stored); else localStorage.setItem("llg:first-touch:" + siteKey, JSON.stringify(currentTouch)); } catch (_) {}

  function renderTurnstile() {
    if (!turnstileSiteKey || !window.turnstile || widgetId !== null) return;
    widgetId = window.turnstile.render(turnstileMount, { sitekey: turnstileSiteKey, action: "lead_submit", theme: "light" });
  }
  if (window.turnstile) renderTurnstile();
  else if (turnstileSiteKey) {
    var existingLoader = document.querySelector('script[data-llg-text-turnstile="true"]');
    if (!existingLoader) { var loader = document.createElement("script"); loader.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; loader.async = true; loader.defer = true; loader.setAttribute("data-llg-text-turnstile", "true"); loader.addEventListener("load", renderTurnstile); document.head.appendChild(loader); }
    else existingLoader.addEventListener("load", renderTurnstile);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status.textContent = "";
    if (!form.reportValidity()) return;
    var data = Object.fromEntries(new FormData(form).entries());
    var turnstileToken = widgetId !== null && window.turnstile ? window.turnstile.getResponse(widgetId) : "";
    if (!turnstileToken) { status.textContent = "Please complete the security check."; return; }
    submit.disabled = true;
    submit.textContent = "Starting your text…";
    var name = String(data.fullName || "").trim();
    var payload = {
      submissionId: crypto.randomUUID(), siteKey: siteKey, businessName: businessName,
      fullName: name, phone: data.phone || "", zip: data.zip || "", service: data.service || "", message: data.message || "",
      smsConsent: data.smsConsent === "on", consentText: consentText, consentVersion: "website-text-widget-v1",
      company: data.company || "", turnstileToken: turnstileToken, pagePath: location.pathname,
      firstTouch: firstTouch, lastTouch: currentTouch, referrer: document.referrer || "", landingPage: location.href
    };
    fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (response) { return response.json().catch(function () { return {}; }).then(function (body) { if (!response.ok) throw new Error(body.message || "We couldn't start the text. Please try again."); return body; }); })
      .then(function () { shadow.querySelector(".form-view").style.display = "none"; var success = shadow.querySelector(".success"); success.classList.add("show"); success.focus(); form.reset(); })
      .catch(function (error) { status.textContent = error instanceof Error ? error.message : "We couldn't start the text. Please try again."; if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId); })
      .finally(function () { submit.disabled = false; submit.textContent = "Start texting"; });
  });
})();`;
}
