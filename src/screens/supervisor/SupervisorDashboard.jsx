// supervisor dashboard //

import React, { useState, useEffect } from 'react';
import {
  View, Text, SafeAreaView, StatusBar, Platform,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
  ScrollView, Modal, Switch, StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import {
  collection, query, onSnapshot, doc, getDoc,
  getDocs, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

// ─── Themes ───────────────────────────────────────────────────────────────────
const YELLOW = '#F5A623';
const TEAL   = '#0D7377';
const PURPLE = '#7C3AED';

const LIGHT = {
  bg: '#F8FAFC', card: '#FFFFFF', input: '#F1F5F9',
  text: '#0F172A', subtext: '#334155', muted: '#64748B',
  border: '#E2E8F0', statusBar: 'dark-content', headerBg: '#FFFFFF',
};
const DARK = {
  bg: '#0F172A', card: '#1E293B', input: '#1E3A5F',
  text: '#F8FAFC', subtext: '#94A3B8', muted: '#64748B',
  border: '#1E293B', statusBar: 'light-content', headerBg: '#1E293B',
};

const SEV_COLOR = { Low: '#16a34a', Medium: '#D97706', High: '#EA580C', Critical: '#DC2626' };
const STA_COLOR = { Reported: '#2563EB', Repairing: '#D97706', Fixed: '#16a34a' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - (ts.toDate?.()?.getTime() || ts)) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}
function getInitial(name = '') { return name.trim().charAt(0).toUpperCase() || '?'; }

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, bg = TEAL }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.42 }}>{getInitial(name)}</Text>
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, valueColor, accent, t }) {
  return (
    <View style={{ flex: 1, minWidth: '22%', backgroundColor: t.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: t.border, borderTopWidth: 3, borderTopColor: accent, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}>
      <Text style={{ fontSize: 8, color: t.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 26, fontWeight: '900', color: valueColor, lineHeight: 30 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 9, color: t.muted, marginTop: 3, fontWeight: '500' }}>{sub}</Text> : null}
    </View>
  );
}

