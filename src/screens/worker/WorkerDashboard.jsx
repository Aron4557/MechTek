import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, Platform,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
  ScrollView, Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

// ─── Themes ───────────────────────────────────────────────────────────────────
const YELLOW = '#F5A623';
const TEAL   = '#0D7377';

const LIGHT = {
  bg:        '#F8FAFC',
  card:      '#FFFFFF',
  input:     '#F1F5F9',
  text:      '#0F172A',
  subtext:   '#334155',
  muted:     '#64748B',
  border:    '#E2E8F0',
  statusBar: 'dark-content',
  headerBg:  '#FFFFFF',
};
const DARK = {
  bg:        '#0F172A',
  card:      '#1E293B',
  input:     '#0F3460',
  text:      '#F8FAFC',
  subtext:   '#94A3B8',
  muted:     '#64748B',
  border:    '#1E293B',
  statusBar: 'light-content',
  headerBg:  '#1E293B',
};

const SEV_COLOR = { Low: '#16a34a', Medium: '#D97706', High: '#EA580C', Critical: '#DC2626' };
const STA_COLOR = { Reported: '#2563EB', Repairing: '#D97706', Fixed: '#16a34a' };

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - (ts.toDate?.()?.getTime() || ts)) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function getInitial(name = '') { return name.trim().charAt(0).toUpperCase() || '?'; }

function Avatar({ name, size = 36, bg = TEAL }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.42 }}>{getInitial(name)}</Text>
    </View>
  );
}

function StatCard({ label, value, sub, valueColor, accent, t }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border, borderTopWidth: 3, borderTopColor: accent, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <Text style={{ fontSize: 10, color: t.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 30, fontWeight: '900', color: valueColor, lineHeight: 34 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 11, color: t.muted, marginTop: 4, fontWeight: '500' }}>{sub}</Text> : null}
    </View>
  );
}

function FaultCard({ fault, t }) {
  const sevColor = SEV_COLOR[fault.severity] || '#aaa';
  const staColor = STA_COLOR[fault.status]   || '#aaa';
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: sevColor, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: t.text, flex: 1, marginRight: 8 }} numberOfLines={1}>{fault.machineName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, backgroundColor: staColor + '18', borderColor: staColor + '55' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: staColor }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: staColor }}>{fault.status}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: TEAL, fontWeight: '600', marginBottom: 2 }} numberOfLines={1}>{fault.title || '—'}</Text>
      <Text style={{ fontSize: 12, color: t.muted, marginBottom: 10 }} numberOfLines={1}>{fault.description}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: sevColor + '18' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: sevColor }}>{fault.severity}</Text>
        </View>
        <Text style={{ fontSize: 11, color: t.muted }}>{timeAgo(fault.createdAt)}</Text>
      </View>
    </View>
  );
}

