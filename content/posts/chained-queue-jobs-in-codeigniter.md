---
title: "Chained Jobs with CodeIgniter Queue"
date: 2025-04-17T20:03:24+01:00
tags: ["codeigniter4", "queue"]
draft: false
---

Job queues help handle background tasks like sending emails, generating reports, or resizing images - keeping your application fast and responsive. But what if you need tasks to run in a specific order? That’s where chained jobs shine.

<!--more-->

### What Are Chained Jobs?

Chained jobs in [CodeIgniter Queue](https://github.com/codeigniter4/queue) allow you to define a sequence of jobs that will be executed one after another, but only if the previous job completes successfully.

This is perfect when tasks are dependent on each other - for example:

1. Generate a report
2. Send the report by email

With CodeIgniter Queue, chaining these jobs looks like this:

```php
service('queue')->chain(function($chain) {
    $chain
        ->push('reports', 'generate-report', ['userId' => 123])
        ->push('emails', 'email', [
            'message' => 'Email message goes here',
            'userId'  => 123,
        ]);
});
```

### How It Works

- The first job (generate-report) is added to the queue.
- When it completes successfully, the second job (email) is automatically dispatched.
- If any job in the chain fails, the rest are not executed, ensuring consistency.

### Best Practices

- Keep jobs focused and independent where possible.
- Implement retries using tries or error handling to make chains more resilient.
- Monitor logs to understand where a chain might stop due to failure.

### Summary

Chained jobs let you build dependable multistep workflows - without blocking the user experience. Whether it’s generating reports, sending notifications, or processing files, CodeIgniter Queue makes it clean and efficient.