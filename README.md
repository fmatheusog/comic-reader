# Comic Reader

App Android (celular e tablet) para ler os seus próprios livros e quadrinhos: **EPUB, PDF e CBZ**.
Uso pessoal, 100% offline: sem backend, sem conta, sem scraper. Você escolhe os arquivos pelo seletor do Android e o app copia tudo para o armazenamento privado dele.

- React Native 0.88 + Expo SDK 58 (nova arquitetura), TypeScript, expo-router
- Interface em português do Brasil

## Recursos

- **Biblioteca**: grade de capas responsiva (mais colunas no tablet), busca, filtros (Todos/Lendo/Novos/Lidos), ordenação, faixa "Continuar lendo", renomear, marcar como lido e excluir (toque e segure na capa).
- **CBZ**: extração para o disco (sem carregar o arquivo na memória), ordenação natural das páginas, leitura de `ComicInfo.xml` (detecta mangá), paginação horizontal, zoom com pinça e toque duplo, duas páginas lado a lado com o aparelho deitado, sentido de leitura alternável.
- **PDF**: leitor nativo (`react-native-pdf`), capa gerada da primeira página (`react-native-pdf-thumbnail`).
- **EPUB**: um capítulo por vez numa WebView, com scripts removidos, CSS do app (tema, fonte, tamanho, espaçamento, margens), sumário, links internos, progresso por capítulo + posição de rolagem.
- **Gestos por zona**: esquerda = voltar, direita = avançar, centro = mostrar/ocultar controles (invertido no modo mangá).
- **Temas**: sistema, claro, sépia e escuro. Progresso salvo automaticamente.

### Decisões

- **Persistência: `expo-sqlite`.** Permite buscar, filtrar e ordenar com SQL e gravar o progresso de forma atômica a cada página, sem reescrever um JSON inteiro.
- Os arquivos ficam em `<documentos do app>/books/<id>/`. Para CBZ e EPUB o arquivo original é descartado depois de extraído (para não ocupar o dobro de espaço); o PDF é mantido como está.
- Os caminhos no banco são relativos, então sobrevivem a atualizações do app.

## Rodando em desenvolvimento

O app usa módulos nativos (`react-native-pdf`, `react-native-zip-archive`, `react-native-blob-util`...), então **não funciona no Expo Go**. É preciso um *development build* (`expo-dev-client`).

```bash
npm install
```

**Opção A: build local (precisa de Android Studio / JDK 17 e `ANDROID_HOME`)**

```bash
npx expo run:android
```

Isso gera a pasta `android/`, compila, instala no emulador ou aparelho conectado (depuração USB ligada) e inicia o Metro.

**Opção B: development build na nuvem (EAS)**

```bash
npm install -g eas-cli
eas login
eas build -p android --profile development
```

Instale o APK gerado no aparelho e rode `npx expo start --dev-client`.

### Verificações

```bash
npm run typecheck      # tsc --noEmit
npm test               # testes dos parsers (EPUB, ComicInfo, ordenação natural, páginas duplas)
npx expo-doctor
npx eslint src
```

### Arquivos de exemplo

```bash
node scripts/make-fixtures.mjs
```

Gera em `fixtures/` um CBZ (12 páginas numeradas, com `ComicInfo.xml` de mangá), um PDF de 3 páginas e dois EPUBs (EPUB 3 com `nav` e EPUB 2 com NCX), todos com conteúdo próprio. Copie para o aparelho (`adb push fixtures/exemplo.cbz /sdcard/Download/`) e importe pelo app.

## Gerando o APK

### Com EAS Build (nuvem)

```bash
eas login
eas build -p android --profile preview
```

O perfil `preview` (em `eas.json`) gera um **APK** instalável. Ao terminar, o EAS mostra um link e um QR code para baixar.

### Local, com Android Studio

Requisitos: Android Studio (SDK + JDK 17) e `ANDROID_HOME` configurado.

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease      # no Windows: gradlew.bat assembleRelease
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`. Por padrão o template assina o release com a chave de debug, o que serve para uso pessoal. Para uma chave sua, configure um `keystore` em `android/app/build.gradle`.

## Instalando no tablet

1. Copie o APK para o tablet (cabo USB, Drive, e-mail) ou baixe pelo link do EAS direto no aparelho.
2. Abra o arquivo no tablet e permita "Instalar apps desconhecidos" para o app que o abriu (Arquivos ou Chrome) quando o Android pedir.
3. Ou, com depuração USB ligada: `adb install -r app-release.apk`.
4. Abra o Comic Reader, toque em **Importar** e escolha seus arquivos.

## Estrutura

```
src/app/                rotas do expo-router; só reexportam as telas das features
src/features/library/   biblioteca: tela, busca/filtros, modais de ação e edição, importação
src/features/reader/    leitor: telas CBZ/PDF/EPUB, zoom, barras, progresso
src/features/settings/  tela de ajustes
src/entities/book/      livro: tipo e consultas SQLite, armazenamento, BookCard,
                        formatos (CBZ, PDF, EPUB: parser puro + I/O)
src/shared/             db (conexão e migrações), i18n pt-BR, temas, ajustes persistidos
scripts/                gerador de arquivos de exemplo
tests/                  testes dos módulos puros
```

Dependências só descem: `app → features → entities → shared`, e uma feature não
importa outra.

## Limitações conhecidas

- Sem DRM: arquivos protegidos não abrem.
- Links externos dentro de EPUBs são ignorados (o app é offline).
- O zoom do CBZ é centrado (não segue o ponto da pinça) e, com zoom ativo, a troca de página é por toque duplo para sair do zoom.
- Ícone e splash ainda são os do template do Expo.
