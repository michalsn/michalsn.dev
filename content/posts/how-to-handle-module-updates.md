---
title: "The Skipped Version Problem: How To Handle Module Updates"
date: 2025-12-08T15:20:39+01:00
draft: false
tags: ["codeigniter4", "modules"]
summary: "Updating modules sounds simple - until users skip versions. Suddenly migrations break, tables are missing, and update logic becomes a headache. See how a lightweight UpdateManifest can turn chaotic upgrades into a predictable, controlled process."
---

When you're managing modules in an application, there's a deceptively tricky problem that doesn't reveal itself until your module ecosystem starts to mature. It's the problem of users who don't update frequently.

### The Scenario Nobody Plans For

Let's say you've built a blog module for your application. Version 1.0.0 launches with basic post management. A few months later, you release version 1.1.0 that adds a comments system with new database tables. Then comes version 1.2.0 with categories, requiring more database changes. By version 2.0.0, you've completely restructured how posts are stored to support multiple authors.

Most developers test the happy path: someone installs version 1.0.0, updates to 1.1.0, then to 1.2.0, and finally to 2.0.0. Each update runs its migrations, everything works perfectly.

But reality is messier. A user installs version 1.0.0, uses your module for six months without checking for updates, and then one day decides to update. They jump straight from 1.0.0 to 2.0.0, skipping versions 1.1.0 and 1.2.0 entirely.

What happens to the migrations from those skipped versions?

### The Database Migration Dilemma

Most frameworks handle migrations sequentially. CodeIgniter, Symfony, Laravel, and others maintain a migrations table that tracks which migrations have run. When you tell the system to update, it runs any migrations it hasn't seen before.

The naive approach to module updates is straightforward: just run the module's migrations to the latest version. When our user updates from 1.0.0 to 2.0.0, the system runs all pending migrations for that module. This works, technically, but it creates a subtle problem.

Imagine version 1.1.0 added a `comments` table. Version 1.2.0 added a `categories` table. Version 2.0.0 completely restructured the `posts` table and needed to migrate existing data. The 2.0.0 migration assumes the `comments` and `categories` tables already exist because they should have been created in earlier versions.

If a user upgrades directly from 1.0.0 to 2.0.0, the database migrations themselves will still run in the correct sequence - that part isn't the issue. The real problem appears when a release requires additional work outside of the database changes, such as seeding new data, transforming existing records, updating configuration files, or performing other application-level adjustments.

Those steps often depend on certain migrations having already run, and they may expect the database to be in a particular state. When a user skips several versions, the code responsible for these extra tasks can end up referencing data or structures that don't exist yet in their installation. This is what leads to defensive logic, conditional checks, and increasingly fragile upgrade scripts.

### Version-Aware Updates

I needed a system that understood the relationship between migrations and module versions. This led to the UpdateManifest, a simple mapping between module versions and the migrations that belong to each version. Here's what it looks like:

```php
class UpdateManifest extends BaseUpdateManifest
{
    protected array $migrations = [
        '1.0.0' => [
            '2025-01-15-120000_CreatePostsTable',
        ],
        '1.1.0' => [
            '2025-02-01-100000_CreateCommentsTable',
        ],
        '1.2.0' => [
            '2025-02-15-140000_CreateCategoriesTable',
        ],
        '2.0.0' => [
            '2025-03-01-120000_RestructurePostsTable',
            '2025-03-01-121000_MigrateExistingPosts',
        ],
    ];
}
```

When a user updates from 1.0.0 to 2.0.0, the system looks at this manifest and knows exactly what needs to happen. It processes each version incrementally: first it runs the 1.1.0 migrations, then the 1.2.0 migrations, then finally the 2.0.0 migrations. Each step gets the database into a known state before the next step begins.

This means the 2.0.0 migrations can safely assume that the comments and categories tables exist. They don't need defensive checks because the system guarantees the intermediate steps have run first.

### The Update Flow

When an update runs, the system walks through each version between the current installed version and the target version. For each version along the way, it runs the associated migrations and calls the module's update hook with the version numbers.

Let's say the module has an `onUpdate` method that needs to do some data transformation:

```php
public function onUpdate(string $fromVersion, string $toVersion): void
{
    if (version_compare($fromVersion, '2.0.0', '<') &&
        version_compare($toVersion, '2.0.0', '>=')) {
        $this->migratePostsToNewStructure();
    }
}
```

With the manifest-based approach, this method gets called for each version step. Updating from 1.0.0 to 2.0.0 actually results in three calls:

First, `onUpdate('1.0.0', '1.1.0')` runs after the 1.1.0 migrations complete. Then `onUpdate('1.1.0', '1.2.0')` runs after the 1.2.0 migrations. Finally, `onUpdate('1.2.0', '2.0.0')` runs, and this is where the post migration logic executes because we're crossing the 2.0.0 boundary.

This granularity gives you precise control over when and how data migrations happen, regardless of which versions the user actually installed.

### When Simplicity Wins

The manifest approach isn't always necessary. For simpler modules with straightforward database changes, you might not need it at all. If your module just adds tables and columns without complex data migrations, the standard approach of running all pending migrations works fine.

I designed the system to support both approaches. If a module doesn't include an UpdateManifest, the updater falls back to the simpler method: run all the latest migrations, then call `onUpdate` once with the starting and ending version. This works great for modules that don't need fine-grained control over the update process.

But when you're dealing with complex schema changes or data migrations that depend on specific state, the manifest becomes invaluable. It's particularly useful when version 2.0.0 needs to fundamentally restructure how data is stored, and that restructuring depends on knowing exactly what state the database is in.

### Looking Forward

I've also considered extending the manifest to track other version-specific changes beyond migrations... maybe asset updates? The pattern is flexible enough to accommodate extensions if they prove necessary.

For now, though, the focus remains on what the manifest does best: ensuring database migrations run in the correct order, along the way with any other updates for certain version of the module.

### The Bottom Line

The UpdateManifest is optional complexity that becomes essential at scale. For simple modules, you don't need it. For complex modules with evolving schemas and data migration requirements, it transforms a potential nightmare into a manageable process.

It's the kind of infrastructure that doesn't seem important until you need it, and then you can't imagine working without it.

See the project: https://github.com/michalsn/codeigniter-module-manager
