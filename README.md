# DuoFit

Aplicativo de treino para um casal montar, executar e acompanhar treinos de musculação. O projeto está na fase de fundação técnica e modelagem do domínio, sem autenticação ou persistência de dados.

## Tecnologias

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
- `src/domain`: contratos e regras independentes da interface.
- `src/data/exercises`: catálogo local de exercícios e consultas puras.
- `tests/domain`: testes do domínio e da integridade do catálogo.
- `assets`: ícones e imagens estáticas da aplicação.
- `app.json`: configuração do Expo para Android, iOS e Web.
- `tsconfig.json`: configuração rigorosa do TypeScript e alias `@/` para `src/`.
