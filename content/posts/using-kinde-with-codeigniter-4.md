---
title: "Using Kinde with CodeIgniter 4"
date: 2023-07-27T10:04:27+01:00
tags: ["kinde", "authentication", "codeigniter4"]
draft: false
---

[Kinde](https://kinde.com) is an identity and access management platform that provides authentication and authorization services for web applications. It's one of the direct auth0 competitors.

The first thing that strikes you from the business side is that we get more options in the free version as well as higher limits for active users. It is also less expensive than auth0 when we finally reach the free limits. For startups that often use a cloud-based authentication model, this is a significant convenience.

Anyway, back to the library. Installation of [codeigniter-kinde](https://github.com/michalsn/codeigniter-kinde) is pretty basic:

    composer require michalsn/codeigniter-kinde

Then we have to migrate our database. This library comes with the ready to use `users` table, so if you have your own `users` table, be sure to implement all fields that exists in this package.

    php spark migrate --all

Now we have to copy a config file to our's app namespace:

    php spark kinde:publish

The last thing is to fill the config file with our credentials. You can read more about it in the [getting started](https://kinde.com/docs/developer-tools/php-sdk/) article.

This package comes with predefined routes to: `login`, `register`, `logout` and for the `callback` URL (which is used to finalize authentication).
THe best part is that you don't have to do anything but just use this URL's in your app. Since login and registration are done via Kinde site, everything is ready to use just few seconds after we fill the config file.

We also have a universal `kinde` filter that can serve as a guard for your app.

We can also check things manually in the controller if we want. If we decide to define the permissions, we can also check for them very easy:

```php
if (authenticated() && can('edit_post')) {
    // ...
}
```