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
import './map-component.scss';

interface MapComponentProps {
  onLocationSelect: (location: string) => void;
  apiKey: string;
  setSearchInput: (value: string) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ onLocationSelect, apiKey, setSearchInput }) => {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use a ref to prevent multiple script loads
  const scriptLoaded = React.useRef(false);

  const geocodeLocation = async (
    geocoder: google.maps.Geocoder,
    latLng: google.maps.LatLng
  ): Promise<string | null> => {
    try {
      const response = await geocoder.geocode({ location: latLng });
      if (response.results[0]) {
        return response.results[0].formatted_address;
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const updateMarker = (
    position: google.maps.LatLng,
    mapInstance: google.maps.Map
  ) => {
    if (marker) {
      marker.setMap(null);
    }
    const newMarker = new google.maps.Marker({
      position,
      map: mapInstance,
      animation: google.maps.Animation.DROP
    });
    setMarker(newMarker);
  };

  const handleFindMe = () => {
    if (navigator.geolocation && map) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latLng = new google.maps.LatLng(
            position.coords.latitude,
            position.coords.longitude
          );
          map.setCenter(latLng);
          
          const geocoder = new google.maps.Geocoder();
          try {
            const response = await geocoder.geocode({ location: latLng });
            if (response.results[0]) {
              const result = response.results[0];
              
              // Extract address components
              let city = '';
              let state = '';
              let country = '';
              
              result.address_components.forEach(component => {
                if (component.types.includes('locality') || component.types.includes('postal_town')) {
                  city = component.long_name;
                } else if (component.types.includes('administrative_area_level_1')) {
                  state = component.long_name;
                } else if (component.types.includes('country')) {
                  country = component.long_name;
                }
              });

              // Format the location string, ensuring city is present
              let formattedLocation = city;
              if (state) formattedLocation += `, ${state}`;
              if (country) formattedLocation += `, ${country}`;

              updateMarker(latLng, map);
              if (window.setLocationInputValue) {
                window.setLocationInputValue(formattedLocation);
              }
              onLocationSelect(formattedLocation);
            }
          } catch (error) {
            console.error('Geocoding error:', error);
            alert('Unable to get location details. Please try again.');
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to find your location. Please try again.');
        }
      );
    }
  };

  // Add this array of major cities with their coordinates
  const majorCities = [
    { lat: 40.7128, lng: -74.0060, name: "New York" },    // New York
    { lat: 51.5074, lng: -0.1278, name: "London" },       // London
    { lat: 35.6762, lng: 139.6503, name: "Tokyo" },       // Tokyo
    { lat: 48.8566, lng: 2.3522, name: "Paris" },         // Paris
    { lat: -33.8688, lng: 151.2093, name: "Sydney" },     // Sydney
    { lat: 55.7558, lng: 37.6173, name: "Moscow" },       // Moscow
    { lat: 31.2304, lng: 121.4737, name: "Shanghai" },    // Shanghai
    { lat: 19.4326, lng: -99.1332, name: "Mexico City" }, // Mexico City
    { lat: 37.7749, lng: -122.4194, name: "San Francisco" }, // San Francisco
    { lat: 25.2048, lng: 55.2708, name: "Dubai" },        // Dubai
    { lat: -1.2921, lng: 36.8219, name: "Nairobi" },      // Nairobi
    { lat: 41.9028, lng: 12.4964, name: "Rome" },         // Rome
    { lat: -34.6037, lng: -58.3816, name: "Buenos Aires" }, // Buenos Aires
    { lat: 52.5200, lng: 13.4050, name: "Berlin" },       // Berlin
  ];

  const handleRandomPlace = async () => {
    if (!map) return;
    
    const randomCity = majorCities[Math.floor(Math.random() * majorCities.length)];
    const latLng = new google.maps.LatLng(randomCity.lat, randomCity.lng);
    
    const geocoder = new google.maps.Geocoder();
    try {
      const response = await geocoder.geocode({ location: latLng });
      if (response.results[0]) {
        const result = response.results[0];
        
        // Extract address components
        let city = randomCity.name; // Use the predefined city name as fallback
        let state = '';
        let country = '';
        
        result.address_components.forEach(component => {
          if (component.types.includes('locality') || component.types.includes('postal_town')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name; // Using long_name instead of short_name
          } else if (component.types.includes('country')) {
            country = component.long_name;
          }
        });

        // Format the location string, ensuring city is always present
        let formattedLocation = city || randomCity.name; // Fallback to predefined name if city is empty
        if (state) formattedLocation += `, ${state}`;
        if (country) formattedLocation += `, ${country}`;

        map.setCenter(latLng);
        map.setZoom(12);
        updateMarker(latLng, map);
        
        if (window.setLocationInputValue) {
          window.setLocationInputValue(formattedLocation);
        }
        onLocationSelect(formattedLocation);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  useEffect(() => {
    if (!apiKey) {
      console.error('Google Maps API key is missing. Check your .env file and make sure REACT_APP_GOOGLE_MAPS_API_KEY is set correctly.');
      setLoadError('Google Maps API key is missing');
      return;
    }

    if (!window.google && !scriptLoaded.current) {
      scriptLoaded.current = true;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onerror = () => {
        setLoadError('Failed to load Google Maps');
        scriptLoaded.current = false;
      };
      
      script.onload = () => {
        setIsLoaded(true);
      };

      document.head.appendChild(script);
    } else if (window.google) {
      setIsLoaded(true);
    }

    // Cleanup function
    return () => {
      if (scriptLoaded.current) {
        const scripts = document.querySelectorAll(`script[src*="maps.googleapis.com/maps/api/js"]`);
        scripts.forEach(script => script.remove());
        scriptLoaded.current = false;
      }
    };
  }, [apiKey]);

  // Only initialize map after script is loaded
  useEffect(() => {
    if (!isLoaded || !mapRef.current || loadError) return;

    try {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: 40.7128, lng: -74.0060 }, // Default to New York
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU
        }
      });

      window.googleMap = mapInstance;
      setMap(mapInstance);

      // Add click listener
      mapInstance.addListener('click', async (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const geocoder = new google.maps.Geocoder();
          const location = await geocodeLocation(geocoder, e.latLng);
          if (location) {
            updateMarker(e.latLng, mapInstance);
            onLocationSelect(location);
          }
        }
      });
    } catch (error) {
      console.error('Map initialization error:', error);
      setLoadError('Failed to initialize map');
    }
  }, [isLoaded, loadError]);

  // Show loading or error states
  if (loadError) {
    return <div className="map-error">Error: {loadError}</div>;
  }

  if (!isLoaded) {
    return <div className="map-loading">Loading map...</div>;
  }

  return (
    <>
      <div 
        ref={mapRef} 
        id="map" 
        style={{ height: '260px', width: '320px' }}
      />
      <div className="map-controls">
        <button className="map-control-button" onClick={handleFindMe}>
          📍 find me
        </button>
        <button className="map-control-button" onClick={handleRandomPlace}>
          🎲 random place
        </button>
      </div>
    </>
  );
};

export default MapComponent; 