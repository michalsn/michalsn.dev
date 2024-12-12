---
title: "Auth0 CodeIgniter 4 package"
description: "Learn how to integrate Auth0 with CodeIgniter 4 to add secure user authentication and authorization features."
date: 2023-08-16T18:31:53+01:00
tags: ["auth0", "authentication", "codeigniter4"]
draft: false
---

[Auth0](https://auth0.com) is a cloud-based service that helps developers add secure user authentication and authorization features to their applications without having to build these components from scratch. Auth0 is designed to simplify the process of implementing user authentication, including features like single sign-on (SSO), multi-factor authentication (MFA), and social login.

Auth0 allows you to add basic authentication functionality very quickly by delegating it to an external platform, but we should always consider whether such a solution definitely suits us.

In the past I [have written](/posts/integrating-codeigniter-4-with-auth0/) about the integration of CodeIgniter 4 and the auth0 v7 package, but now I wanted to present the package I created for v8.

You can head over to the [repo](https://github.com/michalsn/codeigniter-auth0) to read the instructions.

Installation via composer is always simple:

    composer require michalsn/codeigniter-auth0

    composer require guzzlehttp/guzzle guzzlehttp/psr7 http-interop/http-factory-guzzle

Migrate the database. This library also creates its own `users` table in the database, so if you already have such a table, consider having the same field names in your version.

    php spark migrate --all

The next step is to publish the Auth0 config file into our `app` namespace:

    php spark auth0:publish

Now we can set all the credentials to our Auth0 account in `app\Config\Auth0.php` file. See the [getting started](https://auth0.com/docs/libraries/auth0-php) article for reference.

`codeigniter-auth0` comes with the predefined routes to `login`, `logout` and receiving a `callback` calls.

To check if user is authenticated, we can use `auth0Stateful` filter or write our own implementation.

We can also just check this in every request or controller via simple:

```php
if (! service('auth0')->isAuthenticated()) {
    // ...
}
```