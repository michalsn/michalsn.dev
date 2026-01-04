---
title: "Advanced Model Relations for CodeIgniter 4"
date: 2026-01-03T17:08:27+01:00
draft: false
tags: ["codeigniter4", "php", "database", "performance"]
summary: "Learn how to efficiently manage database relationships in CodeIgniter 4 with eager loading, lazy loading, and advanced relation patterns."
---

CodeIgniter 4 provides a robust Query Builder and Model system that makes working with databases straightforward and enjoyable. But when your application grows and you need to work with related data across multiple tables, you'll quickly run into two problems: repetitive code and performance bottlenecks.

Let me show you how to solve both.

### The N+1 Query Problem

Consider a simple blog application where you need to display users and their posts. Here's the typical approach:

```php
$users = $userModel->findAll(); // 1 query

foreach ($users as $user) {
    // This executes a query for EACH user
    $user->posts = $postModel->where('user_id', $user->id)->findAll(); // +N queries
}
```

If you have 100 users, this code executes **101 queries** - one to fetch users, then one additional query for each user's posts. This is the infamous N+1 query problem, and it can cripple your application's performance.

We can do better.

### Introducing Relations

What if you could write this instead?

```php
$users = $userModel->with('posts')->findAll(); // Just 2 queries!
```

This eager loads all users and their posts in exactly **2 queries** - one for users, one for all related posts - regardless of how many users you have. That's a 50x performance improvement for 100 users, and the gains only increase as your data grows.

This is possible with the **codeigniter-relations** package, which brings elegant relation management to CodeIgniter 4.

### Getting Started

First, install the package via Composer:

```bash
composer require michalsn/codeigniter-relations
```

Now let's build a simple blog system to see how relations work in practice.

### Setting Up Models and Entities

To use relations, you need two components:

1. **Models** with the `HasRelations` trait (for eager loading)
2. **Entities** with the `HasLazyRelations` trait (for lazy loading)

#### Setting Up the Model

First, add the trait to your User model:

```php
<?php

namespace App\Models;

use App\Entities\User;
use CodeIgniter\Model;
use Michalsn\CodeIgniterRelations\Traits\HasRelations;
use Michalsn\CodeIgniterRelations\Relations\HasMany;

class UserModel extends Model
{
    use HasRelations;

    protected $table      = 'users';
    protected $primaryKey = 'id';
    protected $returnType = User::class;

    public function posts(): HasMany
    {
        return $this->hasMany(PostModel::class);
        // Assumes posts.user_id by default
        // For custom foreign keys: return $this->hasMany(PostModel::class, 'author_id');
    }
}
```

#### Setting Up the Entity

For lazy loading to work, your entity needs the `HasLazyRelations` trait:

```php
<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;
use Michalsn\CodeIgniterRelations\Traits\HasLazyRelations;

class User extends Entity
{
    use HasLazyRelations;

    protected $datamap = [];
    protected $dates   = ['created_at', 'updated_at'];
    protected $casts   = [];
}
```

**Important:** Without the entity trait, lazy loading (like `$user->posts()`) won't work. Eager loading (like `$userModel->with('posts')`) only requires the model trait.

### Using Relations

#### Eager Loading

Load users with their posts in a single operation:

```php
$users = $userModel->with('posts')->findAll();

foreach ($users as $user) {
    echo $user->name . " has written " . count($user->posts) . " posts<br>";

    foreach ($user->posts as $post) {
        echo "- " . $post->title . "<br>";
    }
}
```

Behind the scenes, this executes exactly **2 queries** regardless of how many users you have.

#### Lazy Loading (Requires Entity)

Sometimes you don't need the related data upfront. You can load it on demand:

```php
$user = $userModel->find(1); // Returns User entity

// Load posts only when needed
$posts = $user->posts(); // Calls the relation method

foreach ($posts as $post) {
    echo $post->title;
}
```

**Note:** This only works if your model returns entities (not arrays or objects) and the entity has the `HasLazyRelations` trait.

#### Nested Relations

Need to go deeper? Load posts with their comments:

```php
$users = $userModel->with('posts.comments')->findAll();

foreach ($users as $user) {
    foreach ($user->posts as $post) {
        echo $post->title . " (" . count($post->comments) . " comments)<br>";

        foreach ($post->comments as $comment) {
            echo "  - " . $comment->content . "<br>";
        }
    }
}
```

