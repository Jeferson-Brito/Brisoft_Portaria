# Brisoft Portaria

Controle de acesso e portaria multiempresa (SaaS) com convites por QR Code, liberação pelo WhatsApp e área do morador.

## Estrutura

```
backend/                 API Fastify + Prisma (PostgreSQL), publicada no Render via Dockerfile
  prisma/
    schema.prisma        Schema único do banco (aplicado com prisma db push)
    init-real-admin.ts   Cria a primeira empresa, admin e porteiro
    init-super-admin.ts  Cria o super administrador do SaaS
  src/
    app.ts / server.ts   Montagem do Fastify e ponto de entrada
    config/              Variáveis de ambiente validadas
    core/errors/         AppError e erros de domínio
    lib/                 Cliente Prisma
    middlewares/         Autenticação, papéis e bloqueio por assinatura
    modules/<dominio>/   Rotas, controller, service e testes de cada domínio
    services/            Integrações: WhatsApp (Baileys), realtime, storage, verificação
    utils/               Funções puras (endereço, telefone, CNPJ, dias da semana)
  tests/                 Testes de integração e e2e entre módulos

mobile/                  App Expo (React Native) para portaria, admin, morador e super admin
  App.tsx                Escolhe a área do app conforme o papel do usuário
  src/
    components/          Componentes reutilizáveis
    config/              Cliente HTTP (axios) e URL da API
    contexts/            Sessão (AuthContext) e tempo real (RealtimeContext)
    screens/
      admin/             Cadastros e configurações da empresa
      auth/              Login, cadastro, perfil inicial e assinatura
      concierge/         Portaria: painel, solicitações, convites e presentes
      packages/          Encomendas
      profile/           Perfil do usuário
      reports/           Relatórios
      resident/          Área do morador
      settings/          Menu de configurações
      super-admin/       Painel do dono do SaaS
    services/            Notificações push e sessão segura
    theme/               Cores
    utils/               Fotos e liberação com checagem de restrição
  scripts/               Geração de assets (ícone de notificação)

docs/                    Documento de ideia do produto
```

## Rodando localmente

```
npm install
npm run backend:dev      # API em http://localhost:3333
npm run mobile:start     # Expo (abrir no Expo Go)
```

Ou execute `iniciar_servidores.bat` para abrir os dois de uma vez.

Copie `backend/.env.example` para `backend/.env` e preencha as variáveis.

## Banco de dados

O schema fica só em `backend/prisma/schema.prisma`. Para aplicar mudanças:

```
npm run backend:db-push
```

Nunca use `--accept-data-loss` em produção.

## Testes

```
npm run backend:test
```

## Publicação

- **Backend:** o Render usa `backend/Dockerfile` (raiz `backend`). Um push na `main` dispara o deploy.
- **App:** `cd mobile` e `npx eas-cli build --platform android --profile preview` gera o APK.
