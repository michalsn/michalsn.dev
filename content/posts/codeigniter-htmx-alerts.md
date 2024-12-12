---
title: "Alerts for htmx and CodeIgniter 4"
meta_description: "Discover how to set up alerts in a CodeIgniter 4 application using htmx and the codeigniter-htmx-alerts library."
date: 2024-09-26T12:35:09+01:00
tags: ["htmx", "codeigniter4", "alerts"]
draft: false
---

In a traditional CodeIgniter 4 application, setting up alerts is quite simple. We can simply write a few lines of code or use a dedicated library like [codeigniter4-alerts](https://github.com/tattersoftware/codeigniter4-alerts).

Things get complicated, however, when we use [htmx](https://htmx.org/) and want the alerts to interact with the way it works. Here a [library](https://github.com/michalsn/codeigniter-htmx-alerts) dedicated to work with htmx can come to the rescue.

## Installation

Installation via composer is very simple:

    composer require michalsn/codeigniter-htmx-alerts

Next, we can add a container in which alerts will be displayed in our view (or main layout).

```php
<?= alerts()->container(); ?>
```

Usually it will be just before the closing `</body>` tag.

## Config

By default, the view files are build to work with [Tabler](https://tabler.io/admin-template) theme. But you can simply change the view files and adjust them to the look you want.

To do so, you have to publish the config file.

    php spark alerts:publish

After this, you can search for the `$views` property array in `app/Config/Alerts.php` file.

## Usage

Setting an alert is simple as this:

```php
alerts()->set('success', 'Success message goes here.');
```

You don't have to worry if you're dealing with htmx request or the traditional one. Alerts will be displayed automatically on the page.