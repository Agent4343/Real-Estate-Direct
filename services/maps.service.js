/**
 * Maps Service
 * Integrates with Google Maps API for geocoding, distance calculation, and location services
 * Supports Canadian real estate property locations
 */

class MapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
    this.country = 'CA'; // Canada
  }

  /**
   * Geocode an address to get coordinates
   * @param {Object} address - Address components
   * @returns {Object} Geocoding result
   */
  async geocodeAddress(address) {
    const addressString = typeof address === 'string'
      ? address
      : this.formatAddress(address);

    if (!this.apiKey) {
      return this.mockGeocode(addressString);
    }

    try {
      const params = new URLSearchParams({
        address: addressString,
        components: `country:${this.country}`,
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/geocode/json?${params}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Geocoding failed: ${data.status}`);
      }

      const result = data.results[0];

      return {
        success: true,
        location: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        components: this.parseAddressComponents(result.address_components),
        locationType: result.geometry.location_type,
        viewport: result.geometry.viewport
      };
    } catch (error) {
      console.error('[MAPS] Geocoding error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reverse geocode coordinates to get address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Object} Address result
   */
  async reverseGeocode(lat, lng) {
    if (!this.apiKey) {
      return this.mockReverseGeocode(lat, lng);
    }

    try {
      const params = new URLSearchParams({
        latlng: `${lat},${lng}`,
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/geocode/json?${params}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Reverse geocoding failed: ${data.status}`);
      }

      const result = data.results[0];

      return {
        success: true,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        components: this.parseAddressComponents(result.address_components)
      };
    } catch (error) {
      console.error('[MAPS] Reverse geocoding error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate distance between two locations
   * @param {Object} origin - Origin location
   * @param {Object} destination - Destination location
   * @returns {Object} Distance result
   */
  async getDistance(origin, destination) {
    if (!this.apiKey) {
      return this.mockDistance(origin, destination);
    }

    try {
      const originStr = typeof origin === 'string'
        ? origin
        : `${origin.lat},${origin.lng}`;
      const destStr = typeof destination === 'string'
        ? destination
        : `${destination.lat},${destination.lng}`;

      const params = new URLSearchParams({
        origins: originStr,
        destinations: destStr,
        units: 'metric',
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/distancematrix/json?${params}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Distance calculation failed: ${data.status}`);
      }

      const element = data.rows[0].elements[0];

      return {
        success: true,
        distance: {
          text: element.distance.text,
          meters: element.distance.value,
          kilometers: element.distance.value / 1000
        },
        duration: {
          text: element.duration.text,
          seconds: element.duration.value,
          minutes: Math.round(element.duration.value / 60)
        }
      };
    } catch (error) {
      console.error('[MAPS] Distance calculation error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get nearby places (schools, transit, amenities)
   * @param {Object} location - Location coordinates
   * @param {string} type - Place type (school, transit_station, etc.)
   * @param {number} radius - Search radius in meters
   * @returns {Object} Nearby places
   */
  async getNearbyPlaces(location, type, radius = 2000) {
    if (!this.apiKey) {
      return this.mockNearbyPlaces(location, type);
    }

    try {
      const params = new URLSearchParams({
        location: `${location.lat},${location.lng}`,
        radius: radius.toString(),
        type,
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/place/nearbysearch/json?${params}`);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Nearby search failed: ${data.status}`);
      }

      return {
        success: true,
        places: (data.results || []).map(place => ({
          name: place.name,
          placeId: place.place_id,
          location: place.geometry.location,
          rating: place.rating,
          types: place.types,
          vicinity: place.vicinity
        }))
      };
    } catch (error) {
      console.error('[MAPS] Nearby places error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive neighborhood data for a property
   * @param {Object} location - Property location
   * @returns {Object} Neighborhood data
   */
  async getNeighborhoodData(location) {
    const amenityTypes = [
      'school',
      'transit_station',
      'grocery_or_supermarket',
      'hospital',
      'park',
      'restaurant',
      'shopping_mall'
    ];

    const results = await Promise.all(
      amenityTypes.map(type => this.getNearbyPlaces(location, type))
    );

    const neighborhood = {};
    amenityTypes.forEach((type, index) => {
      neighborhood[type] = results[index].success ? results[index].places : [];
    });

    return {
      success: true,
      location,
      amenities: neighborhood,
      walkScore: this.calculateWalkScore(neighborhood),
      transitScore: this.calculateTransitScore(neighborhood)
    };
  }

  /**
   * Generate static map URL for property
   * @param {Object} location - Property location
   * @param {Object} options - Map options
   * @returns {string} Static map URL
   */
  getStaticMapUrl(location, options = {}) {
    const {
      width = 600,
      height = 400,
      zoom = 15,
      mapType = 'roadmap',
      markerColor = 'red'
    } = options;

    if (!this.apiKey) {
      // Return a placeholder URL for development
      return `https://via.placeholder.com/${width}x${height}?text=Map+Preview`;
    }

    const params = new URLSearchParams({
      center: `${location.lat},${location.lng}`,
      zoom: zoom.toString(),
      size: `${width}x${height}`,
      maptype: mapType,
      markers: `color:${markerColor}|${location.lat},${location.lng}`,
      key: this.apiKey
    });

    return `${this.baseUrl}/staticmap?${params}`;
  }

  /**
   * Generate embed URL for interactive map
   * @param {Object} location - Property location
   * @returns {string} Embed URL
   */
  getEmbedUrl(location) {
    if (!this.apiKey) {
      return null;
    }

    const params = new URLSearchParams({
      q: `${location.lat},${location.lng}`,
      key: this.apiKey
    });

    return `https://www.google.com/maps/embed/v1/place?${params}`;
  }

  /**
   * Format address object to string
   */
  formatAddress(address) {
    const parts = [
      address.streetNumber,
      address.street,
      address.unit ? `Unit ${address.unit}` : '',
      address.city,
      address.province,
      address.postalCode
    ].filter(Boolean);

    return parts.join(', ') + ', Canada';
  }

  /**
   * Parse Google's address components
   */
  parseAddressComponents(components) {
    const parsed = {};
    const componentMap = {
      street_number: 'streetNumber',
      route: 'street',
      sublocality_level_1: 'neighborhood',
      locality: 'city',
      administrative_area_level_1: 'province',
      postal_code: 'postalCode',
      country: 'country'
    };

    components.forEach(component => {
      component.types.forEach(type => {
        if (componentMap[type]) {
          parsed[componentMap[type]] = component.short_name;
          if (type === 'administrative_area_level_1' || type === 'locality') {
            parsed[`${componentMap[type]}Long`] = component.long_name;
          }
        }
      });
    });

    return parsed;
  }

  /**
   * Calculate approximate walk score based on nearby amenities
   */
  calculateWalkScore(amenities) {
    let score = 0;
    const weights = {
      grocery_or_supermarket: 15,
      restaurant: 10,
      school: 10,
      park: 10,
      transit_station: 15,
      shopping_mall: 5,
      hospital: 5
    };

    Object.entries(amenities).forEach(([type, places]) => {
      const count = Math.min(places.length, 5);
      score += count * (weights[type] || 5);
    });

    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate approximate transit score based on nearby stations
   */
  calculateTransitScore(amenities) {
    const transitStations = amenities.transit_station || [];
    const count = transitStations.length;

    if (count >= 5) return 90;
    if (count >= 3) return 70;
    if (count >= 1) return 50;
    return 25;
  }

  // ==========================================
  // Mock Methods for Development
  // ==========================================

  mockGeocode(address) {
    console.log('[MAPS] Using mock geocode for:', address);

    // Generate consistent mock coordinates based on address hash
    const hash = this.simpleHash(address);
    const lat = 43.65 + (hash % 100) / 1000;
    const lng = -79.38 + ((hash >> 8) % 100) / 1000;

    return {
      success: true,
      location: { lat, lng },
      formattedAddress: address,
      placeId: `mock_place_${hash}`,
      components: {
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1',
        country: 'CA'
      },
      locationType: 'APPROXIMATE',
      viewport: {
        northeast: { lat: lat + 0.01, lng: lng + 0.01 },
        southwest: { lat: lat - 0.01, lng: lng - 0.01 }
      }
    };
  }

  mockReverseGeocode(lat, lng) {
    return {
      success: true,
      formattedAddress: `${Math.round(lat * 1000)}, ${Math.round(lng * 1000)} Mock Street, Toronto, ON`,
      placeId: `mock_place_${lat}_${lng}`,
      components: {
        streetNumber: Math.round(lat * 1000).toString(),
        street: 'Mock Street',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1',
        country: 'CA'
      }
    };
  }

  mockDistance(origin, destination) {
    // Calculate approximate distance using Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(destination.lat - origin.lat);
    const dLng = this.toRad(destination.lng - origin.lng);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(origin.lat)) * Math.cos(this.toRad(destination.lat)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return {
      success: true,
      distance: {
        text: `${distance.toFixed(1)} km`,
        meters: Math.round(distance * 1000),
        kilometers: distance
      },
      duration: {
        text: `${Math.round(distance * 2)} mins`,
        seconds: Math.round(distance * 120),
        minutes: Math.round(distance * 2)
      }
    };
  }

  mockNearbyPlaces(location, type) {
    const mockPlaces = {
      school: [
        { name: 'Mock Elementary School', rating: 4.2 },
        { name: 'Mock High School', rating: 4.0 }
      ],
      transit_station: [
        { name: 'Mock Station', rating: 4.1 },
        { name: 'Mock Bus Stop', rating: 3.8 }
      ],
      grocery_or_supermarket: [
        { name: 'Mock Grocery', rating: 4.3 },
        { name: 'Mock Supermarket', rating: 4.0 }
      ],
      hospital: [
        { name: 'Mock General Hospital', rating: 4.0 }
      ],
      park: [
        { name: 'Mock Park', rating: 4.5 },
        { name: 'Mock Gardens', rating: 4.2 }
      ],
      restaurant: [
        { name: 'Mock Restaurant 1', rating: 4.1 },
        { name: 'Mock Restaurant 2', rating: 4.3 },
        { name: 'Mock Cafe', rating: 4.0 }
      ],
      shopping_mall: [
        { name: 'Mock Shopping Centre', rating: 4.0 }
      ]
    };

    return {
      success: true,
      places: (mockPlaces[type] || []).map((place, index) => ({
        ...place,
        placeId: `mock_${type}_${index}`,
        location: {
          lat: location.lat + (index * 0.001),
          lng: location.lng + (index * 0.001)
        },
        types: [type],
        vicinity: 'Near property location'
      }))
    };
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }
}

module.exports = {
  MapsService,
  mapsService: new MapsService()
};
