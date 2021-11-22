---
title: "Verification of CNAME record for custom domain"
date: 2021-11-22T16:10:35+02:00
tags: ["domain", "cname"]
draft: false
---

When we give users option to connect their own domain to our service, we must also check that the DNS record has the correct `CNAME` settings before we approve such a domain.

<!--more-->

We can use a simple helper that will do the verification:

```
<?php

/**
 * Verify CNAME for domain
 *
 * @param string $host
 *
 * @return bool
 */
function verifyCname(string $host): bool
{
    $result  = false;
    $records = dns_get_record($host, DNS_CNAME);

    foreach ($records as $row) {
        if ($row['type'] === 'CNAME') {
            if ($row['host'] === $host && $row['target'] === 'add your valid cname record value here') {
                $result = true;
            } else {
                return false;
            }
        }
    }

    return $result;
}
```

It would be good to verify beforehand that the hostname given by the user is correct, or at least has a chance to be correct. For this purpose, we can use the list of available domains:

```
https://github.com/incognico/list-of-top-level-domains
```

With the right choice of verification, we will be able to weed out domains that are clearly not valid or simply cannot exist.