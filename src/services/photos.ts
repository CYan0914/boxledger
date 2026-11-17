import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Photos live as files next to the database, never inside it. A 3,000-item
 * inventory with a JPEG blob per row would make every list query slow.
 */
export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

export async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsMultipleSelection: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/**
 * Moves the picked image into the app's own storage so it survives the
 * temporary cache being purged. Returns the URI to persist in the database.
 */
export async function persistPhoto(uri: string, id: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const FileSystem = await import('expo-file-system/legacy');
  const dir = `${FileSystem.documentDirectory}photos/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const extension = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const target = `${dir}${id}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}
