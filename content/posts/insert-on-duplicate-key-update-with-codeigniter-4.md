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

```php
// app/Traits/ExtraModelMethods.php
namespace App\Traits;

use CodeIgniter\Database\Exceptions\DataException;
use InvalidArgumentException;
use ReflectionException;
use stdClass;

trait ExtraModelMethods
{
    /**
     * Insert on duplicate key update
     *
     * @param array|object $data Data
     * @param bool $escape Escape
     * @throws ReflectionException
     */
    public function insertOnDuplicateUpdate($data, ?bool $escape = null): bool
    {
        if (! empty($data)) {
            $data = $this->transformAllDataToArray($data, 'update');
        }

        // Validate data before saving.
        if (! $this->skipValidation && ! $this->cleanRules(true)->validate($data)) {
            return false;
        }

        // Must be called first so we don't
        // strip out updated_at values.
        $data = $this->doProtectFields($data);

        // doProtectFields() can further remove elements from
        // $data so we need to check for empty dataset again
        if (empty($data)) {
            throw DataException::forEmptyDataset('update');
        }

        // Set created_at and updated_at with same time
        $date = $this->setDate();

        if ($this->useTimestamps && $this->createdField && ! array_key_exists($this->createdField, $data)) {
            $data[$this->createdField] = $date;
        }

        if ($this->useTimestamps && $this->updatedField) {
            $data[$this->updatedField] = $date;
        }

        $builder = $this->builder();
        $insert  = $builder->set($data, '', $escape)->getCompiledInsert();

        // Remove created_at field in case of update query
        if ($data[$this->createdField]) {
            unset($data[$this->createdField]);
        }
        $update = $builder->set($data, '', $escape)->getCompiledUpdate();
        $update = preg_replace('/UPDATE[\s\S]+? SET /', '', $update);

        // Prepare event
        $eventData = [
            'id'     => $this->getIdValue($data),
            'data'   => $data,
            'result' => $builder->db()->query(sprintf('%s ON DUPLICATE KEY UPDATE %s', $insert, $update)),
        ];

        if ($this->tempAllowCallbacks) {
            $this->trigger('afterUpdate', $eventData);
        }

        $this->tempAllowCallbacks = $this->allowCallbacks;

        return $eventData['result'];
    }

    /**
     * Transform data to array
     *
     * @param array|object|null $data Data
     * @param string            $type Type of data (insert|update)
     *
     * @throws DataException
     * @throws InvalidArgumentException
     * @throws ReflectionException
     */
    protected function transformAllDataToArray($data, string $type): array
    {
        if (! in_array($type, ['insert', 'update'], true)) {
            throw new InvalidArgumentException(sprintf('Invalid type "%s" used upon transforming data to array.', $type));
        }

        if (empty($data)) {
            throw DataException::forEmptyDataset($type);
        }

        // If $data is using a custom class with public or protected
        // properties representing the collection elements, we need to grab
        // them as an array.
        if (is_object($data) && ! $data instanceof stdClass) {
            $data = $this->objectToArray($data, false, true);
        }

        // If it's still a stdClass, go ahead and convert to
        // an array so doProtectFields and other model methods
        // don't have to do special checks.
        if (is_object($data)) {
            $data = (array) $data;
        }

        // If it's still empty here, means $data is no change or is empty object
        if (empty($data)) {
            throw DataException::forEmptyDataset($type);
        }

        return $data;
    }
}
```

To use the new method in our model we just need to import our **Trait** class:

```php
// app/Models/ProfileModel.php
namespace App\Models;

use App\Traits\ExtraModelMethods;
use CodeIgniter\Model;

class ProfileModel extends Model
{
    use ExtraModelMethods;

    protected $table = 'profile_table';
    
    ...

}

```

Let's create an example **migration** file to test this. In console we type:

```cli
php spark make:migration AddProfileTable
```

And then inside our migration file we will create table with the unique identifier.

```php
// app/Database/Migrations/2021-10-15-101102_AddProfileTable.php
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddProfileTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => '11',
                'unsigned'       => true,
                'null'           => false,
                'auto_increment' => true,
            ],
            'user_id' => [
                'type'       => 'INT',
                'constraint' => '11',
                'unsigned'   => true,
                'null'       => false,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => '128',
                'null'       => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('user_id');
        $this->forge->createTable('profile_table');
    }

    public function down()
    {
        $this->forge->dropTable('profile_table');
    }
}
```

Now, we can test it out in our controller. Let's edit **Home** controller by adding new methods:

```php
// app/Controllers/Home.php
namespace App\Controllers;

use App\Models\ProfileModel;

class Home extends BaseController
{
    public function index()
    {
        return view('welcome_message');
    }

    public function add()
    {
        $profileModel = model(ProfileModel::class);

        $profileModel->insertOnDuplicateUpdate([
            'user_id' => 1,
            'name'    => 'James',
        ]);
    }

    public function edit()
    {
        $profileModel = model(ProfileModel::class);

        $profileModel->insertOnDuplicateUpdate([
            'user_id' => 1,
            'name'    => 'Frank',
        ]);
    }
}
```

After calling the **add()** method, we should have an entry in the table with one entry and name "James". After calling the **edit()** method, we should still have one entry in the table, but this time with the name "Frank".

Because the **user_id** column is unique, new data is added only if the value for this column is unique, otherwise the data is updated.