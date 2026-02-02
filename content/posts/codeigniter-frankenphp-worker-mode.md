---
title: "Supercharge Your CodeIgniter 4 Applications with FrankenPHP Worker Mode"
date: 2026-02-02T07:32:17+01:00
draft: false
tags: ["codeigniter4", "frankenphp", "performance", "worker-mode", "php"]
summary: "Discover how FrankenPHP's worker mode delivers 2-3x performance improvements for CodeIgniter 4 applications with persistent database connections and zero-downtime request handling."
---

PHP application performance has taken a significant leap forward with FrankenPHP worker mode, and CodeIgniter 4 now supports it. In this post, I'll show you how worker mode can dramatically improve your application's performance for production deployments.

## What is FrankenPHP?

[FrankenPHP](https://frankenphp.dev/) is a modern PHP application server built on top of the Caddy web server. It combines the simplicity of PHP with the performance characteristics of compiled languages by keeping your application in memory and reusing it across multiple HTTP requests.

## The Traditional PHP Request Cycle Problem

In a typical PHP-FPM deployment, every HTTP request follows the same expensive pattern:

1. Start a new PHP process (or reuse one from the pool)
2. Parse and compile PHP files
3. Bootstrap the entire framework
4. Load configuration files
5. Initialize database connections
6. Process the request
7. Tear everything down

This works, but it's inefficient. Your application performs the same initialization work thousands of times per day, only to throw it away after each request.

## Enter Worker Mode

FrankenPHP worker mode fundamentally changes this model:

1. **One-time bootstrap** — Your application loads once when the worker starts
2. **Request loop** — Each incoming request reuses the already-initialized application
3. **State isolation** — Request-specific data is reset between requests to prevent leakage

The result? Your application handles requests significantly faster because it skips all that redundant initialization work.

## CodeIgniter Worker Mode Implementation

I'm excited to share that experimental worker mode support is now available for CodeIgniter, starting from v4.7.

### Key Features

**Persistent Database Connections**
- Database connections are maintained across requests and validated with `ping()` before use
- PostgreSQL uses native `pg_ping()`; other drivers use efficient "SELECT 1" queries
- Automatic detection and rollback of uncommitted transactions

**Smart Session Handling**
- Connection pooling for Redis and Memcached session handlers
- Connections are validated before each request
- Prevents connection exhaustion under heavy load

**State Management**
- Superglobals (`$_GET`, `$_POST`, `$_SERVER`, etc.) properly reset between requests
- Services and caches cleared to prevent data leakage
- Debug Toolbar support for development environments

**Easy Setup**
```bash
# Install worker mode files
php spark worker:install

# Remove worker mode if needed
php spark worker:uninstall
```

### Zero Impact on Existing Deployments

An important advantage: worker mode is **completely optional** and adds **zero overhead** to traditional PHP-FPM deployments. The worker mode code only executes when you explicitly use `public/frankenphp-worker.php`. Your existing `public/index.php` remains untouched.

## Real-World Performance Benchmarks

I ran comprehensive benchmarks comparing FrankenPHP worker mode against classic mode on an M1 Mac with 16GB RAM. The tests used `wrk` with 4 threads, 30-second duration, and 100-200 concurrent connections. FrankenPHP was configured with 16 threads/workers.

### Throughput Improvements

Worker mode delivered impressive performance gains across all scenarios:

| Test Scenario | Classic Mode | Worker Mode | Improvement |
|--------------|--------------|-------------|-------------|
| **Static page** | 1,373 req/s | 2,808 req/s | **2.0x** |
| **Database queries** | 1,063 req/s | 2,002 req/s | **1.9x** |
| **Cache operations** | 1,420 req/s | 2,495 req/s | **1.8x** |
| **Session handling** | 709 req/s | 2,110 req/s | **3.0x** |
| **Combined workload** | 674 req/s | 1,496 req/s | **2.2x** |

*All measurements at 100 concurrent connections*

### Latency Reductions

Lower latency means better user experience. Worker mode significantly reduced response times:

| Test Scenario | Classic Mode | Worker Mode | Reduction |
|--------------|--------------|-------------|-----------|
| **Static** | 72.83ms | 35.62ms | **51%** |
| **Database** | 93.97ms | 49.90ms | **47%** |
| **Cache** | 70.33ms | 40.02ms | **43%** |
| **Session** | 150.95ms | 47.43ms | **69%** |
| **Combined** | 148.56ms | 66.75ms | **55%** |

### Scalability Under Load

When doubling the connection count from 100 to 200:

- **Worker mode** maintained nearly identical throughput with predictable latency increases
- **Classic mode** showed no improvement and experienced significant failures

### Reliability: The Hidden Advantage

Perhaps the most striking difference wasn't in speed, but in **reliability**:

- **Worker mode**: Zero failed requests across all test scenarios
- **Classic mode**: Significant failure rates due to connection pool exhaustion
  - Database tests: ~74% failure rate (23,500 errors)
  - Session tests: ~24% failure rate (5,000 errors)
  - Combined workload: ~60% failure rate (12,100 errors)

Worker mode's persistent connections eliminate the connection pool exhaustion problem entirely.

### Predictable Performance

Worker mode also delivers more consistent latency. In session handling tests at 100 connections:

- **Worker mode**: p50-to-p99 latency spread of 46-66ms
- **Classic mode**: p50-to-p99 latency spread of 84-418ms

Tighter latency distribution means more predictable application behavior under load.

## Why Worker Mode Wins

The performance improvements come from three key optimizations:

1. **Eliminated Bootstrap Overhead** - Framework initialization happens once at startup, not per-request
2. **Persistent Connections** - Database and cache connections are reused, avoiding connection overhead and pool exhaustion
3. **Reduced Memory Allocation** - Less object creation and garbage collection per request

## How to Set It Up

I won't be describing here how we can install FrankenPHP, as this is all covered in the [user guide](https://codeigniter.com/user_guide/installation/worker_mode.html).

## What's Next?

Worker mode support for CodeIgniter 4 is currently **experimental**. The implementation is stable and thoroughly tested, but we're gathering feedback from the community before marking it as production-ready.

Key areas we're monitoring:

- Memory usage patterns over extended periods
- Edge cases in state reset logic
- Performance characteristics with various workloads
- Integration with third-party packages

## Getting Started

With 2-3x throughput gains, sub-50ms latencies, and zero failed requests under load, worker mode offers substantial benefits for production CodeIgniter 4 deployments. If you're running CodeIgniter 4 in production, worker mode with FrankenPHP is worth evaluating.
