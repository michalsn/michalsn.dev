---
title: "CodeIgniter Tags"
date: 2023-09-28T09:31:27+01:00
tags: ["tags", "codeigniter4"]
draft: false
---

Tags provide a way to organize content and improve the user's experience by helping them discover related articles and navigate through a website's content more efficiently. They are particularly useful in content-heavy websites or blogs where there's a wide range of topics and subjects covered.
This blog also uses tags system. These tags help categorize and organize content to make it more accessible and searchable.

Since there was no tags library for CodeIgniter 4, I decided to write one. The [codeigniter-tags](https://github.com/michalsn/codeigniter-tags) is designed to work with many content types at once, so we can use it in many models.

Installation via composer is very simple:

    composer require michalsn/codeigniter-tags

After that just need to migrate our database:

    php spark migrate --all

Now the only thing left is to initialize the library in our model:

```php
class ExampleModel extends BaseModel
{
    use HasTags;

    // ...

    protected function initialize()
    {
        $this->initTags();
    }

    // ...
}
```

We use `HasTags` trait and `$this->initTags()` to initialize tags.

Now we have a handy way add tags to our entry, just by specifying them as a string or array:

```php
model(ExampleModel::class)->save([
    'id'   => 1,
    // this is our field with tags
    // we can also set it as an array: ['tag1', 'tag2']
    'tags' => 'tag1,tag2',
]);
```

We can also get the entries with tags assigned to them:

```php
model(ExampleModel::class)->withTags()->findAll();
```

For more detailed info, you can see the [docs](https://michalsn.github.io/codeigniter-tags/).