---
title: "Eager and Lazy Loading in CodeIgniter 4"
description: "Learn how to efficiently manage database queries in CodeIgniter 4 using eager and lazy loading techniques."
date: 2024-12-12T10:30:52+01:00
tags: ["model", "codeigniter4", "relations"]
draft: false
---

Efficiently managing database queries is crucial for application performance. To simplify it, I made a nice CodeIgniter 4 library that provides two techniques for loading related data: **eager loading** and **lazy loading**. 

    composer require michalsn/codeigniter-nested-model

These approaches allow developers to fetch related models in an efficient and intuitive way. Here's a comprehensive guide to understanding and using these techniques.

## Eager Loading

Eager loading fetches related data in advance, minimizing the number of database queries. To implement eager loading, you must define the relations between your models.

### Defining Relations

In the following example, we have a `UserModel` with a one-to-one relation to `ProfileModel`. The `HasRelations` trait is used to define these relations.

```php
class UserModel extends Model
{
    use HasRelations;

    public function initialize()
    {
        $this->initRelations();
    }

    public function profile(): Relation
    {
        return $this->hasOne(ProfileModel::class);
    }
}
```

### Fetching Data

To eagerly load data, use the `with()` method and specify the relation:

```php
$users = model(UserModel::class)->with('profile')->findAll();
```

This code performs two queries: one to fetch all users and another to fetch all profiles associated with these users.

### Writing with Relations

Eager loading also supports saving related models. For simple relations like `hasOne` or `hasMany`, you can save the entire object with its relations:

```php
$userModel = model(UserModel::class);
$user      = $userModel->with('profile')->find(1);

$user->profile->favorite_pet = 'Cat';

$userModel->with('profile')->save($user);
```

#### Using Transactions

When saving objects with relations, it's recommended to use the `useTransactions()` method. This ensures that all changes are rolled back if something goes wrong:

```php
$userModel->with('profile')->useTransactions()->save($user);
```

## Lazy Loading

Lazy loading fetches related data only when it is accessed. This requires your model to use an **Entity** as the `$returnType`.

### Defining Relations for Lazy Loading

The setup for lazy loading is similar to eager loading but requires an `Entity` class. The `UserModel` must use the `HasRelations` trait, and the `$returnType` must be set to an entity class:

```php
class UserModel extends Model
{
    use HasRelations;

    protected $returnType = User::class;

    public function initialize()
    {
        $this->initRelations();
    }

    public function profile(): Relation
    {
        return $this->hasOne(ProfileModel::class);
    }
}
```

### Creating the Entity

The entity class must use the `HasLazyRelations` trait:

```php
class User extends Entity
{
    use HasLazyRelations;
}
```

### Fetching Data

With lazy loading, data is retrieved on demand when you access the relation property:

```php
$users = model(UserModel::class)->findAll();
foreach ($users as $user) {
    d($user->profile);
}
```

This approach performs an **n+1 query pattern**: one query to fetch all users and one additional query for each related profile.

## Choosing Between Eager and Lazy Loading

- **Eager Loading**: Best when you know in advance which relations you'll need. Reduces the number of queries by preloading data.
- **Lazy Loading**: Useful when you don't know which relations will be accessed. However, it can lead to multiple queries and potential performance issues.

Both techniques offer flexibility and help optimize database interactions in CodeIgniter 4. By understanding their strengths and appropriate use cases, you can build more efficient and maintainable applications.

For more information, see the project documentation: https://michalsn.github.io/codeigniter-nested-model/

