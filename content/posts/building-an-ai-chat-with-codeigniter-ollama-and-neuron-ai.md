---
title: "Building an AI Chat with CodeIgniter, Ollama, and Neuron AI"
date: 2026-02-12T19:55:21+01:00
draft: false
tags: ["codeigniter4", "php", "ai", "ollama", "neuronai", "sse", "streaming"]
summary: "Learn how to build a modern AI-powered chat application with CodeIgniter 4, featuring real-time SSE streaming, persistent conversation history, and function calling capabilities."
---

AI capabilities are no longer a luxury feature - they are increasingly expected in modern web applications. As frameworks across the ecosystem rush to integrate LLM functionality (Laravel introduced Laravel AI, Python has LangChain, JavaScript has Vercel AI SDK), it is easy to assume you need to switch stacks to build AI-powered features. You do not.

CodeIgniter 4 can build the same modern, AI-driven applications as any other framework. Large language models are impressive, but wiring one into a real web application - with streaming, conversation memory, and tool usage - takes more than a single API call. In this article we build exactly that: a chat interface powered by a local LLM, starting from the simplest possible request/response and layering on complexity one phase at a time. The result is a fully functional AI chat application in PHP with CodeIgniter 4.

The stack:

- **[Ollama](https://ollama.com/)** - a local LLM server. Install it, pull a model (`ollama pull qwen3:1.7b`), and you have an OpenAI-compatible API running on `localhost:11434`. No API keys, no cloud bills.
- **[Neuron AI](https://neuronai.dev/)** - a PHP library for building AI agents. It is framework-agnostic and handles provider abstraction, streaming, chat history, and tool calling. Think of it as the glue between your application and the LLM.
- **[CodeIgniter 4.8-dev](https://codeigniter.com/user_guide/installation/installing_composer.html#next-minor-version)** - specifically its new `SSEResponse` class, which makes Server-Sent Events a first-class response type. We will treat it as a black box in this article: you return it from a controller and it handles headers, output buffering, and flushing.

By the end we will have: JSON responses, real-time SSE streaming, persistent chat history, and function calling.

## Phase 1: Simple Request/Response

### The Agent

Every Neuron AI integration starts with an agent class. An agent defines three things: which LLM provider to use, what system instructions the model receives, and (optionally) what tools it can call. Here is the minimal version:

```php
<?php

namespace App\Neuron;

use NeuronAI\Agent;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\Providers\Ollama\Ollama;

class MyAgent extends Agent
{
    protected function provider(): AIProviderInterface
    {
        return new Ollama(
            url: 'http://localhost:11434/api/',
            model: 'qwen3:1.7b',
        );
    }

    public function instructions(): string
    {
        return 'You are a friendly AI assistant.';
    }
}
```

`Ollama` is one of several providers Neuron AI supports (OpenAI, Anthropic, etc.). The interface is identical regardless of which one you pick.

### The Controller

The controller receives a message, passes it to the agent, and returns JSON:

```php
use App\Neuron\MyAgent;
use NeuronAI\Chat\Messages\UserMessage;

public function send()
{
    $userMessage = $this->request->getJsonVar('message');

    $response = MyAgent::make()->chat(
        new UserMessage($userMessage),
    );

    return $this->response->setJSON([
        'reply' => $response->getContent(),
    ]);
}
```

`MyAgent::make()` instantiates the agent with all its configured defaults. `chat()` sends the message and blocks until the full response is available.

### The Frontend

A minimal fetch call:

```javascript
const res = await fetch('/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: input.value }),
});
const data = await res.json();
displayMessage(data.reply);
```

This works, but the user stares at a blank screen until the entire response is generated. For a local 1.7B model that might be a few seconds. For a larger model or a complex prompt, it could be much longer.

## Phase 2: Real-Time Streaming with SSE

### Why Streaming Matters

LLMs generate text token by token. With a blocking `chat()` call, all those tokens buffer on the server until the last one arrives. Streaming sends each token to the browser as it is produced. The user sees words appear in real time, which makes even slow models feel responsive.

### Switching to SSE

Neuron AI provides a `stream()` method that returns an iterator of chunks instead of a complete response. On the CodeIgniter side, we return an `SSEResponse` instead of a JSON response.

`SSEResponse` takes a closure. When the framework calls `send()`, it sets up the correct headers (`text/event-stream`, `Cache-Control: no-cache`, etc.), clears output buffers, closes the session (so other requests are not blocked), and then invokes your closure. Inside the closure you call `$sse->event()` to push data to the client.

```php
use App\Neuron\MyAgent;
use CodeIgniter\HTTP\SSEResponse;
use NeuronAI\Chat\Messages\UserMessage;

public function send(): ResponseInterface|SSEResponse
{
    $userMessage = $this->request->getJsonVar('message');

    return new SSEResponse(function (SSEResponse $sse) use ($userMessage) {

        $stream = MyAgent::make()->stream(
            new UserMessage($userMessage),
        );

        foreach ($stream as $chunk) {
            if (! $sse->event(data: ['text' => $chunk])) {
                break; // client disconnected
            }
        }

        $sse->event(data: '[DONE]');
    });
}
```

A few things to notice:

- `event()` accepts arrays (auto-JSON-encoded) or strings.
- It returns `bool` - `false` means the client has disconnected, so you should stop generating.
- The `[DONE]` sentinel tells the frontend the stream is complete.

### Parsing SSE on the Frontend

We use the Fetch API with a `ReadableStream` reader rather than `EventSource`, because we need to send a POST body and custom headers.

```javascript
const res = await fetch('/chat/send', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ message }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let rawText = '';

while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') continue;

        const { text } = JSON.parse(payload);
        rawText += text;
        contentEl.innerHTML = renderMarkdown(rawText);
    }
}
```

The SSE protocol is line-based: each field is `field: value\n`, and events are separated by a blank line. We split on newlines, look for `data:` lines, and append each text chunk to the growing response. The result is a ChatGPT-like streaming effect with surprisingly little code.

## Phase 3: Chat History

### The Problem

Every call to `stream()` (or `chat()`) is stateless. The agent has no memory of previous messages. Ask it "What did I just say?" and it will have no idea.

### Neuron AI's Chat History Interface

Neuron AI defines a `ChatHistoryInterface` that you can implement with any storage backend - files, Redis, a database. When an agent has a chat history configured, Neuron AI automatically loads previous messages before sending the prompt and saves new messages after the response completes.

### A CodeIgniter-Backed Implementation

We need a database table for messages:

| Column    | Type        |
|------|-------|
| id        | BIGINT (PK) |
| thread_id | INT         |
| role      | VARCHAR     |
| content   | LONGTEXT    |
| meta      | JSON        |

And a standard CodeIgniter model:

```php
<?php

namespace App\Models;

use CodeIgniter\Model;
use App\Entities\ChatMessage;

class ChatMessageModel extends Model
{
    protected $table            = 'chat_messages';
    protected $returnType       = ChatMessage::class;
    protected $allowedFields    = ['thread_id', 'role', 'content', 'meta'];
    protected $useTimestamps    = true;
    protected array $casts      = ['meta' => 'json-array'];
}
```

The chat history adapter extends Neuron AI's `AbstractChatHistory` and bridges it to the model:

```php
<?php

namespace App\Neuron\Chat\History;

use NeuronAI\Chat\History\AbstractChatHistory;
use NeuronAI\Chat\History\ChatHistoryInterface;
use NeuronAI\Chat\Messages\Message;
use NeuronAI\Chat\Messages\ToolCallMessage;
use NeuronAI\Chat\Messages\ToolCallResultMessage;

class CodeIgniterChatHistory extends AbstractChatHistory
{
    public function __construct(
        protected string $threadId,
        protected string $modelClass,
        int $contextWindow = 50000,
    ) {
        parent::__construct($contextWindow);
        $this->load();
    }

    protected function load(): void
    {
        $messages = model($this->modelClass)
            ->where('thread_id', $this->threadId)
            ->orderBy('id')
            ->findAll();

        $messages = array_map($this->recordToArray(...), $messages);

        if ($messages !== []) {
            $this->history = $this->deserializeMessages($messages);
        }
    }

    protected function onNewMessage(Message $message): void
    {
        // Tool messages are transient - don't persist them
        if ($message instanceof ToolCallMessage
            || $message instanceof ToolCallResultMessage) {
            return;
        }

        model($this->modelClass)->insert([
            'thread_id' => $this->threadId,
            'role'      => $message->getRole(),
            'content'   => $message->getContent(),
            'meta'      => $this->serializeMessageMeta($message),
        ]);
    }

    // ... see the rest on the GitHub repo
}
```

The key decisions here:

- **Thread ID** groups messages into conversations.
- **`contextWindow`** limits how many tokens of history Neuron AI includes in the prompt. When the window is exceeded, older messages are trimmed automatically via `onTrimHistory()`.
- **Tool messages are not persisted.** They are ephemeral - the LLM generates them during a single request and they have no value in future conversations.

### Wiring It Into the Agent

The agent now accepts a thread ID and declares a `chatHistory()` method:

```php
class MyAgent extends Agent
{
    public function __construct(private readonly string $threadId)
    {
    }

    protected function provider(): AIProviderInterface
    {
        return new Ollama(
            url: 'http://localhost:11434/api/',
            model: 'qwen3:1.7b',
        );
    }

    public function instructions(): string
    {
        return 'You are a friendly AI assistant.';
    }

    protected function chatHistory(): ChatHistoryInterface
    {
        return new CodeIgniterChatHistory(
            threadId: $this->threadId,
            modelClass: ChatMessageModel::class,
            contextWindow: 50000,
        );
    }
}
```

The controller passes the thread ID when creating the agent:

```php
$stream = MyAgent::make($threadId)->stream(
    new UserMessage($userMessage),
);
```

That is all. Neuron AI handles loading prior messages into the prompt and saving the user message and assistant response to the database. The conversation now survives page reloads.

## Phase 4: Tool Usage

### What Tools Are

Tools (also called function calling) let the LLM request that your application execute a function and return the result. The model does not run code itself - it emits a structured "call this function with these arguments" message, your code executes it, and you feed the result back into the conversation.

This is how AI agents do things like check the weather, query a database, or (like in our case) look up the current date. Because models have no idea about the present time, this is the easiest way to demonstrate how tools work.

### Defining Tools in the Agent

Add a `tools()` method to the agent:

```php
use CodeIgniter\I18n\Time;
use NeuronAI\Tools\Tool;

protected function tools(): array
{
    return [
        Tool::make(
            'get_current_date',
            'Retrieve current date and time.',
        )->setCallable(function () {
            return Time::now()->toDateTimeString();
        }),
        Tool::make(
            'get_current_weekday',
            'Retrieve current weekday name.',
        )->setCallable(function () {
            return Time::now()->format('l');
        }),
    ];
}
```

Each tool has a name, a description (which the LLM reads to decide when to use it), and a callable that produces the result. You can also give the system prompt hints about when to use each tool:

```php
use NeuronAI\SystemPrompt;

public function instructions(): string
{
    return (string) new SystemPrompt(
        background: [
            'You are a friendly AI Agent created with Neuron framework.',
        ],
        toolsUsage: [
            'To get current date and time, use get_current_date',
            'To get current weekday use get_current_weekday',
        ],
    );
}
```

### Handling Tool Calls in the Stream

With tools enabled, the stream no longer yields only text strings. It can also yield `ToolCallMessage` (the model wants to call a function) and `ToolCallResultMessage` (the function has returned a result). We need to handle these in the controller:

```php
use NeuronAI\Chat\Messages\ToolCallMessage;
use NeuronAI\Chat\Messages\ToolCallResultMessage;

return new SSEResponse(function (SSEResponse $sse) use ($userMessage, $threadId) {

    $stream = MyAgent::make($threadId)->stream(
        new UserMessage($userMessage),
    );

    foreach ($stream as $chunk) {
        // Result messages are internal - skip them
        if ($chunk instanceof ToolCallResultMessage) {
            continue;
        }

        // Tool call messages carry the tool name(s)
        if ($chunk instanceof ToolCallMessage) {
            $tools = array_map(
                static fn ($tool) => $tool->getName(),
                $chunk->getTools()
            );
            if (! $sse->event(data: ['tools' => $tools], event: 'tool')) {
                break;
            }
            continue;
        }

        // Regular text chunk
        if ($chunk !== '') {
            if (! $sse->event(data: ['text' => $chunk])) {
                break;
            }
        }
    }

    $sse->event(data: '[DONE]');
});
```

Notice the named event: `event: 'tool'`. This lets the frontend distinguish tool calls from text chunks without inspecting the payload.

### Showing Tool Usage on the Frontend

On the frontend, we check for the `event:` line before parsing `data:`:

```javascript
let currentEvent = null;

for (const line of lines) {
    if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
    }

    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') { currentEvent = null; continue; }

    const parsed = JSON.parse(payload);

    if (currentEvent === 'tool' && parsed.tools) {
        toolIndicator.textContent = 'Using tools: ' + parsed.tools.join(', ');
        toolIndicator.classList.remove('hidden');
        currentEvent = null;
        continue;
    }

    currentEvent = null;

    // Regular text chunk
    rawText += parsed.text;
    contentEl.innerHTML = renderMarkdown(rawText);
}
```

When the user asks "What day is it?", they see a brief "Using tools: get_current_date, get_current_weekday" indicator while the model calls the functions, followed by the streamed answer that includes the actual date. The whole round-trip - model decides to call a tool, PHP executes it, result goes back to the model, model generates the final answer - happens within a single SSE stream.

## What We Built

Four phases, each building on the last:

1. **JSON request/response** - the simplest thing that works. A POST, a blocking `chat()` call, a JSON reply.
2. **SSE streaming** - switch to `stream()` and `SSEResponse`, get real-time token delivery with connection-abort detection.
3. **Chat history** - implement `ChatHistoryInterface` backed by a CodeIgniter model, give each conversation a thread ID, and the agent remembers everything.
4. **Tool usage** - define callable tools in the agent, filter the stream for `ToolCallMessage` types, and let the LLM interact with your application.

The progression shows a pattern: Neuron AI handles the AI complexity (prompt assembly, streaming protocol, tool orchestration), `SSEResponse` handles the HTTP complexity (headers, buffering, flushing), and your application code stays focused on business logic - which tools to expose, how to store history, what to show the user.

From here you could add RAG (retrieval-augmented generation) to let the agent search your documents, multi-agent workflows where agents delegate to each other, image generation, or any of the other capabilities Neuron AI supports. The foundation is the same: an agent, a provider, and a stream.

## Source Code

The complete codebase for this chat application, including migrations, and frontend code, is available at [github.com/michalsn/codeigniter-neuron-ai-chat](https://github.com/michalsn/codeigniter-neuron-chat).
