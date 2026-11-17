import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { PrimaryButton } from '../ui/components';
import { colors, radius, space } from '../ui/theme';
import { PRIVACY_URL, TERMS_URL } from '../domain/links';
import type { ProOffer } from '../services/purchases';

/**
 * Real StoreKit paywall. Prices come from the store, so the copy cannot drift
 * from what Apple charges in this region.
 *
 * Rendered as a full-screen view rather than a Modal: RN's Modal lays its
 * content against the document on web and clips the buttons off-screen.
 */
export function PaywallScreen({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store.loadOffers();
    // loadOffers is stable (useCallback with no deps) and must only run when
    // the paywall opens, not on every store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthly = store.proOffers.find((offer) => offer.plan === 'monthly');
  const lifetime = store.proOffers.find((offer) => offer.plan === 'lifetime');

  async function buy(plan: 'monthly' | 'lifetime') {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await store.buyPro(plan);
      if (outcome.status === 'purchased') {
        Alert.alert('BoxLedger Pro unlocked', 'The 30-item cap is lifted and CSV export is on.');
        onClose();
      } else if (outcome.status === 'pending') {
        Alert.alert('Waiting for approval', 'The purchase is pending approval. It unlocks once approved.');
      } else if (outcome.status === 'cancelled') {
        // Nothing to say; the user closed the sheet on purpose.
      } else {
        Alert.alert('Purchase did not complete', outcome.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (busy) return;
    setBusy(true);
    try {
      const entitled = await store.restorePro();
      if (entitled === true) {
        Alert.alert('Purchases restored', 'BoxLedger Pro is active on this Apple ID.');
        onClose();
      } else if (entitled === false) {
        Alert.alert('Nothing to restore', 'This Apple ID has no BoxLedger purchase.');
      } else {
        Alert.alert('Could not reach the App Store', 'Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const pricesUnavailable = !store.offersLoading && !monthly && !lifetime;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onClose} style={styles.closeRow}>
          <Text style={styles.close}>Close</Text>
        </Pressable>

        <Text style={styles.title}>BoxLedger Pro</Text>
        <Text style={styles.body}>
          The free tier records 30 items and keeps every sale you log. Pro lifts the item cap and
          unlocks the CSV tax export.
        </Text>

        {store.offersLoading ? <Text style={styles.note}>Loading prices from the App Store…</Text> : null}

        {lifetime ? (
          <PlanCard
            offer={lifetime}
            hint="One payment. No renewal."
            actionLabel={busy ? 'Working…' : `Buy once · ${lifetime.displayPrice}`}
            onPress={() => buy('lifetime')}
            disabled={busy}
          />
        ) : null}

        {monthly ? (
          <PlanCard
            offer={monthly}
            hint="Cancel anytime in your Apple ID settings."
            actionLabel={busy ? 'Working…' : `Subscribe · ${monthly.displayPrice}/month`}
            onPress={() => buy('monthly')}
            disabled={busy}
          />
        ) : null}

        {pricesUnavailable ? (
          <View style={styles.option}>
            <Text style={styles.optionTitle}>Prices could not be loaded</Text>
            <Text style={styles.optionHint}>
              The App Store did not return the products. Check your connection, then reopen this
              screen.
            </Text>
          </View>
        ) : null}

        <Pressable onPress={restore} disabled={busy} style={styles.keepFree}>
          <Text style={styles.keepFreeText}>Restore purchases</Text>
        </Pressable>

        {monthly ? (
          <Text style={styles.legal}>
            {monthly.title} is an auto-renewable subscription at {monthly.displayPrice} per month.
            Payment is charged to your Apple ID at confirmation. It renews automatically for the
            same period unless cancelled at least 24 hours before the period ends. Manage or cancel
            in your Apple ID settings.
          </Text>
        ) : null}

        <View style={styles.links}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.link}>Terms of Use (EULA)</Text>
          </Pressable>
          <Text style={styles.linkDot}>·</Text>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.link}>Privacy Policy</Text>
          </Pressable>
        </View>

        <Pressable onPress={onClose} style={styles.keepFree}>
          <Text style={styles.keepFreeText}>Keep using the free tier</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PlanCard({
  offer,
  hint,
  actionLabel,
  onPress,
  disabled,
}: {
  offer: ProOffer;
  hint: string;
  actionLabel: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.option}>
      <Text style={styles.optionTitle}>{offer.title || 'BoxLedger Pro'}</Text>
      <Text style={styles.optionPrice}>
        {offer.displayPrice} <Text style={styles.optionPeriod}>{offer.period}</Text>
      </Text>
      <Text style={styles.optionHint}>{hint}</Text>
      <View style={styles.optionAction}>
        <PrimaryButton label={actionLabel} onPress={onPress} disabled={disabled} />
      </View>
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
  optionPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginTop: space.xs,
  },
  optionPeriod: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inkMuted,
  },
  optionHint: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  optionAction: {
    marginTop: space.md,
  },
  note: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  legal: {
    fontSize: 11,
    color: colors.inkMuted,
    lineHeight: 16,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  link: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  linkDot: {
    color: colors.inkMuted,
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
