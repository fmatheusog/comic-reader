# Comic Reader

App Android (celular e tablet) para ler os seus próprios livros e quadrinhos: **EPUB, PDF e CBZ**.
Uso pessoal, 100% offline: sem backend, sem conta, sem scraper. Você escolhe os arquivos pelo seletor do Android e o app copia tudo para o armazenamento privado dele.

- React Native 0.88 + Expo SDK 58 (nova arquitetura), TypeScript, expo-router
- Interface em português do Brasil

## Recursos

- **Biblioteca**: grade de capas responsiva (mais colunas no tablet), busca, filtros (Todos/Lendo/Novos/Lidos), ordenação, faixa "Continuar lendo", editar informações (título, autor e descrição), marcar como lido e excluir (toque e segure na capa).
- **CBZ**: extração para o disco (sem carregar o arquivo na memória), ordenação natural das páginas, leitura de `ComicInfo.xml` (detecta mangá; autor e resumo viram os campos do livro), paginação horizontal, zoom com pinça e toque duplo que seguem o ponto tocado, duas páginas lado a lado com o aparelho deitado, sentido de leitura alternável.
- **PDF**: leitor nativo (`react-native-pdf`), capa gerada da primeira página (`react-native-pdf-thumbnail`).
- **EPUB**: um capítulo por vez numa WebView, com scripts removidos, CSS do app (tema, fonte, tamanho, espaçamento, margens), sumário, links internos, progresso por capítulo + posição de rolagem.
- **Gestos por zona**: esquerda = voltar, direita = avançar, centro = mostrar/ocultar controles (invertido no modo mangá).
- **Temas**: sistema, claro, sépia e escuro. Progresso salvo automaticamente.

### Decisões

- **Persistência: `expo-sqlite`.** Permite buscar, filtrar e ordenar com SQL e gravar o progresso de forma atômica a cada página, sem reescrever um JSON inteiro.
- Os arquivos ficam em `<documentos do app>/books/<id>/`. Para CBZ e EPUB o arquivo original é descartado depois de extraído (para não ocupar o dobro de espaço); o PDF é mantido como está.
- Os caminhos no banco são relativos, então sobrevivem a atualizações do app.
- **Título do CBZ = nome do arquivo.** O que vem no `ComicInfo.xml` só completa autor e descrição; o título você controla pelo nome do arquivo ou pela edição manual. EPUBs usam o título do próprio arquivo.
- O código é organizado em camadas (`app → features → entities → shared`), veja a seção Estrutura.

## Rodando em desenvolvimento

O app usa módulos nativos (`react-native-pdf`, `react-native-zip-archive`, `react-native-blob-util`...), então **não funciona no Expo Go**. É preciso um *development build* (`expo-dev-client`).

```bash
npm install
```

**Opção A: build local (precisa de Android Studio / JDK 17 e `ANDROID_HOME`)**

```bash
npx expo run:android
```

Isso gera a pasta `android/`, compila, instala no emulador ou aparelho conectado (depuração USB ligada) e inicia o Metro. Os atalhos `npm run android` e `npm run ios` fazem o mesmo.

> **Windows: mantenha o projeto num caminho curto** (por exemplo `C:cr`). O build nativo usa CMake/ninja, que estoura o limite de 260 caracteres do Windows com caminhos como `C:Users...CodePersonalcomic-reader`. O erro aparece como falha de `mkdir` do ninja em `app:assembleDebug`, e habilitar `LongPathsEnabled` no sistema não resolve. Se mover a pasta, apague `android/` e rode o comando de novo.

**Opção B: development build na nuvem (EAS)**

```bash
npm install -g eas-cli
eas login
eas build -p android --profile development
```

Instale o APK gerado no aparelho e rode `npx expo start --dev-client`. O perfil `development` **precisa do Metro rodando** (ele abre o app e pede login do Expo na primeira vez); para um APK que funciona sozinho, use o perfil `preview` da seção abaixo.

### Verificações

```bash
npm run typecheck      # tsc --noEmit
npm test               # testes dos parsers (EPUB, ComicInfo, ordenação natural, páginas duplas)
npx expo-doctor
npx eslint src
```

### Pegadinhas conhecidas

- No SDK 58, `File.copy()` e `File.move()` do `expo-file-system` são **assíncronos**: sem `await`, o arquivo copiado fica vazio e a importação falha com "Zip headers not found". Use `await` (ou `copySync`/`moveSync`).
- Depois de mover arquivos de lugar, o Metro pode reclamar de módulo não encontrado: reinicie com `npx expo start -c`.
- `npm audit` aponta 3 vulnerabilidades altas, todas do `zod` 3.x (consumo de memória ao validar coleções enormes), que chega por ferramentas de desenvolvimento (`@expo/cli` e o plugin de hooks do eslint). O app não usa `zod` e isso não vai para o APK. **Não rode `npm audit fix --force`**: ele "corrige" rebaixando o `expo` para o SDK 54. O aviso some quando o `@expo/cli` atualizar o `zod` (`npx expo install --fix`).
- Para mandar um arquivo ao emulador: `adb push fixtures/exemplo.cbz /sdcard/Download/`.

### Arquivos de exemplo

```bash
node scripts/make-fixtures.mjs
```

Gera em `fixtures/` um CBZ (12 páginas numeradas, com `ComicInfo.xml` de mangá), um PDF de 3 páginas e dois EPUBs (EPUB 3 com `nav` e EPUB 2 com NCX), todos com conteúdo próprio. Copie para o aparelho (`adb push fixtures/exemplo.cbz /sdcard/Download/`) e importe pelo app.

### Ícone

```bash
node scripts/make-icons.mjs
```

Gera o ícone simples (livro aberto) em `assets/images/`: ícone, ícone adaptativo (fundo, primeiro plano e monocromático) e imagem da splash. Sem dependências; para trocar por uma arte própria, basta substituir esses arquivos.

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
scripts/                gerador de arquivos de exemplo e de ícones
tests/                  testes dos módulos puros
```

Dependências só descem: `app → features → entities → shared`, e uma feature não
importa outra.

## Limitações conhecidas

- Sem DRM: arquivos protegidos não abrem.
- Links externos dentro de EPUBs são ignorados (o app é offline).
- Com zoom ativo no CBZ, a troca de página só volta depois de sair do zoom (toque duplo).
- A busca procura só em título e autor (não na descrição).
- A importação de CBZ foi testada no emulador; os leitores de PDF e EPUB (principalmente as imagens dentro do EPUB) ainda precisam de testes em aparelho real.
- O ícone é um desenho simples gerado por script.
