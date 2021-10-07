---
title: "CodeIgniter 4 + Mix with versioning"
date: 2021-08-25T21:05:40+02:00
tags: ["mix", "codeigniter4"]
draft: false
---

Last time I showed you how to easily integrate Mix with CodeIgniter 4. This time we'll complete the integration process by implementing a helper which will make using versioned assets very convenient and easy.

<!--more-->

Why do we even need this helper? Mix can generate versioned versions of files. In short, it does this by adding a special string to the file name, as a query string. This string is the checksum for the file. If it changes, it tells the browser that it needs to download the resource again, not use the cache.

We need to create a file **mix_helper.php** in **app/helpers/** directory:

```
if (! function_exists('mix')) {
    /**
     * Get the path to a versioned Mix file.
     *
     * @param string $path
     * @param string $manifestDirectory
     *
     * @return string
     *
     * @throws Exception
     */
    function mix(string $path, string $manifestDirectory = ''): string
    {
        static $manifests = [];

        $publicPath = ROOTPATH . 'public';

        if ($path[0] !== '/') {
            $path = "/{$path}";
        }

        if ($manifestDirectory && $manifestDirectory[0] !== '/') {
            $manifestDirectory = "/{$manifestDirectory}";
        }

        if (is_file($publicPath . $manifestDirectory . '/hot')) {
            $url = rtrim(file_get_contents($publicPath . $manifestDirectory . '/hot'));

            $customUrl = config('Mix')->hotProxyUrl;

            if (! empty($customUrl)) {
                return $customUrl . $path;
            }

            if (strpos($url , 'http://') === 0 || strpos($url , 'https://') === 0) {
                return explode(':', $url, 2)[1] . $path;
            }

            return "//localhost:8080{$path}";
        }

        $manifestPath = $publicPath . $manifestDirectory . '/mix-manifest.json';

        if (! isset($manifests[$manifestPath])) {
            if (! is_file($manifestPath)) {
                throw new Exception('The Mix manifest does not exist.');
            }

            $manifests[$manifestPath] = json_decode(file_get_contents($manifestPath), true);
        }

        $manifest = $manifests[$manifestPath];

        if (! isset($manifest[$path])) {
            $exception = new Exception("Unable to locate Mix file: {$path}.");

            if (! CI_DEBUG) {
                return $path;
            } else {
                throw $exception;
            }
        }

        return config('Mix')->url . $manifestDirectory . $manifest[$path];
    }
}
```

Next, we create the **Mix.php** configuration file in the **app/config/** directory:

```
<?php
namespace Config;

use CodeIgniter\Config\BaseConfig;

class Mix extends BaseConfig
{
    /**
     * Url for CDN.
     * Leave empty if using local files.
     *
     * @var string
     */
    public $url = '';

    /**
     * Hot reload Url.
     * Leave empty for default localhost:8080.
     *
     * @var string
     */
    public $hotProxyUrl = '';
}
```

There is a good chance that you won't need to change anything in the configuration file, because you will only be using local resources, but you can change a few settings if you need to.

How to use this helper? It's very simple - just enter an *ordinary* file name and helper will add appropriate query string, based on **mix-manifest.json** file generated during asset compilation.

This is what our asset configuration file will look like (**webpack.mix.js**):

```
let mix = require('laravel-mix');

mix.js('resources/js/app.js', 'js')
    .postCss('resources/css/app.css', 'css')
    .version()
    .setPublicPath('public');
```
And in our view we will apply a helper: 
```
<link href="<?= mix('/css/app.css'); ?>" rel="stylesheet">
```

This will get a link similar to this one:

```
<link href="/css/app.css?id=a8b3deb4b7d26dcf51d2" rel="stylesheet">
```
The same for JS files. Without the helper we would have to manually rename the versioned files every time.
