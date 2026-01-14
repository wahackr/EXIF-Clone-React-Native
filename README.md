# EXIF Clone (React Native)

A powerful iOS application built with React Native and Expo to clone GPS metadata from one photo to multiple target photos. 

**Perfect for:**
- **Photographers**: Geotag DSLR/mirrorless photos using a smartphone reference photo.
- **Group Travelers**: Fix photos received via **WhatsApp** or social media that have lost their original GPS data and timestamps due to compression.

## Key Features

- **Source Selection**: Pick a reference photo to extract valid GPS coordinates.
- **Location Preview**: Visualize the source coordinate on an embedded Apple Map.
- **Batch Transfer**: Select multiple target photos to update simultaneously.
- **Smart Filtering**: Automatically ignores non-JPEG files (like HEIC) during selection to ensure compatibility and preserve image quality.
- **Safe "Save as Copy"**: Modified photos are strictly saved as **new copies** in a dedicated **"EXIF Clone"** album. Your original photos are never touched or overwritten.
- **Creation Date Sync**: Optional toggle to copy the original creation date/time from the source photo to targets.
- **Overwrite Protection**: "Overwrite Existing GPS" option acts as a safeguard. By default, the app skips photos that already have GPS data to prevent accidental data loss.

## Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd EXIF-Clone-React-Native
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## How to Run

1.  **Start the Expo development server**:
    ```bash
    npx expo start
    ```

2.  **Run on iOS**:
    -   **Physical Device**: Install the **Expo Go** app from the App Store. Scan the QR code displayed in the terminal.
    -   **Simulator (macOS only)**: Press `i` in the terminal to open the app in the iOS Simulator.

## Usage Guide

1.  **Grant Permissions**: On first launch, allow "Full Access" to your Photo Library so the app can read source files and save new copies.
2.  **Select Source**: Tap "Select Source Photo" to choose your reference image with GPS data.
3.  **Select Targets**: Tap "Select Target Photos". You can pick multiple images. Non-JPEG files will be automatically filtered out.
4.  **Configure Options**:
    -   *Copy Creation Date*: Enable if you want targets to match the source's timestamp.
    -   *Overwrite Existing GPS*: Enable only if you want to replace GPS data on photos that already have it.
5.  **Transfer**: Tap "Transfer GPS Data".
    -   Success: Updated photos appear in the **"EXIF Clone"** album in your Photos app.
    -   Skipped: Files that were not JPEGs or had existing GPS (when overwrite was off) are skipped and reported in the summary.

## Tech Stack

-   **Framework**: React Native (Expo SDK 52)
-   **EXIF Manipulation**: `piexifjs`
-   **Maps**: `react-native-maps`
-   **File System**: `expo-file-system` & `expo-media-library`

## Project Structure

-   `src/ui/`: Contains UI components and screens (e.g., `HomeScreen.js`).
-   `src/libs/`: Contains logic for GPS parsing (`gpsUtils.js`) and the core transfer engine (`transferUtils.js`).
