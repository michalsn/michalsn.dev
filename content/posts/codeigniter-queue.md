---
title: "CodeIgniter Queue"
date: 2023-10-14T15:36:19+01:00
tags: ["queue", "database", "codeigniter4"]
draft: false
---

While CodeIgniter 4 itself doesn't have a built-in queue system, I have built one which rely on the database handler.

But what is a queue? It's a system that allows you to schedule and manage background tasks or jobs to be executed in the given order. These jobs can include sending emails, processing data, generating reports, and more. Using a queue system helps offload time-consuming or resource-intensive tasks from the main application, ensuring that the application remains responsive.

Here is the project [repo](https://github.com/michalsn/codeigniter-queue).

**Update 15/12/2023**: This project has become the [official CodeIgniter Queue](https://github.com/codeigniter4/queue) project. The repository has been moved to the CodeIgniter4 organization.

First things first. Let's install the package:

    composer require michalsn/codeigniter-queue

And migrate our database:

    php spark migrate --all

Last thing, during installation is to publish our config file:

    php spark queue:publish

Now, we can create our first Job:

    php spark queue:job Example

And implement our example job in the `process` method:

```php
// ...

class Example extends BaseJob implements JobInterface
{
    public function process()
    {
        $email  = service('email', null, false);
        $result = $email
            ->setTo('sample@email.com')
            ->setSubject('Sample subject')
            ->setMessage($this->data['message'])
            ->send(false);

        if (! $result) {
            throw new Exception($email->printDebugger('headers'));
        }

        return $result;
    }
}
```

This job will just send an email. The only variable is a `message`, which is available via the `$this->data` class variable.
If sending an email will not be successful, the exception will be thrown. This will indicate that the job failed.

To make this job available, we have to add it to the `$jobHandlers` array in the `app\Config\Queue.php` file.

```php
// ...

use App\Jobs\Example;

// ...

public array $jobHandlers = [
    'my-example' => Example::class
];

// ...
```

This is how we will add our job to the queue:

```php
service('queue')->push('queueName', 'my-example', ['message' => 'Hello there']);
```

To start executing the jobs, we have to start the worker:

    php spark queue:work queueName

That's pretty much it. There are many additional option and ways to run a queue worker, though.

To learn more you can check the [docs](https://michalsn.github.io/codeigniter-queue/).
