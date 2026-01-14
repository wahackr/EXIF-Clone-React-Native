import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { extractGPS, extractTransferData } from '../../libs/gpsUtils';
import { transferEXIF } from '../../libs/transferUtils';

export default function HomeScreen() {
  const [sourcePhoto, setSourcePhoto] = useState(null);
  const [sourceLocation, setSourceLocation] = useState(null);
  const [targetPhotos, setTargetPhotos] = useState([]);
  const [copyDate, setCopyDate] = useState(false);
  const [overwriteGPS, setOverwriteGPS] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const handleSelectSource = async () => {
    if (!permissionStatus?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to use this app.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        exif: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSourcePhoto(asset);

        const location = extractGPS(asset.exif);
        setSourceLocation(location);

        if (!location) {
          Alert.alert('No GPS Data', 'The selected photo does not contain GPS location data.');
        }
      }
    } catch (error) {
      console.log('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const handleSelectTargets = async () => {
    if (!permissionStatus?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to use this app.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        const validAssets = [];
        let ignoredCount = 0;

        for (const asset of result.assets) {
          const isJpeg = asset.fileName?.toLowerCase().endsWith('.jpg') ||
            asset.fileName?.toLowerCase().endsWith('.jpeg') ||
            asset.uri.toLowerCase().endsWith('.jpg') ||
            asset.uri.toLowerCase().endsWith('.jpeg');

          if (isJpeg) {
            validAssets.push(asset);
          } else {
            ignoredCount++;
          }
        }

        if (ignoredCount > 0) {
          Alert.alert('Ignored Non-JPEG Files', `${ignoredCount} file(s) were ignored because they are not JPEG format.`);
        }

        setTargetPhotos(prev => {
          const newPhotos = [...prev];
          for (const asset of validAssets) {
            if (!newPhotos.some(p => p.uri === asset.uri)) {
              newPhotos.push(asset);
            }
          }
          return newPhotos;
        });
      }
    } catch (error) {
      console.log('Error selecting targets:', error);
      Alert.alert('Error', 'Failed to select target images.');
    }
  };

  const handleClearTargets = () => {
    setTargetPhotos([]);
  };

  const handleTransfer = async () => {
    if (!sourcePhoto) {
      Alert.alert('Missing Source', 'Please select a source photo with GPS data.');
      return;
    }
    if (!sourceLocation) { // Ensure source has GPS
      Alert.alert('Invalid Source', 'Source photo must have GPS data.');
      return;
    }
    if (targetPhotos.length === 0) {
      Alert.alert('Missing Targets', 'Please select at least one target photo.');
      return;
    }

    setIsTransferring(true);

    try {
      // Prepare source data
      const sourceData = extractTransferData(sourcePhoto.exif);

      const result = await transferEXIF(
        sourceData,
        targetPhotos,
        { copyDate, overwriteGPS },
        (current, total) => {
          // Optional: Update detailed progress state if needed
          console.log(`Processed ${current}/${total}`);
        }
      );

      if (result.failed === 0 && result.skipped === 0) {
        Alert.alert('Success', `Successfully transferred GPS data to ${result.success} photos.\nSaved in "EXIF Clone" album.`);
        setTargetPhotos([]); // Clear targets on success
      } else {
        let msg = `Processed: ${result.success}`;
        if (result.skipped > 0) msg += `\nSkipped: ${result.skipped}`;
        if (result.failed > 0) msg += `\nFailed: ${result.failed}`;
        msg += `\nCheck console for details.`;

        Alert.alert('Transfer Results', msg);
        // Only clear targets if everything succeeded or skipped (no catastrophic failures)
        if (result.failed === 0) setTargetPhotos([]);
      }

    } catch (error) {
      console.log('Transfer error:', error);
      Alert.alert('Error', 'An error occurred during transfer.');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>EXIF Clone</Text>

        {/* Source Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Source Photo</Text>
          {sourcePhoto ? (
            <View style={styles.selectedContainer}>
              <Image source={{ uri: sourcePhoto.uri }} style={styles.thumbnail} />
              <View style={styles.infoContainer}>
                <Text style={styles.infoText} numberOfLines={1}>{sourcePhoto.fileName || 'Selected Image'}</Text>
                {sourceLocation ? (
                  <Text style={styles.locationText}>📍 {sourceLocation.lat.toFixed(5)}, {sourceLocation.lng.toFixed(5)}</Text>
                ) : (
                  <Text style={styles.warningText}>⚠️ No GPS Data</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No source selected</Text>
            </View>
          )}

          {/* Map Preview */}
          {sourceLocation && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: sourceLocation.lat,
                  longitude: sourceLocation.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker coordinate={{ latitude: sourceLocation.lat, longitude: sourceLocation.lng }} />
              </MapView>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSelectSource}>
            <Text style={styles.buttonText}>{sourcePhoto ? 'Change Source Photo' : 'Select Source Photo'}</Text>
          </TouchableOpacity>
        </View>

        {/* Target Section */}
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Target Photos</Text>
            {targetPhotos.length > 0 && (
              <TouchableOpacity onPress={handleClearTargets}>
                <Text style={styles.clearText}>Clear ({targetPhotos.length})</Text>
              </TouchableOpacity>
            )}
          </View>

          {targetPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.targetList}>
              {targetPhotos.map((photo, index) => (
                <Image key={index} source={{ uri: photo.uri }} style={styles.targetThumbnail} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No targets selected</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSelectTargets}>
            <Text style={styles.buttonText}>{targetPhotos.length > 0 ? 'Add More Targets' : 'Select Target Photos'}</Text>
          </TouchableOpacity>
        </View>

        {/* Options Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Options</Text>
          <View style={styles.optionRow}>
            <Text style={styles.optionText}>Copy Creation Date from Source</Text>
            <Switch
              value={copyDate}
              onValueChange={setCopyDate}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={copyDate ? "#007AFF" : "#f4f3f4"}
            />
          </View>
          <Text style={styles.optionDesc}>Also copies original date/time to target photos.</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>Overwrite Existing GPS</Text>
            <Switch
              value={overwriteGPS}
              onValueChange={setOverwriteGPS}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={overwriteGPS ? "#007AFF" : "#f4f3f4"}
            />
          </View>
          <Text style={styles.optionDesc}>If off, skips photos that already have GPS data.</Text>
        </View>

        {/* Action Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, styles.actionButton, isTransferring && styles.disabledButton]}
            onPress={handleTransfer}
            disabled={isTransferring}
          >
            {isTransferring ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Transfer GPS Data</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#444',
  },
  placeholder: {
    height: 150,
    backgroundColor: '#eee',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  placeholderText: {
    color: '#888',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#34C759',
  },
  disabledButton: {
    backgroundColor: '#9ccc9c',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
  },
  mapContainer: {
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  targetList: {
    marginBottom: 12,
  },
  targetThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionDesc: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
});
