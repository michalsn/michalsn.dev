---
title: "Building a Production-Ready File Handler for CodeIgniter 4 Settings"
date: 2025-10-29T19:33:19+02:00
draft: false
tags: ["codeigniter4", "settings"]
summary: "While CodeIgniter 4 Settings includes a database-backed handler, I wanted a file-based option that's lightweight, fast, and safe for production use. I'll walk through the challenges of handling concurrency, file locking, and caching, and explain the design choices behind the new FileHandler."
---

The [CodeIgniter 4 Settings](https://github.com/codeigniter4/settings) package provides a clean API for managing application configuration that changes at runtime. While it shipped with a `DatabaseHandler` for persistent storage, I wanted to offer an alternative: a file-based handler optimized for production use with proper concurrency handling.

This post dives into the technical challenges I encountered and the design decisions that shaped the implementation.

### Why Build a FileHandler?

The DatabaseHandler works great, but file-based storage offers distinct advantages:

- **Zero database dependency** - Deploy without migrations or database setup
- **Opcache acceleration** - PHP files benefit from opcache, making reads essentially free after the first hit
- **Simpler debugging** - Open a file, see your settings. No SQL client needed.

But building a file handler that's actually production-ready? That's where it gets interesting.

### Challenge #1: Race Conditions

The core problem: multiple PHP processes writing to the same file simultaneously. Without proper handling, you get classic write conflicts:

```
Process A: Read file -> Modify -> Write back
Process B: Read file -> Modify -> Write back
Result: Process B's changes win, Process A's changes lost
```

#### Initial Approach: One File for Everything

My first instinct was simple: one file per context (production, testing, etc.), containing all classes:

```
writable/settings/
  ├── general.php      <- ALL classes for null context
  └── production.php   <- ALL classes for production context
```

**Problem:** Every write to *any* class in the same context would contend on the same file lock. With 10 config classes, you'd effectively serialize all writes, even for completely unrelated settings.

#### The Solution: One File Per Class+Context

Instead, I isolated by class+context combination:

```
writable/settings/
  ├── App_Config_Database.php            <- Database class, null context
  ├── App_Config_Email.php               <- Email class, null context
  └── 9eb667bc447b15815da4c9342efc4c3b/  <- hash('xxh128', 'production')
      ├── App_Config_Database.php
      └── App_Config_Email.php
```

Now writes to `Database` settings and `Email` settings are completely independent. Lock contention only happens when writing to the same class+context—exactly when coordination is actually needed.

### Challenge #2: The Merge Strategy

Even with isolated files, I still have concurrent writes to the same class:

```php
// Process A
$settings->set('Email.fromAddress', 'new@example.com');

// Process B (different PHP process, same moment)
$settings->set('Email.fromName', 'New Name');
```

Each process has its own in-memory state (inheriting from `ArrayHandler`). Process A doesn't know about `fromName`, Process B doesn't know about `fromAddress`. 

Naive implementation:

```php
function persist() {
    $data = $this->getInMemoryData();
    file_put_contents($file, serialize($data));
}
```

**Result:** Whichever process writes last wins. The other process's changes disappear.

#### Lock + Merge Pattern

The solution requires re-reading after acquiring the lock. However, there's a subtlety with deletions: `array_merge()` only adds or overwrites keys - it doesn't remove them. When `forget()` removes a property from in-memory storage, that absence won't propagate through the merge.

The solution tracks deletions explicitly:

```php
private array $deleted = [];

public function set(string $class, string $property, $value = null, ?string $context = null)
{
    $this->hydrate($class, $context);

    // Update in-memory storage first
    $this->setStored($class, $property, $value, $context);

    // Clear deletion tracking if this property was previously forgotten
    $key = $class . ($context === null ? '' : '::' . $context);
    unset($this->deleted[$key][$property]);

    // Persist to disk with file locking
    $this->persist($class, $context);
}

public function forget(string $class, string $property, ?string $context = null)
{
    $this->hydrate($class, $context);

    // Delete from local storage
    $this->forgetStored($class, $property, $context);

    // Track this deletion for persist()
    $key = $class . ($context === null ? '' : '::' . $context);
    $this->deleted[$key][$property] = true;

    // Persist to disk with file locking
    $this->persist($class, $context);
}

private function persist(string $class, ?string $context): void
{
    $filePath = $this->getFilePath($class, $context);

    // Open file and acquire exclusive lock (blocks other processes)
    $lockHandle = fopen($filePath, 'c+b');
    flock($lockHandle, LOCK_EX);

    // Critical: clear stat cache BEFORE reading
    clearstatcache(true, $filePath);

    // Read current state (may have been modified since we started)
    $currentData = filesize($filePath) > 0 ? include $filePath : [];

    // Merge current state with our changes
    $ourData = $this->extractDataForContext($class, $context);
    $mergedData = array_merge($currentData, $ourData);

    // Apply deletions (array_merge doesn't remove keys)
    $key = $class . ($context === null ? '' : '::' . $context);
    $toDelete = $this->deleted[$key] ?? [];
    foreach (array_keys($toDelete) as $property) {
        unset($mergedData[$property]);
    }

    // Write merged result
    file_put_contents($filePath, $this->generatePhpFile($mergedData));

    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
}
```

Now Process B's write flow looks like:

1. Acquire lock (waits for Process A to finish)
2. Re-read file (sees Process A's `fromAddress` change)
3. Merge with own changes (`fromName`)
4. Apply any tracked deletions
5. Write the final result

Both changes preserved, and deletions work correctly. The `set()` method clears deletion tracking to handle cases where a property is forgotten and then re-set.

### Challenge #3: The `clearstatcache()` Bug

During testing, I hit a mysterious failure in in one of my tests:

```php
// Process A writes siteName
$settings->set('Example.siteName', 'First');

// Simulate Process B manually modifying file (adds siteEmail)
$data = include $filePath;
$data['siteEmail'] = 'concurrent@example.com';
file_put_contents($filePath, ...);

// Process A writes siteTitle
$settings->set('Example.siteTitle', 'Second');

// Expected: All three properties
// Actual: siteEmail missing!
```

The debug output was confusing:

```
BEFORE fopen: filesize = 250 bytes
AFTER fopen: filesize = 0 bytes  <- Wait, what?
```

**The issue:** PHP's file stat cache. The `fopen('c+b')` mode creates the file if it doesn't exist, returning filesize 0. PHP caches this stat. When I later modified the file externally, `filesize()` still returned the cached 0, so I skipped reading the file content.

The fix is subtle but critical:

```php
flock($lockHandle, LOCK_EX);
clearstatcache(true, $filePath);  // Clear cache after acquiring lock
```

Without this, the merge logic silently uses stale size information and loses data.

### Challenge #4: Future-Proofing the Directory Structure

Looking at `DatabaseHandler`, I noticed it can delete settings by class or context via SQL:

```sql
-- Delete all settings for a class
DELETE FROM settings WHERE class = 'App\\Config\\Email';

-- Delete all settings for a context
DELETE FROM settings WHERE context = 'production';
```

I wanted the same capability eventually, but since `DatabaseHandler` doesn't have an API for it yet, the trick is to design the file structure to allow it later.

#### Why Hash Context Directories?

I initially considered plaintext directory names:

```
writable/settings/production/
```

But contexts can contain *any* characters (they're just strings in `DatabaseHandler`). Filesystem special characters like `/`, `:`, `\` would break. I needed a safe, collision-free mapping.

**Solution:** Hash context names using `xxh128`:

```php
$contextHash = hash('xxh128', $context);
return $this->path . $contextHash . '/' . $className . '.php';
```

Now `production` becomes `9eb667bc447b15815da4c9342efc4c3b`, and `prod/weird:context` becomes `1634c5d2a06947f80d1828f39a5fac50`. All contexts are filesystem-safe, and I can reverse the mapping when needed.

#### Future API Possibilities

This structure enables operations that are not implemented yet in the Settings package, but may be in the future:

```php
// Delete all settings for a class (future API)
public function deleteClass(string $class): void
{
    $className = str_replace('\\', '_', $class);
    unlink($this->path . $className . '.php');  // null context

    foreach (glob($this->path . '*/', GLOB_ONLYDIR) as $dir) {
        unlink($dir . $className . '.php');  // all contexts
    }
}

// Delete all settings for a context (future API)
public function deleteContext(string $context): void
{
    $contextHash = hash('xxh128', $context);
    $this->deleteDirectory($this->path . $contextHash . '/');
}
```

The file structure makes these operations trivial to implement.

### Performance Considerations

#### Why `GLOB_NOSORT`?

In my `flush()` implementation, I delete everything:

```php
foreach (glob($this->path . '*.php', GLOB_NOSORT) as $file) {
    unlink($file);
}
```

The `GLOB_NOSORT` flag skips the alphabetical sort. When you're deleting everything anyway, why waste CPU cycles sorting? Small optimization, but these add up.

#### Why PHP Format Over JSON?

I chose to store settings as PHP files, returning arrays:

```php
<?php

return [
    'fromAddress' => ['value' => 'admin@example.com', 'type' => 'string'],
    'fromName' => ['value' => 'Administrator', 'type' => 'string'],
];
```

Why not JSON? Two reasons:

1. **Opcache** - PHP's opcache can cache compiled PHP files in memory. After the first read, subsequent `include $file` hits are essentially free. JSON files must be read and parsed every time.

2. **Native types** - PHP's `var_export()` preserves type information naturally. JSON requires explicit type preservation logic.

The tradeoff: PHP files are slightly less portable than JSON. For a CodeIgniter 4 package, that's acceptable.

### Lessons Learned

**1. Concurrent programming is subtle**

The `clearstatcache()` bug took real debugging to find. File operations that seem atomic often aren't. Testing concurrent scenarios is essential.

**2. Optimize for the common case**

Separate files per class means writes to different settings files happen in parallel - no blocking. Writes to the same class still block each other, but this only happens when absolutely necessary.

**3. Design for future extensibility**

The hashed directory structure feels over-engineered for current needs. But it costs me nothing now and aligns with `DatabaseHandler` capabilities. Good architecture leaves doors open.
