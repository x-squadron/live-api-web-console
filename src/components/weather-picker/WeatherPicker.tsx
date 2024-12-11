/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useEffect } from 'react';
import './weather-picker.scss';
import TopicChip from '../topic-chip/TopicChip';
import LocationInput from '../location-input/LocationInput';
import MapComponent from '../map-component/MapComponent';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

interface Style {
  emoji: string;
  label: string;
}
const STYLES: Style[] = [
  { emoji: '✒️', label: 'a wise poet' },
  { emoji: '🐰', label: 'a funny bunny' },
  { emoji: '💼', label: 'a politician' },
  { emoji: '🧙', label: 'a mystical wizard' },
  { emoji: '🎭', label: 'a dramatic performer' },
  { emoji: '🌊', label: 'a surfer' },
  { emoji: '🏴‍☠️', label: 'a pirate captain' },
  { emoji: '🌟', label: 'a cosmic wanderer' },
  { emoji: '🧘', label: 'a yogi guru' },
  { emoji: '🎪', label: 'a circus performer' },
];

declare global {
  interface Window {
    google: typeof google;
    googleMap: google.maps.Map;
    currentMarker: google.maps.Marker;
    setLocationInputValue: (value: string) => void;
  }
}


interface WeatherData {
  main: {
    temp: number;
    humidity: number;
    feels_like: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  wind: {
    speed: number;
  };
}

const fetchWeather = async (location: string): Promise<WeatherData> => {
  const apiKey = process.env.REACT_APP_WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error("Weather API key not found");
  }
  const cityMatch = location.match(/^([^,]+)/);
  const cityName = cityMatch ? cityMatch[0] : location;
  
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${apiKey}&units=metric`
  );
  if (!response.ok) {
    throw new Error("Weather data not available");
  }
  return response.json();
};

const WeatherPicker = () => {

  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  
  const { client, connected, connect } = useLiveAPIContext();

  const sendWeatherPrompt = (location: string, style: string, weather: WeatherData) => {
    if (!client || !connected) return;
    
    const prompt = `Describe the weather in ${location} in the style of ${style}. 
    Current conditions: ${weather.weather[0].description}, temperature: ${weather.main.temp}°C, humidity: ${weather.main.humidity}%. 
    Stay in character until asked to change. Announce weather location and time.`;
    
    client.send([{ text: prompt }]);
  };

  const handleWeatherStart = async (location: string, style: string, weather: WeatherData) => {
    setSelectedLocation(location);
    setSelectedStyle(style);
    setWeatherData(weather);
    
    await connect();

    sendWeatherPrompt(location, style, weather);
  };

  const handleWeatherUpdate = (location: string, style: string, weather: WeatherData) => {
    if (!connected) return;
    
    setSelectedLocation(location);
    setSelectedStyle(style);
    setWeatherData(weather);
  };

  // Send weather prompt when we change location or style
  useEffect(() => {
    if (connected && selectedLocation && selectedStyle && weatherData) {
      sendWeatherPrompt(selectedLocation, selectedStyle, weatherData);
    }
  }, [connected, selectedLocation, selectedStyle, weatherData]);


  const handleLocationSelect = async (location: string) => {
    if (!location) {
      setSelectedLocation(null);
      setWeatherData(null);
      return;
    }

    try {
      const weather = await fetchWeather(location);
      setWeatherData(weather);
      setSelectedLocation(location);

      // If already streaming, trigger update
      if (connected && selectedStyle) {
        handleWeatherUpdate(location, selectedStyle, weather);
      }
    } catch (error) {
      console.error("Failed to fetch weather:", error);
      alert("Could not fetch weather data for this location. Please try again.");
    }
  };

  const handleStyleSelect = (style: string) => {
    setSelectedStyle(style);
    
    // If already streaming and we have location/weather, trigger update
    if (connected && selectedLocation && weatherData) {
      handleWeatherUpdate(selectedLocation, style, weatherData);
    }
  };

  const handleStart = () => {
    if (selectedLocation && selectedStyle && weatherData) {
      handleWeatherStart(selectedLocation, selectedStyle, weatherData);
    }
  };

  return (
    <div className="weather-picker">
      <h1 className="title">GenWeather</h1>
      
      <div className="content-grid">
        <div className="left-section">
          <h2 className="section-label">Get the weather in:</h2>
          <LocationInput 
            onLocationSelect={handleLocationSelect}
            isStreaming={connected}
          />
          <MapComponent 
            onLocationSelect={handleLocationSelect}
            apiKey={GOOGLE_MAPS_API_KEY || ''}
            setSearchInput={(value: string) => {
              const win = window as any;
              if (win.setLocationInputValue) {
                win.setLocationInputValue(value);
              }
            }}
          />    
        </div>

        <div className="right-section">
          <h2 className="section-label">In the style of:</h2>
          <div className="persona-buttons">
            {STYLES.map((style: Style, index: number) => (
              <TopicChip 
                key={index} 
                {...style} 
                isSelected={selectedStyle === style.label}
                onClick={() => handleStyleSelect(style.label)}
                disabled={!selectedLocation}
              />
            ))} 
          </div>
        </div>
      </div>

      <button 
        className={`start-button ${selectedLocation !== null && selectedStyle !== null && !connected && weatherData !== null ? 'ready' : ''}`}
        onClick={handleStart}
        disabled={!selectedLocation || !selectedStyle || !weatherData || connected}
      >
        <span className="emoji">🔊</span> {connected ? 'Streaming...' : 'Start talking'}
      </button>
    </div>
  );
};

export default WeatherPicker; 