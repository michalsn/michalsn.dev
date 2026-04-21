---
title: "Meet Form Requests in CodeIgniter"
date: 2026-04-21T20:03:42+01:00
draft: false
tags: ["codeigniter4", "validation", "forms", "php"]
summary: "Learn how Form Requests in CodeIgniter move validation and input normalization out of controllers with a small, runnable create-post example."
---

Validation code inside controllers often starts small and then slowly takes over the method. A simple `store()` action grows to include rules, custom messages, authorization checks, input normalization, and special handling for web versus JSON requests.

CodeIgniter 4.8 introduces **Form Requests** to keep that logic in one dedicated class. You type-hint the request in your controller, and the framework resolves it, authorizes it, validates it, and injects it before your method body runs.

In this post, we will build a tiny endpoint that creates a blog post entry. It is a realistic example, but still small enough to follow in a few minutes.

### Try Form Requests Today with 4.8-dev

Form Requests are planned for CodeIgniter 4.8, so if you want to test them before the release you should follow the official [Next Minor Version](https://codeigniter.com/user_guide/installation/installing_composer.html#next-minor-version) instructions for the App Starter.

The short version looks like this:

```bash
composer create-project codeigniter4/appstarter ci-formrequest-demo
cd ci-formrequest-demo
php builds next
composer update
php spark serve
```

If you already have an App Starter project, you usually only need the last two framework-switching steps:

```bash
php builds next
composer update
```

After that, you can start using `FormRequest` and the new `make:request` generator.

### The Scenario

Let us create a `POST /posts` endpoint for a simple content admin tool.

We want to:

1. accept a title and body
2. generate a slug automatically from the title
3. reject invalid input
4. insert only validated fields into the database

That is exactly the kind of controller action where Form Requests shine.

### Add the Route

In `app/Config/Routes.php`:

```php
$routes->post('posts', 'Posts::store');
```

### Create the Posts Table

Generate a migration:

```bash
php spark make:migration CreatePosts
```

Then update the generated migration:

```php
<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePosts extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 5,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
            ],
            'slug' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
            ],
            'body' => [
                'type' => 'TEXT',
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('slug');
        $this->forge->createTable('posts');
    }

    public function down(): void
    {
        $this->forge->dropTable('posts');
    }
}
```

Run it:

```bash
php spark migrate
```

### Generate the Form Request

Now generate the request class:

```bash
php spark make:request StorePostRequest
```

Open `app/Requests/StorePostRequest.php` and make it look like this:

```php
<?php

namespace App\Requests;

use CodeIgniter\HTTP\FormRequest;

class StorePostRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => ['required', 'min_length[3]', 'max_length[255]'],
            'slug'  => ['required', 'max_length[255]', 'is_unique[posts.slug]'],
            'body'  => ['required', 'min_length[20]'],
        ];
    }

    protected function prepareForValidation(array $data): array
    {
        helper('url');

        $data['title'] = trim((string) ($data['title'] ?? ''));
        $data['body']  = trim((string) ($data['body'] ?? ''));
        $data['slug']  = url_title($data['title'] ?? '', '-', true);

        return $data;
    }
}
```

There are a few nice things happening here:

- the controller no longer needs to know the validation rules
- the slug is generated before validation, so it can participate in the `is_unique[posts.slug]` rule
- `validated()` will return only the fields covered by `rules()`

That last point is especially useful for create and update endpoints, because accidental extra fields from the client are discarded automatically.

### Form Requests Can Do More Than Validate

The example above focuses on the smallest useful setup, but `FormRequest` can also take care of several other request-level concerns.

You can define custom validation messages:

```php
public function messages(): array
{
    return [
        'title' => [
            'required'   => 'Please enter a title before publishing.',
            'min_length' => 'The title should be at least 3 characters long.',
        ],
    ];
}
```

You can block a request before validation by overriding `isAuthorized()`:

```php
public function isAuthorized(): bool
{
    return auth()->user()->can('posts.create');
}
```

And if you need complete control over failure responses, you can override `failedValidation()` or `failedAuthorization()`. That is especially handy for APIs that should always answer with JSON, even for ordinary browser requests.

There are also extension points such as `validationData()` when you want to customize where validation input comes from, for example when combining query-string values with JSON or POST data.

### Keep the Controller Small

Create `app/Controllers/Posts.php`:

```php
<?php

namespace App\Controllers;

use App\Requests\StorePostRequest;
use CodeIgniter\HTTP\ResponseInterface;

class Posts extends BaseController
{
    public function store(StorePostRequest $request): ResponseInterface
    {
        $data = $request->validated();

        $db = db_connect();
        $db->table('posts')->insert($data);

        return $this->response
            ->setStatusCode(201)
            ->setJSON([
                'id'   => $db->insertID(),
                'post' => $data,
            ]);
    }
}
```

This is the real win. The controller reads like application logic again:

1. get the validated data
2. insert it
3. return the response

No inline validation rules. No manual branching for invalid input. No repeated normalization logic.

### Try It

Send a valid request:

```bash
curl -X POST http://localhost:8080/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "  Form Requests are finally here  ",
    "body": "This post shows how validation can move out of controllers in a clean way.",
    "is_featured": true
  }'
```

You should get a `201 Created` response similar to this:

```json
{
  "id": 1,
  "post": {
    "title": "Form Requests are finally here",
    "slug": "form-requests-are-finally-here",
    "body": "This post shows how validation can move out of controllers in a clean way."
  }
}
```

Notice two things:

- the title and body were trimmed in `prepareForValidation()`
- the extra `is_featured` field was dropped because it was not part of `rules()`

Now try an invalid request:

```bash
curl -X POST http://localhost:8080/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "No",
    "body": "Too short"
  }'
```

Because this is a JSON request, the default FormRequest behavior returns a `422 Unprocessable Entity` response with validation errors:

```json
{
  "errors": {
    "title": "The title field must be at least 3 characters in length.",
    "body": "The body field must be at least 20 characters in length."
  }
}
```

If this were a normal browser form request instead, the default behavior would redirect back with input and validation errors, just like the usual validation flow in CodeIgniter.

### Why This Feels Better Than Controller Validation

Form Requests are not only about moving code around. They also make request handling easier to reason about:

- validation rules live next to request-specific behavior
- normalization happens before validation in one obvious place
- authorization can live in the same class through `isAuthorized()`
- the controller receives a request object that is already safe to use

That combination makes controller methods smaller and easier to test, especially once your app has several create and update endpoints.

### Where to Use It First

If you want to introduce Form Requests gradually, start with endpoints like:

- creating posts, products, or users
- updating profile data
- handling JSON API payloads
- any action where the controller currently begins with a long validation block

These are usually the quickest wins.

### Final Thoughts

Form Requests bring a small but meaningful improvement to everyday CodeIgniter development. They do not replace the validation library. Instead, they give that validation logic a better home.

If you have ever looked at a controller full of validation rules, redirects, and data cleanup and thought "this should live somewhere else", Form Requests are exactly that "somewhere else".

Until CodeIgniter 4.8 is released, you can already experiment with the feature today using the [Next Minor Version](https://codeigniter.com/user_guide/installation/installing_composer.html#next-minor-version) setup.
