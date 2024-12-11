# Multimodal Live API - Web console

This repository contains a react-based starter app for using the [Multimodal Live API](https://ai.google.dev/gemini-api) over a websocket. It provides modules for streaming audio playback, recording user media such as from a microphone, webcam or screen capture as well as a unified log view to aid in development of your application.

We have provided several example applications on other branches of this repository:

- [demos/GenExplainer](https://github.com/google-gemini/multimodal-live-api-web-console/tree/demos/genexplainer)
- [demos/GenWeather](https://github.com/google-gemini/multimodal-live-api-web-console/tree/demos/genweather)

# GenExplainer

GenExplainer is an example of how to use the Multimodal Live API. Pick a topic (like black holes or DNA) and choose how you want it explained (maybe by a pirate or a chef). The app uses Gemini to generate bespoke explanations.

Since this is a Live API that uses bidirectional streaming, the app is able to send a request to the AI and receive a response in near real-time.

The AI request happens in `/src/components/explainer-picker/ExplainerPicker.tsx`, where we handle your choices and talk to the AI. Here's the key part:

```typescript
const handleSelection = (type: 'topic' | 'style', label: string) => {
  // When you pick a topic or style...
  if (isStreaming && newTopic && newStyle) {
    // Send it to the Multimodal Live API 
    client.send([{
      text: `Explain ${newTopic} in the style of ${newStyle}. 
      Don't change your style until I ask you to.`,
    }]);
  }
};
```

## Development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
Project consists of:

- an Event-emitting websocket-client to ease communication between the websocket and the front-end
- communication layer for processing audio in and out
- a boilerplate view for starting to build your apps and view logs

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.
