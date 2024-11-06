---
title: "User tracking with JavaScript"
date: 2024-11-06T18:06:23+01:00
tags: ["javascript", "tracking"]
draft: false
---

If you’ve ever wanted to capture info about your users, you might be interested in this little experiment.

With features like automatic page view tracking that logs details about your visitors’ browsers, devices, and more, plus the ability to log custom events like clicks, it’s perfect for anyone who enjoys tinkering with web analytics.

The `PageViewEvents` JavaScript class provides a streamlined way to capture and send data about page views and user interactions on your site.

Project page: https://github.com/michalsn/page-view-events

### Key Features

The primary goal of the PageViewEvents class is to capture detailed page view data and user events and send them to specified endpoints for logging or analytics. It provides:

- **Page View Tracking**: Automatically captures page details such as the visitor's operating system, browser, language, screen resolution, and current URL.
- **Event Tracking**: Allows logging of custom user interactions, such as clicks or other specified events, with details about the clicked element and its position within the DOM.
- **Configurable Data Transmission**: Choose between sending data via `sendBeacon` (a background-safe transmission for low-impact tracking) or `fetch` (for added flexibility). Additionally, you can specify whether data should be sent in JSON format or as plain text.

### Configuration Options

The class provides a few configurable properties to suit various use cases:

- **sendMethod**: Defines how data is transmitted. Acceptable values are:
    - **beacon**: Uses navigator.sendBeacon for non-blocking, reliable background data transmission. Recommended for scenarios where low-impact logging is preferred.
    - **fetch**: Uses the Fetch API for standard HTTP transmission, with `keepalive` set to `true`.
- **sendJson**: If set to true, data is sent in JSON format with `Content-Type: application/json`. Otherwise, data is sent as plain text (`Content-Type: text/plain`), which avoids preflight CORS requests.

### Getting Started

To set up PageViewEvents, simply include it in your project and configure any desired options. Here’s how to integrate and use it:

1. Load the Script

Add the JavaScript file to your HTML:

```html
<script src="PageViewEvents.js"></script>
```

2. Configuration

Define an optional configuration object, specifying the tracking ID (tid), custom URL, and additional settings if needed:

```javascript
const pveConfig = {
    // Options for sending data
    sendOptions: {
        sendMethod: "fetch",
        sendJson: true,
        sendUrl: "https://example.com/log",
    },

    // Options for initialization
    initOptions: {
        tid: "example-site",
        lu: false,
        luid: "abc",
        cid: "123",
        ip: "127.0.0.1"
    }
};
```

3. Initialize and Capture Events

Once the script and configuration are in place, initialization of `PageViewEvents` class is made automatically. By default, all "full page load" and "on click" events are logged. But if you want, you can specify any additional events, or log the view page manually.

### Example Use Cases

#### Full page load

This is done automatically, but you can also call it manually, if you load the page via AJAX call.

```javascript
// Log a page view event
pve.view();
```

This will log a page view event, capturing various details about the visitor’s environment and the page.

#### Logging a Custom Event

Custom events can be triggered to log user interactions. By default, all `on click` events are logged automatically.

```javascript
// Log a custom event for a button hover
const myButton = document.querySelector('#myButton');
myButton.addEventListener('mouseover', (e) => {
    pve.event(e.target, 'Mouse over Button');
});
```
In this example, the event logs that the user’s mouse is over a specific button, providing data on the element and additional context.

#### Example data

This data will be sent to the desired endpoint:

```json
{
   "visitorId":"c0f8e388...",
   "platform":"MacIntel",
   "language":"pl-PL",
   "userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
   "currentUrl":"http://localhost:8080/",
   "referrerUrl":"",
   "timezone":"Europe/Warsaw",
   "screenResolution":"2560x1080",
   "screenSize":"2560x977",
   "windowSize":"1560x353",
   "utcDate":"2022-10-10 10:20:00",
   "eventType":"on click",
   "xPath":"/html[1]",
   "tid":"example-site",
   "lu":false,
   "luid":"",
   "cid":"123",
   "visitorIp":"127.0.0.1"
}
```

### Summary

With the `PageViewEvents` class, you can efficiently capture and send valuable data on page views and user interactions. The flexibility of using either `sendBeacon` or `fetch`, along with the option to send data in JSON or plain text, makes it adaptable to various tracking and analytics setups.
