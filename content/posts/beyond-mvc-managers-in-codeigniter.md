---
title: "Beyond MVC: Adding Managers to Your CodeIgniter 4 Applications"
date: 2025-06-15T18:24:44+01:00
tags: ["codeigniter4", "architecture", "mvc"]
draft: false
summary: "Learn how to extend the traditional MVC pattern with Managers in CodeIgniter 4 to handle complex business logic and create more maintainable applications."
---

As your CodeIgniter 4 applications grow in complexity, you might find that the traditional MVC pattern needs an additional layer to handle sophisticated business logic. This is where the **MVCM** (Model-View-Controller-Manager) pattern becomes valuable.

### What are Managers?

**Managers** are classes that sit between your Controllers and Models, handling complex business operations that don't naturally fit into either component. Think of them as coordinators that orchestrate multiple operations to complete a business task.

Consider a simple example: when a user registers on your website, you might need to:

1. Validate the user data
2. Create the user record
3. Create a user profile
4. Send a welcome email

While you *could* put all this logic in your Controller, it would make the controller bloated and hard to test. Managers provide a clean place for this coordination logic.

### When to Use Managers

Managers are particularly useful when you need to:

- **Coordinate multiple models**: Operations that involve several database tables or models
- **Handle complex business workflows**: Multi-step processes with business rules and validations
- **Integrate external services**: Calling APIs, sending emails, or processing payments
- **Manage transactions**: Ensuring data consistency across multiple operations
- **Reuse business logic**: Logic that needs to be called from controllers, CLI commands, or background jobs

### A Simple Manager Example

Here's how you might structure a UserManager:

```php
<?php

namespace App\Managers;

use App\Libraries\Mailer;
use App\Models\ProfileModel;
use App\Models\UserModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use InvalidArgumentException;

class UserManager
{
    protected UserModel $userModel;
    protected ProfileModel $profileModel;
    protected Mailer $mailer;

    public function __construct(
        ?UserModel $userModel = null,
        ?ProfileModel $profileModel = null,
        ?Mailer $mailer = null,
    )
    {
        $this->userModel    = $userModel ?? model(UserModel::class);
        $this->profileModel = $profileModel ?? model(ProfileModel::class);
        $this->mailer       = $mailer ?? new Mailer();
    }

    public function registerUser($userData, $profileData)
    {
        // Business validation (rules that might change based on business logic)
        $this->validateBusinessRules($userData);

        $db = db_connect();
        $db->transException(true)->transStart();

        try {
            // Create user record
            $user = $this->userModel->createUser($userData);

            // Create associated profile
            $profile = $this->profileModel->createProfile($user['id'], $profileData);

            // Send welcome email using a custom library
            $this->mailer->sendWelcome($user['email'], $user['name']);

            $db->transComplete();

            return $user;
        } catch (DatabaseException $e) {
            $db->transRollback();

            throw $e;
        }
    }

    protected function validateBusinessRules($userData)
    {
        // Check if email already exists
        if ($this->userModel->where('email', $userData['email'])->first()) {
            throw new InvalidArgumentException('Email already registered');
        }

        // Check username against prohibited words
        $prohibitedWords = ['admin', 'root', 'system'];

        foreach ($prohibitedWords as $word) {
            if (str_contains($userData['name'], $word)) {
                throw new InvalidArgumentException('Username contains prohibited words');
            }
        }
    }
}
```

Your Controller then becomes much cleaner:

```php
<?php

namespace App\Controllers;

use App\Managers\UserManager;
use Exception;

class Users extends BaseController
{
    protected UserManager $userManager;

    public function __construct()
    {
        $this->userManager = new UserManager();
        // $this->userManager = manager(UserManager::class);
    }

    public function register()
    {
        // HTTP-layer validation (required fields, format, etc.)
        $rules = [
            'user.email'    => 'required|valid_email',
            'user.password' => 'required|min_length[8]',
            'user.name'     => 'required|min_length[2]',
            'profile.age'   => 'permit_empty|integer|greater_than[12]',
        ];

        if (! $this->validateData($this->request->getPost(), $rules)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->validator->getErrors(),
            ]);
        }

        $post = $this->validator->getValidated();

        try {
            $user = $this->userManager->registerUser($post['user'], $post['profile']);

            return $this->response->setJSON([
                'status'  => true,
                'message' => 'Registration successful',
                'user'    => $user,
            ]);
        } catch (Exception $e) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => [$e->getMessage()],
            ]);
        }
    }
}
```

### Validation in MVCM

Validation placement in MVCM is flexible and depends on your application's needs. You have several options:

- **All validation in the Controller** - Simple approach for straightforward applications
- **All validation in the Manager** - Keeps all business logic centralized
- **Split validation** - Separates HTTP concerns from business rules

The example above demonstrates the **split validation approach**, where validation is divided between two layers:

**Controller Validation** handles HTTP concerns:
- Required fields and basic format checking
- Data type validation (integer, email, etc.)
- Request structure validation

**Manager Validation** handles business rules:
- Database-dependent checks (uniqueness, relationships)
- Domain-specific business logic
- Complex validation requiring multiple data sources

This separation ensures controllers fail fast on malformed requests, while business validation remains reusable across different entry points (web controllers, API endpoints, CLI commands).

Example: A controller validates that an email field is present and properly formatted, while the manager validates that the email isn't already registered in the system.

Choose the approach that best fits your application's complexity and team preferences.

### Organizing Managers

Like Models and Controllers, Managers should be organized logically:

- Store them in **app/Managers**
- Use descriptive names like `UserManager`, `OrderManager`, `PaymentManager`
- Group related functionality together
- Keep each Manager focused on a specific domain area

#### Loading Managers

Just like CodeIgniter provides the `config()`, `model()`, etc. helper functions for loading config files and models, you can create a similar `manager()` helper for loading managers. Add this function to your **app/Common.php** file:

```php
<?php

use CodeIgniter\Config\Factories;

if (! function_exists('manager')) {
    /**
     * A simple way of getting manager instances from Factories
     */
    function manager(string $name, bool $getShared = true): mixed
    {
        return Factories::managers($name, ['getShared' => $getShared]);
    }
}
```

This allows you to load managers using the same clean syntax as models:

```php
<?php

use App\Managers\UserManager;

// Instead of this:
$this->userManager = new UserManager();

// You can use this:
$this->userManager = manager(UserManager::class);
```

The `manager()` helper leverages CodeIgniter's Factories system, providing automatic dependency injection and instance sharing, just like the built-in `model()` helper.

### Benefits of Using Managers

**Cleaner Controllers**: Controllers focus on HTTP concerns rather than business logic

**Reusable Logic**: Manager methods can be called from multiple places in your application

**Easier Testing**: Business logic can be unit tested independently of HTTP requests

**Better Organization**: Complex workflows have a dedicated, logical place to live

**Maintainability**: Changes to business processes are centralized in one location

### Keep in Mind

Managers are not always necessary. For simple CRUD operations, the traditional MVC pattern works perfectly. Add Managers when your business logic becomes complex enough to warrant the additional layer.

The goal is always cleaner, more maintainable code - not adding complexity for its own sake.