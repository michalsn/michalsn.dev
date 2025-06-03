---
title: "Managing Multiple .env Files for Multi-Client Applications in CodeIgniter 4"
date: 2025-06-02T14:08:21+01:00
tags: ["env", "configuration", "codeigniter4"]
draft: false
---

When building applications that serve multiple clients or domains from a single codebase, developers often face the challenge of managing different configurations for each client. This becomes particularly complex when each client requires separate database credentials, API keys, or other environment-specific settings. 

In this post, we'll explore how to extend CodeIgniter 4 environment configuration system to support multiple `.env` files, enabling you to maintain separate configurations for each client while keeping your codebase clean and maintainable.

### The Multi-Tenant Challenge

Before diving into the solution, let's understand the problem we're trying to solve. In multi-tenant applications, you typically have two main architectural approaches:

#### Single Database Approach

In this approach, all clients share the same database, with data separation handled through tenant identifiers in your database schema. This is simpler to manage and maintain:

- **Pros**: Easy migrations, simpler backup/restore procedures, straightforward analytics across all clients
- **Cons**: Data isolation concerns, potential performance bottlenecks, limited customization per client

#### Separate Database Per Client

Here, each client gets their own dedicated database instance:

- **Pros**: Complete data isolation, better security, ability to customize schema per client, easier compliance with data regulations
- **Cons**: Complex migrations, difficult cross-client analytics, increased maintenance overhead

When you choose the separate database approach, you need different database credentials for each client, which is where our `.env` file challenge begins.

### CodeIgniter 4's Default .env Limitation

Out of the box, CodeIgniter 4 supports only a single `.env` file located in your project root. This file contains environment variables that override your configuration files, making it perfect for storing sensitive information like database credentials, API keys, and other environment-specific settings.

However, when you need different configurations for different clients accessing the same application instance, you need a way to load different `.env` files based on the current client context.

### The Solution: Custom Boot Class

The solution involves creating a custom Boot class that extends CodeIgniter's base Boot class and overriding the `loadDotEnv()` method. This approach is clean, maintainable, and doesn't require core framework modifications.

#### Step 1: Create the Custom Boot Class

First, create a new file `app/AppBoot.php`:

```php
<?php

declare(strict_types=1);

namespace App;

use CodeIgniter\Boot;
use CodeIgniter\Config\DotEnv;
use Config\Paths;
use RuntimeException;

/**
 * Bootstrap for the application
 *
 * @codeCoverageIgnore
 */
class AppBoot extends Boot
{
    /**
     * Load environment settings from .env files into $_SERVER and $_ENV
     */
    protected static function loadDotEnv(Paths $paths): void
    {
        require_once $paths->systemDirectory . '/Config/DotEnv.php';
        
        $clientName  = static::determineClientName();
        $envFileName = '.env.' . $clientName;
        
        if (file_exists($paths->appDirectory . '/../' . $envFileName)) {
            (new DotEnv($paths->appDirectory . '/../', $envFileName))->load();
        } else {
            // Fallback to default .env file
            (new DotEnv($paths->appDirectory . '/../', '.env'))->load();
        }
    }
    
    private static function determineClientName(): string
    {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $host = preg_replace('/^www\./', '', strtolower($host));
    
        // Hardcoded trusted domains and subdomains
        $allowedDomains = [
            'acmeclient.com'    => 'acme',
            'client1.myapp.com' => 'client1',
            'client2.myapp.com' => 'client2',
        ];
    
        if (isset($allowedDomains[$host])) {
            return $allowedDomains[$host];
        }
    
        throw new RuntimeException("Unauthorized domain: {$host}");
    }
}
```

#### Step 2: Modify the Bootstrap Process

Next, update your `public/index.php` file to use your custom Boot class:

```php
<?php

use App\AppBoot;
use Config\Paths;

// ...

$paths = new Paths();

// LOAD THE FRAMEWORK BOOTSTRAP FILE
require $paths->systemDirectory . '/Boot.php';
// Load our custom bootstrap file
require $paths->appDirectory . '/AppBoot.php';

exit(AppBoot::bootWeb($paths));
```

#### Step 3: Create Client-Specific .env Files

Now create separate `.env` files for each client in your project root:

```dotenv
# .env.client1
database.default.hostname = client1-db.example.com
database.default.database = client1_production
database.default.username = client1_user
database.default.password = super_secure_password_1

app.baseURL = https://client1.myapp.com/
app.indexPage = ''

# .env.client2
database.default.hostname = client2-db.example.com
database.default.database = client2_production
database.default.username = client2_user
database.default.password = super_secure_password_2

app.baseURL = https://client2.myapp.com/
app.indexPage = ''
```

### Security Considerations

#### File Permissions

Ensure your `.env` files have appropriate permissions:

```bash
chmod 600 .env.*
```

#### Version Control

Add all `.env` files to your `.gitignore`:

```gitignore
.env
.env.*
!.env.example
```

### Best Practices

1. **Consistent naming**: Use a consistent naming convention for your `.env` files (e.g., `.env.clientname`)
2. **Documentation**: Maintain a README or documentation explaining how to add new clients and their configurations
3. **Validation**: Implement validation to ensure required environment variables are present for each client
4. **Security**: Always validate the client name to prevent unauthorized access to other clients' configurations through domain spoofing

### Summary

Managing multiple `.env` files in CodeIgniter 4 for multi-client applications doesn't have to be complicated. By extending the framework's Boot class and implementing smart client detection logic, you can maintain clean separation of concerns while keeping your codebase maintainable.

Remember that the client detection logic (`determineClientName()` method) is where you'll implement your specific business rules. You should adapt them to fit your application's unique requirements.

This approach provides the flexibility needed for complex multi-tenant applications while preserving the simplicity that makes CodeIgniter 4 so appealing. The separate database approach, while more complex, offers benefits that may be crucial for your specific use case.