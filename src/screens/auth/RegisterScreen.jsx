import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

const YELLOW = '#F5A623';
const TEAL   = '#0D7377';
const BG     = '#F8FAFC';
const CARD   = '#FFFFFF';
const INPUT  = '#F1F5F9';
const BORDER = '#E2E8F0';
const TEXT   = '#0F172A';
const MUTED  = '#64748B';

const ROLES = [
  { id: 'Worker',     label: 'Worker',     desc: 'Report & track faults',   icon: 'wrench' },
  { id: 'Technician', label: 'Technician', desc: 'Resolve assigned faults', icon: 'cog'   },
  { id: 'Supervisor', label: 'Supervisor', desc: 'Manage & oversee all',    icon: 'shield-account' },
];

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [phone, setPhone]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [selectedRole, setSelectedRole] = useState('Worker');
  const [loading, setLoading]           = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.'); return;
    }
    if (password.length < 6) { Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }

    setLoading(true);
    let createdUser = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      createdUser = cred.user;
      await setDoc(doc(db, 'users', createdUser.uid), {
        uid:       createdUser.uid,
        name:      fullName.trim(),
        email:     email.trim().toLowerCase(),
        phone:     phone.trim() || '',
        role:      selectedRole,
        createdAt: serverTimestamp(),
        isActive:  true,
      });
      Alert.alert('Account Created', `Welcome, ${fullName.trim()}! You can now sign in.`, [
        { text: 'Sign In', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err) {
      if (createdUser && err.code !== 'auth/email-already-in-use') {
        try { await deleteUser(createdUser); } catch (_) {}
      }
      let msg = 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      else if (err.code === 'auth/invalid-email')   msg = 'Invalid email format.';
      else if (err.code === 'auth/weak-password')   msg = 'Password is too weak.';
      Alert.alert('Registration Failed', msg);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.brandLogoRow}>
            <Text style={styles.brandMech}>MECH</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandTek}>TEK</Text>
          </View>
          <Text style={styles.brandSub}>Maintenance Management System</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.cardSub}>Fill in your details to get started</Text>

          {/* Full Name */}
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Your full name" placeholderTextColor={MUTED}
              value={fullName} onChangeText={setFullName} autoCapitalize="words" />
          </View>

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="you@company.com" placeholderTextColor={MUTED}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>

          {/* Phone */}
          <Text style={styles.label}>Phone Number <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="+264 81 000 0000" placeholderTextColor={MUTED}
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Min. 6 characters" placeholderTextColor={MUTED}
              value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Re-enter password" placeholderTextColor={MUTED}
              value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} />
            <TouchableOpacity onPress={() => setShowConfirm(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>

          {/* Role */}
          <Text style={styles.label}>Select Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => {
              const active = selectedRole === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  onPress={() => setSelectedRole(r.id)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name={r.icon} size={26} color={active ? TEAL : MUTED} />
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>CREATE ACCOUNT</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <Text style={styles.linkBold}>Sign In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 48 },

  brand: { alignItems: 'center', marginBottom: 32 },
  brandLogoRow: { flexDirection: 'row', alignItems: 'center' },
  brandMech:    { fontSize: 36, fontWeight: '900', color: YELLOW, letterSpacing: 4 },
  brandDivider: { width: 2, height: 34, backgroundColor: BORDER, marginHorizontal: 8, borderRadius: 1 },
  brandTek:     { fontSize: 36, fontWeight: '900', color: TEAL, letterSpacing: 4 },
  brandSub:     { fontSize: 12, color: MUTED, marginTop: 6 },

  card: {
    backgroundColor: CARD, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 4, borderWidth: 1, borderColor: BORDER,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: MUTED, marginBottom: 20 },

  label:    { fontSize: 12, fontWeight: '700', color: TEXT, marginBottom: 8, marginTop: 14, letterSpacing: 0.3 },
  optional: { fontWeight: '400', color: MUTED },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: INPUT, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, paddingVertical: 13, fontSize: 14, color: TEXT },
  eyeBtn:    { padding: 4 },

  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  roleCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 4,
    borderRadius: 12, backgroundColor: INPUT,
    alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: BORDER,
  },
  roleCardActive: { borderColor: TEAL, backgroundColor: TEAL + '12' },
  roleLabel:      { fontSize: 11, fontWeight: '700', color: MUTED, textAlign: 'center' },
  roleLabelActive:{ color: TEAL },
  roleDesc:       { fontSize: 8, color: MUTED, textAlign: 'center', lineHeight: 12 },

  btn: {
    backgroundColor: TEAL, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 22, marginBottom: 16,
  },
  btnText:  { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1.5 },
  linkRow:  { flexDirection: 'row', justifyContent: 'center' },
  linkText: { color: MUTED, fontSize: 13 },
  linkBold: { color: TEAL, fontSize: 13, fontWeight: '700' },
});