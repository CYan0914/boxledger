import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useStore } from '../state/store';
import { Card, Divider, Field, PrimaryButton, SectionTitle } from '../ui/components';
import { colors, radius, space } from '../ui/theme';
import { computeProfit, formatMoney, recordedProfit } from '../domain/profit';
import { centsToInput, parseMoneyToCents, parsePercent } from '../domain/format';
import { platformLabel, STATUS_LABELS } from '../domain/platforms';
import { daysSince } from '../domain/dates';

export function ItemDetailScreen({ id, onClose }: { id: string; onClose: () => void }) {
  const store = useStore();
  const item = store.items.find((i) => i.id === id);
  const [selling, setSelling] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [shipping, setShipping] = useState('');
  const [taxPct, setTaxPct] = useState('');
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!item) return null;
    const saleCents = parseMoneyToCents(salePrice) ?? 0;
    const shippingCents = parseMoneyToCents(shipping) ?? 0;
    const tax = parsePercent(taxPct) ?? 0;
    return computeProfit(item, store.configs, {
      salePriceCents: saleCents,
      shippingCostCents: shippingCents,
      taxReservePct: tax,
    });
  }, [item, store.configs, salePrice, shipping, taxPct]);

  if (!item) {
    return (
      <View style={styles.root}>
        <Text style={styles.missing}>This item no longer exists.</Text>
        <PrimaryButton label="Close" onPress={onClose} tone="quiet" />
      </View>
    );
  }

  const profit = recordedProfit(item);

  function beginSelling() {
    if (!item) return;
    setSelling(true);
    if (salePrice === '') setSalePrice(centsToInput(item.listPriceCents));
    setShipping(centsToInput(item.shippingCostCents));
    setTaxPct(String(Math.round(item.taxReservePct * 100)));
    setError(null);
  }

  async function confirmSale() {
    if (!item) return;
    const saleCents = parseMoneyToCents(salePrice);
    const shippingCents = parseMoneyToCents(shipping);
    const tax = parsePercent(taxPct);
    if (saleCents === null || shippingCents === null || tax === null) {
      setError('Check the amounts. Use numbers like 24.50 and 0 for no tax reserve.');
      return;
    }
    if (saleCents <= 0) {
      setError('Enter what it actually sold for.');
      return;
    }
    await store.markSold(item.id, {
      salePriceCents: saleCents,
      shippingCostCents: shippingCents,
      taxReservePct: tax,
    });
    setSelling(false);
  }

  function confirmDelete() {
    if (!item) return;
    Alert.alert('Delete this item?', 'Its record and profit will be removed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await store.deleteItem(item.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {item.photoPath ? <Image source={{ uri: item.photoPath }} style={styles.photo} /> : null}

        <Card>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{STATUS_LABELS[item.status]}</Text>
          </View>
          <Divider />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Platform</Text>
            <Text style={styles.metaValue}>{platformLabel(item.platform)}</Text>
          </View>
          <Divider />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Bin</Text>
            <Text style={styles.metaValue}>{item.bin || 'Unassigned'}</Text>
          </View>
          <Divider />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Cost</Text>
            <Text style={styles.metaValue}>{formatMoney(item.costCents)}</Text>
          </View>
          <Divider />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>List price</Text>
            <Text style={styles.metaValue}>
              {item.listPriceCents === null ? '—' : formatMoney(item.listPriceCents)}
            </Text>
          </View>
          <Divider />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Source</Text>
            <Text style={styles.metaValue} numberOfLines={2}>
              {item.source || '—'}
            </Text>
          </View>
          {item.barcode ? (
            <>
              <Divider />
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Barcode</Text>
                <Text style={styles.metaValue}>{item.barcode}</Text>
              </View>
            </>
          ) : null}
          <Divider />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>In the system</Text>
            <Text style={styles.metaValue}>{daysSince(item.createdAt)} days</Text>
          </View>
          {item.notes ? (
            <>
              <Divider />
              <Text style={styles.notes}>{item.notes}</Text>
            </>
          ) : null}
        </Card>

        {item.status === 'in_stock' ? (
          <PrimaryButton label="Mark as listed" onPress={() => store.markListed(item.id)} />
        ) : null}

        {item.status !== 'sold' && !selling ? (
          <PrimaryButton label="Sold it" onPress={beginSelling} tone="quiet" />
        ) : null}

        {selling ? (
          <Card>
            <SectionTitle>Sell it</SectionTitle>
            <Field
              label="Sale price"
              value={salePrice}
              onChangeText={setSalePrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Field
              label="Shipping you paid"
              value={shipping}
              onChangeText={setShipping}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Field
              label="Tax reserve %"
              value={taxPct}
              onChangeText={setTaxPct}
              keyboardType="decimal-pad"
              placeholder="0"
              hint="Set aside a slice of the sale for taxes. Default 0."
            />

            {preview ? (
              <>
                <Divider />
                <BreakdownRow label="Sale price" value={formatMoney(preview.salePriceCents)} />
                <BreakdownRow label="Platform fee" value={`−${formatMoney(preview.platformFeeCents)}`} />
                {preview.processingFeeCents > 0 ? (
                  <BreakdownRow
                    label="Processing"
                    value={`−${formatMoney(preview.processingFeeCents)}`}
                  />
                ) : null}
                {preview.orderFeeCents > 0 ? (
                  <BreakdownRow label="Per-order fee" value={`−${formatMoney(preview.orderFeeCents)}`} />
                ) : null}
                {preview.listingFeeCents > 0 ? (
                  <BreakdownRow label="Listing fee" value={`−${formatMoney(preview.listingFeeCents)}`} />
                ) : null}
                <BreakdownRow label="Shipping" value={`−${formatMoney(preview.shippingCostCents)}`} />
                <BreakdownRow label="Item cost" value={`−${formatMoney(preview.costCents)}`} />
                {preview.taxReserveCents > 0 ? (
                  <BreakdownRow label="Tax reserve" value={`−${formatMoney(preview.taxReserveCents)}`} />
                ) : null}
                <Divider />
                <BreakdownRow strong label="Real profit" value={formatMoney(preview.profitCents)} />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={{ marginTop: space.md }}>
              <PrimaryButton label="Confirm sale" onPress={confirmSale} />
            </View>
            <Pressable onPress={() => setSelling(false)} style={styles.cancelRow}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Card>
        ) : null}

        {item.status === 'sold' && profit !== null ? (
          <Card>
            <SectionTitle>Sold — {item.soldAt?.slice(0, 10)}</SectionTitle>
            <BreakdownRow label="Sale price" value={formatMoney(item.salePriceCents ?? 0)} />
            <BreakdownRow label="Platform fees" value={`−${formatMoney(item.feeCents ?? 0)}`} />
            <BreakdownRow label="Shipping" value={`−${formatMoney(item.shippingCostCents)}`} />
            <BreakdownRow label="Item cost" value={`−${formatMoney(item.costCents)}`} />
            {item.taxReservePct > 0 ? (
              <BreakdownRow
                label={`Tax reserve (${Math.round(item.taxReservePct * 100)}%)`}
                value={`−${formatMoney(Math.round((item.salePriceCents ?? 0) * item.taxReservePct))}`}
              />
            ) : null}
            <Divider />
            <BreakdownRow strong label="Real profit" value={formatMoney(profit)} />
          </Card>
        ) : null}

        <Pressable onPress={confirmDelete} style={styles.deleteRow}>
          <Text style={styles.deleteText}>Delete item</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, strong ? styles.strongText : null]}>{label}</Text>
      <Text style={[styles.breakdownValue, strong ? styles.strongText : null]}>{value}</Text>
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
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.sm,
  },
  title: {
    flex: 1,
    fontSize: 22,
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
    gap: space.md,
    paddingBottom: 60,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: 2,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  metaValue: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  notes: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  breakdownValue: {
    fontSize: 14,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  strongText: {
    fontWeight: '700',
    color: colors.ink,
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: space.sm,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  cancelText: {
    color: colors.inkMuted,
    fontSize: 14,
  },
  deleteRow: {
    alignItems: 'center',
    paddingVertical: space.lg,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  missing: {
    textAlign: 'center',
    margin: space.xxl,
    color: colors.inkMuted,
  },
});
