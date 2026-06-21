import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {RecognitionEvent} from '../types/recognition';
import {PRIMARY, BG, CARD, TEXT, TEXT2, TEXT3, BORDER, avatarColor} from '../theme';

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function confidenceLabel(score: number): string {
  const pct = Math.round(score * 100);
  const tag  = pct >= 90 ? 'Alta' : pct >= 75 ? 'Média' : 'Baixa';
  return `${pct}% — ${tag}`;
}

export default function DetailScreen({route}: {route: any}) {
  const event: RecognitionEvent = route.params.event;
  const {location} = event;
  const color  = avatarColor(event.person_name);
  const initial= event.person_name.charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={[styles.avatar, {backgroundColor: color + '22'}]}>
          <Text style={[styles.avatarText, {color}]}>{initial}</Text>
        </View>
        <Text style={styles.heroName}>{event.person_name}</Text>
        <Text style={styles.heroSub}>
          {new Date(event.timestamp).toLocaleString('pt-BR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
        </Text>

        {/* Badge acesso */}
        <View style={[styles.heroBadge, {backgroundColor: event.access_granted ? '#f0fdf4' : '#fef2f2', marginBottom: 8}]}>
          <View style={[styles.heroBadgeDot, {backgroundColor: event.access_granted ? '#16a34a' : '#dc2626'}]} />
          <Text style={[styles.heroBadgeText, {color: event.access_granted ? '#16a34a' : '#dc2626'}]}>
            {event.access_granted ? 'Acesso liberado' : 'Acesso negado'}
          </Text>
        </View>

        {/* Badge confiança */}
        {(() => {
          const pct   = Math.round(event.confidence * 100);
          const clr   = pct>=90?'#16a34a':pct>=75?'#d97706':'#dc2626';
          const bg    = pct>=90?'#f0fdf4':pct>=75?'#fffbeb':'#fef2f2';
          return (
            <View style={[styles.heroBadge, {backgroundColor: bg}]}>
              <View style={[styles.heroBadgeDot, {backgroundColor: clr}]} />
              <Text style={[styles.heroBadgeText, {color: clr}]}>{pct}% confiança</Text>
            </View>
          );
        })()}
      </View>

      {/* Local */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LOCAL</Text>
        <View style={styles.card}>
          <InfoRow label="Câmera"   value={location.camera_label} />
          <View style={styles.div} />
          <InfoRow label="Endereço" value={location.address} />
          <View style={styles.div} />
          <InfoRow label="Cidade"   value={location.city} />
          <View style={styles.div} />
          <InfoRow label="Estado"   value={location.state} />
        </View>
      </View>

      {/* Reconhecimento */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECONHECIMENTO</Text>
        <View style={styles.card}>
          <InfoRow label="Acesso"      value={event.access_granted ? '✅ Liberado' : '⚠️ Negado'} />
          <View style={styles.div} />
          <InfoRow label="Data e hora" value={formatDate(event.timestamp)} />
          <View style={styles.div} />
          <InfoRow label="Confiança"   value={confidenceLabel(event.confidence)} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  {flex:1, backgroundColor: BG},
  content:    {paddingBottom:48},
  hero:       {alignItems:'center', paddingTop:32, paddingBottom:28, paddingHorizontal:24},
  avatar:     {width:80, height:80, borderRadius:40, alignItems:'center', justifyContent:'center', marginBottom:14},
  avatarText: {fontSize:32, fontWeight:'800'},
  heroName:   {fontSize:22, fontWeight:'700', color: TEXT, marginBottom:4},
  heroSub:    {fontSize:13, color: TEXT3, marginBottom:14},
  heroBadge:  {flexDirection:'row', alignItems:'center', gap:6, borderRadius:20, paddingHorizontal:14, paddingVertical:7},
  heroBadgeDot:{width:7, height:7, borderRadius:4},
  heroBadgeText:{fontSize:13, fontWeight:'700'},
  section:    {marginHorizontal:16, marginBottom:16},
  sectionTitle:{fontSize:11, fontWeight:'700', color: TEXT3, letterSpacing:0.8, marginBottom:8, paddingLeft:2},
  card:       {backgroundColor: CARD, borderRadius:16, paddingHorizontal:16, paddingVertical:4},
  row:        {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:14},
  rowLabel:   {fontSize:14, color: TEXT2, flex:1},
  rowValue:   {fontSize:14, color: TEXT, fontWeight:'500', flex:2, textAlign:'right'},
  div:        {height:1, backgroundColor: BORDER},
});
