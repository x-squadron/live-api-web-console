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
import './location-input.scss';

interface LocationInputProps {
  onLocationSelect: (location: string) => void;
  isStreaming: boolean;
}
const LocationInput: React.FC<LocationInputProps> = ({ onLocationSelect, isStreaming }) => {
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isStreaming && window.google) {
      setIsSearching(true);
      const geocoder = new window.google.maps.Geocoder();
      try {
        const response = await geocoder.geocode({ address: inputValue.trim() });
        if (response.results[0]) {
          const location = response.results[0];
          
          // Update map position and add marker
          if (window.googleMap) {
            const latLng = location.geometry.location;
            window.googleMap.setCenter(latLng);
            window.googleMap.setZoom(12);
            // Remove existing marker if any
            if (window.currentMarker) {
              window.currentMarker.setMap(null);
            }
            // Add new marker
            window.currentMarker = new google.maps.Marker({
              position: latLng,
              map: window.googleMap,
              animation: google.maps.Animation.DROP
            });
          }
          // Set the formatted address
          setInputValue(location.formatted_address);
          onLocationSelect(location.formatted_address);
          setLocationLoaded(true);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        alert('Location not found. Please try again.');
        clearSearch();
      }
    }
  };
  const clearSearch = () => {
    setInputValue('');
    setIsSearching(false);
    setLocationLoaded(false);
    onLocationSelect('');
    // Remove marker from map
    if (window.currentMarker) {
      window.currentMarker.setMap(null);
    }
  };
  useEffect(() => {
    // @ts-ignore - TypeScript might complain about this property
    window.setLocationInputValue = setInputValue;
  }, []);
  return (
    <form onSubmit={handleSearch} className="search-container">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="location..."
        disabled={isStreaming}
        className={`${isSearching ? 'searching' : ''} ${locationLoaded ? 'location-loaded' : ''}`}
      />
      <span 
        className={`material-symbols-outlined search-icon ${locationLoaded ? 'location-loaded' : ''}`}
        onClick={() => {
          if (isSearching) {
            clearSearch();
          } else {
            handleSearch(new Event('submit') as any);
          }
        }}
      >
        {isSearching ? 'close' : 'search'}
      </span>
    </form>
  );
};
export default LocationInput;