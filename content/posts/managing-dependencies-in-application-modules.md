---
title: "Managing Dependencies in Application Modules: What Works for Your Users"
date: 2025-12-16T16:39:11+01:00
draft: false
tags: ["codeigniter4", "modules", "dependencies"]
summary: "How should modules manage their external dependencies? The answer isn't purely technical - it depends on who's installing them. This post explores the real-world trade-offs between Composer-managed, developer-friendly modules and self-contained, user-friendly packages."
---

When you're building a modular system for an application, one question keeps coming up: how should modules handle their external dependencies? It's a question that seems straightforward until you realize that the answer depends entirely on who's installing these modules.

### The Real-World Scenario

Imagine you've built a CodeIgniter application with a module system (maybe [this one](https://github.com/michalsn/codeigniter-module-manager)). You create a blog module that needs to parse Markdown, so you use the excellent `league/commonmark` library. Then someone else builds a documentation module for the same application that also needs Markdown parsing, but they wrote their code six months ago and used an older version of the library.

A user installs both modules into their application. What happens next?

This is where things get interesting. The answer depends on how you've designed your module distribution strategy and who your typical user is.

### When Your Users Are Developers

Let's start with the scenario where you're building modules for technical users who are comfortable with command-line tools and PHP development. In this case, you can leverage Composer the same way WordPress might use it internally or how Drupal manages its module dependencies.

Each module declares what it needs in a `composer.json` file. When someone installs a module into their application, they add that module to their project's dependencies. Composer then resolves everything, finds compatible versions, and manages the installation. The application ends up with a single vendor directory containing all the dependencies from all the modules, with versions that work together.

Here's what this looks like for a blog module:

```json
{
  "require": {
    "league/commonmark": "^2.0"
  }
}
```

The module developer doesn't worry about conflicts because Composer handles version resolution. If the blog module needs version 2.x and the documentation module needs version 2.x as well, Composer finds a version that satisfies both. If they genuinely can't be resolved together, Composer tells the user before anything breaks.

This approach works beautifully for technical users. They're already running Composer commands, they understand version constraints, and they know how to resolve conflicts when they occur. But it falls apart if your user base includes people who just want to install a module through a web interface and have it work immediately.

### When Simplicity Matters More Than Elegance

Now consider a different audience: store owners adding modules to their e-commerce platform, bloggers extending their CMS, or small business owners customizing their application. These users don't know what Composer is, and they shouldn't have to learn.

This is where WordPress's approach makes perfect sense. When you download a WordPress plugin, it includes everything it needs. The plugin developer has already run `composer install`, and the entire vendor directory comes bundled with the plugin ZIP file. You upload it through the WordPress admin interface, activate it, and it just works.

For an application module system, this means the blog module would include its own copy of `league/commonmark` in its distribution package. The documentation module would include its own copy too. Each module is completely self-contained.

The obvious problem here is conflicts. If both modules try to load their own version of the same library, PHP will complain about duplicate class declarations. The solution is namespace scoping, which sounds technical but is conceptually simple: you give each module's dependencies a unique prefix so they can't conflict.

Instead of both modules using `League\CommonMark\CommonMarkConverter`, the blog module uses `BlogModule\Vendor\League\CommonMark\CommonMarkConverter`. Here's what that looks like:

```php
// The blog module uses its own namespaced version
use BlogModule\Vendor\League\CommonMark\CommonMarkConverter;

$converter = new CommonMarkConverter();
$html = $converter->convert($markdown);
```

Tools like [PHP-Scoper](https://github.com/humbug/php-scoper) automate this prefixing process. As a module developer, you build your module, scope its dependencies, and package everything together. The user downloads one ZIP file that contains everything needed to make that module work, with no possibility of conflicting with other modules.

The trade-off is file size and update complexity. Your application might end up with three copies of the same library if three modules use it. Security updates require releasing new versions of each module rather than updating one shared dependency. For non-technical users, though, these trade-offs are worth it for the simplicity of installation.

### Adapting to Your Audience

Some module systems serve both audiences and need a more flexible approach. The module can check whether dependencies already exist in the application before loading its bundled versions. This gives technical users the efficiency of shared dependencies while ensuring non-technical users still get a working module.

The module checks at runtime whether the classes it needs are already available:

```php
// Check if the dependency is already loaded globally
if (! class_exists('League\CommonMark\CommonMarkConverter')) {
    // Load our bundled version if needed
    require_once __DIR__ . '/vendor/autoload.php';
}
```

This approach works well when you have a marketplace that serves different types of users. Developers can install modules through Composer and benefit from centralized dependency management. Others can download pre-packaged modules through the application's admin interface and get the same functionality without any technical knowledge.

### Making the Right Choice for Your Application

The key is understanding how people will actually use your module system. If you're building modules for an internal application used by your development team, Composer-based dependency management makes perfect sense. Everyone knows the tools, and you can enforce standards across your team.

If you're building a marketplace where people download modules through a web interface, bundled dependencies with namespace scoping becomes essential. Your users might not even know what a command line is, and that's fine. They shouldn't have to learn PHP tooling just to add functionality to their application.

For something in between, maybe you're building modules for a SaaS platform where some clients have technical teams and others don't, the hybrid detection approach lets you support both seamlessly. Technical users get the benefits of shared dependency management, while others get the simplicity of pre-packaged modules.

### Real-World Examples

Look at how existing module systems handle this. WordPress chose universal bundling because their user base ranges from developers to bloggers with no technical background. The duplicate dependencies are an acceptable cost for ensuring anyone can install a plugin.

Drupal's module system uses Composer heavily because they're targeting developers building complex, enterprise-level websites. Their users are comfortable with technical tools and appreciate the cleaner dependency management.

PrestaShop's addon marketplace bundles dependencies because their users are merchants running online stores, not developers. The larger file sizes don't matter when weighed against the simplicity of installation.

Each system made the right choice for their users. The question isn't which approach is technically superior, but which approach fits your actual user base.

### The Path Forward

As you design your module system, spend time understanding who will use it. Will modules be installed by developers through command-line tools? Downloaded through a marketplace by non-technical users? Both? The answer should drive your dependency strategy more than any technical consideration.

Once you've made that choice, document it clearly and stick to it consistently. Make sure module developers know exactly what's expected of them. If you require namespace scoping, provide tools and documentation to make it easy. If you expect Composer, make that clear in your module development guide.

The worst outcome isn't choosing the "wrong" approach for edge cases, it's having no clear approach at all. When some modules bundle dependencies and others expect Composer, users end up confused and frustrated. Consistency matters more than perfection.

Ultimately, good dependency management isn't about using the most sophisticated tools or following the most elegant patterns. It's about understanding your users and building something that fits naturally into their workflow. That's what transforms a module system from merely functional into genuinely useful.
