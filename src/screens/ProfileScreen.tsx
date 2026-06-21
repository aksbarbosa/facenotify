import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {supabase} from '../services/supabase';
import {removeTokenFromSupabase} from '../services/notificationService';
import {PRIMARY, BG, CARD, TEXT, TEXT2, TEXT3, BORDER, DANGER, avatarColor} from '../theme';

interface Profile  { name: string | null; address: string | null; }
interface Dependent{ id: string; name: string; }

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function SectionCard({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [email,      setEmail]      = useState('');
  const [loading,    setLoading]    = useState(true);

  const swipeBackPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_,gs) => gs.dx < -20 && Math.abs(gs.dx) > Math.abs(gs.dy)*2.5,
    onPanResponderRelease: (_,gs) => {
      if (gs.dx < -60 && Math.abs(gs.dx) > Math.abs(gs.dy)*2) navigation.goBack();
    },
  })).current;

  useEffect(() => {
    async function load() {
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');
      const [{data:prof},{data:deps}] = await Promise.all([
        supabase.from('profiles').select('name,address').eq('id',user.id).single(),
        supabase.from('dependents').select('id,name').eq('profile_id',user.id).order('created_at'),
      ]);
      if (prof) setProfile(prof);
      if (deps) setDependents(deps);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await removeTokenFromSupabase();
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const displayName = profile?.name ?? email;
  const initial     = displayName ? displayName[0].toUpperCase() : '?';
  const color       = avatarColor(displayName);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      {...swipeBackPan.panHandlers}>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, {backgroundColor: color + '22'}]}>
          <Text style={[styles.avatarText, {color}]}>{initial}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.emailText}>{email}</Text>
      </View>

      {/* Informações */}
      <SectionCard title="Informações">
        <InfoRow label="Nome"     value={profile?.name    ?? ''} />
        <View style={styles.divider} />
        <InfoRow label="E-mail"   value={email} />
        <View style={styles.divider} />
        <InfoRow label="Endereço" value={profile?.address ?? ''} />
      </SectionCard>

      {/* Dependentes */}
      <SectionCard title="Dependentes">
        {dependents.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum dependente cadastrado.</Text>
        ) : (
          dependents.map((dep, i) => (
            <View key={dep.id}>
              <View style={styles.depRow}>
                <View style={[styles.depAvatar, {backgroundColor: avatarColor(dep.name) + '22'}]}>
                  <Text style={[styles.depAvatarText, {color: avatarColor(dep.name)}]}>
                    {dep.name[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.depName}>{dep.name}</Text>
              </View>
              {i < dependents.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        )}
      </SectionCard>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered:    {flex:1, justifyContent:'center', alignItems:'center', backgroundColor: BG},
  container:   {flex:1, backgroundColor: BG},
  content:     {paddingBottom:48},
  avatarSection:{alignItems:'center', paddingTop:32, paddingBottom:28},
  avatar:      {width:84, height:84, borderRadius:42, alignItems:'center', justifyContent:'center', marginBottom:14},
  avatarText:  {fontSize:34, fontWeight:'800'},
  displayName: {fontSize:20, fontWeight:'700', color: TEXT, marginBottom:4},
  emailText:   {fontSize:13, color: TEXT3},
  section:     {marginHorizontal:16, marginBottom:16},
  sectionTitle:{fontSize:11, fontWeight:'700', color: TEXT3, letterSpacing:0.8, marginBottom:8, paddingLeft:2},
  card:        {backgroundColor: CARD, borderRadius:16, paddingHorizontal:16, paddingVertical:4},
  row:         {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:14},
  rowLabel:    {fontSize:14, color: TEXT2, flex:1},
  rowValue:    {fontSize:14, color: TEXT, fontWeight:'500', flex:2, textAlign:'right'},
  divider:     {height:1, backgroundColor: BORDER},
  depRow:      {flexDirection:'row', alignItems:'center', paddingVertical:12, gap:12},
  depAvatar:   {width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center'},
  depAvatarText:{fontSize:15, fontWeight:'700'},
  depName:     {fontSize:15, color: TEXT, fontWeight:'500'},
  emptyText:   {fontSize:14, color: TEXT3, paddingVertical:16},
  logoutBtn:   {marginHorizontal:16, marginTop:4, padding:16, borderRadius:16, backgroundColor: CARD, alignItems:'center'},
  logoutText:  {color: DANGER, fontWeight:'600', fontSize:15},
});
