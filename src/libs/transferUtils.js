import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import piexif from 'piexifjs';
import { createGPSDict } from './gpsUtils';

/**
 * Transfer GPS data (and optionally date) from source to targets.
 * @param {object} sourceData - { lat, lng, dateTimeOriginal, dateTimeDigitized }
 * @param {Array} targetPhotos - Array of target assets
 * @param {object} options - { copyDate: boolean, overwriteGPS: boolean }
 * @param {function} onProgress - Callback (processedCount, total)
 * @returns {Promise<object>} - { success: number, failed: number, errors: [] }
 */
export const transferEXIF = async (sourceData, targetPhotos, options, onProgress) => {
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  let errors = [];

  const ALBUM_NAME = 'EXIF Clone';
  let album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);

  for (let i = 0; i < targetPhotos.length; i++) {
    const target = targetPhotos[i];
    try {
      console.log(`[Transfer] Processing file #${i + 1}: ${target.fileName}`);

      // 1. Check if conversion is needed
      const isJpeg = target.fileName?.toLowerCase().endsWith('.jpg') ||
        target.fileName?.toLowerCase().endsWith('.jpeg') ||
        target.uri.toLowerCase().endsWith('.jpg') ||
        target.uri.toLowerCase().endsWith('.jpeg');

      let finalUri = target.uri;

      if (!isJpeg) {
        console.log(`[Transfer] Skipped: Not a JPEG (${target.fileName})`);
        errors.push({ file: target.fileName, error: 'Skipped: Not a JPEG (HEIC/PNG not compatible without conversion)' });
        skippedCount++; // Mark as skipped
        if (onProgress) onProgress(i + 1, targetPhotos.length);
        continue;
      }

      // 2. Read file as Base64
      const base64 = await FileSystem.readAsStringAsync(finalUri, {
        encoding: 'base64',
      });

      // 3. Load existing EXIF
      const dataUri = 'data:image/jpeg;base64,' + base64;
      const exifObj = piexif.load(dataUri);

      // 4. Update GPS
      const hasGPS = exifObj.GPS && Object.keys(exifObj.GPS).length > 0;
      let gpsUpdated = false;

      if (hasGPS && !options.overwriteGPS) {
        console.log(`[Transfer] Skipped: Target has GPS and overwrite is OFF (${target.fileName})`);
        skippedCount++;
        errors.push({ file: target.fileName, error: 'Skipped: Has existing GPS (Overwrite Disabled)' });
        if (onProgress) onProgress(i + 1, targetPhotos.length);
        continue;
      } else if (sourceData.lat !== undefined && sourceData.lng !== undefined) {
        exifObj['GPS'] = createGPSDict(sourceData.lat, sourceData.lng);
        gpsUpdated = true;
      }

      // 5. Update Date if enabled
      if (options.copyDate && sourceData.dateTimeOriginal) {
        exifObj['Exif'][36867] = sourceData.dateTimeOriginal;
        exifObj['Exif'][36868] = sourceData.dateTimeDigitized || sourceData.dateTimeOriginal;
        exifObj['0th'][306] = sourceData.dateTimeOriginal;
      }

      // 6. Create new modified image data
      // Preserve thumbnail if present (piexif logic handles this automatically in dump/insert usually, 
      // but we are just modifying specific tags).

      const exifBytes = piexif.dump(exifObj);

      // Insert back into the original base64
      const newCtx = piexif.insert(exifBytes, dataUri);
      const newBase64 = newCtx.replace(/^data:image\/[a-z]+;base64,/, '');

      // 7. Write to temp file
      const tempUri = FileSystem.documentDirectory + 'temp_' + target.fileName;
      await FileSystem.writeAsStringAsync(tempUri, newBase64, {
        encoding: 'base64',
      });

      // 8. Save to Media Library
      const asset = await MediaLibrary.createAssetAsync(tempUri);

      // 9. Add to Album
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        album = await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
      }
      // console.log(`[Transfer] Success! Saved asset: ${asset.id}`); // Optional log

      // Cleanup temp
      await FileSystem.deleteAsync(tempUri, { idempotent: true });

      successCount++;
    } catch (error) {
      console.error(`[Transfer] ERROR processing ${target.fileName}:`, error);
      failCount++;
      errors.push({ file: target.fileName, error: error.message });
    }

    if (onProgress) {
      onProgress(i + 1, targetPhotos.length);
    }
  }

  return { success: successCount, failed: failCount, skipped: skippedCount, errors };
};
