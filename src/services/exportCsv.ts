import { Platform } from 'react-native';

/**
 * Hands the CSV to the platform share sheet (iOS/Android) or downloads it
 * (web preview). The file is written to the cache directory, which the OS is
 * free to purge — the database remains the source of truth.
 */
export async function shareCsv(csv: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document?.createElement('a');
    if (anchor) {
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
    }
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'Export for taxes',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
