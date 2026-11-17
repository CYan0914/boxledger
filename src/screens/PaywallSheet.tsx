import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { PrimaryButton } from '../ui/components';
import { colors, radius, space } from '../ui/theme';

/**
 * Placeholder paywall. No StoreKit / Play Billing in this build. The unlock
 * button flips the local `isPro` flag so the rest of the product (30-item cap,
 * CSV export) can be exercised and tested now.
 *
 * Rendered as a full-screen view rather than a Modal: RN's Modal lays its
 * content against the document on web and clips the buttons off-screen.
 */
export function PaywallScreen({ onClose }: { onClose: () => void }) {
  const store = useStore();

  async function unlockPlaceholder() {
    await store.saveSettings({ ...store.settings, isPro: true });
    onClose();
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onClose} style={styles.closeRow}>
          <Text style={styles.close}>Close</Text>
        </Pressable>

        <Text style={styles.title}>Pay once, or $4.99 a month</Text>
        <Text style={styles.body}>
          The free tier records 30 items. The paid tier lifts that cap and unlocks the CSV tax
          export.
        </Text>

        <View style={styles.option}>
          <Text style={styles.optionTitle}>$39 one-time</Text>
          <Text style={styles.optionHint}>No renewal. Yours forever.</Text>
        </View>
        <View style={styles.option}>
          <Text style={styles.optionTitle}>$4.99 / month</Text>
          <Text style={styles.optionHint}>Cancel anytime.</Text>
        </View>

        <PrimaryButton label="Unlock in this build (placeholder)" onPress={unlockPlaceholder} />
        <Text style={styles.note}>
          Payments are not implemented yet. This button flips the local paid flag so the cap and CSV
          export can be tested. StoreKit and Play Billing plug in here later.
        </Text>

        <Pressable onPress={onClose} style={styles.keepFree}>
          <Text style={styles.keepFreeText}>Keep using the free tier</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  closeRow: {
    alignItems: 'flex-end',
    paddingTop: space.lg,
  },
  close: {
    color: colors.accent,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  option: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: space.lg,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  optionHint: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  note: {
    fontSize: 11,
    color: colors.inkMuted,
    lineHeight: 16,
  },
  keepFree: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  keepFreeText: {
    fontSize: 13,
    color: colors.inkMuted,
  },
});
