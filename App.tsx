import React, { useState } from 'react';
import { Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './src/state/store';
import { HomeScreen } from './src/screens/HomeScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { AddItemScreen } from './src/screens/AddItemScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PaywallScreen } from './src/screens/PaywallSheet';
import { colors, space } from './src/ui/theme';

type Tab = 'home' | 'inventory' | 'settings';

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  if (!store.ready) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ExpoStatusBar style="dark" />
        <Text style={styles.loadingText}>Opening the ledger…</Text>
      </SafeAreaView>
    );
  }

  const openItem = (id: string) => setDetailId(id);

  // Full-screen conditional rendering rather than <Modal>: on the web preview
  // a Modal lays its content out against the document instead of the viewport,
  // which pushes long forms below the fold. A plain view is also one less
  // platform difference between iOS, Android and web.
  if (addOpen) {
    return (
      <SafeAreaView style={styles.root}>
        <ExpoStatusBar style="dark" />
        <AddItemScreen
          onClose={() => setAddOpen(false)}
          onOpenPaywall={() => {
            setAddOpen(false);
            setPaywallOpen(true);
          }}
        />
      </SafeAreaView>
    );
  }

  if (detailId) {
    return (
      <SafeAreaView style={styles.root}>
        <ExpoStatusBar style="dark" />
        <ItemDetailScreen id={detailId} onClose={() => setDetailId(null)} />
      </SafeAreaView>
    );
  }

  if (paywallOpen) {
    return (
      <SafeAreaView style={styles.root}>
        <ExpoStatusBar style="dark" />
        <PaywallScreen onClose={() => setPaywallOpen(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ExpoStatusBar style="dark" />
      <View style={styles.body}>
        {tab === 'home' ? (
          <HomeScreen onAdd={() => setAddOpen(true)} onOpenItem={openItem} />
        ) : null}
        {tab === 'inventory' ? (
          <InventoryScreen onAdd={() => setAddOpen(true)} onOpenItem={openItem} />
        ) : null}
        {tab === 'settings' ? (
          <SettingsScreen onOpenPaywall={() => setPaywallOpen(true)} />
        ) : null}
      </View>

      <View style={styles.tabBar}>
        <TabButton label="Home" active={tab === 'home'} onPress={() => setTab('home')} />
        <TabButton
          label="Inventory"
          active={tab === 'inventory'}
          onPress={() => setTab('inventory')}
        />
        <TabButton
          label="Settings"
          active={tab === 'settings'}
          onPress={() => setTab('settings')}
        />
      </View>

    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tabButton} accessibilityRole="tab">
      <View style={[styles.tabDot, active ? styles.tabDotActive : null]} />
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    color: colors.inkMuted,
    fontSize: 14,
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.card,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabDot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabDotActive: {
    backgroundColor: colors.accent,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  tabLabelActive: {
    color: colors.accent,
  },
});
