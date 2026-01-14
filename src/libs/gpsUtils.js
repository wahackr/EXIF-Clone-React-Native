/* eslint-disable no-undef */
/**
 * Parse GPS coordinates from EXIF data.
 * Handles different formats returned by iOS/Android pickers.
 * @param {object} exif - The EXIF object from the image picker
 * @returns {{lat: number, lng: number} | null} - Coordinates or null if invalid
 */
export const extractGPS = (exif) => {
  if (!exif) return null;

  // iOS often nests GPS data in a '{GPS}' object, or flat properties like 'GPSLatitude'
  // Android often returns flat properties.

  let lat = exif.GPSLatitude || exif['{GPS}']?.Latitude;
  let lng = exif.GPSLongitude || exif['{GPS}']?.Longitude;

  // Refs (N/S, E/W) might be needed if lat/lng are always positive
  const latRef = exif.GPSLatitudeRef || exif['{GPS}']?.LatitudeRef;
  const lngRef = exif.GPSLongitudeRef || exif['{GPS}']?.LongitudeRef;

  if (lat === undefined || lng === undefined) return null;

  // Convert DMS array to decimal if necessary (piexifjs might return array)
  // But expo-image-picker usually returns decimal for flat properties.

  // Handle refs
  if (latRef === 'S' && lat > 0) lat = -lat;
  if (lngRef === 'W' && lng > 0) lng = -lng;

  return { lat, lng };
};

/**
 * Extract data needed for transfer (GPS + Dates)
 * @param {object} exif 
 * @returns {object}
 */
export const extractTransferData = (exif) => {
  if (!exif) return {};
  const gps = extractGPS(exif);

  // Extract Dates
  // iOS keys might be DateTimeOriginal, DateTimeDigitized or inside {Exif}
  const dateTimeOriginal = exif.DateTimeOriginal || exif['{Exif}']?.DateTimeOriginal;
  const dateTimeDigitized = exif.DateTimeDigitized || exif['{Exif}']?.DateTimeDigitized;

  return {
    ...gps,
    dateTimeOriginal,
    dateTimeDigitized,
  };
};

/**
 * Convert decimal degrees to DMS (Degrees, Minutes, Seconds) rational format for EXIF.
 * @param {number} deg - Decimal degrees
 * @returns {Array} - Array of rationals [[deg, 1], [min, 1], [sec, 100]]
 */
function degToDms(deg) {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.round((minutesNotTruncated - minutes) * 60 * 100);

  return [[degrees, 1], [minutes, 1], [seconds, 100]];
}

/**
 * Create a GPS dict compatible with piexifjs.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {object} - GPS dict
 */
export const createGPSDict = (lat, lng) => {
  const gps = {};

  // Tag IDs from EXIF standard
  const GPSVersionID = 0;
  const GPSLatitudeRef = 1;
  const GPSLatitude = 2;
  const GPSLongitudeRef = 3;
  const GPSLongitude = 4;

  gps[GPSVersionID] = [2, 2, 0, 0];
  gps[GPSLatitudeRef] = lat < 0 ? 'S' : 'N';
  gps[GPSLatitude] = degToDms(lat);
  gps[GPSLongitudeRef] = lng < 0 ? 'W' : 'E';
  gps[GPSLongitude] = degToDms(lng);

  return gps;
};
