# ReelVault 🎬

A premium Instagram Reel and Story downloader built with React Native and Expo. Download your favorite content directly to your gallery without any login requirements.

## 🚀 Features

- **Reel Downloader**: Paste a link and download high-quality videos.
- **Story Viewer**: View and download public stories via username.
- **Premium UI**: Sleek dark mode design with glassmorphism effects and smooth transitions.
- **No Login Required**: Fully privacy-focused, no Instagram credentials needed.
- **Auto-Paste**: Detects Instagram links from your clipboard automatically.

## 🛠️ Tech Stack

- **Framework**: Expo (React Native)
- **Networking**: Axios
- **Storage**: Expo FileSystem & Media Library
- **Icons**: Lucide React Native
- **Multimedia**: Expo AV

## 🏃 How to Run

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure Backend**:
   Edit `services/api.js` and set your `BASE_URL`.
3. **Start Expo Go**:
   ```bash
   npx expo start
   ```
4. **Open on your device**:
   Scan the QR code with the Expo Go app (Android) or Camera app (iOS).

## 📂 Project Structure

- `components/`: Reusable UI components.
- `screens/`: Main application screens (Reels, Stories).
- `services/api.js`: Axios configuration and API calls.
- `utils/download.js`: Logic for file downloading and gallery saving.
- `constants/Theme.js`: Centralized theme tokens.
- `backend/`: Node.js Express server to handle scraping logic.

## ⚙️ Backend Setup (Free)

The backend is built with Node.js and can be deployed for free on platforms like [Render](https://render.com) or [Railway](https://railway.app).

1. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```
2. **Run locally**:
   ```bash
   npm start
   ```
3. **Deploy**:
   - Create a new web service on Render.
   - Connect your GitHub repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Copy the provided URL and paste it into `reelvault/services/api.js`.

## 📱 Creating an APK (Android)

To create an APK for your device, use **EAS Build**:

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```
2. **Log in to Expo**:
   ```bash
   eas login
   ```
3. **Configure Project**:
   ```bash
   eas build:configure
   ```
4. **Build APK**:
   Run the following command to generate a build that can be installed on Android devices:
   ```bash
   eas build --platform android --profile preview
   ```
   *Note: Using `--profile preview` will generate an `.apk` file instead of an `.aab` file.*
5. **Download and Install**:
   Once the build is complete, EAS will provide a link to download the APK.

## 🚀 Deployment (App)

- **Expo Go**: The fastest way to share with friends. Run `npx expo start` and share the QR.
- **Production**: Follow the Expo documentation to submit to Google Play or Apple App Store.

## ⚠️ Notes

- Story fetching in the backend is a placeholder. For full functionality, consider integrating `instagram-private-api` with a session cookie or a third-party scraping service.
- Ensure the backend URL in `services/api.js` excludes the trailing slash.

