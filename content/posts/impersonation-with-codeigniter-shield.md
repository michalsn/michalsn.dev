---
title: "Implementing User Impersonation in CodeIgniter Shield"
date: 2025-07-02T20:10:32+01:00
draft: false
tags: ["codeigniter4", "authentication", "shield", "security"]
summary: "Implement secure user impersonation in CodeIgniter 4 using the Shield authentication system and a modular architecture."
---

User impersonation is the ability for an authenticated user with appropriate privileges to assume the identity of another user temporarily. During impersonation, the original user's session is preserved, allowing them to seamlessly return to their own account when the impersonation session ends.

### Why Implement Impersonation?

There are several compelling reasons to implement user impersonation in your web application:

**Customer Support**: Support representatives can experience exactly what a customer sees, making it easier to diagnose and resolve issues without requiring customers to share sensitive information or perform complex troubleshooting steps.

**Testing and Quality Assurance**: Developers and QA teams can test features from the perspective of different user roles and permission levels without creating multiple test accounts or constantly switching credentials.

**Debugging User-Specific Issues**: When a bug only affects certain users or user types, impersonation allows developers to reproduce the exact conditions and environment where the issue occurs.

**Administrative Tasks**: System administrators can perform actions on behalf of users who may be unavailable or unable to complete certain tasks themselves.

### Prerequisites: Installing and Setting Up Shield

