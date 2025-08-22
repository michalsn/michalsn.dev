---
title: "Unix Signals in PHP: Building Bulletproof CLI Applications"
date: 2025-08-21T20:10:31+02:00
draft: false
tags: ["php", "unix", "signals"]
summary: "Deep dive into Unix signal handling in PHP applications with object-oriented design patterns, edge cases, and production-ready implementations."
---

Whether you're building a message queue worker, a long-running importer, or a real-time monitoring daemon, signals are your lifeline to building something others can actually trust.

### Signals: The Unix Way of Saying "Hey, Listen Up"

Unix signals are software interrupts. Think of them as the operating system's way of tapping your process on the shoulder - sometimes politely, sometimes not so much.

#### The Signal Landscape

Signals roughly fall into a few camps:

**The Polite Ones:**
- `SIGTERM (15)`: "Please wrap up and exit when convenient"
- `SIGINT (2)`: What happens when you hit Ctrl+C
- `SIGHUP (1)`: Originally "your terminal hung up," now often used for reloading config

**The Nuclear Options:**
- `SIGKILL (9)`: The kernel's way of saying "I'm not asking"
- `SIGSTOP (19)`: Forced pause - no negotiations

**The Useful Ones:**
- `SIGUSR1 (10)` & `SIGUSR2 (12)`: Yours to define - toggle debug mode, rotate logs, whatever you need

Here's the crucial bit: `SIGKILL` and `SIGSTOP` bypass your application entirely. No amount of clever PHP will catch them. The kernel handles these directly, which is both frustrating and necessary - it's the OS's ultimate escape hatch.

### Building a Signal Handling Architecture That Doesn't Suck

Most tutorials show you how to throw `pcntl_signal()` calls around your code. That works for demos, but in production, you want something maintainable and testable.

Here's my approach - a trait that handles the signal plumbing while letting your application focus on business logic:

```php
<?php

trait SignalHandling
{
    private bool $running = true;
    private bool $signalsBlocked = false;
    private array $registeredSignals = [];
    private array $signalMethodMap = [];

    // Extension availability checks - cached for performance
    private static ?bool $pcntlAvailable = null;
    private static ?bool $posixAvailable = null;

    protected function registerSignals(
        array $signals = [SIGTERM, SIGINT, SIGHUP],
        array $methodMap = []
    ): void {
        // Bail gracefully if PCNTL isn't available (Windows, shared hosting, etc.)
        if (! $this->isPcntlAvailable()) {
            return;
        }

        // Some signals need POSIX extension - filter them out if it's missing
        if (!$this->isPosixAvailable()) {
            $posixSignals = [SIGTSTP, SIGCONT];
            $filtered     = array_diff($signals, $posixSignals);
            if ($filtered !== $signals) {
                error_log('Warning: POSIX extension required for pause/resume signals');
                $signals   = $filtered;
                $methodMap = array_diff_key($methodMap, array_flip($posixSignals));
            }
        }

        // This is important - enables immediate signal delivery
        pcntl_async_signals(true);

        $this->signalMethodMap = $methodMap;

        foreach ($signals as $signal) {
            if (pcntl_signal($signal, [$this, 'handleSignal'])) {
                $this->registeredSignals[] = $signal;
            }
        }
    }

    protected function handleSignal(int $signal): void
    {
        // Custom logic first (strategy pattern in action)
        $this->callCustomHandler($signal);

        // Then standard behavior (template method pattern)
        $this->applyStandardSignalBehavior($signal);
    }

    private function callCustomHandler(int $signal): void
    {
        $method = $this->signalMethodMap[$signal] ?? null;

        // Try explicit mapping first
        if ($method && method_exists($this, $method)) {
            $this->{$method}($signal);
            return;
        }

        // Fall back to generic handler
        if (method_exists($this, 'onInterruption')) {
            $this->onInterruption($signal);
        }
    }

    private function applyStandardSignalBehavior(int $signal): void
    {
        switch ($signal) {
            case SIGTERM:
            case SIGINT:
            case SIGQUIT:
            case SIGHUP:
                $this->running = false;
                break;

            case SIGTSTP:
                // Temporarily restore the default handler
                pcntl_signal(SIGTSTP, SIG_DFL);
                // Re-send the signal to ourselves to trigger actual suspension
                posix_kill(posix_getpid(), SIGTSTP);
                break;

            case SIGCONT:
                // When resumed, immediately re-register our custom handler
                pcntl_signal(SIGTSTP, [$this, 'handleSignal']);
                break;
        }
    }

    protected function withSignalsBlocked(callable $operation)
    {
        $this->blockSignals();
        try {
            return $operation();
        } finally {
            $this->unblockSignals();
        }
    }

    private function blockSignals(): void
    {
        if (!$this->signalsBlocked && $this->isPcntlAvailable()) {
            pcntl_sigprocmask(SIG_BLOCK, [
                SIGTERM, SIGINT, SIGHUP, SIGQUIT,
                SIGTSTP, SIGCONT, SIGUSR1, SIGUSR2, SIGPIPE, SIGALRM
            ]);
            $this->signalsBlocked = true;
        }
    }

    private function unblockSignals(): void
    {
        if ($this->signalsBlocked && $this->isPcntlAvailable()) {
            pcntl_sigprocmask(SIG_UNBLOCK, [
                SIGTERM, SIGINT, SIGHUP, SIGQUIT,
                SIGTSTP, SIGCONT, SIGUSR1, SIGUSR2, SIGPIPE, SIGALRM
            ]);
            $this->signalsBlocked = false;
        }
    }

    protected function isRunning(): bool
    {
        return $this->running;
    }

    protected function shouldTerminate(): bool
    {
        return ! $this->running;
    }
    
    protected function isSignalBlocked(): bool
    {
        return $this->signalsBlocked;
    }

    private function isPcntlAvailable(): bool
    {
        if (self::$pcntlAvailable === null) {
            self::$pcntlAvailable = ! str_contains(PHP_OS, 'WIN') && extension_loaded('pcntl');
        }
        return self::$pcntlAvailable;
    }

    private function isPosixAvailable(): bool
    {
        if (self::$posixAvailable === null) {
            self::$posixAvailable = ! str_contains(PHP_OS, 'WIN') && extension_loaded('posix');
        }
        return self::$posixAvailable;
    }
}
```

