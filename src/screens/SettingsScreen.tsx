import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useStore } from '../state/store';
import { Card, Divider, Field, PrimaryButton, SectionTitle } from '../ui/components';
import { colors, radius, space } from '../ui/theme';
import { buildTaxCsv } from '../domain/csv';
import { shareCsv } from '../services/exportCsv';
import { parseMoneyToCents, parsePercent, percentToInput } from '../domain/format';
import type { PlatformFeeConfig } from '../domain/fees';
import type { PlatformId } from '../domain/types';
import { platformLabel } from '../domain/platforms';

export function SettingsScreen({ onOpenPaywall }: { onOpenPaywall: () => void }) {
  const store = useStore();
  const [openPlatform, setOpenPlatform] = useState<PlatformId | null>(null);
  const [draft, setDraft] = useState<PlatformFeeConfig[]>(store.configs);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [staleDraft, setStaleDraft] = useState(String(store.settings.staleDays));
  const [taxDraft, setTaxDraft] = useState(
    String(Math.round(store.settings.defaultTaxReservePct * 100))
  );

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(store.configs),
    [draft, store.configs]
  );

  function updateConfig(id: PlatformId, patch: Partial<PlatformFeeConfig>) {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function updateRule(
    id: PlatformId,
    index: number,
    patch: { maxCents?: number | null; percent?: number; flatCents?: number | null }
  ) {
    setDraft((prev) =>
      prev.map((config) => {
        if (config.id !== id) return config;
        const rules = config.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule));
        return { ...config, rules };
      })
    );
  }

  async function saveFees() {
    await store.saveConfigs(draft);
    setSavedAt(new Date().toLocaleTimeString());
  }

  async function savePreferences() {
    const days = Math.max(1, Math.round(Number(staleDraft) || store.settings.staleDays));
    const tax = parsePercent(taxDraft);
    await store.saveSettings({
      ...store.settings,
      staleDays: days,
      defaultTaxReservePct: tax ?? store.settings.defaultTaxReservePct,
    });
    setStaleDraft(String(days));
    Alert.alert('Saved', `Stale reminder set to ${days} days.`);
  }

  async function exportCsv() {
    if (!store.settings.isPro) {
      onOpenPaywall();
      return;
    }
    const csv = buildTaxCsv(store.items);
    const stamp = new Date().toISOString().slice(0, 10);
    await shareCsv(csv, `boxledger-tax-${stamp}.csv`);
  }

  function confirmReset() {
    Alert.alert(
      'Delete everything?',
      'Every item, every fee edit and every setting will be removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            await store.resetAll();
            setDraft(store.configs);
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View>
        <SectionTitle>Platform fee table</SectionTitle>
        <Text style={styles.blurb}>
          Every rate used to calculate profit comes from this table. Rates change; each platform shows
          the date its defaults were last checked. Edit any row and save.
        </Text>
      </View>

      {draft.map((config) => {
        const open = openPlatform === config.id;
        return (
          <Card key={config.id} style={styles.feeCard}>
            <Pressable
              onPress={() => setOpenPlatform(open ? null : config.id)}
              style={styles.feeHeader}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.feeName}>{config.label}</Text>
                <Text style={styles.feeMeta}>
                  Checked {config.dataDate} · {config.mode === 'marginal' ? 'tiered by portion' : 'one rule for the whole sale'}
                </Text>
              </View>
              <Text style={styles.chev}>{open ? '−' : '+'}</Text>
            </Pressable>

            {open ? (
              <View style={styles.feeEditor}>
                {config.rules.map((rule, index) => (
                  <View key={index} style={styles.ruleRow}>
                    <View style={styles.ruleField}>
                      <Text style={styles.tinyLabel}>Up to $</Text>
                      <TextInput
                        defaultValue={
                          rule.maxCents === null ? '' : String(rule.maxCents / 100)
                        }
                        placeholder="∞"
                        keyboardType="decimal-pad"
                        style={styles.tinyInput}
                        onChangeText={(text) => {
                          if (text.trim() === '') {
                            updateRule(config.id, index, { maxCents: null });
                            return;
                          }
                          const cents = parseMoneyToCents(text);
                          if (cents !== null) updateRule(config.id, index, { maxCents: cents });
                        }}
                      />
                    </View>
                    <View style={styles.ruleField}>
                      <Text style={styles.tinyLabel}>Fee %</Text>
                      <TextInput
                        defaultValue={rule.percent === undefined ? '' : String(rule.percent)}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        style={styles.tinyInput}
                        onChangeText={(text) => {
                          if (text.trim() === '') {
                            updateRule(config.id, index, { percent: 0 });
                            return;
                          }
                          const value = Number(text);
                          if (Number.isFinite(value)) {
                            updateRule(config.id, index, {
                              percent: value,
                              flatCents: null,
                            });
                          }
                        }}
                      />
                    </View>
                    <View style={styles.ruleField}>
                      <Text style={styles.tinyLabel}>Or flat $</Text>
                      <TextInput
                        defaultValue={
                          rule.flatCents === undefined || rule.flatCents === null
                            ? ''
                            : String(rule.flatCents / 100)
                        }
                        placeholder="—"
                        keyboardType="decimal-pad"
                        style={styles.tinyInput}
                        onChangeText={(text) => {
                          if (text.trim() === '') {
                            updateRule(config.id, index, { flatCents: null });
                            return;
                          }
                          const cents = parseMoneyToCents(text);
                          if (cents !== null) {
                            updateRule(config.id, index, { flatCents: cents, percent: 0 });
                          }
                        }}
                      />
                    </View>
                  </View>
                ))}

                <View style={styles.twoUp}>
                  <View style={styles.half}>
                    <Field
                      label="Processing %"
                      defaultValue={String(config.processingPercent)}
                      keyboardType="decimal-pad"
                      onChangeText={(text) => {
                        const value = Number(text);
                        if (Number.isFinite(value)) {
                          updateConfig(config.id, { processingPercent: value });
                        }
                      }}
                    />
                  </View>
                  <View style={styles.half}>
                    <Field
                      label="+ Fixed $"
                      defaultValue={
                        config.processingFixedCents ? String(config.processingFixedCents / 100) : ''
                      }
                      keyboardType="decimal-pad"
                      onChangeText={(text) => {
                        const cents = parseMoneyToCents(text);
                        if (cents !== null) {
                          updateConfig(config.id, { processingFixedCents: cents });
                        }
                      }}
                    />
                  </View>
                </View>

                <Field
                  label="Listing fee $"
                  defaultValue={config.listingFeeCents ? String(config.listingFeeCents / 100) : ''}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => {
                    const cents = parseMoneyToCents(text);
                    if (cents !== null) updateConfig(config.id, { listingFeeCents: cents });
                  }}
                />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Fee also applies to shipping</Text>
                    <Text style={styles.switchHint}>Turn off if the platform charges on item price only.</Text>
                  </View>
                  <Switch
                    value={config.feeOnShipping}
                    onValueChange={(value) => updateConfig(config.id, { feeOnShipping: value })}
                  />
                </View>

                <Text style={styles.source}>{config.notes}</Text>
                <Text style={styles.sourceUrl}>{config.sourceUrl}</Text>
              </View>
            ) : null}
          </Card>
        );
      })}

      <PrimaryButton
        label={dirty ? 'Save fee table' : 'Fee table saved'}
        onPress={saveFees}
        disabled={!dirty}
      />
      {savedAt ? <Text style={styles.savedAt}>Saved at {savedAt}</Text> : null}

      <View>
        <SectionTitle>Stale inventory</SectionTitle>
        <Card>
          <Field
            label="Remind me after (days)"
            value={staleDraft}
            onChangeText={setStaleDraft}
            keyboardType="number-pad"
            hint="Clock starts when the item is listed, or at intake if never listed."
          />
          <Field
            label="Default tax reserve %"
            value={taxDraft}
            onChangeText={setTaxDraft}
            keyboardType="decimal-pad"
            hint="Applied to new items. 0 means no reserve."
          />
          <PrimaryButton label="Save preferences" onPress={savePreferences} tone="quiet" />
        </Card>
      </View>

      <View>
        <SectionTitle>Tax export</SectionTitle>
        <Card>
          <Text style={styles.blurb}>
            Sold items only: date, item, cost, sale price, platform fee, profit.
          </Text>
          <PrimaryButton label="Export CSV" onPress={exportCsv} />
          {!store.settings.isPro ? (
            <Text style={styles.locked}>CSV export is part of the paid tier.</Text>
          ) : null}
        </Card>
      </View>

      <View>
        <SectionTitle>Plan</SectionTitle>
        <Card>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>
                {store.settings.isPro ? 'Paid tier (placeholder)' : 'Free tier'}
              </Text>
              <Text style={styles.switchHint}>
                {store.items.length} of {store.settings.freeItemLimit} item slots used. Payments are
                not implemented in this build; this switch stands in for StoreKit.
              </Text>
            </View>
            <Switch
              value={store.settings.isPro}
              onValueChange={(value) =>
                store.saveSettings({ ...store.settings, isPro: value })
              }
            />
          </View>
          <Divider />
          <Text style={styles.prices}>$39 one-time · $4.99/month</Text>
          <Pressable onPress={onOpenPaywall} style={styles.linkRow}>
            <Text style={styles.link}>Open the paywall</Text>
          </Pressable>
        </Card>
      </View>

      <View>
        <SectionTitle>Data</SectionTitle>
        <Card>
          <Text style={styles.blurb}>
            Everything lives on this phone. No account, no sync, no server. Photos are files in the
            app's own storage; the database only stores their paths.
          </Text>
          <Divider />
          <Pressable onPress={confirmReset} style={styles.linkRow}>
            <Text style={[styles.link, { color: colors.danger }]}>Delete all data</Text>
          </Pressable>
        </Card>
      </View>

      <Text style={styles.version}>
        BoxLedger 1.0.0 · {Platform.OS} · fee defaults checked 2026-11-17
      </Text>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.xl,
    paddingTop: space.xxl,
    gap: space.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.ink,
  },
  blurb: {
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 19,
  },
  feeCard: {
    padding: 0,
    overflow: 'hidden',
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
  },
  feeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  feeMeta: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  chev: {
    fontSize: 20,
    color: colors.inkMuted,
    width: 20,
    textAlign: 'center',
  },
  feeEditor: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: space.md,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  ruleField: {
    flex: 1,
  },
  tinyLabel: {
    fontSize: 10,
    color: colors.inkMuted,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tinyInput: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
  },
  twoUp: {
    flexDirection: 'row',
    gap: space.md,
  },
  half: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  switchHint: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  source: {
    fontSize: 11,
    color: colors.inkMuted,
    lineHeight: 16,
  },
  sourceUrl: {
    fontSize: 10,
    color: colors.accent,
  },
  savedAt: {
    fontSize: 11,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  locked: {
    fontSize: 11,
    color: colors.warn,
    marginTop: space.sm,
  },
  prices: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '600',
    paddingVertical: space.sm,
  },
  linkRow: {
    paddingVertical: space.sm,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  version: {
    fontSize: 11,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