Before we implement impersonation, we need to install and configure [Shield](https://shield.codeigniter.com/) authentication library for CodeIgniter 4.

#### Installing Shield

First, install Shield via Composer:

```bash
composer require codeigniter4/shield
```

#### Initial Shield Setup

Run the Shield setup command to generate the necessary configuration files and database migrations:

```bash
php spark shield:setup
```

This command creates several configuration files in your `app/Config` directory:
- `app/Config/Auth.php`
- `app/Config/AuthGroups.php`
- `app/Config/AuthToken.php`

#### Moving Configuration to Module Structure

To keep our impersonation functionality modular and organized, we'll move these configuration files to our custom module structure.

First, create the module directory structure:

```bash
mkdir -p modules/Shield/Config
```

Move the generated configuration files to our module:

```bash
mv app/Config/Auth.php modules/Shield/Config/
mv app/Config/AuthGroups.php modules/Shield/Config/
mv app/Config/AuthToken.php modules/Shield/Config/
```

Update the namespace in each moved configuration file. Change the namespace from `namespace Config;` to `namespace Modules\Shield\Config;` in:
- `modules/Shield/Config/Auth.php`
- `modules/Shield/Config/AuthGroups.php`
- `modules/Shield/Config/AuthToken.php`

#### Cleaning Up Default Routes

Remove the Shield route registration from your main routes file. Open `app/Config/Routes.php` and remove this line:

```php
service('auth')->routes($routes);
```

We'll handle route registration within our module structure instead.

#### Setting Up Module Autoloading

Add the module to your `app/Config/Autoload.php` file:

```php
// ...

public $psr4 = [
    APP_NAMESPACE    => APPPATH,
    'Modules\Shield' => ROOTPATH . 'modules/Shield',
];

// ...
```

This PSR-4 autoloading configuration allows us to organize our impersonation code in a clean, modular way that won't interfere with the core Shield functionality.

### Creating the Impersonation Trait

The core of our impersonation system is a trait that extends the session authenticator's capabilities. Create `modules/Shield/Traits/Impersonable.php`:

```php
<?php

declare(strict_types=1);

namespace Modules\Shield\Traits;

use CodeIgniter\Events\Events;
use CodeIgniter\HTTP\Response;
use CodeIgniter\Shield\Exceptions\LogicException;

trait Impersonable
{
    public function impersonateLogin(int $userId)
    {
        if (! $this->loggedIn() || $this->isPending() || $this->isAnonymous()) {
            throw new LogicException('User have to be logged in fully to impersonate.');
        }

        $sessionUserInfo = $this->getSessionUserInfo();

        if ($sessionUserInfo['originalId'] ?? null) {
            throw new LogicException('User is already impersonating someone.');
        }

        $originalId = $sessionUserInfo['id'] ?? null;
        $this->user = $this->provider->findById($userId);

        $this->setSessionUserKey('originalId', $originalId);
        $this->setSessionUserKey('id', $this->user->id);

        Events::trigger('impersonateLogin', $this->user);

        /** @var Response $response */
        $response = service('response');

        // When logged in, ensure cache control headers are in place
        $response->noCache();
    }

    public function impersonateLogout()
    {
        if (! $this->loggedIn()) {
            throw new LogicException('User have to be logged in fully to impersonate.');
        }

        $sessionUserInfo = $this->getSessionUserInfo();

        if (! $userId = $sessionUserInfo['originalId'] ?? null) {
            throw new LogicException('User is not impersonating anyone.');
        }

        $this->user = $this->provider->findById($userId);

        $this->setSessionUserKey('id', $this->user->id);
        $this->removeSessionUserKey('originalId');

        Events::trigger('impersonateLogout', $this->user);

        /** @var Response $response */
        $response = service('response');

        // When logged in, ensure cache control headers are in place
        $response->noCache();
    }

    public function isImpersonated(): bool
    {
        if ($this->getSessionUserKey('originalId')) {
            return true;
        }

        return false;
    }
}
```

This trait provides three essential methods:

**`impersonateLogin()`**: Initiates impersonation by storing the original user ID and switching to the target user. It includes safeguards to prevent impersonation chains and ensures only fully authenticated users can impersonate others.

**`impersonateLogout()`**: Ends the impersonation session and returns to the original user account.

**`isImpersonated()`**: Checks whether the current session is in an impersonation state.

### Extending the Session Authenticator

Next, we need to create a custom session authenticator that uses our impersonation trait. Create `modules/Shield/Authentication/Authenticators/Session.php`:

```php
<?php

declare(strict_types=1);

namespace Modules\Shield\Authentication\Authenticators;

use CodeIgniter\Shield\Authentication\AuthenticatorInterface;
use CodeIgniter\Shield\Authentication\Authenticators\Session as ShieldSession;
use Modules\Shield\Traits\Impersonable;

class Session extends ShieldSession implements AuthenticatorInterface
{
    use Impersonable;
}
```

This extension maintains full compatibility with Shield's existing session authentication while adding our impersonation capabilities.

### Configuring the Custom Authenticator

Now we need to update our `modules/Shield/Config/Auth.php` file (which we moved from the app directory earlier) to use our custom session authenticator. Open the file and update the `use` statement:

```php
<?php

declare(strict_types=1);

namespace Modules\Shield\Config;

// ...
// use CodeIgniter\Shield\Authentication\Authenticators\Session;
use Modules\Shield\Authentication\Authenticators\Session;
// ...

class Auth extends ShieldAuth
{
    // ...
}
```

We have to replace the default `use CodeIgniter\Shield\Authentication\Authenticators\Session;` with our custom session authenticator instead.

### Creating the Impersonation Controller

Now we'll create a controller to handle impersonation requests. Create `modules/Shield/Controllers/Impersonate.php`:

```php
<?php

declare(strict_types=1);

namespace Modules\Shield\Controllers;

use App\Controllers\BaseController;
use CodeIgniter\Exceptions\PageNotFoundException;

class Impersonate extends BaseController
{
    public function impersonateLogin(int $userId)
    {
        if (! auth()->loggedIn()) {
            throw PageNotFoundException::forPageNotFound();
        }
        
        if (! auth()->user()->can('admin.impersonate')) {
            throw PageNotFoundException::forPageNotFound();
        }

        $authenticator = auth('session')->getAuthenticator();
        $authenticator->impersonateLogin($userId);

        return redirect()->to(config('Auth')->loginRedirect())->withCookies();
    }

    public function impersonateLogout()
    {
        if (! auth()->loggedIn()) {
            throw PageNotFoundException::forPageNotFound();
        }

        $authenticator = auth('session')->getAuthenticator();
        $authenticator->impersonateLogout();

        return redirect()->to(config('Auth')->loginRedirect())->withCookies();
    }
}
```

The controller provides clean endpoints for starting and ending impersonation sessions. Notice how we throw a `PageNotFoundException` for unauthenticated users rather than redirecting to a login page - this helps prevent information disclosure about the existence of impersonation functionality.

### Setting Up Routes

Create `modules/Shield/Config/Routes.php` to register our impersonation routes:

```php
<?php

declare(strict_types=1);

namespace Modules\Shield\Config;

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
service('auth')->routes($routes);

$routes->get('login-as/(:num)', '\Modules\Shield\Controllers\Impersonate::impersonateLogin/$1', ['as' => 'login-as']);
$routes->get('logout-as', '\Modules\Shield\Controllers\Impersonate::impersonateLogout', ['as' => 'logout-as']);
```

We're also setting up `service('auth')->routes($routes)` here, to maintain all the changes in one place.

### Setting Up Permissions

As you may noticed we were checking certain permissions when we try to display a link or actually perform logging as another user. Now, it's time to fill these permissions in the `modules/Shield/Config/AuthGroups.php` file:

```php
// ...

public array $permissions = [
    'admin.impersonate'   => 'Can login as a different user',
    // ...
];

// ...

public array $matrix = [
    'superadmin' => [
        'admin.*',
        'users.*',
        'beta.*',
    ],
    'admin' => [
        'admin.impersonate',
        // ...
    ],
    // ...
];

// ...
```

### Usage Examples

Here's how you can implement impersonation in your application views and controllers:

#### In Your Admin Panel View

```html
<?php if (auth()->user()->can('admin.impersonate')): ?>
    <div class="user-actions">
        <?php if (auth()->isImpersonated()): ?>
            <a href="<?= route_to('logout-as') ?>" class="btn btn-warning">
                <i class="fas fa-sign-out-alt"></i> Stop Impersonating
            </a>
        <?php else: ?>
            <a href="<?= route_to('login-as', $user->id) ?>" class="btn btn-primary">
                <i class="fas fa-sign-in-alt"></i> Login as <?= esc($user->username) ?>
            </a>
        <?php endif; ?>
    </div>
<?php endif; ?>
```

#### In Your Base Controller

You might want to add visual indicators when impersonation is active:

```php
<?php

namespace App\Controllers;

use CodeIgniter\Controller;

class BaseController extends Controller
{
    // ...
    
    protected array $data = [];
    
    protected function initController()
    {
        parent::initController();
        
        // Add impersonation status to view data
        if (auth()->loggedIn()) {
            $this->data['isImpersonated'] = auth()->isImpersonated();
        } else {
            $this->data['isImpersonated'] = false;
        }
    }
}
```

#### In Your Layout Template

Add a visual indicator for impersonation sessions:

```html
<?php if ($isImpersonated ?? false): ?>
    <div class="alert alert-warning impersonation-banner">
        <strong>⚠️ Impersonation Active</strong>
        You are currently viewing this application as another user.
        <a href="<?= route_to('logout-as') ?>" class="btn btn-sm btn-outline-dark ms-2">
            Return to Your Account
        </a>
    </div>
<?php endif; ?>
```

### Security Considerations

When implementing user impersonation, security should be your top priority:

**Permission Checks**: Always verify that the impersonating user has appropriate permissions before allowing impersonation. Consider creating a specific permission like `admin.impersonate` and checking it before showing impersonation links or processing impersonation requests.

**Audit Logging**: Log all impersonation activities for security auditing and compliance purposes. You can hook into the `impersonateLogin` and `impersonateLogout` events we trigger in our trait.

**Session Security**: Our implementation stores the original user ID in the session, which is secure as long as your session storage is properly configured and secured.

**Visual Indicators**: Always provide clear visual feedback when impersonation is active so users understand the current context.

### Event Handling

Our implementation triggers events that you can use for logging or additional processing:

```php
<?php

// In your Events.php or a service
Events::on('impersonateLogin', function ($user) {
    log_message('info', 'Impersonation started for user: ' . $user->id);
});

Events::on('impersonateLogout', function ($user) {
    log_message('info', 'Impersonation ended, returned to user: ' . $user->id);
});
```

### Conclusion

This implementation provides a secure, maintainable way to add user impersonation to your CodeIgniter 4 application using Shield authentication. The modular approach keeps your custom code organized and separate from the core framework, making it easier to maintain and update over time.

Remember to always implement proper authorization checks in your application logic, maintain audit logs of impersonation activities, and provide clear visual feedback to users when impersonation is active. With these safeguards in place, user impersonation becomes a powerful tool for administration, support, and debugging.