---
title: "Event-Aware Pagination in CodeIgniter 4 Models"
date: 2025-07-14T17:45:17+01:00
draft: false
tags: ["codeigniter4", "model-events", "pagination"]
summary: "Discover why your CodeIgniter 4 pagination shows incorrect total counts when using model events, and implement a simple fix that ensures consistent filtering across both count and result queries."
---

If you've ever used CodeIgniter 4's model events with pagination and noticed that your total count doesn't match your filtered results, you're not alone. There's a subtle but significant issue in how the framework handles model events during pagination that can lead to confusing and incorrect behavior.

### The Problem

CodeIgniter 4's model events, particularly `beforeFind`, are powerful tools for automatically applying filters, scopes, or modifications to your database queries. However, when using pagination, these events create an inconsistency problem.

Consider this common scenario: you have a model with a `beforeFind` event that filters records based on user permissions or status. When you call `paginate()`, the framework performs two separate operations:

1. **Count Query**: `countAllResults()` is called to determine the total number of records
2. **Data Query**: `findAll()` is called to retrieve the actual paginated results

The critical issue is that model events are only triggered for the second operation. The `countAllResults()` method executes independently, without any of your `beforeFind` event modifications applied. This means your total count includes records that won't appear in your results, leading to incorrect pagination metadata.

For example, if you have 100 total records but your `beforeFind` event filters them down to 30 active records, the pagination will show "100 total records" while only displaying the 30 filtered ones. This creates confusion for users and can break pagination controls.

### The Solution

To fix this, we have to ensure that model events are triggered before the count operation, maintaining consistency between the total count and the actual results. Here's our enhanced pagination method:

```php
public function paginate(?int $perPage = null, string $group = 'default', ?int $page = null, int $segment = 0)
{
    // Since multiple models may use the Pager, the Pager must be shared.
    $pager = service('pager');

    if ($segment !== 0) {
        $pager->setSegment($segment, $group);
    }

    $page = $page >= 1 ? $page : $pager->getCurrentPage($group);

    // Get the tempPager to estimate required variables, use dummy count of 1
    $tempPager = $pager->store($group, $page, $perPage, 1, $segment);
    $perPage   = $tempPager->getPerPage($group);
    $offset    = ($page - 1) * $perPage;

    if ($this->tempAllowCallbacks) {
        // Call the before event and check for a return
        $eventData = $this->trigger('beforeFind', [
            'method'    => 'findAll',
            'limit'     => $perPage,
            'offset'    => $offset,
            'singleton' => false,
        ]);

        if (isset($eventData['returnData']) && $eventData['returnData'] === true) {
            return $eventData['data'];
        }
    }

    // Store it in the Pager library, so it can be paginated in the views.
    $this->pager = $pager->store($group, $page, $perPage, $this->countAllResults(false), $segment);
    $perPage     = $this->pager->getPerPage($group);
    $offset      = ($pager->getCurrentPage($group) - 1) * $perPage;

    // Backup since it will be reset in the findAll method
    $tempAllowCallbacks = $this->tempAllowCallbacks;

    $data = $this->allowCallbacks(false)->findAll($perPage, $offset);

    if ($tempAllowCallbacks) {
        $eventData = $this->trigger('afterFind', [
            'data'      => $data,
            'limit'     => $perPage,
            'offset'    => $offset,
            'method'    => 'findAll',
            'singleton' => false,
        ]);

        return $eventData['data'];
    }

    return $data;
}
```

### How It Works

The solution addresses the core issue by triggering `beforeFind` events before calling `countAllResults()`. Here's the key insight: we use a temporary pager instance with a dummy total count of 1 to determine the actual `perPage` and `offset` values that will be used. This allows us to trigger the `beforeFind` event with accurate pagination parameters.

Once the events are triggered and any query modifications are applied, we call `countAllResults()` to get the correct count that reflects the filtered data. Then we disable callbacks temporarily and call `findAll()` to avoid duplicate event execution, manually triggering `afterFind` events if needed.

### Implementation as a Trait

To make this solution easily reusable across your models, you can implement it as a trait:

```php
<?php

namespace App\Models\Traits;

trait EventAwarePagination
{
    public function paginate(?int $perPage = null, string $group = 'default', ?int $page = null, int $segment = 0)
    {
        // ... the enhanced pagination method above
    }
}
```

Then use it in your models:

```php
<?php

namespace App\Models;

use CodeIgniter\Model;
use App\Models\Traits\EventAwarePagination;

class UserModel extends Model
{
    use EventAwarePagination;
    
    protected $table = 'users';
    protected $beforeFind = ['filterActiveUsers'];
    
    protected function filterActiveUsers(array $data)
    {
        $this->where('status', 'active');
        
        return $data;
    }
}
```

### Backward Compatibility

Models without events will behave exactly as before, while models with events will now work "correctly". The fix only affects the execution order and ensures events are properly applied to both count and data queries.

### Conclusion

This solution is elegant, maintains backward compatibility, and can be easily applied to existing codebases through a simple trait implementation.

If you're using model events with pagination in CodeIgniter 4, implementing this fix will ensure your users see consistent and accurate pagination data, improving both the reliability and user experience of your application.