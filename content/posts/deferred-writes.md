---
title: "Deferred Writes: Performance Optimization and Database Gotchas"
date: 2025-11-30T10:34:02+01:00
draft: false
tags: ["codeigniter4", "settings", "database"]
summary: "A look behind the scenes of implementing deferred writes in the CodeIgniter 4 Settings package: how batching write operations improves performance, and the subtle database portability issue caused by NULL values in unique constraints."
---

While contributing to the [CodeIgniter 4 Settings](https://github.com/codeigniter4/settings) package, I implemented one particularly interesting feature: **deferred writes**. This enhancement allows the framework to batch setting updates and commit them only once per request, significantly reducing unnecessary database and file operations. What seemed like a small optimization quickly turned into an interesting deep dive into database portability and edge-case behavior.

### The Performance Problem

Consider a typical request that updates multiple settings:

```php
$settings->set('App.siteName', 'My Awesome Site');
$settings->set('App.siteEmail', 'admin@example.com');
$settings->set('App.maintenance', false);
$settings->set('Email.fromAddress', 'noreply@example.com');
```

With immediate writes (`deferWrites = false`), each `set()` call triggers:

1. One SELECT query to hydrate all settings for that context (cached after first call)
2. One INSERT or UPDATE query to persist the change

**Result:** 1 SELECT + 4 separate INSERT/UPDATE queries

This works, but it's inefficient. We're making individual database round-trips for changes that could be batched together.

### The Solution: Deferred Writes

The concept is simple: instead of writing immediately, queue the changes and flush them all at once at the end of the request:

```php
// In your config/Settings.php
public $database = [
    'class'       => DatabaseHandler::class,
    'table'       => 'settings',
    'deferWrites' => true,  // Enable deferred writes
];
```

Now the same code executes very differently:

```php
$settings->set('App.siteName', 'My Awesome Site');      // Queued
$settings->set('App.siteEmail', 'admin@example.com');   // Queued
$settings->set('App.maintenance', false);               // Queued
$settings->set('Email.fromAddress', 'noreply@example.com');  // Queued

// ... end of request, post_system event triggers ...
// Now: 1 SELECT + 1 batch INSERT + 1 batch UPDATE (for all changes)
```

**Result:** 1 SELECT + 2 batch operations, regardless of how many properties you modify.

This works for both `DatabaseHandler` and `FileHandler`:

- **DatabaseHandler**: Uses `insertBatch()` and `updateBatch()` to minimize queries
- **FileHandler**: Groups changes by class+context and writes each file once

### The Implementation Challenge

The core logic is straightforward—track pending changes in an array and persist them during the `post_system` event:

```php
protected array $pendingProperties = [];

public function set(string $class, string $property, $value, ?string $context)
{
    if ($this->deferWrites) {
        $this->markPending($class, $property, $value, $context);
    } else {
        $this->persist($class, $property, $value, $context);
    }

    $this->setStored($class, $property, $value, $context);
}

protected function markPending(string $class, string $property, $value, ?string $context)
{
    $key = $class . '::' . $property . ($context === null ? '' : '::' . $context);
    $this->pendingProperties[$key] = [
        'class'    => $class,
        'property' => $property,
        'value'    => $value,
        'context'  => $context,
    ];
}
```

At the end of the request, CodeIgniter fires the `post_system` event, which triggers:

```php
Events::on('post_system', [$this, 'persistPendingProperties']);
```

So far, so good. But here's where I hit a wall.

### The Unique Index Problem

My database table schema looked like this:

```sql
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    type VARCHAR(31) DEFAULT 'string',
    context VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

To prevent duplicate settings, I needed a unique constraint on `(class, key, context)`. My first instinct:

```sql
CREATE UNIQUE INDEX idx_unique_setting ON settings (class, key, context);
```

This worked perfectly in SQL Server. But when I tested on MySQL and PostgreSQL, I could insert multiple rows with the same `class` and `key` when `context` was NULL:

```sql
INSERT INTO settings (class, key, context, ...) VALUES ('App\Config', 'siteName', NULL, ...);
INSERT INTO settings (class, key, context, ...) VALUES ('App\Config', 'siteName', NULL, ...);
-- Both succeed! Duplicates created.
```

#### Why Does This Happen?

**TL;DR:** Most databases treat NULL as "unknown", and two unknowns are never equal—even to each other.

Here's the SQL standard behavior:

- **MySQL/MariaDB**: NULL values are not considered equal in unique indexes. Multiple NULLs are allowed.
- **PostgreSQL**: Same behavior: NULL != NULL for unique constraints.
- **SQLite3**: Same behavior.
- **SQL Server (SQLSRV)**: Treats NULLs as equal by default in unique constraints (non-standard).

So my unique index only worked in SQL Server. Everywhere else, it allowed unlimited duplicates when `context` was NULL.

#### The Fix: Application-Level Duplicate Prevention

Since I couldn't rely on database constraints for portability, I moved the duplicate prevention into the application layer. The `persistPendingProperties()` method in `DatabaseHandler` now:

1. **Fetches existing records** that match pending changes
2. **Builds a lookup map** to identify which pending properties already exist
3. **Separates inserts from updates** based on existence
4. **Executes batch operations** for both inserts and updates

Here's the core logic (simplified):

```php
public function persistPendingProperties()
{
    // Separate deletes from upserts
    $deletes = [];
    $upserts = [];

    foreach ($this->pendingProperties as $info) {
        if ($info['delete']) {
            $deletes[] = ['class' => $info['class'], 'key' => $info['property'], 'context' => $info['context']];
        } else {
            $upserts[] = [
                'class'   => $info['class'],
                'key'     => $info['property'],
                'value'   => $this->prepareValue($info['value']),
                'type'    => gettype($info['value']),
                'context' => $info['context'],
            ];
        }
    }

    $this->db->transStart();

    if ($upserts !== []) {
        // Fetch existing records for our pending data
        $this->buildOrWhereConditions($upserts, 'class', 'key', 'context');
        $existing = $this->builder->get()->getResultArray();

        // Build map: composite key => record ID
        $existingMap = [];
        foreach ($existing as $row) {
            $key = $row['class'] . '::' . $row['key'] . ($row['context'] ?? '');
            $existingMap[$key] = $row['id'];
        }

        // Separate into inserts (new) and updates (existing)
        $inserts = [];
        $updates = [];

        foreach ($upserts as $row) {
            $key = $row['class'] . '::' . $row['key'] . ($row['context'] ?? '');

            if (isset($existingMap[$key])) {
                // Already exists - update it
                $updates[] = [
                    'id'    => $existingMap[$key],
                    'value' => $row['value'],
                    'type'  => $row['type'],
                ];
            } else {
                // New record - insert it
                $inserts[] = $row;
            }
        }

        if ($inserts !== []) {
            $this->builder->insertBatch($inserts);
        }

        if ($updates !== []) {
            $this->builder->updateBatch($updates, 'id');
        }
    }

    // Handle deletes
    if ($deletes !== []) {
        $this->buildOrWhereConditions($deletes, 'class', 'key', 'context');
        $this->builder->delete();
    }

    $this->db->transComplete();
    $this->pendingProperties = [];
}
```

This approach:

- **Works across all database engines** (MySQL, PostgreSQL, SQLite, SQL Server)
- **Prevents duplicates reliably** through application logic
- **Maintains batch efficiency** with `insertBatch()` and `updateBatch()`
- **Handles edge cases** like forgetting and then re-setting a property

### FileHandler: A Different Take

Interestingly, the `FileHandler` doesn't face this problem at all. Since files are organized by `class+context` combination:

```
writable/settings/
  ├── App_Config.php                    <- App\Config class, null context
  ├── Email_Config.php                  <- Email\Config class, null context
  └── a1b2c3d4e5f6/                     <- hash('xxh128', 'production')
      ├── App_Config.php
      └── Email_Config.php
```

Each file is self-contained. When persisting changes, the handler:

1. Groups pending properties by `class+context`
2. For each group, acquire an exclusive file lock
3. Reads current data, merges changes, writes back
4. Releases the lock

No database, no NULL behavior quirks. The filesystem naturally enforces uniqueness.

### Lessons Learned

##### 1. Database Portability is Hard

What seems like basic functionality (unique constraints with nullable columns) has surprising edge cases. Always test across multiple database engines when building portable libraries.

##### 2. NULL is Special

SQL's three-valued logic (TRUE, FALSE, UNKNOWN) makes NULL values behave in ways that aren't always intuitive. `NULL != NULL` is one of those SQL quirks that will eventually catch you off guard.

##### 3. Application Logic Can Compensate

When database features aren't portable, moving logic to the application layer can provide consistent behavior. The cost: slightly more complex code. The benefit: it works everywhere.

##### 4. Batch Operations Are Your Friend

Even with the extra SELECT query to identify existing records, batching inserts and updates together is still dramatically faster than individual operations. The performance gains of deferred writes are real.

### Performance Impact

In realistic scenarios (10+ settings updated per request), deferred writes reduce database queries by 70-80%. The overhead of the duplicate-detection SELECT is negligible compared to the savings from batch operations.

For file-based storage, the impact is even more dramatic—one file write instead of 10.

### Tradeoffs

Deferred writes aren't without costs:

- **Write operations won't appear in CodeIgniter's Debug Toolbar** (the `post_system` event runs after toolbar data collection)
- **Early termination loses pending writes** (fatal errors, `exit()`, etc.)
- **Failures are logged, not thrown** (exceptions during `post_system` would disrupt shutdown)

For most applications, these tradeoffs are worth it. If you need immediate persistence guarantees, stick with `deferWrites = false`.

### Try It Yourself

Enable deferred writes in your `app/Config/Settings.php`:

```php
public $database = [
    'class'       => DatabaseHandler::class,
    'table'       => 'settings',
    'deferWrites' => true,
];

// Or for FileHandler
public $file = [
    'class'       => FileHandler::class,
    'path'        => WRITEPATH . 'settings',
    'deferWrites' => true,
];
```

In the end, deferred writes turned out to be a small feature with a big impact. They're portable, fast, and already reducing unnecessary I/O for CI4 applications. 

Hopefully, this breakdown helps anyone who wants to understand the internals or build on the idea further.