// ─── Fault Card ───────────────────────────────────────────────────────────────
function FaultCard({ fault, onAssign, t }) {
  const sevColor = SEV_COLOR[fault.severity] || '#aaa';
  const staColor = STA_COLOR[fault.status]   || '#aaa';
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: sevColor, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: t.text, flex: 1, marginRight: 8 }} numberOfLines={1}>{fault.machineName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, backgroundColor: staColor + '18', borderColor: staColor + '55' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: staColor }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: staColor }}>{fault.status}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: TEAL, fontWeight: '600', marginBottom: 2 }} numberOfLines={1}>{fault.title || '—'}</Text>
      <Text style={{ fontSize: 12, color: t.muted, marginBottom: 10 }} numberOfLines={1}>{fault.description}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: fault.status !== 'Fixed' ? 10 : 0 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: sevColor + '18' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: sevColor }}>{fault.severity}</Text>
        </View>
        <Text style={{ fontSize: 11, color: t.muted }}>{timeAgo(fault.createdAt)}</Text>
        {fault.assignedTechnicianName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: TEAL + '18', borderWidth: 1, borderColor: TEAL + '33' }}>
            <Ionicons name="person-outline" size={10} color={TEAL} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: TEAL }}>{fault.assignedTechnicianName}</Text>
          </View>
        ) : null}
      </View>
      {fault.status !== 'Fixed' && (
        <TouchableOpacity
          style={{ backgroundColor: t.input, borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: YELLOW + '55', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
          onPress={() => onAssign(fault)} activeOpacity={0.8}
        >
          <Ionicons name={fault.assignedTechnicianId ? 'swap-horizontal-outline' : 'person-add-outline'} size={14} color={YELLOW} />
          <Text style={{ color: YELLOW, fontSize: 12, fontWeight: '700' }}>
            {fault.assignedTechnicianId ? 'Reassign Technician' : 'Assign Technician'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────
function AssignModal({ visible, fault, technicians, onClose, t }) {
  const [selected, setSelected]   = useState(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (visible) setSelected(fault?.assignedTechnicianId || null);
  }, [visible, fault]);

  const handleAssign = async () => {
    if (!selected) { Alert.alert('Select Technician', 'Please select a technician.'); return; }
    const tech = technicians.find(tc => tc.uid === selected);
    if (!tech) return;
    setAssigning(true);
    try {
      await updateDoc(doc(db, 'faults', fault.id), {
        assignedTechnicianId: tech.uid, assignedTechnicianName: tech.name, updatedAt: serverTimestamp(),
      });
      Alert.alert('Assigned', `${tech.name} assigned successfully.`);
      onClose();
    } catch { Alert.alert('Error', 'Could not assign. Try again.'); }
    finally { setAssigning(false); }
  };

  if (!fault) return null;
  const sevColor = SEV_COLOR[fault.severity] || '#aaa';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: t.text }}>Assign Technician</Text>
            <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
              <Ionicons name="close" size={18} color={t.muted} />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: sevColor }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: t.text, marginBottom: 4 }}>{fault.machineName}</Text>
            <Text style={{ fontSize: 13, color: TEAL, fontWeight: '600', marginBottom: 8 }}>{fault.title}</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: sevColor + '18', alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: sevColor }}>{fault.severity}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, marginBottom: 12 }}>SELECT TECHNICIAN</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {technicians.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="people-outline" size={40} color={t.muted} />
                <Text style={{ color: t.muted, marginTop: 12, fontSize: 14 }}>No technicians registered yet.</Text>
              </View>
            ) : technicians.map(tech => {
              const isSel = selected === tech.uid;
              return (
                <TouchableOpacity
                  key={tech.uid}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: isSel ? TEAL : t.border }}
                  onPress={() => setSelected(tech.uid)} activeOpacity={0.7}
                >
                  <Avatar name={tech.name} size={38} bg={isSel ? TEAL : '#334155'} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isSel ? TEAL : t.text, marginBottom: 2 }}>{tech.name}</Text>
                    <Text style={{ fontSize: 11, color: t.muted }}>{tech.email}</Text>
                  </View>
                  {isSel && <Ionicons name="checkmark-circle" size={22} color={TEAL} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={{ backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16, opacity: (!selected || assigning) ? 0.5 : 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            onPress={handleAssign} disabled={!selected || assigning}
          >
            {assigning
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Confirm Assignment</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ faults, t }) {
  const machineCounts = {};
  faults.forEach(f => { machineCounts[f.machineName] = (machineCounts[f.machineName] || 0) + 1; });
  const topMachines = Object.entries(machineCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const techStats = {};
  faults.forEach(f => {
    if (!f.assignedTechnicianId) return;
    if (!techStats[f.assignedTechnicianId])
      techStats[f.assignedTechnicianId] = { name: f.assignedTechnicianName || 'Unknown', total: 0, fixed: 0 };
    techStats[f.assignedTechnicianId].total++;
    if (f.status === 'Fixed') techStats[f.assignedTechnicianId].fixed++;
  });
  const techList = Object.values(techStats).sort((a, b) => b.fixed - a.fixed);

  const total     = faults.length;
  const reported  = faults.filter(f => f.status === 'Reported').length;
  const repairing = faults.filter(f => f.status === 'Repairing').length;
  const fixed     = faults.filter(f => f.status === 'Fixed').length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, marginBottom: 14 }}>ANALYTICS</Text>

      {/* Status overview */}
      <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, marginBottom: 10 }}>FAULT STATUS OVERVIEW</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Reported',  value: reported,  color: '#2563EB' },
          { label: 'Repairing', value: repairing, color: '#D97706' },
          { label: 'Fixed',     value: fixed,     color: '#16a34a' },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, backgroundColor: t.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: t.border, borderTopWidth: 3, borderTopColor: s.color }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: s.color }}>{s.value}</Text>
            <Text style={{ fontSize: 10, color: t.muted, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' }}>{s.label}</Text>
            <Text style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</Text>
          </View>
        ))}
      </View>

      {/* Most faulty machines */}
      <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, marginBottom: 10 }}>MOST FAULTY MACHINES</Text>
      <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: t.border }}>
        {topMachines.length === 0
          ? <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 12 }}>No data yet.</Text>
          : topMachines.map(([name, count], i) => (
            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: t.muted, fontWeight: '800', width: 24 }}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: t.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>{name}</Text>
                  <Text style={{ fontSize: 12, color: t.muted, fontWeight: '700' }}>{count}</Text>
                </View>
                <View style={{ height: 5, backgroundColor: t.input, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: 3, width: `${(count / total) * 100}%`, backgroundColor: i === 0 ? '#DC2626' : i === 1 ? '#EA580C' : YELLOW }} />
                </View>
              </View>
            </View>
          ))}
      </View>

      {/* Technician performance */}
      <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, marginBottom: 10 }}>TECHNICIAN PERFORMANCE</Text>
      <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: t.border }}>
        {techList.length === 0
          ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="people-outline" size={32} color={t.muted} />
              <Text style={{ color: t.muted, marginTop: 8, fontSize: 13 }}>No technicians assigned yet.</Text>
            </View>
          )
          : techList.map((tech, i) => (
            <View key={tech.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < techList.length - 1 ? 1 : 0, borderBottomColor: t.border }}>
              <Avatar name={tech.name} size={40} bg={i === 0 ? YELLOW : TEAL} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: t.text, fontWeight: '700', marginBottom: 2 }}>{tech.name}</Text>
                <Text style={{ fontSize: 11, color: t.muted }}>{tech.total} assigned · {tech.fixed} fixed</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: TEAL }}>{tech.total > 0 ? Math.round((tech.fixed / tech.total) * 100) : 0}%</Text>
                <Text style={{ fontSize: 9, color: t.muted, fontWeight: '700' }}>rate</Text>
              </View>
            </View>
          ))}
      </View>

      {/* Severity breakdown */}
      <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, marginBottom: 10 }}>SEVERITY BREAKDOWN</Text>
      <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border }}>
        {Object.entries(SEV_COLOR).map(([sev, color]) => {
          const count = faults.filter(f => f.severity === sev).length;
          return (
            <View key={sev} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color, width: 60 }}>{sev}</Text>
              <View style={{ flex: 1, height: 6, backgroundColor: t.input, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: '100%', borderRadius: 3, width: total > 0 ? `${(count / total) * 100}%` : '0%', backgroundColor: color }} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color, width: 24, textAlign: 'right' }}>{count}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ user, userData, totalFaults, onLogout, isDark, onToggleTheme, t }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {/* Hero */}
      <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: t.card, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: t.border }}>
        <Avatar name={userData?.name || ''} size={80} bg={PURPLE} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: t.text, marginTop: 14, marginBottom: 6 }}>{userData?.name || '—'}</Text>
        <View style={{ backgroundColor: PURPLE + '18', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: PURPLE + '44', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="shield-account-outline" size={12} color={PURPLE} />
          <Text style={{ color: PURPLE, fontSize: 12, fontWeight: '700' }}>Supervisor</Text>
        </View>
      </View>

      {/* Account */}
      <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 16, overflow: 'hidden' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>ACCOUNT DETAILS</Text>

        {[
          { icon: 'mail-outline',  label: 'Email Address', value: user?.email || '—',             iconBg: TEAL + '18',   iconColor: TEAL   },
          { icon: 'call-outline',  label: 'Phone Number',  value: userData?.phone || 'Not provided', iconBg: YELLOW + '18', iconColor: YELLOW },
        ].map((row, i) => (
          <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: t.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: row.iconBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={row.icon} size={18} color={row.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: t.muted, fontWeight: '600', marginBottom: 2 }}>{row.label}</Text>
              <Text style={{ fontSize: 14, color: t.text, fontWeight: '600' }}>{row.value}</Text>
            </View>
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, borderTopColor: t.border }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#DC262618', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={18} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: t.muted, fontWeight: '600', marginBottom: 2 }}>Total Faults Overseen</Text>
            <Text style={{ fontSize: 22, color: YELLOW, fontWeight: '900' }}>{totalFaults}</Text>
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
          <Switch value={isDark} onValueChange={onToggleTheme}
            trackColor={{ false: '#CBD5E0', true: TEAL + '88' }}
            thumbColor={isDark ? TEAL : '#94A3B8'} />
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SupervisorDashboard({ navigation }) {
  const [isDark, setIsDark]                  = useState(false);
  const [activeTab, setActiveTab]            = useState('home');
  const [userData, setUserData]              = useState(null);
  const [faults, setFaults]                  = useState([]);
  const [technicians, setTechnicians]        = useState([]);
  const [loadingFaults, setLoadingFaults]    = useState(true);
  const [refreshing, setRefreshing]          = useState(false);
  const [filterStatus, setFilterStatus]      = useState('All');
  const [assignFault, setAssignFault]        = useState(null);
  const [showAssignModal, setShowAssignModal]= useState(false);

  const t    = isDark ? DARK : LIGHT;
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid))
      .then(snap => { if (snap.exists()) setUserData(snap.data()); })
      .catch(e => console.log('Profile error:', e));
  }, [user]);

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then(snap => setTechnicians(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.role === 'Technician')))
      .catch(e => console.log('Tech fetch error:', e));
  }, []);

  useEffect(() => {
    setLoadingFaults(true);
    return onSnapshot(query(collection(db, 'faults')),
      snap => {
        setFaults(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)));
        setLoadingFaults(false); setRefreshing(false);
      },
      err => { console.log('Faults error:', err.message); setLoadingFaults(false); setRefreshing(false); }
    );
  }, []);

  const total      = faults.length;
  const reported   = faults.filter(f => f.status === 'Reported').length;
  const repairing  = faults.filter(f => f.status === 'Repairing').length;
  const fixed      = faults.filter(f => f.status === 'Fixed').length;
  const unassigned = faults.filter(f => !f.assignedTechnicianId && f.status !== 'Fixed').length;

  const FILTERS        = ['All', 'Reported', 'Repairing', 'Fixed'];
  const filteredFaults = filterStatus === 'All' ? faults : faults.filter(f => f.status === filterStatus);

  const handleLogout = () => Alert.alert('Sign Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: async () => {
      try { await signOut(auth); navigation.replace('Login'); }
      catch { Alert.alert('Error', 'Could not sign out.'); }
    }},
  ]);

  const firstName = (userData?.name || '').split(' ')[0].substring(0, 12);

  const TABS = [
    { id: 'home',      icon: 'grid-outline',        label: 'Dashboard' },
    { id: 'analytics', icon: 'bar-chart-outline',   label: 'Analytics' },
    { id: 'profile',   icon: 'person-outline',      label: 'Profile'   },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.headerBg} translucent={false} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: Platform.OS === 'android' ? 44 : 12, backgroundColor: t.headerBg, borderBottomWidth: 1, borderBottomColor: t.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: YELLOW, letterSpacing: 2 }}>MECH</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: TEAL, letterSpacing: 2 }}>TEK</Text>
        </View>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.input, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border }}
          onPress={() => setActiveTab('profile')}
        >
          <Avatar name={userData?.name || ''} size={24} bg={PURPLE} />
          <Text style={{ color: t.subtext, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>Supervisor · {firstName}</Text>
          <Ionicons name="chevron-down" size={12} color={t.muted} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {activeTab === 'home' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={TEAL} />}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, marginBottom: 14 }}>SUPERVISOR DASHBOARD</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <StatCard label="Total"     value={total}     sub="all faults"  valueColor={YELLOW}   accent={YELLOW}   t={t} />
            <StatCard label="Reported"  value={reported}  sub="awaiting"    valueColor="#2563EB"  accent="#2563EB"  t={t} />
            <StatCard label="Repairing" value={repairing} sub="in progress" valueColor="#D97706"  accent="#D97706"  t={t} />
            <StatCard label="Fixed"     value={fixed}     sub="completed"   valueColor="#16a34a"  accent={TEAL}     t={t} />
          </View>

          {unassigned > 0 && (
            <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FECACA', marginBottom: 14 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '600', flex: 1 }}>
                {unassigned} fault{unassigned > 1 ? 's' : ''} need{unassigned === 1 ? 's' : ''} a technician
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: filterStatus === f ? TEAL + '18' : t.input, borderWidth: 1, borderColor: filterStatus === f ? TEAL : t.border }}
                onPress={() => setFilterStatus(f)}
              >
                <Text style={{ color: filterStatus === f ? TEAL : t.muted, fontSize: 12, fontWeight: '700' }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, marginBottom: 12 }}>
            {filterStatus === 'All' ? 'ALL FAULTS' : `${filterStatus.toUpperCase()} FAULTS`}{' '}
            <Text style={{ color: t.muted }}>({filteredFaults.length})</Text>
          </Text>

          {loadingFaults ? (
            <ActivityIndicator color={TEAL} size="large" style={{ marginTop: 40 }} />
          ) : filteredFaults.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={52} color={t.muted} />
              <Text style={{ fontSize: 16, color: t.muted, fontWeight: '600', marginTop: 14 }}>No {filterStatus.toLowerCase()} faults</Text>
            </View>
          ) : (
            filteredFaults.map(fault => (
              <FaultCard key={fault.id} fault={fault}
                onAssign={f => { setAssignFault(f); setShowAssignModal(true); }} t={t} />
            ))
          )}
        </ScrollView>
      )}

      {activeTab === 'analytics' && <AnalyticsTab faults={faults} t={t} />}

      {activeTab === 'profile' && (
        <ProfileTab user={user} userData={userData} totalFaults={total} onLogout={handleLogout}
          isDark={isDark} onToggleTheme={() => setIsDark(p => !p)} t={t} />
      )}

      {/* Tab Bar */}
      <View style={{ flexDirection: 'row', backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.border, paddingBottom: Platform.OS === 'ios' ? 20 : 40, paddingTop: 8 }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }} onPress={() => setActiveTab(tab.id)}>
              <Ionicons name={tab.icon} size={22} color={active ? TEAL : t.muted} />
              <Text style={{ fontSize: 10, color: active ? TEAL : t.muted, marginTop: 3, fontWeight: active ? '700' : '500' }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AssignModal visible={showAssignModal} fault={assignFault} technicians={technicians}
        onClose={() => { setShowAssignModal(false); setAssignFault(null); }} t={t} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});
