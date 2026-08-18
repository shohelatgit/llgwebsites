// Helper function to get a PostHog property
function getPostHogProperty(propertyName) {
    return window.posthog && window.posthog.get_property ?
        (window.posthog.get_property(propertyName) || '') : '';
}

// Helper function to get the path from a URL
function getPath(url) {
    try {
        return new URL(url).pathname;
    } catch {
        return ''; // Return empty string if URL is invalid
    }
}
function getLeadSource() {

    // Get the initial URL, referring domain, and current URL
    const initialUrl = getPostHogProperty('$initial_current_url');
    const initialReferrer = getPostHogProperty('$initial_referrer');
    const referrer = getPostHogProperty('$referrer')
    const currentUrl = window.location.href;

    // Get paths
    const initialPath = getPath(initialUrl);
    const currentPath = getPath(currentUrl);

    // Check for Google Click ID (gclid) in the initial or current URL
    if (initialUrl.includes('gclid=') || currentUrl.includes('gclid=')) {
        return 'Google Click ID';
    }

    try {
        let gclidCookie = getCookie("gclid");
        if (gclidCookie) {
            return 'Google Click ID';
        }
    } catch (e) {console.error(e)}

    // Handle MSCLKID
    try {
        let msclkid = getParam("msclkid");
        let msclkidValue = getCookie("msclkid");
        if (msclkid || msclkidValue || initialUrl.includes('msclkid=') || currentUrl.includes('msclkid=')) {
            return 'Microsoft Ads';
        }
    } catch (e) {console.error(e)}

    if (currentPath.includes('free-quote') || initialPath.includes('free-quote')) {
        return 'Microsoft Ads';
    }

    // Check for LSA in the path
    if (initialPath.includes('-lsa') || currentPath.includes('-lsa')) {
        return 'Google LSA';
    }

    // Check for Mailer in the path
    if (initialPath.includes('-now') || currentPath.includes('-now')) {
        return 'Mailer';
    }

    // Check referring domain
    if (referrer.includes('facebook.com')) {
        return 'Facebook';
    }

    if (referrer.includes('google.com') || referrer.includes('bing.com')) {
        return 'Web Search';
    }

    if (referrer.includes('twitter.com') || referrer.includes('x.com')) {
        return 'Twitter';
    }

    // Check for utm_source=yelp
    const utmSource = getQueryStringParam('utm_source');
    if (utmSource && utmSource.toLowerCase() === 'yelp') {
        return 'Yelp';
    }

    if (referrer.includes('yelp.com')) {
        return 'Yelp';
    }

    // Check initial referring domain
    if (initialReferrer.includes('facebook.com')) {
        return 'Facebook';
    }

    if (initialReferrer.includes('google.com') || initialReferrer.includes('bing.com')) {
        return 'Web Search';
    }

    if (initialReferrer.includes('twitter.com') || initialReferrer.includes('x.com')) {
        return 'Twitter';
    }

    // Check for utm_source=yelp in initialUrl
    try {
        const initialUrlParams = new URLSearchParams(new URL(initialUrl).search);
        const initialUtmSource = initialUrlParams.get('utm_source');
        if (initialUtmSource && initialUtmSource.toLowerCase() === 'yelp') {
            return 'Yelp';
        }
    } catch (e) {
        // If initialUrl is not a valid URL or any other error, just continue
        console.warn('Could not parse initialUrl for utm_source: Yelp', e);
    }

    if (initialReferrer.includes('yelp.com')) {
        return 'Yelp';
    }

    // Default to Website
    return 'Website';
}

function setFormInput(name, value) {
    const inputs = document.querySelectorAll(`input[name="${name}"]`);
    inputs.forEach(input => {
        input.value = value;
    });
}

