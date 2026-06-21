import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Alert,
} from 'react-native';
import {Calendar} from 'react-native-calendars';
import {useNavigation} from '@react-navigation/native';
import {useNotifications} from '../store/notificationsStore';
import {useUser} from '../store/userStore';
import {getFCMToken} from '../services/notificationService';
import {RecognitionEvent} from '../types/recognition';
import {PRIMARY, BG, CARD, TEXT, TEXT2, TEXT3, BORDER, avatarColor as themeAvatarColor} from '../theme';

export {avatarColor} from '../theme';

const {height: SCREEN_H} = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.88;

const STATUS_H  = StatusBar.currentHeight ?? 24;
const NAV_H     = 56;
const SEARCH_H  = 68;
const SECTION_H = 48;
const CARD_HEIGHT = Math.floor((SCREEN_H - STATUS_H - NAV_H - SEARCH_H - SECTION_H) / 5);

// ─── Utilitários ─────────────────────────────────────────────────────────────
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
}

function sectionLabel(d: string): string {
  const today     = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (d === today)     return 'Hoje';
  if (d === yesterday) return 'Ontem';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
}

function groupByDate(evts: RecognitionEvent[]) {
  const map: Record<string, RecognitionEvent[]> = {};
  for (const e of evts) {
    const day = e.timestamp.split('T')[0];
    if (!map[day]) map[day] = [];
    map[day].push(e);
  }
  return Object.entries(map)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([day, data]) => ({title: sectionLabel(day), count: data.length, data}));
}

function buildMarkedDates(start: string, end: string) {
  if (!start) return {};
  const marked: any = {};
  const cur  = new Date(start);
  const last = end ? new Date(end) : new Date(start);
  while (cur <= last) {
    const key = cur.toISOString().split('T')[0];
    marked[key] = {color: PRIMARY, textColor:'#fff', startingDay: key===start, endingDay: key===end||(!end&&key===start)};
    cur.setDate(cur.getDate() + 1);
  }
  return marked;
}

// ─── Componentes ─────────────────────────────────────────────────────────────
function AccessBadge({granted}: {granted: boolean}) {
  return (
    <View style={[badge.wrap, {backgroundColor: granted ? '#f0fdf4' : '#fef2f2'}]}>
      <View style={[badge.dot, {backgroundColor: granted ? '#16a34a' : '#dc2626'}]} />
      <Text style={[badge.text, {color: granted ? '#16a34a' : '#dc2626'}]}>
        {granted ? 'Liberado' : 'Negado'}
      </Text>
    </View>
  );
}

function ConfidenceBadge({score}: {score: number}) {
  const pct   = Math.round(score * 100);
  const color = pct >= 90 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626';
  const bg    = pct >= 90 ? '#f0fdf4' : pct >= 75 ? '#fffbeb' : '#fef2f2';
  return (
    <View style={[badge.wrap, {backgroundColor: bg}]}>
      <View style={[badge.dot, {backgroundColor: color}]} />
      <Text style={[badge.text, {color}]}>{pct}%</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: {flexDirection:'row', alignItems:'center', borderRadius:10, paddingHorizontal:8, paddingVertical:4, gap:4},
  dot:  {width:5, height:5, borderRadius:3},
  text: {fontSize:11, fontWeight:'700'},
});

