---
title: "CodeIgniter Markdown Pages"
date: 2023-12-29T12:17:23+01:00
tags: ["markdown", "yaml", "codeigniter4"]
draft: false
---

Markdown Pages project allows you to map Markdown files to collections and easily list or read data from them.

In addition to the Markdown parser, we also have the ability to parse YAML sections, where you can put a lot of useful information.

How to start:

    composer michalsn/codeigniter-markdown-pages

Basic usage:

```php
$markdownPages = service('markdownpages', ROOTPATH . 'pages');

// Get the first directory
$dir = $markdownPages->dirs()->first();

echo $dir->getName()
// prints: Quick Start

echo $dir->getSlug()
// prints: quick-start

foreach($dir->getFiles()->items() as $file) {
    echo $file->getName();
    // prints: Installation

    echo $file->getSlug();
    // prints: installation

    echo $file->getPath();
    // prints: quick-start/installation

    echo $content->parse()->getContent();
    // prints: parsed markdown from file

    echo $content->parse()->getMeta();
    // prints: parsed YAML as key -> value
}
```

This project use [Collection](https://github.com/lonnieezell/myth-collection) class pretty much everywhere so please get familiar with it to use this package comfortably.

The full documentation is available [here](https://michalsn.github.io/codeigniter-markdown-pages/).