---
title: "Generating a custom domain link in CodeIgniter 4"
date: 2022-07-31T16:01:38+02:00
tags: ["php", "subdomain", "codeigniter4"]
draft: false
---

How can we handle generation of a custom domain link in CodeIgniter 4? Although this is not a built-in feature, we can deal with it in a fairly simple way.

<!--more-->

Suppose we have an application where each user account is served from its own domain. We can handle this scenarion quite simply through a simple helper:

**A small comment.** The original code used a function that was marked as internal. And as it happens in such cases, this function was removed, with the next update of the framework.

Therefore, below is already a new version that works:

```php
// app/Helpers/app_helper.php
use CodeIgniter\HTTP\SiteURI;
use Config\App;

/**
 * Returns a site URL as defined by Host.
 *
 * @param string|array $path URI string
 * @param string|null  $host Host to use
 */
function account_url($path = '', ?string $host = null): string
{
    if (empty($host)) {
        return site_url($path);
    }

    // Convert array of segments to a string
    if (is_array($path)) {
        $path = implode('/', $path);
    }

    return (string) new SiteURI(config(App::class), $path, $host);
}
```

For posterity, I also leave the original version, which no longer works (probably since the release of version 4.4 of the framework). But everything else remains the same.

```php
// app/Helpers/app_helper.php

/**
 * Returns a site URL as defined by Host.
 *
 * @param string|array $path URI string
 * @param string|null  $host Host to use
 */
function account_url($path = '', ?string $host = null): string
{
    // Convert array of segments to a string
    if (is_array($path)) {
        $path = implode('/', $path);
    }

    if (empty($host)) {
        return site_url($path);
    }

    $uri = _get_uri($path);
    $uri->setHost($host);

    return URI::createURIString($uri->getScheme(), $uri->getAuthority(), $uri->getPath(), $uri->getQuery(), $uri->getFragment());
}
```

Now we can use our helper function like this:

```php
helper('app');
account_url('controller/method', 'host.tld');
```

So basically this helper will work the same as `site_url`, but it will handle an additional parameter that will define our custom domain.