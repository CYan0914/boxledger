import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useStore } from '../state/store';
import { filterItems } from '../data/storage';
import { Chip } from '../ui/components';
import { colors, radius, space } from '../ui/theme';
import { formatMoney, recordedProfit } from '../domain/profit';
import { PLATFORM_ORDER, platformLabel, STATUS_LABELS } from '../domain/platforms';
import type { Item, PlatformId } from '../domain/types';

type StatusFilter = Item['status'] | 'all';

export function InventoryScreen({
  onAdd,
  onOpenItem,
}: {
  onAdd: () => void;
  onOpenItem: (id: string) => void;
}) {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PlatformId | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const results = useMemo(
    () => filterItems(store.items, query, platform, status),
    [store.items, query, platform, status]
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.count}>
          {results.length} of {store.items.length}
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search title, barcode or bin (B12)"
        placeholderTextColor={colors.inkMuted}
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {(['all', 'in_stock', 'listed', 'sold'] as StatusFilter[]).map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? 'All' : STATUS_LABELS[value]}
            active={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Chip label="Any platform" active={platform === 'all'} onPress={() => setPlatform('all')} />
        {PLATFORM_ORDER.map((id) => (
          <Chip
            key={id}
            label={platformLabel(id)}
            active={platform === id}
            onPress={() => setPlatform(id)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No items match this filter.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpenItem(item.id)} style={styles.row}>
            {item.photoPath ? (
              <Image source={{ uri: item.photoPath }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Text style={styles.thumbBin}>{item.bin || '—'}</Text>
              </View>
            )}
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {platformLabel(item.platform)}
                {item.bin ? ` · ${item.bin}` : ''}
                {item.listPriceCents ? ` · list ${formatMoney(item.listPriceCents)}` : ''}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.statusPill, statusStyle(item.status)]}>
                {STATUS_LABELS[item.status]}
              </Text>
              <Text style={styles.rowMoney}>
                {item.status === 'sold'
                  ? formatMoney(recordedProfit(item) ?? 0)
                  : formatMoney(item.costCents)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable onPress={onAdd} style={styles.fab} accessibilityRole="button">
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </View>
  );
}

function statusStyle(status: Item['status']) {
  if (status === 'sold') return { color: colors.good, backgroundColor: colors.goodSoft };
  if (status === 'listed') return { color: colors.accent, backgroundColor: colors.accentSoft };
  return { color: colors.warn, backgroundColor: colors.warnSoft };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.ink,
  },
  count: {
    fontSize: 13,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  search: {
    marginHorizontal: space.xl,
    marginTop: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
  },
  chipRow: {
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  list: {
    paddingHorizontal: space.xl,
    paddingBottom: 120,
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: space.md,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBin: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rowMoney: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    textAlign: 'center',
    color: colors.inkMuted,
    marginTop: space.xxl,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabLabel: {
    color: colors.onAccent,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '400',
  },
});
