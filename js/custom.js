document.addEventListener('DOMContentLoaded', function() {
    const el = document.getElementById('cookie-notice');

    if (!el) return;

    // Ensure the banner is a direct child of <body> to avoid stacking context issues
    if (el.parentElement !== document.body) {
        document.body.appendChild(el);
    }

    el.classList.add('show'); // show the banner

    // Utilities
    function createCookie(name, value, days, domain) {
        let cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + "; Path=/";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            cookie += "; Expires=" + date.toUTCString();
        }
        // SameSite=None requires Secure for modern browsers
        cookie += "; SameSite=None; Secure";
        if (domain) cookie += "; Domain=" + domain;
        document.cookie = cookie;
    }

    function readCookie(name) {
        const nameEQ = encodeURIComponent(name) + "=";
        const parts = document.cookie.split(';');
        for (let p of parts) {
            p = p.trim();
            if (p.indexOf(nameEQ) === 0) return decodeURIComponent(p.substring(nameEQ.length));
        }
        return null;
    }

    // Try deleting cookie by various domain patterns (host-only + dot + current host)
    function deleteCookiesByPattern(pattern) {
        const parts = document.cookie.split(';');
        const hostname = location.hostname;
        const domainVariants = [undefined, hostname, '.' + hostname];

        for (let p of parts) {
            let cookie = p.trim();
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            if (name.indexOf(pattern) !== -1) {
                // attempt deletion with multiple domain attributes
                for (const dom of domainVariants) {
                    let c = encodeURIComponent(name) + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
                    if (dom) c += "; Domain=" + dom;
                    document.cookie = c;
                }
            }
        }
    }

    // Show / hide helpers
    function showBanner() { el.classList.add('show'); }
    function hideBanner() { el.classList.remove('show'); }

    // Load analytics script after consent
    function loadAnalytics() {
        // Example: load GTM only after user accepts. Use correct Hugo conditional to only include this code in production.
        (function loadGtag(){
            var s = document.createElement('script');
            s.src = 'https://www.googletagmanager.com/gtag/js?id=G-74HSH0WCPE';
            s.async = true;
            s.onload = function() {
                window.dataLayer = window.dataLayer || [];
                function gtag(){ dataLayer.push(arguments); }
                gtag('js', new Date());
                gtag('config', 'G-74HSH0WCPE', { 'anonymize_ip': true, cookie_flags: 'secure;samesite=none' });
            };
            document.head.appendChild(s);
        })();
    }

    // Behavior based on cookie
    const consent = readCookie('cookie-notice-option');
    if (consent === 'true') {
        // user accepted — make sure analytics are loaded
        loadAnalytics();
        hideBanner();
    } else if (consent === 'false') {
        // user denied — ensure google cookies removed
        deleteCookiesByPattern('_ga');
        hideBanner();
    } else {
        // no choice yet — show banner
        showBanner();
    }

    // Event listeners (guarded in case elements missing)
    const acceptBtn = document.getElementById('cookie-notice-accept');
    const denyBtn = document.getElementById('cookie-notice-deny');

    if (acceptBtn) {
        acceptBtn.addEventListener('click', function() {
            createCookie('cookie-notice-option', 'true', 31);
            hideBanner();
            // load GTM now (after consent)
            loadAnalytics();
        });
    }

    if (denyBtn) {
        denyBtn.addEventListener('click', function() {
            createCookie('cookie-notice-option', 'false', 31);
            // remove probable GA cookies
            deleteCookiesByPattern('_ga');
            hideBanner();
        });
    }
});