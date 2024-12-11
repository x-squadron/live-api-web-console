# Multimodal Live API - Web console

This repository contains a react-based starter app for using the [Multimodal Live API](https://ai.google.dev/gemini-api) over a websocket. It provides modules for streaming audio playback, recording user media such as from a microphone, webcam or screen capture as well as a unified log view to aid in development of your application.

We have provided several example applications on other branches of this repository:

- [demos/GenExplainer](https://github.com/google-gemini/multimodal-live-api-web-console/tree/demos/genexplainer)
- [demos/GenWeather](https://github.com/google-gemini/multimodal-live-api-web-console/tree/demos/genweather)

# GenWeather

GenWeather demonstrates how to use the Multimodal Live API to get creative weather reports. Pick any location on the map and choose a character style (like a pirate or a yogi guru) to get a unique weather report. The app combines real weather data with Gemini's creative abilities to generate engaging weather descriptions.

Since this is a Live API that uses bidirectional streaming, the app can send weather updates and receive new descriptions in near real-time as you change locations or character styles.

The AI interaction happens in `/src/components/weather-picker/WeatherPicker.tsx`, where we fetch weather data and communicate with the AI. Here's the key part:

```typescript
const sendWeatherPrompt = (location: string, style: string, weather: WeatherData) => {
  if (!client || !connected) return;
  
  const prompt = `Describe the weather in ${location} in the style of ${style}. 
  Current conditions: ${weather.weather[0].description}, temperature: ${weather.main.temp}°C, humidity: ${weather.main.humidity}%. 
  Stay in character until asked to change. Announce weather location and time.`;
  
  client.send([{ text: prompt }]);
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