This still uses just **3 optimized queries** instead of hundreds.

### Relation Types

The package supports all common relation types. Let's explore each one.

#### One-to-One (HasOne / BelongsTo)

A user has one profile:

```php
// UserModel
public function profile(): HasOne
{
    return $this->hasOne(ProfileModel::class);
}

// ProfileModel
public function user(): BelongsTo
{
    return $this->belongsTo(UserModel::class);
}

// Usage - Eager loading
$user = $userModel->with('profile')->find(1);
echo $user->profile->bio;

// Usage - Lazy loading (from entity)
$user = $userModel->find(1);
$profile = $user->profile(); // Calls relation
echo $profile->bio;
```

#### One-to-Many (HasMany / BelongsTo)

We've already seen this - a user has many posts:

```php
// UserModel
public function posts(): HasMany
{
    return $this->hasMany(PostModel::class);
}

// PostModel
public function user(): BelongsTo
{
    return $this->belongsTo(UserModel::class);
}
```

#### Many-to-Many (BelongsToMany)

Students and courses - students can enroll in many courses, and courses have many students:

```php
// StudentModel
public function courses(): BelongsToMany
{
    return $this->belongsToMany(
        CourseModel::class,
        'course_student', // pivot table
        'student_id',     // foreign key for student
        'course_id'       // foreign key for course
    );
}

// Usage - Eager loading
$student = $studentModel->with('courses')->find(1);

// Usage - Working with the relationship (requires entity)
$student = $studentModel->find(1);

// Attach courses
$student->courses()->attach([1, 2, 3]);

// Sync courses (detach missing, attach new)
$student->courses()->sync([2, 3, 4]);

// Detach specific courses
$student->courses()->detach([1]);
```

#### Working with Pivot Data

Need to store additional data in your pivot table? Easy:

```php
public function courses(): BelongsToMany
{
    return $this->belongsToMany(CourseModel::class)
        ->withPivot(['grade', 'enrolled_at'])
        ->withTimestamps();
}

// Access pivot data
foreach ($student->courses as $course) {
    echo $course->title . " - Grade: " . $course->pivot->grade;
}

// Attach with pivot data (from entity)
$student->courses()->attach(1, ['grade' => 'A', 'enrolled_at' => '2024-01-15']);
```

#### Polymorphic Relations

Share a single comments table across multiple models:

```php
// Comment belongs to either Post or Video
// Table structure: id, commentable_type, commentable_id, content, created_at, etc.
class CommentModel extends Model
{
    use HasRelations;

    protected $returnType = \App\Entities\Comment::class;

    public function commentable(): MorphTo
    {
        return $this->morphTo();
    }
}

// Posts have many comments
class PostModel extends Model
{
    use HasRelations;

    protected $returnType = \App\Entities\Post::class;

    public function comments(): MorphMany
    {
        return $this->morphMany(CommentModel::class, 'commentable');
    }
}

// Videos also have many comments
class VideoModel extends Model
{
    use HasRelations;

    protected $returnType = \App\Entities\Video::class;

    public function comments(): MorphMany
    {
        return $this->morphMany(CommentModel::class, 'commentable');
    }
}

// Usage - Eager loading
$post = $postModel->with('comments')->find(1);
$video = $videoModel->with('comments')->find(1);

// Usage - Lazy loading (from entity)
$post = $postModel->find(1);
$comments = $post->comments();
```

#### Through Relations

Access distant relationships through intermediate models. For example, get all posts from a country through users:

```php
// CountryModel
// Relationship chain: Country → Users → Posts
// (users.country_id references countries.id, posts.user_id references users.id)
public function posts(): HasManyThrough
{
    return $this->hasManyThrough(
        PostModel::class,  // final model
        UserModel::class   // intermediate model
    );
}

// Usage
$country = $countryModel->with('posts')->find(1);
// Gets all posts by users in this country
```

### Writing Related Data

Relations aren't just for reading - you can create and update related records too. These methods require entities with the `HasLazyRelations` trait.

#### Creating Related Records

```php
$user = $userModel->find(1); // Returns entity

// Create a new post for this user
$post = $user->posts()->save([
    'title' => 'My New Post',
    'content' => 'This is the content...',
]);

// Create multiple posts
$user->posts()->saveMany([
    ['title' => 'Post 1', 'content' => '...'],
    ['title' => 'Post 2', 'content' => '...'],
]);
```