function ProfileTab({ user, userData, faultsCount, onLogout, isDark, onToggleTheme, t }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: t.card, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: t.border }}>
        <Avatar name={userData?.name || ''} size={80} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: t.text, marginTop: 14, marginBottom: 6 }}>{userData?.name || '—'}</Text>
        <View style={{ backgroundColor: TEAL + '18', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: TEAL + '44' }}>
          <Text style={{ color: TEAL, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{userData?.role || 'Worker'}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 16, overflow: 'hidden' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>ACCOUNT DETAILS</Text>

        {[
          { icon: 'mail-outline', lib: 'Ionicons', label: 'Email', value: user?.email || '—' },
          { icon: 'call-outline',  lib: 'Ionicons', label: 'Phone', value: userData?.phone || 'Not provided' },
        ].map((row, i) => (
          <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: t.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: TEAL + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={row.icon} size={18} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: t.muted, fontWeight: '600', marginBottom: 2 }}>{row.label}</Text>
              <Text style={{ fontSize: 14, color: t.text, fontWeight: '600' }}>{row.value}</Text>
            </View>
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, borderTopColor: t.border }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: YELLOW + '22', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={YELLOW} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: t.muted, fontWeight: '600', marginBottom: 2 }}>Total Faults Reported</Text>
            <Text style={{ fontSize: 22, color: YELLOW, fontWeight: '900' }}>{faultsCount}</Text>
          </View>
        </View>
      </View>

      {/* Settings */}
      <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 16, overflow: 'hidden' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>SETTINGS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: isDark ? '#334155' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? '#94A3B8' : YELLOW} />
            </View>
            <View>
              <Text style={{ fontSize: 14, color: t.text, fontWeight: '600' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
              <Text style={{ fontSize: 11, color: t.muted }}>Switch appearance</Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={onToggleTheme}
            trackColor={{ false: '#CBD5E0', true: TEAL + '88' }}
            thumbColor={isDark ? TEAL : '#94A3B8'}
          />
        </View>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        onPress={onLogout}
      >
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '700' }}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function WorkerDashboard({ navigation }) {
  const [isDark, setIsDark]           = useState(false);
  const [activeTab, setActiveTab]     = useState('home');
  const [userData, setUserData]       = useState(null);
  const [faults, setFaults]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const t    = isDark ? DARK : LIGHT;
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid))
      .then(s => { if (s.exists()) setUserData(s.data()); })
      .catch(e => console.log(e));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'faults'), where('reportedBy', '==', user.uid));
    return onSnapshot(q, snap => {
      setFaults(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)));
      setLoading(false); setRefreshing(false);
    }, err => { console.log(err); setLoading(false); setRefreshing(false); });
  }, [user]);

  const total  = faults.length;
  const active = faults.filter(f => f.status !== 'Fixed').length;
  const fixed  = faults.filter(f => f.status === 'Fixed').length;

  const handleLogout = () => Alert.alert('Sign Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: async () => { try { await signOut(auth); navigation.replace('Login'); } catch { Alert.alert('Error', 'Could not sign out.'); } } },
  ]);

  const handleTab = id => {
    if (id === 'report') { navigation.navigate('ReportFault'); return; }
    setActiveTab(id);
  };

  const TABS = [
    { id: 'home',    icon: 'grid-outline',         label: 'Home'    },
    { id: 'report',  icon: 'add-circle-outline',   label: 'Report'  },
    { id: 'profile', icon: 'person-outline',       label: 'Profile' },
  ];

  const firstName = (userData?.name || '').split(' ')[0].substring(0, 14);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.headerBg} translucent={false} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: Platform.OS === 'android' ? 44 : 12, backgroundColor: t.headerBg, borderBottomWidth: 1, borderBottomColor: t.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: YELLOW, letterSpacing: 2 }}>MECH</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: TEAL, letterSpacing: 2 }}>TEK</Text>
        </View>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.input, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border }} onPress={() => setActiveTab('profile')}>
          <Avatar name={userData?.name || ''} size={24} />
          <Text style={{ color: t.subtext, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{userData?.role || 'Worker'} · {firstName}</Text>
          <Ionicons name="chevron-down" size={12} color={t.muted} />
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? (
        <ProfileTab user={user} userData={userData} faultsCount={total} onLogout={handleLogout} isDark={isDark} onToggleTheme={() => setIsDark(p => !p)} t={t} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={TEAL} />}>

          <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, marginBottom: 14 }}>MY DASHBOARD</Text>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <StatCard label="Total"  value={total}  sub="all reports"  valueColor={YELLOW}    accent={YELLOW} t={t} />
            <StatCard label="Active" value={active} sub="in progress"  valueColor="#D97706"   accent="#D97706" t={t} />
            <StatCard label="Fixed"  value={fixed}  sub="resolved"     valueColor="#16a34a"   accent={TEAL} t={t} />
          </View>

          <TouchableOpacity
            style={{ backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}
            onPress={() => navigation.navigate('ReportFault')} activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 }}>Report New Fault</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, marginBottom: 12 }}>MY REPORTED FAULTS</Text>

          {loading ? (
            <ActivityIndicator color={TEAL} size="large" style={{ marginTop: 40 }} />
          ) : faults.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={52} color={t.muted} />
              <Text style={{ fontSize: 16, color: t.muted, fontWeight: '600', marginTop: 14 }}>No faults reported yet</Text>
              <Text style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>Tap the button above to get started</Text>
            </View>
          ) : (
            faults.map(f => <View key={f.id} style={{ marginBottom: 10 }}><FaultCard fault={f} t={t} /></View>)
          )}
        </ScrollView>
      )}

      {/* Tab Bar */}
      <View style={{ flexDirection: 'row', backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.border, paddingBottom: Platform.OS === 'ios' ? 20 : 40, paddingTop: 8 }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }} onPress={() => handleTab(tab.id)}>
              <Ionicons name={tab.icon} size={22} color={active ? TEAL : t.muted} />
              <Text style={{ fontSize: 10, color: active ? TEAL : t.muted, marginTop: 3, fontWeight: active ? '700' : '500' }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});