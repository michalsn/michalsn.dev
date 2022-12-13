---
title: "CodeIgniter HTMX"
date: 2022-12-12T09:30:53+01:00
tags: ["htmx", "codeigniter4"]
draft: false
---

[HTMX](https://htmx.org) is gaining in popularity. No wonder, because in a world overflowing with Javascript-based sites that getting more and more complicated to achieve even tiny result, this solution turns out to be a pleasant return to the past - in quite a good way.

<!--more-->

I think we all remember the old days when we wrote in Prototype or jQuery. Back then the option to return HTML chunks was not completely strange. I remember doing it myself - setting various additional options via the data attribute. You usually ended up with one method that tried to do all sorts of requests and update code snippets on the web page depending on the specified container.

It all worked, but was somehow not particularly convenient. Fortunately, someone came up with the idea to make a real library that would handle all (or at least most) of the problems we might encounter. And so HTMX was born.

But let's move on to how we can make it easier to work with HTMX in CodeIgniter. The [CodeIgniter-HTMX](https://github.com/michalsn/codeigniter-htmx) library will help us with this.

The first thing we need to do is install it:

    composer require michalsn/codeigniter-htmx

Now at our disposal are a number of additional methods from the `IncomingRequest`, `Response` and `RedirectResponse` classes. In addition, we can use a new helper `view_fragment()`, which will allow us to display only fragments of the view. The last thing is to facilitate the display of errors, which will now be displayed in the modal window. By default, HTMX does not display errors.

Detailed documentation can be found here: [https://michalsn.github.io/codeigniter-htmx/installation/](https://michalsn.github.io/codeigniter-htmx/installation/)

As a bonus, I also suggest taking a look at the repository with [examples](https://github.com/michalsn/codeigniter-htmx-demo). There you can find several demos that will show you how we can use HTMX when building our application. You will find several examples:

* Books - an example of data displayed in a table with pagination, search, sorting and inline editing.
* Tasks - an example of how we can use events to load content in a slightly more sophisticated way.
* Paraghraphs - an example of sorting content and editing it in a modal window.

It's time to give HTMX a try.