Why this approach works:

1. **Graceful degradation** - runs fine even without signal support
2. **Separation of concerns** - signal mechanics separate from business logic
3. **Testable** - you can unit test the signal handling without sending real signals
4. **Extensible** - custom handlers through method mapping

### Real-World Usage: A Data Processing Worker

Here's how you'd actually use this in production:

```php
<?php

class DataProcessor
{
    use SignalHandling;

    private Database $db;
    private Logger $logger;
    private bool $debugMode = false;

    public function run(): void
    {
        $this->registerSignals(
            [SIGTERM, SIGINT, SIGUSR1],
            [SIGUSR1 => 'toggleDebugMode'] // Custom handler for debug toggling
        );

        $this->logger->info('Worker started, PID: ' . getmypid());

        while ($this->isRunning()) {
            $batch = $this->getNextBatch();
            
            if (empty($batch)) {
                sleep(5); // Nothing to do, wait a bit
                continue;
            }

            $this->processBatch($batch);
        }

        $this->logger->info('Worker terminated gracefully');
    }

    private function processBatch(array $batch): void
    {
        // Critical section - don't let signals interrupt mid-transaction
        $this->withSignalsBlocked(function() use ($batch) {
            $this->db->beginTransaction();
            try {
                foreach ($batch as $item) {
                    $this->processItem($item);
                }
                $this->db->commit();
                $this->logger->debug('Processed batch of ' . count($batch) . ' items');
            } catch (Exception $e) {
                $this->db->rollback();
                $this->logger->error('Batch processing failed: ' . $e->getMessage());
                throw $e;
            }
        });
    }

    // This gets called for SIGTERM, SIGINT, etc.
    protected function onInterruption(int $signal): void
    {
        $signalName = $this->getSignalName($signal);
        $this->logger->info("Received {$signalName}, initiating shutdown...");

        // App-specific cleanup
        $this->saveProgressCheckpoint();
        $this->notifyMonitoringSystem("shutdown_requested");
    }

    // Custom handler for SIGUSR1
    protected function toggleDebugMode(int $signal): void
    {
        $this->debugMode = !$this->debugMode;
        $this->logger->info('Debug mode: ' . ($this->debugMode ? 'ON' : 'OFF'));
        
        // Maybe adjust log level too
        $this->logger->setLevel($this->debugMode ? LogLevel::DEBUG : LogLevel::INFO);
    }

    private function getSignalName(int $signal): string
    {
        $names = [
            SIGTERM => 'SIGTERM',
            SIGINT  => 'SIGINT',
            SIGHUP  => 'SIGHUP',
            SIGUSR1 => 'SIGUSR1',
        ];
        return $names[$signal] ?? "Signal {$signal}";
    }
}
```

### The Pause/Resume Trap (And How to Avoid It)

This one bit me hard during a debugging session. I had a worker running in the background, sent it `kill -TSTP` to pause it, then `kill -CONT` to resume. Suddenly, Ctrl+C stopped working. The process was running but completely unresponsive to terminal input.

