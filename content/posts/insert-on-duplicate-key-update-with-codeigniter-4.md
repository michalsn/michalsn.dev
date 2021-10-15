---
title: "INSERT ON DUPLICATE KEY UPDATE with CodeIgniter 4"
date: 2021-10-15T13:10:11+02:00
tags: ["mysql", "mariadb", "sql", "codeigniter4"]
draft: false
---

I recently had to use a query with **INSERT ON DUPLICATE KEY UPDATE**, but CodeIgniter 4 does not have built-in support for this type of query because it is not available in all database drivers.

<!--more-->

To start with a basic question - why not use a query with **REPLACE**? There are several reasons:

* If we are dealing with a table that has a field with **AUTO INCREMENT**, it is then incremented every time.
* If we have some foreign key relations with **ON DELETE CASCADE** option, then this it gonna be a mess, because we will automatically delete data from other tables
* The last reason is the slowness of queries with **REPLACE**. Each time we try to perform **INSERT**, if the data is already there, we perform **DELETE** operation and then another **INSERT**.

The **INSERT ON DUPLICATE KEY UPDATE** query comes to the rescue. It is a remedy for all the above problems.

Okay, let's see how we can add support for this type of query to CodeIgniter 4. We will create a **Trait** class:

```
namespace App\Traits;

trait ExtraModelMethods
{
    /**
     * Insert on duplicate key update
     *
     * @param int|string   $id     Unique key
     * @param array|object $data   Data
     * @param bool         $escape Escape
     *
     * @return bool
     */
    public function insertOnDuplicateUpdate($id, $data, bool $escape = null): bool
    {
        $data = $this->transformDataToArray($data, 'update');

        $builder = $this->builder();
        $update  = $builder->set($data, '', $escape)->getCompiledUpdate(false);
        $insert  = $builder->set($this->primaryKey, $id, $escape)->getCompiledInsert();

        $update = preg_replace('/UPDATE[\s\S]+? SET /', '', $update);
        return $builder->db()->query(sprintf('%s ON DUPLICATE KEY UPDATE %s', $insert, $update));
    }
}
```

To use the new method in our model we just need to import our **Trait** class:

```
use App\Traits\ExtraModelMethods;
use CodeIgniter\Model;

class ExampleModel extends Model
{
    use ExtraModelMethods;
}

```