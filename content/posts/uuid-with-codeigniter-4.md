---
title: "UUID with CodeIgniter 4"
date: 2021-04-24T18:24:51+02:00
tags: ["uuid", "codeigniter4"]
draft: false
---

Up until now, working with UUIDs and CodeIgniter 4 hasn't been much fun, but that has now changed with the [codeigniter4-uuid](https://github.com/michalsn/codeigniter4-uuid) library.

<!--more-->

Admittedly, working with UUID was not a big challenge when we were working with the Model class, but in order to do it "nicely", we had to use [Model Events](https://codeigniter4.github.io/userguide/models/model.html#model-events). Everything would be fine until our application itself would not need to use Model Events. Then it would be a mess, because we would have to add UUID support to our existing Events code.

That is why a special library was created, which extends Model class and gives possibility to work with UUID. No matter if we want to store identifiers as text or bytes - everything is handled automatically.

Installation via composer:

```
composer require michalsn/codeigniter4-uuid
```

Then the only change we need to make is in the Model:

```
<?php

namespace App\Models;

use Michalsn\Uuid\UuidModel;

class MyModel extends UuidModel
{
    ...
}
```

This is enough to use UUIDs automatically for the primary key.
