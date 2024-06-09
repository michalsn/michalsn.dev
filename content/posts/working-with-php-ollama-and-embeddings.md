---
title: "Working with PHP, Ollama and embeddings"
date: 2024-06-09T09:44:19+01:00
tags: ["php", "ollama", "embeddings", "rag"]
draft: false
---

While LLMs, such as the popular GPT family models, are incredibly advanced, they do have their limitations. Primarily, they rely on a static set of knowledge learned during their training phase, which means they might lack specific knowledge on certain topics.

One of the key concepts in working with textual data is embeddings. These are representations of text in a dense vector space, where similar items are mapped to nearby points. This technique effectively captures the semantic meaning of words, phrases, and even larger text structures like sentences and paragraphs.

This is where Retrieval Augmented Generation (RAG) makes a significant difference. RAG combines information retrieval techniques with text generation, enabling AI to create content based on information it finds in a custom database or text collection. This means more accurate and contextually relevant outputs, tailored to the specific needs of users.

Let's create sample code, using Ollama, embedding and PHP:

    composer require codewithkyrian/chromadb-php modelflow-ai/ollama

First we have to seed our data:

```php
<?php

declare(strict_types=1);

use Codewithkyrian\ChromaDB\ChromaDB;
use ModelflowAi\Ollama\Ollama;

require_once __DIR__ . '/vendor/autoload.php';

$chromaDB = ChromaDB::client();
$client = Ollama::client();

$documents = [
    "Llamas are members of the camelid family meaning they're pretty closely related to vicuñas and camels",
    "Llamas were first domesticated and used as pack animals 4,000 to 5,000 years ago in the Peruvian highlands",
    "Llamas can grow as much as 6 feet tall though the average llama between 5 feet 6 inches and 5 feet 9 inches tall",
    "Llamas weigh between 280 and 450 pounds and can carry 25 to 30 percent of their body weight",
    "Llamas are vegetarians and have very efficient digestive systems",
    "Llamas live to be about 20 years old, though some only live for 15 years and others live to be 30 years old",
];

$collection = $chromaDB->createCollection('test-collection');

foreach ($documents as $id => $doc) {
    $response = $client->embeddings()->create([
        'model' => 'mxbai-embed-large',
        'prompt' => $doc,
    ]);

    $collection->add(
        ids: [$id],
        embeddings: [$response->embedding],
        documents: [$doc],
    );
}
```

Now we can use the data as a context for our prompts:

```php
<?php

declare(strict_types=1);

use Codewithkyrian\ChromaDB\ChromaDB;
use ModelflowAi\Ollama\Ollama;

require_once __DIR__ . '/vendor/autoload.php';

$chromaDB = ChromaDB::client();
$client = Ollama::client();

$collection = $chromaDB->getCollection('test-collection');

$prompt = 'What animals are llamas related to?';

$response = $client->embeddings()->create([
    'model' => 'mxbai-embed-large',
    'prompt' => $prompt,
]);

$queryResponse = $collection->query(
    queryEmbeddings: [$response->embedding],
    nResults: 1,
    include: ['documents'],
);

$data = $queryResponse->documents[0][0];

$completionResponse = $client->completion()->create([
    'model' => 'llama2',
    'prompt' => "Using this data: $data. Respond to this prompt: $prompt",
]);

echo 'Prompt: ' . $prompt;
echo '<br><br>';
echo 'Data: ' . $data;
echo '<br><br>';
echo 'Response:';
echo '<br><br>';
echo $completionResponse->response;
```