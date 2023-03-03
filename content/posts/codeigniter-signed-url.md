---
title: "CodeIgniter Signed Url"
date: 2022-12-28T10:11:43+01:00
tags: ["signed-url", "htmx", "codeigniter4"]
draft: false
---

Signing URLs may be very useful when we want to prevent manual URL manipulation or when the given address should have an expiration date. [CodeIgniter Signed URL](https://github.com/michalsn/codeigniter-signed-url) package makes it very easy.

<!--more-->

I have build this library for one particular reason. Some time ago I started experimenting with HTMX and Controlled Cells. These last one will be introduced in CodeIgniter 4.3.

Anyway, I created some really basic counter component. You can find it in the [HTMX demos](https://github.com/michalsn/codeigniter-htmx-demo) repo. And one think bodered me. Setting the starting number for the counter was very easy, but what wasn't so easy was setting a custom number by which the counter would increment. Let's see the example:

```php
<?php

namespace Michalsn\CodeIgniterDemoHtmx\Cells\Counter;

use CodeIgniter\View\Cells\Cell;

class CounterCell extends Cell
{
    public $count = 0;

    /**
     * Increment
     *
     * @return void
     */
    public function increment()
    {
        $this->count++;
        return $this->render();
    }

    /**
     * Decrement
     *
     * @return void
     */
    public function decrement()
    {
        $this->count--;
        return $this->render();
    }
}
```
The view part:
```html
...
    <div class="card-body">
        <div class="input-group">
            <input type="text" class="form-control" value="<?= $count; ?>">
            <button class="btn btn-primary" type="button" 
                    hx-get="<?= site_url('cells/counter/increment?count=' . $count); ?>" 
                    hx-swap="morph:outerHTML" 
                    hx-target="closest .card">
                +
             </button>
            <button class="btn btn-secondary" type="button" 
                    hx-get="<?= site_url('cells/counter/decrement?count=' . $count); ?>" 
                    hx-swap="morph:outerHTML" 
                    hx-target="closest .card">
                -
            </button>
        </div>
    </div>
...
```
And the initial component call, with two separate instances:

```html
...
<div class="row justify-content-md-center mb-3">
    <div class="col-sm-6 col-lg-3">
        <?= view_cell('Michalsn\CodeIgniterDemoHtmx\Cells\Counter\CounterCell'); ?>
    </div>

    <div class="col-sm-6 col-lg-3">
        <?= view_cell('Michalsn\CodeIgniterDemoHtmx\Cells\Counter\CounterCell', ['count' => 5]); ?>
    </div>
</div>
...
```

Your first impression would be probably something like - that's quite easy task. Just add another variable, like `$incrementNumber` and call it a day. Well... yes and no. 

If we leave it just like that, anyone will be able to edit the URL and increment counter by any number. The point is that we don't want users to be able to change the number by which we will increment the counter in an instance. And this is the time when Signed URLs come to the rescue.

Let's edit Controlled Cell first:

```php
<?php

namespace Michalsn\CodeIgniterDemoHtmx\Cells\Counter;

use CodeIgniter\View\Cells\Cell;

class CounterCell extends Cell
{
    public $count = 0;
    public $incrementNumber = 1;

    /**
     * Increment
     *
     * @return void
     */
    public function increment()
    {
        $this->count += $this->incrementNumber;
        return $this->render();
    }

    /**
     * Decrement
     *
     * @return void
     */
    public function decrement()
    {
        $this->count -= $this->incrementNumber;
        return $this->render();
    }
}
```
Now the view part. We will change the way URLs are generated with call to the `signedurl()` helper:
```html
...
    <div class="card-body">
        <div class="input-group">
            <input type="text" class="form-control" value="<?= $count; ?>">
            <button class="btn btn-primary" type="button" 
                    hx-get="<?= signedurl()->siteUrl('cells/counter/increment?count=' . $count . '&incrementNumber=' . $incrementNumber); ?>" 
                    hx-swap="morph:outerHTML" 
                    hx-target="closest .card">
                +
             </button>
            <button class="btn btn-secondary" type="button" 
                    hx-get="<?= signedurl()->siteUrl('cells/counter/decrement?count=' . $count . '&incrementNumber=' . $incrementNumber); ?>" 
                    hx-swap="morph:outerHTML" 
                    hx-target="closest .card">
                -
            </button>
        </div>
    </div>
...
```
And our initial component calls:
```html
...
<div class="row justify-content-md-center mb-3">
    <div class="col-sm-6 col-lg-3">
        <?= view_cell('Michalsn\CodeIgniterDemoHtmx\Cells\Counter\CounterCell'); ?>
    </div>

    <div class="col-sm-6 col-lg-3">
        <?= view_cell('Michalsn\CodeIgniterDemoHtmx\Cells\Counter\CounterCell', ['count' => 5, 'incrementNumber' => 5]); ?>
    </div>
</div>
...
```

Now we can be sure that no one will manipulate the URL, and components will work the way we initailized them. Of course, we also need a Filter to validate signed URLs, but you can read in the [docs](https://michalsn.github.io/codeigniter-signed-url/filters/) on how to use it.