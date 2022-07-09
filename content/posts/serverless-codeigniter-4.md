---
title: "Serverless Codeigniter 4"
date: 2022-07-07T18:24:14+02:00
tags: ["serverless", "bref", "aws", "codeigniter4"]
draft: false
---

Serverless has been very popular for several years now. When we need very high performance it can be a very good alternative to traditional server solutions. Therefore, this time we will try to run CodeIgniter 4 in a serverless environment.

### Installation

The first thing to do is to install the Serverless framework (if you don't already have it). You can read how to do that here: https://bref.sh/docs/installation.html

Follow all the steps from the "Serverless" section and come back here.

If we already have the Serverless Framework installed and an AWS account configured, we can move on. Let's create a sample project in CodeIgniter 4:

```cli
composer create-project codeigniter4/appstarter serverless-ci4
```
Inside our project, let's install `bref`, which will allow us to easily run our PHP project on Lambda function.

```cli
composer require bref/bref
```

Let's initiate the project.

```
vendor/bin/bref init
```

And select the `0` option when asked about the type of apllication.

### Configuration

CodeIgniter 4 requires the `Intl` extension. By default, this extension is disabled, so we need to enable it. 
To do this, we need to create a `php.ini` file that will be loaded when the instance is launched.

In the root directory of our project, let's create the following path/file: `php/conf.d/php.ini` with the contents:
```
extension=intl
```

Let's move on to CodeIgniter's configuration settings, because there are a few things we need to change.
Let's create a copy of the `env` file under the name `.env`. Now let's edit the value for `CI_ENVIRONMENT`.

```cli 
CI_ENVIRONMENT = development
```
Just in case, so that in case of any errors we know what is happening - what errors we have.

Next, we need to overwrite the paths for the `session` (if we will use it) and `cache` files. In the following example 
we assume that we use a file handler for both the session and cache files.

```php
// app/Config/Registar.php
namespace App\Config;

use RuntimeException;

class Registrar
{
    public static function App()
    {
        $isLambda = isset($_SERVER['LAMBDA_TASK_ROOT']);

        if ($isLambda) {
            
            $sessionPathDir = '/tmp/session';

            if (! is_dir($sessionPathDir)) {
                if (! mkdir($sessionPathDir, 0755, true) && ! is_dir($sessionPathDir)) {
                    throw new RuntimeException(sprintf('Directory "%s" cannot be created', $sessionPathDir));
                }
            }

            return [
                'sessionSavePath' => $sessionPathDir,
            ];

        }

        return [];
    }

    public static function Cache()
    {
        $isLambda = isset($_SERVER['LAMBDA_TASK_ROOT']);

        if ($isLambda) {
            
            $cachePathDir = '/tmp/cache';

            if (! is_dir($cachePathDir)) {
                if (! mkdir($cachePathDir, 0755, true) && ! is_dir($cachePathDir)) {
                    throw new RuntimeException(sprintf('Directory "%s" cannot be created', $cachePathDir));
                }
            }

            return [
                'file' => [
                    'storePath' => $cachePathDir
                ],
            ];

        }

        return [];
    }
}
```

The last point will be to change the logging method so that the logs are available in `CloudWatch`.
To do this, we will install a simple extension that will replace our default logger.

```cli
composer require bref/logger
```

Let's edit the `Services.php` file to start using the new logger.

```php
// app/Config/Services.php
namespace Config;

use CodeIgniter\Config\BaseService;
use Bref\Logger\StderrLogger;

class Services extends BaseService
{
    /**
     * The Logger class is a PSR-3 compatible Logging class that supports
     * multiple handlers that process the actual logging.
     *
     * @return StderrLogger
     */
    public static function logger(bool $getShared = true)
    {
        if ($getShared) {
            return static::getSharedInstance('logger');
        }

        return new StderrLogger();
    }
}

```

We can now upload our project. The first time deploy may take about 2 minutes.

```
serverless deploy
```

After navigating to the address that will be displayed to us in the console, we should see the standard landing page of CodeIgniter 4.

Of course, usually we won't be serving entire websites, but rather providing an API.
But if we come to run a full-fledged website, we should remember not to serve the static files through the Lambda function.

Fortunately, there are built-in solutions for this. I encourage you to study the documentation: https://bref.sh/docs/.

That would be it. We have a CodeIgniter 4 application served through the Lambda function - in other words: Serverless CodeIgniter 4.
