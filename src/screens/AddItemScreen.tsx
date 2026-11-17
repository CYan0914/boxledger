import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStore } from '../state/store';
import { Field, PrimaryButton, SectionTitle, Chip } from '../ui/components';
import { colors, radius, space } from '../ui/theme';
import { parseMoneyToCents } from '../domain/format';
import { PLATFORM_ORDER, platformLabel } from '../domain/platforms';
import { pickPhoto, persistPhoto, takePhoto } from '../services/photos';
import { canAddItem } from '../data/storage';
import type { PlatformId } from '../domain/types';

export function AddItemScreen({
  onClose,
  onOpenPaywall,
}: {
  onClose: () => void;
  onOpenPaywall: () => void;
}) {
  const store = useStore();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cost, setCost] = useState('');
  const [source, setSource] = useState('');
  const [bin, setBin] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [shipping, setShipping] = useState('');
  const [notes, setNotes] = useState('');
  const [platform, setPlatform] = useState<PlatformId>('poshmark');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const remaining = Math.max(0, store.settings.freeItemLimit - store.items.length);
  const canAdd = canAddItem(store.items.length, store.settings);

  async function handlePhoto(sourceKind: 'camera' | 'library') {
    const uri = sourceKind === 'camera' ? await takePhoto() : await pickPhoto();
    if (uri) setPhotoUri(uri);
  }

  async function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError('Give the item a title so you can find it later.');
      return;
    }
    const costCents = parseMoneyToCents(cost);
    const listPriceCents = parseMoneyToCents(listPrice);
    const shippingCents = parseMoneyToCents(shipping);
    if (costCents === null || listPriceCents === null || shippingCents === null) {
      setError('Amounts must be numbers, e.g. 12.50.');
      return;
    }
    if (!canAdd) {
      onOpenPaywall();
      return;
    }
    setSaving(true);
    try {
      const result = await store.addItem({
        title,
        barcode: barcode.trim() || null,
        costCents,
        source,
        bin,
        listPriceCents: listPrice.trim() ? listPriceCents : null,
        platform,
        shippingCostCents: shippingCents,
        notes,
      });
      if (!result.ok || !result.item) {
        setSaving(false);
        onOpenPaywall();
        return;
      }
      if (photoUri) {
        const stored = await persistPhoto(photoUri, result.item.id);
        await store.updateItem({ ...result.item, photoPath: stored });
      }
      setSaving(false);
      onClose();
    } catch (e) {
      setSaving(false);
      setError('Could not save this item. Nothing was changed.');
    }
  }

  async function openScanner() {
    if (Platform.OS === 'web') {
      Alert.alert('Scanner unavailable on web', 'Type the barcode instead.');
      return;
    }
    if (!permission?.granted) {
      const answer = await requestPermission();
      if (!answer.granted) return;
    }
    setScanning(true);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>New item</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.photoRow}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoEmpty]}>
              <Text style={styles.photoEmptyText}>No photo</Text>
            </View>
          )}
          <View style={styles.photoButtons}>
            <Pressable style={styles.smallButton} onPress={() => handlePhoto('camera')}>
              <Text style={styles.smallButtonText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => handlePhoto('library')}>
              <Text style={styles.smallButtonText}>Choose photo</Text>
            </Pressable>
            {photoUri ? (
              <Pressable style={styles.smallButton} onPress={() => setPhotoUri(null)}>
                <Text style={[styles.smallButtonText, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Levi's 501, 32x30"
          autoCapitalize="sentences"
        />

        <Field
          label="Barcode"
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Scan or type"
          keyboardType="number-pad"
          hint="Optional. Speeds up future lookups."
        />
        <Pressable style={styles.smallButton} onPress={openScanner}>
          <Text style={styles.smallButtonText}>Scan barcode</Text>
        </Pressable>

        <View style={styles.twoUp}>
          <View style={styles.half}>
            <Field
              label="Cost"
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <Field
              label="List price"
              value={listPrice}
              onChangeText={setListPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.twoUp}>
          <View style={styles.half}>
            <Field
              label="Bin"
              value={bin}
              onChangeText={setBin}
              placeholder="B12"
              autoCapitalize="characters"
              hint="Where it physically sits."
            />
          </View>
          <View style={styles.half}>
            <Field
              label="Shipping cost"
              value={shipping}
              onChangeText={setShipping}
              placeholder="0.00"
              keyboardType="decimal-pad"
              hint="What you pay to ship."
            />
          </View>
        </View>

        <Field
          label="Source"
          value={source}
          onChangeText={setSource}
          placeholder="Goodwill, estate sale, lot #4..."
        />

        <Text style={styles.platformLabel}>Platform</Text>
        <View style={styles.chips}>
          {PLATFORM_ORDER.map((id) => (
            <Chip
              key={id}
              label={platformLabel(id)}
              active={platform === id}
              onPress={() => setPlatform(id)}
            />
          ))}
        </View>

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Flaws, size, where it came from"
          multiline
          style={styles.notes}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={saving ? 'Saving…' : 'Save item'}
          onPress={handleSave}
          disabled={saving}
        />
        <Text style={styles.limit}>
          {store.settings.isPro
            ? 'Paid tier — unlimited items'
            : `${remaining} of ${store.settings.freeItemLimit} free item slots left`}
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scanRoot}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
            }}
            onBarcodeScanned={({ data }) => {
              setBarcode(data);
              setScanning(false);
            }}
          />
          <View style={styles.scanOverlay}>
            <Text style={styles.scanHint}>Point at the barcode</Text>
            <Pressable style={styles.scanCancel} onPress={() => setScanning(false)}>
              <Text style={styles.scanCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  close: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: '600',
  },
  content: {
    padding: space.xl,
    gap: space.sm,
  },
  photoRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  photoEmptyText: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  photoButtons: {
    flex: 1,
    gap: 6,
  },
  smallButton: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: space.sm,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  twoUp: {
    flexDirection: 'row',
    gap: space.md,
  },
  half: {
    flex: 1,
  },
  platformLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.md,
  },
  notes: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: space.sm,
  },
  limit: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: space.sm,
  },
  scanRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.xl,
    gap: space.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scanHint: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
  scanCancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  scanCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