#### What's Happening

When you suspend a process with the shell's job control (Ctrl+Z), then resume it with `fg`, everything works perfectly. The terminal maintains control, and signals like Ctrl+C reach your process just fine.

But when you manually send `SIGTSTP` and `SIGCONT`:

```bash
./worker.php &
kill -TSTP $!    # Suspend
kill -CONT $!    # Resume - but now Ctrl+C doesn't work!
```

The process resumes but loses its connection to the terminal's foreground process group. Ctrl+C sends `SIGINT` to the foreground group, but your process isn't in it anymore.

#### Why Manual Resume Breaks Terminal Control

The fundamental issue isn't with our signal handling - it's with how Unix process groups work. When you use `kill -CONT` to resume a process, it starts running again but doesn't rejoin the terminal's foreground process group. The terminal can no longer send signals like Ctrl+C to it.
This is different from using `fg` in the shell, which properly restores the process to the foreground group.

#### Best Practice

Always use shell job control for interactive debugging:
- Suspend: Ctrl+Z
- Resume: `fg`
- Background: `bg`

Document this limitation clearly for your team. Nothing's more frustrating than a "hung" process that's actually just disconnected from terminal input.

### Testing Signal Handlers Without Going Insane

Testing signal handling is tricky. You can't reliably send real signals in a test environment, and even if you could, it's brittle and slow.

Instead, test the signal handling logic directly:

```php
<?php

class WorkerTest extends PHPUnit\Framework\TestCase
{
    public function testGracefulShutdown(): void
    {
        $worker = new DataProcessor($this->mockDb, $this->mockLogger);
        
        $this->assertTrue($worker->isRunning());

        // Simulate receiving SIGTERM
        $worker->handleSignal(SIGTERM);

        $this->assertFalse($worker->isRunning());
        $this->assertTrue($worker->shouldTerminate());
    }

    public function testCriticalSectionBlocking(): void
    {
        $worker = new DataProcessor($this->mockDb, $this->mockLogger);

        $result = $worker->withSignalsBlocked(function() use ($worker) {
            // Inside the critical section, signals should be blocked
            $this->assertTrue($worker->isSignalBlocked());
            return 'success';
        });

        // After the critical section, signals should be unblocked
        $this->assertEquals('success', $result);
        $this->assertFalse($worker->isSignalBlocked());
    }

    public function testCustomSignalHandler(): void
    {
        $worker = new DataProcessor($this->mockDb, $this->mockLogger);
        $initialDebugState = $worker->isDebugMode();

        // Simulate SIGUSR1 (toggle debug mode)
        $worker->handleSignal(SIGUSR1);

        $this->assertNotEquals($initialDebugState, $worker->isDebugMode());
    }
}
```

This tests your signal handling logic without the complexity of actual signal delivery.

### Production Considerations

#### Containers and Docker

Docker only forwards signals to PID 1. If your PHP script isn't PID 1 (maybe you're using a shell script wrapper), signals won't reach it. Solutions:

- Make your PHP script PID 1 in the container
- Use a proper init system like `tini`

#### Windows

No Unix signals on Windows. Consider alternatives:
- File-based signaling (check for specific files periodically)
- Named pipes

#### Monitoring and Observability

Your signal handlers should integrate with your monitoring:

```php
protected function onInterruption(int $signal): void
{
    // Log for debugging
    $this->logger->info("Received signal {$signal}, shutting down gracefully");
    
    // Notify monitoring systems
    $this->metrics->increment('worker.shutdowns.graceful');
    $this->alerts->notify('worker_shutdown', [
        'signal'          => $signal,
        'processed_items' => $this->itemCount,
        'uptime'          => time() - $this->startTime
    ]);
    
    // Save state for debugging
    $this->saveDebugSnapshot();
}
```

### Wrapping Up

Signal handling transforms CLI applications from fragile scripts into robust, manageable services. The key insights:

**Design for the real world:** Your app should degrade gracefully when signal support isn't available. Not every environment supports PCNTL.

**Protect critical sections:** Use signal blocking around database transactions, file operations, and other atomic operations. Data integrity is more important than responsiveness.

**Test the logic, not the mechanism:** Test your signal handling code directly rather than trying to send actual signals in tests.

**Document the gotchas:** Especially the pause/resume terminal issue. Your future self (and your teammates) will thank you.

When done right, signal handling isn't just about catching interruptions - it's about building systems that operators can trust. Systems that shut down cleanly, provide useful debugging hooks, and integrate properly with monitoring infrastructure.

That's the difference between a script that works on your laptop and a service that works in production.
