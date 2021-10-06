---
title: "Integrating CodeIgniter 4 with Auth0"
date: 2021-06-06T15:51:17+02:00
tags: ["auth0", "codeigniter4"]
draft: false
---

Integration with [Auth0](https://auth0.com/) is quite simple and comes down to a few steps. I assume you already have an account on Auth0 so you just need to install the library via [Composer](https://getcomposer.org/):

<!--more-->

```
composer require auth0/auth0-php
```

To get started, we need to create a configuration file **app/Config/Auth0.php**. It is a good idea to leave the configuration values in the file empty and add them via the **.env** file. This will ensure that your wraliw data doesn't end up about the repository.

```
<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class Auth0 extends BaseConfig
{
    public $domain = 'your domain';

    public $clientId = 'your client id';

    public $clientSecret = 'your client secret';

    public $redirectUri = 'redirect url';

    public $scope = 'scope';
}
```

Next, we'll create the main class that will allow Auth0 to write data to the session. To do this, we will implement the interface provided by Auth0. We need to create a file: **app/Libraries/Auth0SessionStorage**:

```
<?php

namespace App\Libraries;

use Auth0\SDK\Store\StoreInterface;

class Auth0SessionStore implements StoreInterface
{
    /**
     * Session object
     *
     * @var \CodeIgniter\Session\Session;
     */
    protected $session;

    /**
     * Session variable prefix
     *
     * @var string
     */
    protected $prefix = 'auth0_';

    /**
     * CodeIgniterSessionStore constructor.
     */
    public function __construct()
    {
        $this->session = service('session');
    }

    /**
     * Persists $value on $_SESSION, identified by $key.
     *
     * @param string $key   Session key to set.
     * @param mixed  $value Value to use.
     *
     * @return void
     */
    public function set(string $key, $value): void
    {
        $this->session->set($this->prefix . $key, $value);
    }

    /**
    * Gets persisted values identified by $key.
    * If the value is not set, returns $default.
    *
    * @param string $key     Session key to set.
    * @param mixed  $default Default to return if nothing was found.
    *
    * @return mixed
    */
    public function get(string $key, $default = null)
    {
        return $this->session->get($this->prefix . $key) ?? $default;
    }

    /**
     * Removes a persisted value identified by $key.
     *
     * @param string $key Session key to delete.
     *
     * @return void
     */
    public function delete(string $key): void
    {
        $this->session->remove($this->prefix . $key);
    }
}
```

The last step is to create a service to handle everything conveniently. Let's edit **app/Config/Services.php** file:

```
<?php

namespace Config;

use Auth0\SDK\Auth0;
use Auth0\SDK\Exception\CoreException;
use App\Libraries\Auth0SessionStore;
use Config\Services as BaseService;

class Services extends BaseService
{
    /**
     * The Auth0 service.
     *
     * @param boolean $getShared
     *
     * @return Auth0
     * @throws CoreException
     */
    public static function auth0(bool $getShared = true)
    {
        if ($getShared)
        {
            return static::getSharedInstance('auth0');
        }

        $config = config('Auth0');
        $config = [
            'domain'        => $config->domain,
            'client_id'     => $config->clientId,
            'client_secret' => $config->clientSecret,
            'redirect_uri'  => $config->redirectUri,
            'scope'         => $config->scope,
            'store'         => new Auth0SessionStore(),
        ];

        return new Auth0($config);
    }
}
```

All that's left is to test the whole thing and create a controller **app/Controllers/Auth.php**.

```
namespace App\Controllers;

class Auth extends BaseController
{
    public function callback()
    {
        return view('auth', ['user' => service('auth0')->getUser()]);
    }

    public function login()
    {
        service('auth0')->login();
    }

    public function logout()
    {
        $config = config('auth0');
        service('auth0')->logout();

        $logoutUrl = sprintf('https://%s/v2/logout?client_id=%s&returnTo=%s', $config->domain, $config->clientId, site_url());
        $this->response->setHeader('Location', $logoutUrl);
    }
}
```

And then there's the **app/Views/auth.php** view:

```
<html>
<head>
    <title>Auth0 Sample</title>
</head>
<body>
    <?php if ($user): ?>
        <h1><?= $user['name']; ?></h1>
        <p><a href="<?= site_url('auth/logout'); ?>">Logout</a></p>
    <?php else: ?>
        <p><a href="<?= site_url('auth/login'); ?>">Login</a></p>
    <?php endif; ?>
</body>
</html>
```
