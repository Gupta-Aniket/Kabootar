import { Platform } from 'react-native';

import * as PERMISSIONS from 'expo-permissions';

export const requestMediaPermissions = async () => {
  const cameraPermission = Platform.select({
    ios: PERMISSIONS.IOS.CAMERA,
    android: PERMISSIONS.ANDROID.CAMERA
  });

  const microphonePermission = Platform.select({
    ios: PERMISSIONS.IOS.MICROPHONE,
    android: PERMISSIONS.ANDROID.RECORD_AUDIO
  });

  try {
    const cameraResult = await request(cameraPermission);
    const microphoneResult = await request(microphonePermission);

    return (
      cameraResult === RESULTS.GRANTED && 
      microphoneResult === RESULTS.GRANTED
    );
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
};