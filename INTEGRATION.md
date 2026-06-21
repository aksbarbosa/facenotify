# Integração — Face Access ↔ FaceNotify

Guia completo para conectar o sistema de reconhecimento facial (Face Access) ao app mobile (FaceNotify).

---

## Arquitetura

```
Face Access (Python/FastAPI)
        │
        │  POST /functions/v1/notify-recognition
        │  Headers: x-webhook-secret + Authorization Bearer
        │  Body: person_id, person_name, location, timestamp, confidence
        │
        ▼
Supabase Edge Function (Deno/TypeScript)
        │
        ├── 1. Valida x-webhook-secret
        ├── 2. Busca profile_id do dependent_id em dependents
        ├── 3. INSERT em recognition_events
        ├── 4. Busca fcm_tokens do responsável
        └── 5. JWT OAuth2 → FCM v1 API → push no dispositivo
                                │
                        FaceNotify (Android)
                        ├── app fechado: notifee.displayNotification
                        └── app aberto:  Supabase Realtime
```

> A `service_role_key` do Supabase fica **exclusivamente** na Edge Function (env var segura). O Face Access nunca tem acesso direto ao banco Supabase.

---

## 1. Banco de Dados (Supabase)

Execute no SQL Editor do Supabase:

```sql
-- Perfis dos responsáveis
CREATE TABLE public.profiles (
  id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name    text,
  address text
);

-- Dependentes vinculados a um responsável
CREATE TABLE public.dependents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tokens FCM por dispositivo
CREATE TABLE public.fcm_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Histórico de reconhecimentos
CREATE TABLE public.recognition_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dependent_id uuid REFERENCES public.dependents(id),
  person_name  text NOT NULL,
  camera_id    text,
  camera_label text,
  address      text,
  city         text,
  state        text,
  confidence   float,
  timestamp    timestamptz DEFAULT now()
);

-- RLS: cada usuário vê apenas seus próprios dados
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own"
  ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "dependents: own"
  ON public.dependents FOR ALL USING (auth.uid() = profile_id);

CREATE POLICY "fcm_tokens: own"
  ON public.fcm_tokens FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "events: own"
  ON public.recognition_events FOR SELECT USING (auth.uid() = user_id);

-- Realtime: o app recebe eventos em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.recognition_events;
```

---

## 2. Supabase Edge Function

Arquivo: `supabase/functions/notify-recognition/index.ts`

A função usa a **FCM v1 API** com autenticação OAuth2 via JWT assinado com a service account do Firebase.

### Deploy

```bash
# na raiz do repositório reconhecimento_facial
supabase functions deploy notify-recognition
```

### Secrets da Edge Function

Configure em **Supabase → Edge Functions → Secrets**:

| Secret | Valor |
|---|---|
| `WEBHOOK_SECRET` | String aleatória longa (compartilhada com o Face Access) |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | `client_email` do service account JSON |
| `FIREBASE_PRIVATE_KEY` | Apenas o conteúdo base64 da chave privada (sem headers PEM, sem quebras de linha) |

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo Supabase.

#### Como extrair a FIREBASE_PRIVATE_KEY

No arquivo `firebase-service-account.json`, o campo `private_key` tem o formato:
```
-----BEGIN PRIVATE KEY-----
MIIEvA...
-----END PRIVATE KEY-----
```

Remova os headers e todas as quebras de linha, deixando apenas o base64 puro:
```
MIIEvAIBADANBgkqhkiG9w0BAQ...
```

Guarde apenas esse valor como secret. O código usa `.replace(/\s/g, '')` antes de decodificar.

---

## 3. Face Access — Configuração do notify_service.py

Adicione as variáveis ao `.env` do Face Access:

```env
EDGE_FUNCTION_URL=https://<projeto>.supabase.co/functions/v1/notify-recognition
WEBHOOK_SECRET=mesmo_valor_configurado_no_supabase
SUPABASE_ANON_KEY=sua_anon_key_do_supabase
CAMERA_ID=cam_001
CAMERA_LABEL=Câmera - Entrada Principal
CAMERA_ADDRESS=Rua das Flores, 123
CAMERA_CITY=São Paulo
CAMERA_STATE=SP
NOTIFY_COOLDOWN_SECONDS=30
```

