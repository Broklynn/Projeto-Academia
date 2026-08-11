# DuoFit

Nome provisório de um aplicativo de treino para um casal montar, executar e acompanhar treinos de musculação. Esta etapa contém somente a fundação técnica, sem autenticação ou persistência de dados.

## Stack

- Expo e React Native
- TypeScript em modo estrito
- Expo Router
- npm
- Android, iOS e Web/PWA

## Como executar

Requisito: Node.js 22.13 ou superior.

```bash
npm install
npm start
```

Comandos por plataforma:

```bash
npm run web
npm run android
npm run ios
```

O comando de iOS requer macOS com Xcode para o simulador nativo. Para verificar o código:

```bash
npm run typecheck
npm run lint
```

## Estrutura

- `src/app`: rotas e telas do Expo Router.
- `assets`: ícones e imagens estáticas da aplicação.
- `src/components`, `src/features`, `src/domain`, `src/hooks`, `src/services`, `src/database`, `src/types`, `src/utils` e `src/tests` serão criados somente quando houver código que justifique cada diretório.
- `app.json`: configuração do Expo para Android, iOS e Web.
- `tsconfig.json`: configuração rigorosa do TypeScript e alias `@/` para `src/`.
