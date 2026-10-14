# Pulso — publicação no Netlify

## Gerar pacote versionado e automático

Ao abrir este projeto no VS Code, permita a execução da tarefa **Pulso: gerar ZIP do Netlify automaticamente** quando solicitado. Ela monitora os arquivos do site; cada alteração em HTML, CSS, JavaScript ou `_headers` sincroniza `netlify-site` e cria o próximo ZIP em `releases` (v1, v2, v3...). O monitor compara o conteúdo: salvar sem alterações reais não gera uma versão repetida.

Para gerar uma versão manualmente, execute `.\build-netlify.ps1` no PowerShell, na pasta do projeto. O número atual também aparece no rodapé do site.

Os arquivos originais permanecem na pasta principal deste projeto. Edite os arquivos de origem na pasta principal; o monitor atualiza `netlify-site` e os pacotes automaticamente.

## Pasta pronta para enviar

A pasta `netlify-site` contém a versão atual descompactada. Para enviar a versão compactada ao Netlify, use sempre o ZIP mais recente dentro de `releases`:

1. Acesse `https://app.netlify.com/drop` e entre na sua conta.
2. Arraste o ZIP mais recente de `releases` para a área indicada. O ZIP contém os arquivos do site na raiz e também pode ser aberto com WinRAR. Se o fluxo do Netlify não aceitar ZIP, extraia-o e envie a pasta extraída.
3. Depois da publicação, o Netlify mostrará o endereço do site. O painel administrativo fica em `/admin.html`.

O arquivo `_headers` configura cabeçalhos básicos de segurança. A geração local do ZIP é automática; para publicar a nova versão, envie o ZIP mais recente ao Netlify.

## Configurar o Supabase

1. No **SQL Editor** do projeto Supabase, execute `supabase-schema.sql`.
2. Em **Authentication → Users**, crie o usuário `admin@pulso.dev` com a senha escolhida para o painel. A senha inicialmente solicitada foi `rios123`; uma senha forte e exclusiva é recomendada antes de disponibilizar o painel publicamente.
3. Em **Authentication → URL Configuration**, adicione o endereço publicado pelo Netlify à lista de **Redirect URLs**.
4. Abra `https://seu-site.netlify.app/admin.html` para gerenciar o site.

O painel autentica pelo Supabase Auth. A autorização para editar notícias, configurações e arquivos também é conferida pelas políticas RLS do banco e do Storage. A senha não é armazenada no código do site; a chave no navegador é a chave publicável do Supabase.

O painel permite editar nome, assinatura, faixa de destaque, capa, cor do tema, notícias e rascunhos; também aceita upload de imagens e documentos. Notícias publicadas e as configurações da capa são carregadas dinamicamente na página inicial.

Para configurar o espaço de patrocínio nas páginas de notícia, execute novamente `supabase-schema.sql` no **SQL Editor** do projeto existente para adicionar os campos `sponsor_image_url` e `sponsor_link_url`. Depois, use **Editar patrocínio** no painel para enviar a imagem (recomendado: 300 × 180 px) e, opcionalmente, o endereço de destino.
