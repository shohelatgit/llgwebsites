export function websiteEmbedScript(): string {
  return String.raw`(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var siteKey = script.getAttribute("data-site-key") || "";
  if (!siteKey) {
    console.error("LLG form embed: data-site-key is required");
    return;
  }

  var mountSelector = script.getAttribute("data-mount");
  var mount = mountSelector ? document.querySelector(mountSelector) : null;
  if (!mount) {
    mount = document.createElement("div");
    script.parentNode.insertBefore(mount, script);
  }
  mount.setAttribute("data-llg-form", siteKey);

  var configUrl = new URL("/sites/config", script.src);
  configUrl.searchParams.set("site_key", siteKey);

  function stableId(storage, key) {
    try {
      var existing = storage.getItem(key);
      if (existing) return existing;
      var created = crypto.randomUUID();
      storage.setItem(key, created);
      return created;
    } catch (_) {
      return crypto.randomUUID();
    }
  }

  function setParameter(element, name, value) {
    if (value) element.setAttribute("data-" + name, value);
  }

  fetch(configUrl.toString(), { method: "GET", mode: "cors", credentials: "omit" })
    .then(function (response) {
      if (!response.ok) throw new Error("configuration unavailable");
      return response.json();
    })
    .then(function (config) {
      var form = document.createElement("div");
      form.setAttribute("data-fillout-id", config.form.form_id);
      form.setAttribute("data-fillout-embed-type", "standard");
      form.setAttribute("data-fillout-inherit-parameters", "");
      form.setAttribute("data-fillout-dynamic-resize", "");
      form.style.width = "100%";
      form.style.minHeight = script.getAttribute("data-min-height") || "650px";

      setParameter(form, "site_key", config.property_key);
      setParameter(form, "landing_page_url", window.location.href);
      setParameter(form, "referrer_url", document.referrer);
      setParameter(form, "visitor_id", stableId(localStorage, "llg_visitor_id"));
      setParameter(form, "session_id", stableId(sessionStorage, "llg_session_id"));

      var tracked = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "campaign_id", "campaign_name", "ad_group_id", "ad_group_name", "ad_id", "ad_name", "keyword", "match_type", "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "rdt_cid", "ttclid", "li_fat_id", "clarity_session_id"];
      var pageParameters = new URLSearchParams(window.location.search);
      tracked.forEach(function (name) { setParameter(form, name, pageParameters.get(name) || ""); });

      mount.replaceChildren(form);
      if (!document.querySelector('script[data-llg-fillout-loader="true"]')) {
        var loader = document.createElement("script");
        loader.src = "https://server.fillout.com/embed/v1/";
        loader.async = true;
        loader.setAttribute("data-llg-fillout-loader", "true");
        document.head.appendChild(loader);
      }
    })
    .catch(function (error) {
      mount.textContent = "The quote form is temporarily unavailable. Please call the number shown on this website.";
      console.error("LLG form embed:", error);
    });
})();`;
}
