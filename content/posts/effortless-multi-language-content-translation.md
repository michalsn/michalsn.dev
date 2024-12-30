---
title: "Effortless multi-language content translation in your models"
description: "Simplify handling translatable content in your CodeIgniter 4 projects with the CodeIgniter Translatable library."
date: 2024-12-29T21:32:17+01:00
tags: ["model", "multilanguage", "codeigniter4", "i18n"]
draft: false
---

Are you building a multi-language application with CodeIgniter 4? Managing translations for your models can be a daunting task, but **CodeIgniter Translatable** makes it easy and efficient.

This lightweight library integrates seamlessly with CodeIgniter 4's model system, allowing you to handle translations directly within your models. This library simplifies the process while maintaining the flexibility you need.

## Key Features

- **Simple Setup:** Use generator to prepare basic structure for migrations and models.
- **Dynamic Locale Support:** Automatically load translations based on the current locale.
- **Custom Query Support:** Retrieve translations efficiently with built-in methods.
- **Integration with CodeIgniter Entities:** Works smoothly with CodeIgniter's entity system.

## Configuration

Getting started with **CodeIgniter Translatable** is easy. Here's a quick overview of how to use it:

1. **Install the library:**

```console
composer require michalsn/codeigniter-translatable
```

2.  **Generate skeleton**

```console
php spark translatable:generate articles
```

3. **Define fields for translation**

```php
class ArticleTranslationModel extends Model
{
    protected $table         = 'article_translations';
    protected $primaryKey    = 'id';
    protected $returnType    = 'object';
    protected $allowedFields = ['article_id', 'locale', 'title', 'content'];

    // ...
}
```

4. **Initialize library in the main model**

```php
class ArticleModel extends Model
{
    use HasTranslations;

    protected $table         = 'articles';
    protected $primaryKey    = 'id';
    protected $returnType    = Article::class;
    protected $allowedFields = ['author'];
    protected $useTimestamps = true;

    // ...

    protected function initialize(): void
    {
        $this->initTranslations(ArticleTranslationModel::class);
    }

    // ...
}
```

## Basic usage

This library relies on settings from `Config\App::supportedLocales`. So please remember to set valid locales there.

The data is always gathered based on current locale `service('request')->getLocale();`, so we can simply use entity's `translate()` method, to access current translation.

```php
$article = model(ArticleModel::class)->find(1);
// will print author
echo $article->author;
// will print "en" title
echo $article->translate()->title;
```

We can also get all translations:

```php
$article = model(ArticleModel::class)->withAllTranslations()->find(1);
// will print author
echo $article->author;
// will print "en" title
echo $article->translate()->title;
// will print "en" title
echo $article->translate('en')->title;
// will print "pl" title
echo $article->translate('pl')->title;
```

For more advanced usage, such as fallback translations or saving translations, check out the [documentation](https://michalsn.github.io/codeigniter-translatable/).

## Summary

This library is designed to save you time and effort when managing multi-language content. By abstracting the complexities of translation management, it allows you to focus on building features for your application rather than reinventing the wheel.

If you encounter issues or have feature suggestions, head over to the [GitHub repository](https://github.com/michalsn/codeigniter-translatable).