O `notify_service.py` é chamado automaticamente pelo `CameraWorker` após cada reconhecimento positivo. O aluno precisa ter o campo `supabase_dependent_id` preenchido no PostgreSQL local com o UUID do dependente correspondente no Supabase.

### Cooldown

A mesma pessoa na mesma câmera só gera uma notificação a cada `NOTIFY_COOLDOWN_SECONDS` segundos. O controle é feito em memória por par `(dependent_id, camera_id)`. Câmeras diferentes não compartilham o cooldown.

### Payload enviado

```json
{
  "person_id": "uuid-do-dependente-no-supabase",
  "person_name": "João Silva",
  "location": {
    "camera_id": "cam_001",
    "camera_label": "Câmera - Entrada Principal",
    "address": "Rua das Flores, 123",
    "city": "São Paulo",
    "state": "SP"
  },
  "timestamp": "2026-06-21T14:32:00+00:00",
  "confidence": 0.9241
}
```

---

## 4. FaceNotify — Configuração do App

### Supabase

Edite `src/services/supabase.ts`:

```typescript
const SUPABASE_URL  = 'https://<seu-projeto>.supabase.co';
const SUPABASE_ANON = 'sua_anon_key';
```

### Firebase

Coloque o `google-services.json` em `android/app/google-services.json`.

O token FCM é registrado automaticamente após o login e removido no logout via `removeTokenFromSupabase()` em `notificationService.ts`.

### Permissões Android

A permissão `POST_NOTIFICATIONS` (Android 13+) é solicitada automaticamente no primeiro acesso. Está declarada em `AndroidManifest.xml`.

### Background push

O handler de mensagens em background está em `index.js`:

```javascript
messaging().setBackgroundMessageHandler(async remoteMessage => {
  await notifee.displayNotification({
    title: remoteMessage.notification?.title ?? 'FaceNotify',
    body:  remoteMessage.notification?.body  ?? '',
    android: { channelId: 'default', pressAction: { id: 'default' } },
  });
});
```

---

## 5. Checklist de Configuração

### Supabase

- [ ] Tabelas criadas (`profiles`, `dependents`, `fcm_tokens`, `recognition_events`)
- [ ] RLS ativo em todas as tabelas
- [ ] Realtime habilitado em `recognition_events`
- [ ] Edge Function `notify-recognition` deployada
- [ ] Secrets configurados: `WEBHOOK_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

### Face Access

- [ ] `EDGE_FUNCTION_URL` no `.env`
- [ ] `WEBHOOK_SECRET` no `.env` (mesmo valor do Supabase)
- [ ] `SUPABASE_ANON_KEY` no `.env`
- [ ] Variáveis da câmera configuradas (`CAMERA_ID`, `CAMERA_LABEL`, etc.)
- [ ] Campo `supabase_dependent_id` preenchido para cada aluno que deve gerar notificações

### FaceNotify (mobile)

- [ ] `google-services.json` em `android/app/`
- [ ] URL e chave anon do Supabase em `src/services/supabase.ts`
- [ ] App instalado no dispositivo e login realizado (para registrar o FCM token)
- [ ] Permissão de notificações concedida no dispositivo

---

## Tabela de Credenciais

| Onde fica | O quê | Quem usa |
|---|---|---|
| Edge Function (env var) | `service_role_key` | Só a Edge Function |
| Edge Function (env var) | `WEBHOOK_SECRET` | Edge Function + Face Access |
| Edge Function (env var) | `FIREBASE_PRIVATE_KEY` | Só a Edge Function |
| Face Access `.env` | `WEBHOOK_SECRET` | Só o sistema de câmeras |
| Face Access `.env` | `SUPABASE_ANON_KEY` | Só o sistema de câmeras |
| FaceNotify (código) | `anon key` | App mobile (protegido por RLS) |
| Android `google-services.json` | Firebase config | SDK Firebase no app |
