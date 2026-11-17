import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { Card, Divider, PrimaryButton, SectionTitle, StatTile } from '../ui/components';
import { colors, radius, space } from '../ui/theme';
import { formatMoney } from '../domain/profit';
import { daysSince } from '../domain/dates';
import { platformLabel } from '../domain/platforms';

export function HomeScreen({
  onAdd,
  onOpenItem,
}: {
  onAdd: () => void;
  onOpenItem: (id: string) => void;
}) {
  const store = useStore();
  const stale = store.staleItems;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>BoxLedger</Text>
        <Text style={styles.tagline}>Know what you have. Know where it is. Know what you made.</Text>
      </View>

      <Card>
        <View style={styles.statsRow}>
          <StatTile value={String(store.inStockCount)} label="In stock" />
          <StatTile value={formatMoney(store.inventoryCostCents)} label="Tied up in stock" />
          <StatTile
            value={formatMoney(store.monthProfitCents)}
            label="Profit this month"
            tone={store.monthProfitCents >= 0 ? 'good' : 'warn'}
          />
        </View>
        <Divider />
        <Text style={styles.caption}>
          {store.settings.isPro
            ? `Paid tier · ${store.items.length} items recorded`
            : `${store.items.length} of ${store.settings.freeItemLimit} free item slots used`}
        </Text>
      </Card>

      <PrimaryButton label="Add an item" onPress={onAdd} />

      <View>
        <SectionTitle>Stale — {store.settings.staleDays}+ days unsold</SectionTitle>
        <Card>
          {stale.length === 0 ? (
            <Text style={styles.empty}>Nothing has been sitting too long. Good.</Text>
          ) : (
            <>
              <Text style={styles.staleCount}>
                {stale.length} item{stale.length === 1 ? '' : 's'} to review
              </Text>
              <Divider />
              {stale.slice(0, 3).map((item) => (
                <Text
                  key={item.id}
                  onPress={() => onOpenItem(item.id)}
                  style={styles.staleRow}
                  numberOfLines={1}
                >
                  <Text style={styles.staleBin}>{item.bin || '—'}</Text>
                  {'  '}
                  {item.title}
                  <Text style={styles.staleMeta}>
                    {'  '}· {daysSince(item.listedAt ?? item.createdAt)}d · {platformLabel(item.platform)}
                  </Text>
                </Text>
              ))}
              {stale.length > 3 ? (
                <Text style={styles.more}>+{stale.length - 3} more in Inventory</Text>
              ) : null}
            </>
          )}
        </Card>
      </View>

      <View>
        <SectionTitle>How profit is calculated</SectionTitle>
        <Card>
          <Text style={styles.explain}>
            Sale price − platform fee − shipping you paid − what you paid for it − tax reserve.
          </Text>
          <Text style={styles.explainMuted}>
            Fee rates are editable in Settings and show the date they were last checked. They change
            often; the app never hides that.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.xl,
    paddingBottom: 120,
    gap: space.lg,
  },
  header: {
    paddingTop: space.sm,
    gap: 4,
  },
  brand: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.ink,
  },
  tagline: {
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  caption: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  empty: {
    fontSize: 14,
    color: colors.inkMuted,
  },
  staleCount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  staleRow: {
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 7,
  },
  staleBin: {
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  staleMeta: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  more: {
    marginTop: space.sm,
    fontSize: 12,
    color: colors.inkMuted,
  },
  explain: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  explainMuted: {
    marginTop: space.sm,
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 18,
  },
});
