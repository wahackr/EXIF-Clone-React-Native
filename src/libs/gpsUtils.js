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
/**
 * Convert a decimal number to a rational [numerator, denominator].
 * Simplified approach: use 100/1000/etc as denominator.
 */
function toRational(num) {
  if (num === undefined || num === null) return null;
  const m = String(num).split('.');
  let denominator = 1;
  if (m.length > 1) {
    denominator = Math.pow(10, m[1].length);
  }
  const numerator = Math.round(num * denominator);
  if (isNaN(numerator) || isNaN(denominator)) return null;
  return [numerator, denominator];
}

/**
 * Restore original EXIF data from Expo's flat format to piexif object.
 * Useful when image conversion strips metadata (e.g. HEIC -> JPEG).
 */
export const restoreOriginalExif = (exifObj, originalExif) => {
  if (!originalExif) return exifObj;

  // Initialize IFDs if missing
  if (!exifObj['0th']) exifObj['0th'] = {};
  if (!exifObj['Exif']) exifObj['Exif'] = {};

  // --- 0th IFD ---
  // Make (271)
  if (!exifObj['0th'][271] && originalExif.Make) {
    exifObj['0th'][271] = originalExif.Make;
  }
  // Model (272)
  if (!exifObj['0th'][272] && originalExif.Model) {
    exifObj['0th'][272] = originalExif.Model;
  }
  // Software (305)
  if (!exifObj['0th'][305] && originalExif.Software) {
    exifObj['0th'][305] = originalExif.Software;
  }

  // --- Exif IFD ---

  // ExposureTime (33434) - Rational
  if (!exifObj['Exif'][33434] && originalExif.ExposureTime) {
    exifObj['Exif'][33434] = toRational(originalExif.ExposureTime);
  }

  // FNumber (33437) - Rational
  if (!exifObj['Exif'][33437] && originalExif.FNumber) {
    exifObj['Exif'][33437] = toRational(originalExif.FNumber);
  }

  // ISOSpeedRatings (34855) - Short
  if (!exifObj['Exif'][34855] && originalExif.ISOSpeedRatings) {
    exifObj['Exif'][34855] = originalExif.ISOSpeedRatings;
  }

  // DateTimeOriginal (36867) - String
  if (!exifObj['Exif'][36867] && originalExif.DateTimeOriginal) {
    exifObj['Exif'][36867] = originalExif.DateTimeOriginal;
  }

  // DateTimeDigitized (36868) - String
  if (!exifObj['Exif'][36868] && originalExif.DateTimeDigitized) {
    exifObj['Exif'][36868] = originalExif.DateTimeDigitized;
  }

  // ShutterSpeedValue (37377) - SRational
  if (!exifObj['Exif'][37377] && originalExif.ShutterSpeedValue) {
    exifObj['Exif'][37377] = toRational(originalExif.ShutterSpeedValue);
  }

  // ApertureValue (37378) - Rational
  if (!exifObj['Exif'][37378] && originalExif.ApertureValue) {
    exifObj['Exif'][37378] = toRational(originalExif.ApertureValue);
  }

  // ExposureBiasValue (37380) - SRational
  if (!exifObj['Exif'][37380] && originalExif.ExposureBiasValue) {
    exifObj['Exif'][37380] = toRational(originalExif.ExposureBiasValue);
  }

  // MeteringMode (37383) - Short
  if (!exifObj['Exif'][37383] && originalExif.MeteringMode) {
    exifObj['Exif'][37383] = originalExif.MeteringMode;
  }

  // Flash (37385) - Short
  if (!exifObj['Exif'][37385] && originalExif.Flash) {
    exifObj['Exif'][37385] = originalExif.Flash;
  }

  // FocalLength (37386) - Rational
  if (!exifObj['Exif'][37386] && originalExif.FocalLength) {
    exifObj['Exif'][37386] = toRational(originalExif.FocalLength);
  }

  // WhiteBalance (41987) - Short
  if (!exifObj['Exif'][41987] && originalExif.WhiteBalance) {
    exifObj['Exif'][41987] = originalExif.WhiteBalance;
  }

  // LensMake (42035) - String
  if (!exifObj['Exif'][42035] && originalExif.LensMake) {
    exifObj['Exif'][42035] = originalExif.LensMake;
  }

  // LensModel (42036) - String
  if (!exifObj['Exif'][42036] && originalExif.LensModel) {
    exifObj['Exif'][42036] = originalExif.LensModel;
  }

  return exifObj;
};
