# Comic Reader

App Android (celular e tablet) para ler os seus próprios livros e quadrinhos: **EPUB, PDF e CBZ**.
Uso pessoal, 100% offline: sem backend, sem conta, sem scraper. Você escolhe os arquivos pelo seletor do Android e o app copia tudo para o armazenamento privado dele.

- React Native 0.88 + Expo SDK 58 (nova arquitetura), TypeScript, expo-router
- Interface em português do Brasil

## Recursos

- **Biblioteca**: grade de capas responsiva (mais colunas no tablet), busca, filtros (Todos/Lendo/Novos/Lidos), ordenação, faixa "Continuar lendo", editar informações (título, autor e descrição), marcar como lido e excluir (toque e segure na capa).
- **Obras**: capítulos da mesma obra ficam juntos num único card na biblioteca; a tela da obra lista os capítulos em ordem, com progresso, botão Continuar/Começar e renomear obra (renomear para o nome de outra obra junta as duas). A obra e o nº do capítulo são detectados pelo nome do arquivo (`Obra - Chapter 12`, `Obra v03`, `Obra - 042`...) ou pelo `ComicInfo.xml`, e podem ser corrigidos em Editar informações. Livros que não parecem capítulo (`Dom Casmurro.epub`) ficam avulsos.
- **Revisão na importação**: ao escolher arquivos, uma tela mostra título, obra e nº de cada um, já preenchidos pela detecção, para você corrigir antes de importar. Informando a obra, o número do capítulo é obrigatório (sem obra, o livro é avulso); a mesma regra vale em Editar informações. Dá para aplicar a mesma obra a todos os arquivos de uma vez.
- **Filtros por obra**: Lendo/Novos/Lidos olham a obra inteira (Lida = todos os capítulos lidos; Nova = nenhum aberto; Lendo = o resto) e o card sempre mostra o total de capítulos. A busca por um capítulo traz a obra completa.
- **Catálogo do Google Drive**: botão ☁ na biblioteca. Você entra com a sua conta Google (só leitura) e escolhe **uma vez** a pasta da sua biblioteca no Drive; dali em diante o app olha só para ela. Cada pasta com arquivos EPUB/PDF/CBZ vira uma obra (subpastas "Vol 1", "Vol 2" se juntam na obra), exibida numa grade com capa (quando já importada), quantos capítulos tem e quantos você já importou, com busca e filtros (Novas / Incompletas / Completas / pasta de origem). Toque numa obra para ver os capítulos e importar tudo, só o que falta ou os que escolher; segure em várias obras para importá-las de uma vez. O nome da pasta vira a obra, você confere na revisão, e o app baixa e importa um arquivo por vez, com progresso e cancelamento. O catálogo fica guardado no aparelho (↻ para atualizar).
- **CBZ**: extração para o disco (sem carregar o arquivo na memória), ordenação natural das páginas, leitura de `ComicInfo.xml` (detecta mangá; autor e resumo viram os campos do livro), paginação horizontal, zoom com pinça e toque duplo que seguem o ponto tocado, duas páginas lado a lado com o aparelho deitado, sentido de leitura alternável.
- **PDF**: leitor nativo (`react-native-pdf`), capa gerada da primeira página (`react-native-pdf-thumbnail`).
- **EPUB**: um capítulo por vez numa WebView, com CSS do app (tema, fonte, tamanho, espaçamento, margens, alinhamento), sumário e links internos. Segurança em duas camadas: scripts e manipuladores de evento são removidos do capítulo e cada capítulo carrega com uma política CSP que só deixa rodar o script do leitor (nonce aleatório), bloqueia a rede e só abre arquivos locais. O progresso é ponderado pelo tamanho dos capítulos, há uma barra para pular no livro e um botão **Voltar** depois de seguir uma nota ou um item do sumário. Mudar a fonte ou girar a tela mantém o ponto de leitura.
- **Leitura contínua**: ao chegar ao fim de um capítulo (CBZ, PDF ou EPUB), uma tela oferece abrir o **próximo capítulo da obra** (com confirmação, para não pular um por engano) ou voltar. Escolher qualquer uma das duas marca o capítulo como lido.
- **Gerenciar obras**: segure uma obra na biblioteca (ou toque em ✎ na tela dela) para renomear, marcar toda como lida ou não lida e excluir.
- **Armazenamento**: nos Ajustes, o espaço usado pelos livros e a opção de excluir os já lidos (dá para importar de novo depois).
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

## Google Drive (configuração)

O login é o do próprio Android (`@react-native-google-signin/google-signin`, API "original"), então **não há ID de cliente, chave ou segredo no código**: o Google identifica o app pelo nome do pacote (`br.fmatheusog.comicreader`) e pelo SHA-1 da chave que assina o APK. Para usar na sua conta:

1. No Google Cloud, crie um projeto, ative a **Drive API** e configure a tela de consentimento OAuth (Externo; publique o app para o login não expirar a cada 7 dias).
2. Crie um **cliente OAuth do tipo Android** com o pacote acima e o SHA-1 da sua chave: `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android` (o release local usa a mesma chave de debug; APKs do EAS têm outra, veja `npx eas-cli credentials`).
3. Recompile (`npm run android`): a biblioteca tem código nativo. O emulador precisa de uma imagem **com Google Play** e uma conta Google logada.