function getGclid() {
    let currentGclid, prevGclid;

    try {
        // Get current GCLID from URL
        const currentParams = new URLSearchParams(window.location.search);
        currentGclid = currentParams.get('gclid');

        // Attempt to get initial URL from PostHog
        let initialUrl;
        try {
            initialUrl = getPostHogProperty("$initial_current_url");
            if (typeof initialUrl !== 'string' || !initialUrl) {
                throw new Error('Invalid initial URL');
            }
        } catch (postHogError) {
            console.warn('Failed to get property:', postHogError);

            // set the gclid cookie
            if (currentGclid) {
                setCookie("gclid", currentGclid, {days: 90});
            }
            return currentGclid || '';
        }

        // Parse initial URL for previous GCLID
        const params = new URLSearchParams(new URL(initialUrl).search);
        prevGclid = params.get('gclid');
    } catch (error) {
        console.error('Error in GCLID processing:', error);
        // set the gclid cookie
        if (currentGclid) {
            setCookie("gclid", currentGclid, {days: 90});
        }
        return currentGclid || '';
    }

    // set the gclid cookie
    if (currentGclid || prevGclid) {
        setCookie("gclid", currentGclid || prevGclid, {days: 90});
    }

    // Return current GCLID if available, otherwise previous GCLID, or empty string
    return currentGclid || prevGclid || '';
}

function setCookie(name, value, options = {}) {
    if (!name || /^(expires|max-age|domain|path|secure|samesite)$/i.test(name)) {
        throw new Error('Invalid cookie name');
    }

    const encodedValue = encodeURIComponent(value);
    let cookieString = name + "=" + encodedValue;

    if (options.days) {
        const date = new Date();
        date.setTime(date.getTime() + options.days * 24 * 60 * 60 * 1000);
        options.expires = date.toUTCString();
    }

    if (options.expires) cookieString += "; expires=" + options.expires;
    if (options.path) cookieString += "; path=" + options.path;
    if (options.domain) cookieString += "; domain=" + options.domain;
    if (options.secure) cookieString += "; secure";
    if (options.sameSite) cookieString += "; samesite=" + options.sameSite;

    if (cookieString.length > 4096) {
        console.warn('Cookie length exceeds 4096 bytes and may be truncated by the browser');
    }

    document.cookie = cookieString;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
}

function deleteCookie(name) {
    setCookie(name, '', { days: -1 });
}

// Handle UTM and other query parameters
function getQueryStringParam(param) {
    var params = new URLSearchParams(window.location.search);
    return params.get(param);
}


function getParam(p) {
    var match = RegExp("[?&]" + p + "=([^&]*)").exec(
        window.location.search
    );
    return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}

function setFormParams() {
    // Set page URL to hidden input field
    try {setFormInput('pageUrl', window.location.href)} catch(e) {console.error(e)}
    try {setFormInput("leadSource", getLeadSource())} catch(e) {console.error(e)}
    try {setFormInput("referrer", getPostHogProperty("$referrer"))} catch(e) {console.error(e)}
    try {setFormInput("initialReferrer", getPostHogProperty("$initial_referrer"))} catch(e) {console.error(e)}
    try {setFormInput("initialUrl", getPostHogProperty("$initial_current_url"))} catch (e) {console.error(e)}

    try {setFormInput("backupGclid", getGclid())} catch(e) {console.error(e)}

    try {
        let gclidCookie = getCookie("gclid");
        if (gclidCookie) {
            setFormInput("gclid", gclidCookie);
        }
    } catch (e) {console.error(e)}

    try {
        // Handle MSCLKID
        let msclkid = getParam("msclkid");
        // TODO: setCookie and getCookie are not working...
        if (msclkid) {
            setCookie("msclkid", msclkid, {days: 90});
        }

        let msclkidValue = getCookie("msclkid");
        if (msclkid || msclkidValue) {
            setFormInput("msclkid", msclkid ? msclkid : msclkidValue)
        }
    } catch (e) {console.error(e)}

    try {
        var paramsToCapture = [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_content",
            "utm_keyword",
            "campaign_id",
            "ad_group_id",
            "ad_id",
            "gclid",
        ];

        paramsToCapture.forEach(function (param) {
            let value = getQueryStringParam(param);
            if (value) {
                setFormInput(param, value)
            }
        });
    } catch (e) {console.error(e)}
}