#### Updating Related Records

```php
// Update existing post
$user->posts()->save([
    'id' => 5,
    'title' => 'Updated Title',
    'content' => 'Updated content...',
]);
```

#### Association Methods

For BelongsTo relations, you can associate and dissociate:

```php
$post = $postModel->find(1); // Returns entity

// Associate post with a user (saves automatically)
$post->user()->associate($user);

// Or just pass the ID
$post->user()->associate(5);

// Remove the association (saves automatically)
$post->user()->dissociate();
```

### Advanced Features

#### Query Constraints

Add custom conditions to your relations:

```php
public function publishedPosts(): HasMany
{
    return $this->hasMany(PostModel::class, function($query) {
        $query->where('status', 'published')
              ->orderBy('published_at', 'DESC');
    });
}

$user = $userModel->with('publishedPosts')->find(1);
```

#### "Of Many" Relations

Get the latest, oldest, or specific related record:

```php
public function latestPost(): HasOne
{
    return $this->hasOne(PostModel::class)->ofMany('created_at', OrderType::MAX);
}

public function oldestPost(): HasOne
{
    return $this->hasOne(PostModel::class)->ofMany('created_at', OrderType::MIN);
}

public function mostPopularPost(): HasOne
{
    return $this->hasOne(PostModel::class)->ofMany('views', OrderType::MAX);
}
```

#### Per-Parent Limiting

Limit results per parent when eager loading:

```php
// Get 5 latest posts per user
$users = $userModel->with('posts', function($query) {
    $query->orderBy('created_at', 'DESC')->limit(5);
})->findAll();
```

### Real-World Example: Building a Forum

Let's put it all together with a simple forum structure:

```php
// User has many threads and posts
class UserModel extends Model
{
    use HasRelations;

    protected $returnType = \App\Entities\User::class;

    public function threads(): HasMany
    {
        return $this->hasMany(ThreadModel::class);
    }

    public function posts(): HasMany
    {
        return $this->hasMany(PostModel::class);
    }
}

// Thread belongs to user, has many posts
class ThreadModel extends Model
{
    use HasRelations;

    protected $returnType = \App\Entities\Thread::class;

    public function user(): BelongsTo
    {
        return $this->belongsTo(UserModel::class);
    }

    public function posts(): HasMany
    {
        return $this->hasMany(PostModel::class);
    }

    public function latestPost(): HasOne
    {
        return $this->hasOne(PostModel::class)->ofMany('created_at', OrderType::MAX);
    }
}

// Post belongs to user and thread
class PostModel extends Model
{
    use HasRelations;

    protected $returnType = \App\Entities\Post::class;

    public function user(): BelongsTo
    {
        return $this->belongsTo(UserModel::class);
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(ThreadModel::class);
    }
}

// Entities need the HasLazyRelations trait
class User extends Entity
{
    use HasLazyRelations;
}

class Thread extends Entity
{
    use HasLazyRelations;
}

class Post extends Entity
{
    use HasLazyRelations;
}

// Display forum index with optimized queries
$threads = $threadModel
    ->with('user')
    ->with('latestPost.user')
    ->orderBy('updated_at', 'DESC')
    ->findAll();

foreach ($threads as $thread) {
    echo $thread->title . " by " . $thread->user->name . "<br>";
    echo "Latest: " . $thread->latestPost->content;
    echo " by " . $thread->latestPost->user->name . "<br><br>";
}
```

This loads everything in just **4 queries** instead of potentially hundreds.

### Quick Reference: When to Use Each Trait

| Component | Trait | Purpose | Required For |
|-----------|-------|---------|--------------|
| **Model** | `HasRelations` | Define relations and enable eager loading | `with()`, relation definitions |
| **Entity** | `HasLazyRelations` | Enable lazy loading and write operations | `$entity->relation()`, `save()`, `attach()`, etc. |

**Remember:**
- Eager loading only needs the model trait
- Lazy loading and write operations require both traits
- Entities must be the model's return type for lazy loading to work

### Conclusion

Managing related data doesn't have to be complicated or slow. With proper relation management, you can write cleaner code that performs better and is easier to maintain.

Whether you're building a blog, e-commerce site, or complex application, relations will help you work with your data more efficiently. Give it a try in your next CodeIgniter 4 project!

Full documentation with more examples is available in the [GitHub repository](https://github.com/michalsn/codeigniter-relations).