**Pasta fixa (opcional):** para o app já abrir direto na sua pasta, sem escolher na tela, copie `.env.example` para `.env` e preencha `EXPO_PUBLIC_DRIVE_FOLDER` com o link (ou o id) da pasta. O `.env` é ignorado pelo git, então o link não vai para o repositório. Reinicie o Metro com `npx expo start -c` (ou recompile). Atenção: o Expo embute as variáveis `EXPO_PUBLIC_*` no código do app, então o valor também vai dentro do APK que você gerar; o id sozinho não dá acesso a nada, pois é preciso entrar com uma conta que tenha permissão na pasta.

Se o login falhar com "erro 10", o pacote ou o SHA-1 cadastrados não batem com os desta compilação.

### Segurança

- Escopo `drive.readonly`: o app só lê; não consegue alterar nem apagar nada no seu Drive.
- O app **não guarda senha, token nem link do Drive**. O token de acesso (1 hora) fica com o Google Play Services e vai só no cabeçalho `Authorization`, nunca na URL. Tokens, URLs e ids de arquivo não são registrados em log nem mostrados em mensagens de erro.
- O **id da pasta escolhida** e o catálogo (nomes de pastas e arquivos) ficam só no banco privado do aparelho, nunca no código, no README ou nos logs. Ao tocar em "Sair", tudo isso é apagado. No banco de cada livro fica também o id do arquivo de origem, para não importar duas vezes. Os downloads passam pelo cache e são apagados logo depois de importados.
- `.gitignore` bloqueia chaves e credenciais (`*.keystore`, `*.jks`, `google-services.json`, `.env`...). Para revogar o acesso: <https://myaccount.google.com/permissions>.

## Gerando o APK

### Com EAS Build (nuvem)

```bash
eas login
eas build -p android --profile preview
```

O perfil `preview` (em `eas.json`) gera um **APK** instalável. Ao terminar, o EAS mostra um link e um QR code para baixar.

**Antes do primeiro build do EAS (necessário para o Google Drive):**

1. **SHA-1 da chave do EAS.** O EAS assina com uma chave própria, diferente da de debug, e o login do Google confere o SHA-1. Rode `npx eas-cli credentials -p android`, copie o SHA-1 do keystore e cadastre-o num **segundo cliente OAuth Android** (mesmo pacote `br.fmatheusog.comicreader`) no Google Cloud. Sem isso, o login dá "erro 10".
2. **Pasta do Drive.** O `.env` não vai para o build na nuvem. Envie a variável ao EAS (o valor é o link da pasta; use visibilidade *sensitive*): `npx eas-cli env:set --name EXPO_PUBLIC_DRIVE_FOLDER --value "<link>" --environment preview --visibility sensitive`. Como é uma variável `EXPO_PUBLIC_*`, ela fica embutida no APK (veja Segurança acima). Os perfis do `eas.json` já apontam cada um para o seu ambiente.

### Local, com Android Studio

Requisitos: Android Studio (SDK + JDK 17) e `ANDROID_HOME` configurado.

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease      # no Windows: gradlew.bat assembleRelease
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`. O Metro lê o `.env` ao empacotar, então a pasta do Drive entra no APK local sem configurar mais nada, e como o release local usa a chave de debug, o SHA-1 já cadastrado para o desenvolvimento serve. Por padrão o template assina o release com a chave de debug, o que serve para uso pessoal. Para uma chave sua, configure um `keystore` em `android/app/build.gradle`.

### Versão

A cada APK novo que você for instalar por cima do anterior, aumente `expo.android.versionCode` (e, se quiser, `expo.version`) no `app.json`. O Android só aceita atualizar por cima com um `versionCode` maior. Depois de mudar o `app.json`, rode `npx expo prebuild --platform android` de novo antes do `gradlew`.

## Instalando no tablet

1. Copie o APK para o tablet (cabo USB, Drive, e-mail) ou baixe pelo link do EAS direto no aparelho.
2. Abra o arquivo no tablet e permita "Instalar apps desconhecidos" para o app que o abriu (Arquivos ou Chrome) quando o Android pedir.
3. Ou, com depuração USB ligada: `adb install -r app-release.apk`.
4. Abra o Comic Reader, toque em **Importar** e escolha seus arquivos.

## Estrutura

```
src/app/                rotas do expo-router; só reexportam as telas das features
src/features/library/   biblioteca: tela, busca/filtros, importação com revisão
src/features/reader/    leitor: telas CBZ/PDF/EPUB, zoom, barras, progresso
src/features/series/    tela da obra: capítulos em ordem, continuar, renomear
src/features/drive/     Google Drive: login, listagem, download e importação
src/features/settings/  tela de ajustes
src/entities/book/      livro: tipo e consultas SQLite, armazenamento, BookCard,
                        formatos (CBZ, PDF, EPUB: parser puro + I/O), detecção e agrupamento de obras,
                        importador, revisão da importação, modais de ações e de edição
src/shared/             db (conexão e migrações), i18n pt-BR, temas, ajustes persistidos, hooks
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
