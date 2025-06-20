---
title: "Getting Started with NeuronAI Workflows"
date: 2025-06-20T18:39:09+02:00
draft: false
tags: ["neuronai", "workflow", "ollama", "agents", "php"]
summary: "Learn how to get started with NeuronAI Workflows by combining simple AI agents, tools, and APIs to automate basic tasks."
---

When working with AI applications, orchestrating multiple steps and AI agents can quickly become complex. [NeuronAI](https://github.com/inspector-apm/neuron-ai) Workflow system provides an elegant solution for chaining together different operations, from data processing to AI agent interactions. In this post, we'll build a weather-based clothing recommendation system that demonstrates the power of combining Workflows with Agents and Tools.

### What We're Building

Our application will take a user's location input and provide personalized clothing recommendations based on current weather conditions. The workflow consists of three distinct steps:

1. **Location Processing**: Extract coordinates from user input using an AI agent with geocoding tools
2. **Weather Data Retrieval**: Fetch current weather information using external APIs
3. **Recommendation Generation**: Analyze weather data and provide clothing suggestions

### Project Overview

The application follows NeuronAI's workflow pattern, where each step is represented as a Node, and the flow between nodes is defined by Edges. This approach ensures clean separation of concerns and makes the application easily maintainable and extensible.

### Setting Up the Workflow Structure

Let's start by examining our main workflow class:

```php
<?php

namespace Weather;

use NeuronAI\Workflow\Edge;
use NeuronAI\Workflow\Workflow;
use Weather\Nodes\FirstNode;
use Weather\Nodes\SecondNode;
use Weather\Nodes\ThirdNode;

class WeatherWorkflow extends Workflow
{
    public function nodes(): array
    {
        return [
            new FirstNode(),
            new SecondNode(),
            new ThirdNode(),
        ];
    }

    public function edges(): array
    {
        return [
            new Edge(FirstNode::class, SecondNode::class),
            new Edge(SecondNode::class, ThirdNode::class),
        ];
    }

    protected function start(): string
    {
        return FirstNode::class;
    }

    protected function end(): array
    {
        return [
            ThirdNode::class,
        ];
    }
}
```

This workflow definition creates a linear flow: `FirstNode → SecondNode → ThirdNode`. Each edge represents a transition between nodes, and the workflow state is passed along the chain, accumulating data at each step.

### Step 1: Location Processing with AI Agents and Tools

Our first node uses an AI agent to extract geographical coordinates from natural language input. This showcases NeuronAI's ability to combine structured output with tool usage.

#### The Place Agent

```php
<?php

namespace Weather\Agents;

use NeuronAI\Agent;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\Providers\Ollama\Ollama;
use Weather\Dto\Coordinates;
use Weather\Tools\SearchPlaceTool;

class PlaceAgent extends Agent
{
    public function provider(): AIProviderInterface
    {
        return new Ollama(
            url: 'http://localhost:11434/api/',
            model: 'qwen3:1.7b',
        );
    }

    protected function tools(): array
    {
        return [
            SearchPlaceTool::make(),
        ];
    }

    protected function getOutputClass(): string
    {
        return Coordinates::class;
    }
}
```

The `PlaceAgent` demonstrates several key NeuronAI concepts:

- **Provider Configuration**: We're using Ollama with the lightweight `qwen3:1.7b` model for fast local inference
- **Tool Integration**: The agent has access to a custom `SearchPlaceTool` that can search for geographical data
- **Structured Output**: The agent returns data in the `Coordinates` DTO format

#### The Place Search Tool

```php
<?php

namespace Weather\Tools;

use GuzzleHttp\Client;
use NeuronAI\Tools\PropertyType;
use NeuronAI\Tools\Tool;
use NeuronAI\Tools\ToolProperty;

class SearchPlaceTool extends Tool
{
    protected Client $client;

    public function __construct()
    {
        parent::__construct(
            'place_coordinates',
            'Get the coordinates of the place (lat ,lon) which will be used later in the weather api',
        );
    }

    protected function properties(): array
    {
        return [
            new ToolProperty(
                name: 'city',
                type: PropertyType::STRING,
                description: 'The city name',
                required: true,
            ),
            new ToolProperty(
                name: 'country',
                type: PropertyType::STRING,
                description: 'The country name',
                required: false,
            )
        ];
    }

    public function __invoke(string $city, $country)
    {
        $params = [
            'city' => $city,
        ];

        if (! empty($country)) {
            $params['country'] = $country;
        }

        $response = $this->getClient()->get('/search?format=json&' . http_build_query($params));

        if ($response->getStatusCode() !== 200) {
            return 'Error :(';
        }

        return $response->getBody()->getContents();
    }

    protected function getClient(): Client
    {
        if (isset($this->client)) {
            return $this->client;
        }

        return $this->client = new Client([
            'base_uri' => 'https://nominatim.openstreetmap.org',
        ]);
    }
}
```

This tool uses the OpenStreetMap service for geocoding. When the AI agent determines it needs geographical coordinates, it can call this tool with the extracted city and country information.

#### Coordinates DTO

```php
<?php

namespace Weather\Dto;

use NeuronAI\StructuredOutput\SchemaProperty;

class Coordinates
{
    #[SchemaProperty(description: 'The latitude of the place, the value can be negative.', required: true)]
    public string $lat;

    #[SchemaProperty(description: 'The longitude of the place, the value can be negative.', required: true)]
    public string $lon;
}
```

The DTO uses NeuronAI's structured output attributes to ensure the AI agent returns properly formatted coordinate data.

#### First Node Implementation

```php
<?php

namespace Weather\Nodes;

use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Workflow\Node;
use NeuronAI\Workflow\WorkflowState;
use Weather\Agents\PlaceAgent;
use Weather\Dto\Coordinates;

class FirstNode extends Node
{
    public function run(WorkflowState $state): WorkflowState
    {
        $coordinates = PlaceAgent::make()->structured(
            new UserMessage($state->get('user_input')),
            Coordinates::class
        );

        $state->set('lat', $coordinates->lat);
        $state->set('lon', $coordinates->lon);

        return $state;
    }
}
```

The `FirstNode` takes the user input from the workflow state, processes it through the `PlaceAgent`, and stores the resulting coordinates back into the state for the next node to use.

### Step 2: Weather Data Retrieval

The second node handles external API integration to fetch weather data:

```php
<?php

namespace Weather\Nodes;

use GuzzleHttp\Client;
use NeuronAI\Workflow\Node;
use NeuronAI\Workflow\WorkflowState;

class SecondNode extends Node
{
    public function run(WorkflowState $state): WorkflowState
    {
        $client = new Client([
            'base_uri' => 'https://api.open-meteo.com',
        ]);

        $params = [
            'latitude'  => $state->get('lat'),
            'longitude' => $state->get('lon'),
        ];

        $response = $client->get('/v1/forecast?hourly=temperature_2m,rain,uv_index,wind_speed_10m&forecast_days=1&forecast_hours=1&past_hours=1&' . http_build_query($params));

        $state->set(
            'weather_info',
            $response->getBody()->getContents()
        );

        return $state;
    }
}
```

This node demonstrates how traditional API calls can seamlessly integrate into NeuronAI workflows. We're using the Open-Meteo API to fetch comprehensive weather data, including:

- Maximum and minimum temperatures
- Wind speed
- UV index
- Rainfall predictions

The raw JSON response is stored in the workflow state for processing by the next node.

### Step 3: AI-Powered Clothing Recommendations

The final node uses another AI agent to analyze the weather data and provide clothing recommendations:

#### Weather Agent

```php
<?php

namespace Weather\Agents;

use NeuronAI\Agent;
use NeuronAI\Providers\AIProviderInterface;
use NeuronAI\Providers\Ollama\Ollama;
use NeuronAI\SystemPrompt;

class WeatherAgent extends Agent
{
    public function provider(): AIProviderInterface
    {
        return new Ollama(
            url: 'http://localhost:11434/api/',
            model: 'qwen3:1.7b',
        );
    }

    public function instructions(): string
    {
        return new SystemPrompt(
            background: [
                'You are a fashion and weather expert specializing in recommending appropriate daily outfits based on weather conditions.',
            ],
            steps: [
                'Carefully analyze the provided JSON input, noting the unit system (e.g., Celsius or Fahrenheit, km/h or mph).',
                'Focus on today\'s forecasted data: maximum temperature, wind speed, total rainfall, and UV index.',
                'Use these weather factors to determine the most suitable outfit that balances comfort, protection, and style.',
            ],
            output: [
                'Provide a concise outfit recommendation for today.',
                'Mention key clothing items (e.g., light jacket, umbrella, sunglasses) based on the weather conditions.',
                'Optionally include a one-line reasoning for your recommendation (e.g., "A light jacket is recommended due to high winds.").'
            ]
        );
    }
}
```

The `WeatherAgent` showcases NeuronAI's `SystemPrompt` builder, which structures the AI's instructions for consistent, high-quality responses. The prompt is carefully crafted to:

- Establish the agent's expertise domain
- Provide clear analytical steps
- Define the expected output format

#### Third Node Implementation

```php
<?php

namespace Weather\Nodes;

use NeuronAI\Chat\Messages\UserMessage;
use NeuronAI\Workflow\Node;
use NeuronAI\Workflow\WorkflowState;
use Weather\Agents\WeatherAgent;

class ThirdNode extends Node
{
    public function run(WorkflowState $state): WorkflowState
    {
        $response = WeatherAgent::make()->chat(
            new UserMessage($state->get('weather_info'))
        );

        $state->set('recommendation', $response->getContent());

        return $state;
    }
}
```

The `ThirdNode` feeds the weather JSON data to the `WeatherAgent` and stores the generated clothing recommendation in the workflow state.

### Putting It All Together

The main application entry point demonstrates how simple it is to execute our workflow:

```php
<?php

require __DIR__ . '/vendor/autoload.php';

use NeuronAI\Workflow\WorkflowState;
use Weather\WeatherWorkflow;

$state = new WorkflowState();
$state->set('user_input', 'I live in Poznan, Poland.');

$workflow = new WeatherWorkflow();
$state = $workflow->run($state);

echo $state->get('recommendation');
```

The workflow execution is straightforward:

1. Create a `WorkflowState` and set the initial user input
2. Instantiate the `WeatherWorkflow`
3. Execute the workflow with `run()`
4. Retrieve the final recommendation from the state

### Key Benefits of This Approach

#### Modularity and Reusability

Each node has a single responsibility, making the system easy to maintain and extend. Need to add weather alerts? Simply add a new node. Want to support multiple recommendation styles? Create different agent variations.

#### State Management

The `WorkflowState` acts as a shared data store throughout the workflow execution, ensuring all nodes have access to the data they need while maintaining clear data flow.

#### Error Handling and Debugging

Each node can be tested independently, and the workflow state provides visibility into data transformations at each step.

#### Flexible AI Integration

Different nodes can use different AI providers or models based on their specific requirements. The location extraction might use a small, fast model, while clothing recommendations could benefit from a larger, more sophisticated model.

### Extending the System

This basic workflow provides a foundation for more sophisticated features:

- **Feedback Loop**: Implement user feedback to provide clothing predictions for different locations
- **Personalization**: Extend the system to consider user preferences and wardrobe
- **Multi-day Planning**: Modify the workflow to provide week-long outfit suggestions
- **Integration**: Connect with calendar systems to suggest outfits for specific events

### Conclusion

NeuronAI's Workflow system provides a clean, maintainable way to orchestrate complex AI applications. By combining Agents, Tools, and traditional API integrations within a structured workflow, we can build sophisticated applications that remain easy to understand and extend.

The weather clothing recommendation system demonstrates how natural language processing, external API integration, and AI-powered analysis can work together seamlessly. Every component handles its own task, making the whole system easier to understand and use.

Although the Workflow system is still in beta and evolving, it already offers a solid foundation for building modular AI applications. You can explore the full source code for this example on [GitHub](https://github.com/michalsn/neuron-ai-playground).