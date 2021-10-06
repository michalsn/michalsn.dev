---
title: "CodeIgniter 4 + Mix"
date: 2021-08-23T23:04:33+02:00
tags: ["mix", "codeigniter4"]
draft: false
---

Today we are going to look at configuring CodeIgniter4 in conjunction with [Mix](https://laravel.com/docs/8.x/mix). Mix is one of the components that comes with the Laravel framework.

<!--more-->

The first thing we do is install CodeIgniter 4 using the command:

```
composer create-project codeigniter4/appstarter codeigniter-mix --no-dev
```

Next, we need to add Mix, which is basically an overlay of [webpack](https://webpack.js.org/). Basically, it would be enough to initialize Mix this way:

```
npm init -y
npm install laravel-mix --save-dev
```

But instead, I will provide the contents of the entire **package.json** file:

```
{
    "private": true,
    "scripts": {
        "dev": "npm run development",
        "development": "mix",
        "watch": "mix watch",
        "watch-poll": "mix watch -- --watch-options-poll=1000",
        "hot": "mix watch --hot",
        "prod": "npm run production",
        "production": "mix --production"
    },
    "devDependencies": {
        "axios": "^0.21",
        "laravel-mix": "^6.0.6",
        "lodash": "^4.17.19",
        "postcss": "^8.1.14"
    }
}
```

This file must be initialized via the command:

```
npm install
```

All the necessary components will be installed. All that remains is to create the **webpack.mix.js** file, which will allow us to define the various steps when compiling the JS and CSS files.

```
let mix = require('laravel-mix');

mix.js('resources/js/app.js', 'js')
    .postCss('resources/css/app.css', 'css', [
        //
    ])
    .setPublicPath('public');
```

Now we need to take care of the proper folder structure. In the main directory, where CodeIgniter is located, we create **resources** directory. Our JS and CSS files will be located there - in **js** and **css** directories respectively.

In the **js** directory, we create the **bootstrap.js** file with the following content:

```
window._ = require('lodash');

window.axios = require('axios');

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
```

And then the **app.js** file, with the contents:

```
require('./bootstrap');
```

The whole thing should look more or less like this:

```
/public
  /js
    - app.js
  /css
    - app.css
/resources
  /js
    - app.js
    - bootstrap.js
  /css
    - app.css
```

Now we can compile everything using the command:

```
npx mix
```

or for the production version:

```
npx mix -p
```