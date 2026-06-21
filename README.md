# FaceNotify

App mobile de notificações de reconhecimento facial, construído com React Native. Recebe alertas em tempo real quando um dependente cadastrado é identificado por uma câmera do sistema **Face Access**, mostrando nome, câmera, localização e nível de confiança do reconhecimento.

---

## Funcionalidades

- Login por e-mail e senha (Supabase Auth)
- Notificações push via Firebase FCM — funcionam mesmo com o app fechado
- Atualização em tempo real via Supabase Realtime quando o app está aberto
- Histórico de reconhecimentos agrupado por data
- Filtro por dependente e por período (calendário)
- Tela de detalhes com local, câmera e confiança do reconhecimento
- Tela de perfil com dados do responsável e lista de dependentes

---

## Tecnologias

| Componente | Tecnologia |
|---|---|
| Framework mobile | React Native 0.85.3 |
| Banco de dados / Auth | Supabase (PostgreSQL + Row Level Security) |
| Notificações push | Firebase Cloud Messaging (FCM v1 API) |
| Realtime | Supabase Realtime (postgres_changes) |
| Notificações locais (background) | notifee |
| Navegação | React Navigation (Native Stack) |

---

## Estrutura do Projeto

```
FaceNotify/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx        ← autenticação
│   │   ├── HomeScreen.tsx         ← lista de eventos + filtros
│   │   ├── DetailScreen.tsx       ← detalhes do reconhecimento
│   │   └── ProfileScreen.tsx      ← perfil e dependentes
│   ├── services/
│   │   ├── supabase.ts            ← cliente Supabase
│   │   └── notificationService.ts ← FCM token + handlers
│   ├── store/
│   │   ├── notificationsStore.ts  ← eventos em tempo real (Realtime)
│   │   └── userStore.ts           ← perfil e dependentes do usuário
│   ├── types/
│   │   └── recognition.ts         ← tipo RecognitionEvent
│   └── theme.ts                   ← cores e palette do app
├── index.js                       ← background message handler (FCM)
├── android/
│   └── app/
│       ├── google-services.json   ← configuração Firebase (não commitar)
│       └── src/main/
│           ├── AndroidManifest.xml
│           └── java/com/facenotify/MainActivity.kt
└── App.tsx                        ← navegação e inicialização
```

---

## Pré-requisitos

- Node.js 18+
- JDK 17+
- Android Studio (SDK 34+) ou dispositivo Android físico
- Projeto Supabase configurado (banco + Edge Function)
- Projeto Firebase com FCM habilitado

---

## Instalação

### 1. Clone e instale dependências

```bash
git clone <url-do-repositorio>
cd FaceNotify
npm install
```

### 2. Configure o Firebase

Baixe o `google-services.json` do Firebase Console (Configurações do Projeto → Android) e coloque em:

```
android/app/google-services.json
```

### 3. Configure o Supabase

Edite `src/services/supabase.ts` com a URL e a chave anon do seu projeto:

```typescript
const SUPABASE_URL  = 'https://<seu-projeto>.supabase.co';
const SUPABASE_ANON = 'sua_anon_key';
```

### 4. Execute o app

```bash
# via USB ou WiFi ADB
npm run android
```

---

## Banco de Dados (Supabase)

O app consome as seguintes tabelas. O SQL de criação completo está em `INTEGRATION.md`.

| Tabela | Conteúdo |
|---|---|
| `auth.users` | Usuários (responsáveis) |
| `public.profiles` | Nome e endereço do responsável |
| `public.dependents` | Dependentes vinculados ao responsável |
| `public.fcm_tokens` | Tokens FCM por dispositivo |
| `public.recognition_events` | Histórico de reconhecimentos |

Todas as tabelas têm **Row Level Security (RLS)** ativo — cada usuário vê apenas seus próprios dados.

---

## Notificações Push

O app usa **Firebase Cloud Messaging (FCM v1 API)**, não Expo Push. O token FCM é salvo na tabela `fcm_tokens` do Supabase após o login e removido no logout.

### Fluxo completo

```
Face Access (Python)
        │ POST /functions/v1/notify-recognition
        ▼
Supabase Edge Function
        │
        ├── Salva em recognition_events
        └── FCM v1 API → dispositivo Android
                │
                ├── App fechado → notifee.displayNotification() (index.js)
                └── App aberto  → Supabase Realtime atualiza a lista
```

### Background handler

O handler de mensagens em background está registrado em `index.js` e exige a permissão `POST_NOTIFICATIONS` (Android 13+), solicitada automaticamente no primeiro login.

---

## Integração com Face Access

Veja `INTEGRATION.md` para:
- SQL completo de criação das tabelas
- Código da Supabase Edge Function
- Variáveis de ambiente necessárias no sistema de câmeras
- Formato do payload enviado pelo Face Access
- Checklist de configuração

---

## Tema e Design

As cores do app estão centralizadas em `src/theme.ts`. Para mudar o tom principal do app inteiro, altere apenas a constante `PRIMARY`:

```typescript
export const PRIMARY = '#5C6BC0';   // indigo suave
export const BG      = '#F2F4FB';   // fundo geral
export const CARD    = '#FFFFFF';
```

---

## Desenvolvimento

```bash
# servidor Metro
npm start

# build debug
npm run android

# TypeScript
npx tsc --noEmit

# limpar build
cd android && ./gradlew clean && cd ..
```

### Debug WiFi (ADB sem cabo)

```bash
adb connect <IP_DO_DISPOSITIVO>:<PORTA>
npm run android
```
