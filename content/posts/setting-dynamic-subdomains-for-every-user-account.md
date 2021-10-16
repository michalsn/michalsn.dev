---
title: "Setting dynamic subdomains for every user account"
date: 2021-10-18T11:42:57+02:00
tags: ["php", "codeigniter4", "subdomain"]
draft: false
---

What if we want every user in our application to have his data served through his own subdomain? I will show you how to do it in CodeIgniter 4 framework.

<!--more-->

The assumptions are as follows - we have 2 domains:
* primary domain on which users will be managed 
* and subdomains, on which the application for each user will run

In short, this is one of the concepts that are often used by SaaS applications.

This can be achieved quite easily. However, when working with CodeIgniter 4 you have to remember that variables defined in **.env** file have priority over all other changes you try to make while the framework is running.

With this in mind - the first thing we will do is to drop the **app.baseURL** variable from the **.env** file so that we can dynamically change this value. This variable is not active by default but you may be used to use it.

First things first - we have to edit the **app/Config/App.php** file and add two variables:

```
    /**
     * --------------------------------------------------------------------------
     * Subdomain URL
     * --------------------------------------------------------------------------
     *
     * Subdomain address for accounts in the system.
     *
     * @var string
     */
    public $subdomainURL = '';

    /**
     * --------------------------------------------------------------------------
     * Account ID
     * --------------------------------------------------------------------------
     *
     * Account ID (or empty string for main domain name).
     * Value '404' means that domain/subdomain is not registered in the system.
     *
     * @var string
     */
    public $accountID = '';
```

We will now override the **subdomainURL** variable in the **.env** file and add our own variable for **baseURL**:

```
baseURL = 'application.test' // yes, this is correct - we don't want to use app.baseURL
app.subdomainURL = '.application.test'
```

If we use separate variables for the primary domain and subdomain address, our system will become more flexible as it will be able to use different domains for subdomains.

The next thing will be to create some form of subdomain creation for each user. I will not go into that here, but I will mention just one thing. It is important to validate subdomain names properly, so that they generate valid URLs.

If you keep the subdomain names in the database, then after each change you will have to update the cache in which you will keep informations about subdomains. Let's make an example model method:

```
public function updateSubdomainCache()
{
    $results   = $this->builder()->select('account_id, subdomain')->get()->getResult();
    $subdomain = config('App')->subdomainURL);
    $data      = [];
    
    foreach ($results as $row) {
        $data[$row->subdomain . $subdomain] = $row->account_id;
    }

    cache()->save('subdomains', $data, 0);
}
```

Now that we have almost everything we need, we can move on to overriding **baseURL** address and make it work for subdomains. We are going to use **Config/Registrar** class which you can read more about [here](https://codeigniter4.github.io/userguide/general/configuration.html?#registrars):

```
namespace App\Config;

class Registrar
{
    public static function App()
    {
        if (! is_cli()) {
            if (! $subdomains = cache('subdomains')) {
                $subdomains = [];
            }

            $subdomains[env('baseURL')] = '';

            if (isset($subdomains[$_SERVER['SERVER_NAME']])) {
                return [
                    'baseURL'   => sprintf('https://%s/', $_SERVER['SERVER_NAME']),
                    'accountID' => $subdomains[$_SERVER['SERVER_NAME']]
                ];
            }
        }

        return [
            'baseURL'   => sprintf('https://%s/', env('baseURL')),
            'accountID' => '404'
        ];
    }
}

```

Finally, we need to define routing. The primary domain and subdomains will be distinguished using the **hostname** resolution trick:

```
// subdomains routes
$routes->group('', [], function ($routes) {
    
});

// main domain routes
$routes->group('', ['hostname' => env('baseURL')], function ($routes) {
    
});
```

This way we set the correct application address and additionally the account ID, which will allow us to form correct queries to the database right away.