function EventCard({event, onPress, isLast}: {event: RecognitionEvent; onPress:()=>void; isLast:boolean}) {
  const color = themeAvatarColor(event.person_name);
  return (
    <TouchableOpacity
      style={[styles.card, {height: CARD_HEIGHT}, !isLast && styles.cardBorder]}
      onPress={onPress}
      activeOpacity={0.6}>
      <View style={[styles.cardAccent, {backgroundColor: color}]} />
      <View style={[styles.cardAvatar, {backgroundColor: color + '22'}]}>
        <Text style={[styles.cardAvatarText, {color}]}>
          {event.person_name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>{event.person_name}</Text>
          <Text style={styles.cardTime}>{relativeTime(event.timestamp)}</Text>
        </View>
        <Text style={styles.cardCamera} numberOfLines={1}>{event.location.camera_label}</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {event.location.city}, {event.location.state}
          </Text>
          <View style={styles.cardBadges}>
            <AccessBadge granted={event.access_granted} />
            <ConfidenceBadge score={event.confidence} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({title, count}: {title:string; count:number}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionPill}>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const {events, subscribe}            = useNotifications();
  const {state: userState, subscribe: subscribeUser} = useUser();
  const [search, setSearch]            = useState('');
  const [filterDep, setFilterDep]      = useState('Todos');
  const [dateStart, setDateStart]      = useState('');
  const [dateEnd,   setDateEnd]        = useState('');
  const [sheetVisible, setSheetVisible]= useState(false);
  const slideAnim   = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetScrollY= useRef(0);

  useEffect(() => subscribe(),      [subscribe]);
  useEffect(() => subscribeUser(),  [subscribeUser]);

  const depOptions = ['Todos', ...userState.dependents.map(d => d.name)];

  const openSheet = useCallback(() => {
    slideAnim.setValue(SHEET_HEIGHT);
    setSheetVisible(true);
    Animated.spring(slideAnim, {toValue:0, useNativeDriver:true, bounciness:4}).start();
  }, [slideAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(slideAnim, {toValue:SHEET_HEIGHT, duration:240, useNativeDriver:true})
      .start(() => { setSheetVisible(false); slideAnim.setValue(SHEET_HEIGHT); });
  }, [slideAnim]);

  const headerPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_,gs) => { if(gs.dy>0) slideAnim.setValue(gs.dy); },
    onPanResponderRelease: (_,gs) => {
      if (gs.dy>60||gs.vy>0.4) closeSheet();
      else Animated.spring(slideAnim,{toValue:0,useNativeDriver:true,bounciness:6}).start();
    },
    onPanResponderTerminate: () => Animated.spring(slideAnim,{toValue:0,useNativeDriver:true}).start(),
  })).current;

  const bodyPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_,gs) =>
      sheetScrollY.current<=0 && gs.dy>10 && gs.dy>Math.abs(gs.dx)*1.5,
    onPanResponderMove: (_,gs) => { if(gs.dy>0) slideAnim.setValue(gs.dy); },
    onPanResponderRelease: (_,gs) => {
      if (gs.dy>60||gs.vy>0.4) closeSheet();
      else Animated.spring(slideAnim,{toValue:0,useNativeDriver:true,bounciness:6}).start();
    },
    onPanResponderTerminate: () => Animated.spring(slideAnim,{toValue:0,useNativeDriver:true}).start(),
  })).current;

  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_,gs) =>
      !sheetVisible && gs.dx>20 && gs.dx>Math.abs(gs.dy)*2.5,
    onPanResponderRelease: (_,gs) => {
      if (gs.dx>60 && gs.dx>Math.abs(gs.dy)*2) navigation.navigate('Profile');
    },
  })).current;

  function onDayPress(day: any) {
    if (!dateStart||(dateStart&&dateEnd)) { setDateStart(day.dateString); setDateEnd(''); }
    else if (day.dateString<dateStart)   { setDateStart(day.dateString); setDateEnd(''); }
    else if (day.dateString===dateStart) { setDateStart(''); }
    else                                 { setDateEnd(day.dateString); }
  }

  const filtered = events.filter(e => {
    const ms = search===''||
      e.person_name.toLowerCase().includes(search.toLowerCase())||
      e.location.city.toLowerCase().includes(search.toLowerCase());
    const md = filterDep==='Todos'||e.person_name===filterDep;
    const day= e.timestamp.split('T')[0];
    const mdt= !dateStart||(day>=dateStart&&day<=(dateEnd||dateStart));
    return ms&&md&&mdt;
  });

  const sections   = groupByDate(filtered);
  const markedDates= buildMarkedDates(dateStart, dateEnd);
  const dateLabel  = dateStart
    ? (dateEnd&&dateEnd!==dateStart ? `${dateStart} → ${dateEnd}` : dateStart)
    : '';
  const hasFilter  = filterDep!=='Todos'||!!dateStart;

  return (
    <View style={styles.container} {...swipePan.panHandlers}>

      {/* Busca + Filtro */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar..."
            placeholderTextColor={TEXT3}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length>0 && (
            <TouchableOpacity onPress={()=>setSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, hasFilter && styles.filterBtnActive]}
          onPress={openSheet}
          activeOpacity={0.7}>
          <Text style={[styles.filterGear, hasFilter && styles.filterGearActive]}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <SectionList
        sections={sections}
        keyExtractor={item=>item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({section}) => (
          <SectionHeader title={section.title} count={section.count} />
        )}
        renderSectionFooter={() => <View style={styles.sectionGap} />}
        renderItem={({item, index, section}) => (
          <EventCard
            event={item}
            isLast={index===section.data.length-1}
            onPress={() => navigation.navigate('Detail', {event: item})}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Nenhum reconhecimento encontrado</Text>
            {hasFilter && (
              <TouchableOpacity onPress={()=>{setFilterDep('Todos');setDateStart('');setDateEnd('');}}>
                <Text style={[styles.emptyAction, {color: PRIMARY}]}>Limpar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Sheet */}
      <Modal transparent visible={sheetVisible} animationType="none" statusBarTranslucent onRequestClose={closeSheet}>
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.sheet, {transform:[{translateY:slideAnim}]}]}>
          <View {...headerPan.panHandlers} style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filtrar</Text>
          </View>
          <View style={styles.sheetBody} {...bodyPan.panHandlers}>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetLabel}>Dependente</Text>
              <View style={styles.chips}>
                {depOptions.map(d=>(
                  <TouchableOpacity key={d}
                    style={[styles.chip, filterDep===d && styles.chipActive]}
                    onPress={()=>setFilterDep(d)} activeOpacity={0.7}>
                    <Text style={[styles.chipText, filterDep===d && styles.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.sheetSection}>
              <View style={styles.sheetLabelRow}>
                <Text style={styles.sheetLabel}>Período</Text>
                {dateStart&&(
                  <TouchableOpacity onPress={()=>{setDateStart('');setDateEnd('');}}>
                    <Text style={styles.dateClear}>Limpar</Text>
                  </TouchableOpacity>
                )}
              </View>
              {dateLabel
                ? <Text style={[styles.dateSelected, {color: PRIMARY}]}>{dateLabel}</Text>
                : <Text style={styles.datePlaceholder}>Toque em uma data para selecionar</Text>
              }
              <Calendar
                markingType="period"
                markedDates={markedDates}
                onDayPress={onDayPress}
                maxDate={new Date().toISOString().split('T')[0]}
                enableSwipeMonths
                theme={{
                  selectedDayBackgroundColor: PRIMARY,
                  todayTextColor: PRIMARY,
                  arrowColor: PRIMARY,
                  textDayFontSize:14,
                  textMonthFontSize:15,
                  textMonthFontWeight:'600',
                  calendarBackground:'transparent',
                  backgroundColor:'transparent',
                }}
              />
            </View>
          </View>
          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.clearBtn}
              onPress={()=>{setFilterDep('Todos');setDateStart('');setDateEnd('');}}>
              <Text style={styles.clearBtnText}>Limpar tudo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.applyBtn, {backgroundColor: PRIMARY}]} onPress={closeSheet}>
              <Text style={styles.applyBtnText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  {flex:1, backgroundColor: BG},
  searchWrap: {flexDirection:'row', paddingHorizontal:16, paddingTop:12, paddingBottom:8, gap:10, alignItems:'center'},
  searchBox:  {flex:1, flexDirection:'row', alignItems:'center', backgroundColor: CARD, borderRadius:14, paddingHorizontal:12, paddingVertical:10, gap:8},
  searchIcon: {fontSize:15},
  searchInput:{flex:1, fontSize:14, color: TEXT, padding:0},
  clearIcon:  {fontSize:13, color: TEXT3, paddingHorizontal:4},
  filterBtn:  {width:44, height:44, borderRadius:14, backgroundColor: CARD, alignItems:'center', justifyContent:'center'},
  filterBtnActive: {backgroundColor: PRIMARY},
  filterGear: {fontSize:20},
  filterGearActive: {tintColor:'#fff'}, // não funciona em emoji, mas mantemos para semântica
  list:       {paddingHorizontal:16, paddingBottom:40},
  sectionHeader: {flexDirection:'row', alignItems:'center', gap:8, marginTop:20, marginBottom:8, paddingHorizontal:2},
  sectionTitle:  {fontSize:11, fontWeight:'700', color: TEXT3, letterSpacing:0.8},
  sectionPill:   {backgroundColor:'#E5E7EB', borderRadius:8, paddingHorizontal:6, paddingVertical:1},
  sectionCount:  {fontSize:10, fontWeight:'700', color: TEXT3},
  sectionGap:    {height:4},
  card:       {flexDirection:'row', alignItems:'center', backgroundColor: CARD, paddingRight:14, overflow:'hidden'},
  cardBorder: {borderBottomWidth:1, borderBottomColor: BORDER},
  cardAccent: {width:3, alignSelf:'stretch'},
  cardAvatar: {width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center', marginHorizontal:14, flexShrink:0},
  cardAvatarText: {fontSize:18, fontWeight:'800'},
  cardBody:   {flex:1, justifyContent:'center', gap:5},
  cardRow:    {flexDirection:'row', alignItems:'center', justifyContent:'space-between'},
  cardName:   {fontSize:15, fontWeight:'700', color: TEXT, flex:1},
  cardTime:   {fontSize:12, color: TEXT3, marginLeft:8, flexShrink:0},
  cardCamera: {fontSize:13, color: TEXT2},
  cardLocation:{fontSize:12, color: TEXT3, flex:1},
  cardBadges: {flexDirection:'row', gap:4, alignItems:'center'},
  emptyWrap:  {alignItems:'center', paddingTop:80, gap:10},
  emptyIcon:  {fontSize:40},
  emptyText:  {fontSize:15, color: TEXT3, textAlign:'center'},
  emptyAction:{fontSize:14, fontWeight:'600', marginTop:4},
  overlay:    {flex:1, backgroundColor:'rgba(0,0,0,0.35)'},
  sheet:      {position:'absolute', bottom:0, left:0, right:0, height:SHEET_HEIGHT, backgroundColor: CARD, borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom: Platform.OS==='ios'?34:16},
  sheetHeader:{paddingHorizontal:24, paddingTop:12, paddingBottom:4},
  sheetHandle:{width:36, height:4, backgroundColor:'#E5E7EB', borderRadius:2, alignSelf:'center', marginBottom:16},
  sheetTitle: {fontSize:18, fontWeight:'700', color: TEXT, marginBottom:4},
  sheetBody:  {flex:1, paddingHorizontal:24, overflow:'hidden'},
  sheetSection:{marginBottom:20},
  sheetLabel: {fontSize:11, fontWeight:'700', color: TEXT3, textTransform:'uppercase', letterSpacing:0.8},
  sheetLabelRow:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10},
  chips:      {flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10},
  chip:       {paddingHorizontal:16, paddingVertical:8, borderRadius:20, backgroundColor:'#F3F4F6'},
  chipActive: {backgroundColor: PRIMARY},
  chipText:   {fontSize:14, color:'#374151'},
  chipTextActive:{color:'#fff', fontWeight:'600'},
  dateSelected:   {fontSize:13, fontWeight:'600', marginBottom:12},
  dateClear:      {fontSize:13, color: TEXT3},
  datePlaceholder:{fontSize:13, color: TEXT3, marginBottom:12},
  sheetFooter:{flexDirection:'row', gap:10, paddingHorizontal:24, paddingTop:12, borderTopWidth:1, borderTopColor: BORDER},
  clearBtn:   {flex:1, borderRadius:14, padding:15, alignItems:'center', backgroundColor:'#F3F4F6'},
  clearBtnText:{color:'#374151', fontWeight:'600', fontSize:15},
  applyBtn:   {flex:1, borderRadius:14, padding:15, alignItems:'center'},
  applyBtnText:{color:'#fff', fontWeight:'700', fontSize:15},
});
