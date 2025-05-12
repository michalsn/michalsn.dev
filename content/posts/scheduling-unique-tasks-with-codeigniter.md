---
title: "Scheduling Unique Tasks with CodeIgniter"
date: 2025-05-06T10:14:47+01:00
tags: ["codeigniter4", "tasks", "queue"]
draft: false
---

When you're scheduling tasks in CodeIgniter 4, it's not uncommon to run into issues where the same task gets triggered before the previous one finishes. This can cause anything from duplicate processing to race conditions and even server slowdowns.

To help with that, [CodeIgniter Tasks](https://github.com/codeigniter4/tasks) provides a built-in method called `singleInstance()`.

<!--more-->

### What Is `singleInstance()`?

The `singleInstance()` method ensures that a task only runs once at a time. If the task is already running, CodeIgniter will skip the next execution to avoid overlapping.

Here’s how to use it:

```php
$schedule->command('app:my-task')
         ->everyFiveMinutes()
         ->singleInstance();
```

In this example, if `app:my-task` is still running when it’s scheduled again in 5 minutes, the new run will be skipped.

### Set a Custom Lock Duration

By default, the lock created by `singleInstance()` lasts as long as the task is running. But what if something goes wrong and the task doesn’t finish cleanly? Or maybe you want to be extra safe and avoid lockouts?

You can pass a number of seconds to control how long the lock should last:

```php
$schedule->command('data:sync')
         ->everyMinute()
         ->singleInstance(MINUTE * 10); // Lock lasts 10 minutes
```

Even if the task crashes, the lock will expire after 10 minutes, allowing future runs to proceed.

### When Should You Use It?

Use `singleInstance()` when:

- Your task is long-running
- The task modifies files, databases, or external systems
- Overlapping executions could cause problems

For example:

```php
$schedule->command('emails:send')
         ->everyMinute()
         ->singleInstance(MINUTE * 15); // 15-minute lock to prevent duplicates
```

### Schedule Queues as Tasks

A recent addition to CodeIgniter Tasks is the ability to schedule queue jobs directly, making it easier to defer work to a background process. Instead of executing heavy logic during the task itself, you can simply dispatch a job:

```php
$schedule->queue('queue', 'job-name', ['data' => 'array'])
         ->everyMinute()
         ->singleInstance();
```

This means you can leverage your queue system (like Redis or database-backed queues) for smoother performance and better scalability-while still enjoying the scheduling flexibility of the task scheduler.

You can even apply `singleInstance()` to make sure the job isn’t dispatched more than once while it’s still being processed.

### Summary

Using `singleInstance()` is a simple way to make sure your scheduled tasks don’t step on each other. Whether you’re processing orders, sending emails, or syncing data, it adds a layer of safety - and with optional lock durations, you stay in control even when something goes wrong.