# Acqua Azul

Site da Acqua Azul Natação (Manaus): história, turmas abertas e agendamento de aula experimental pelo WhatsApp, com uma aba de admin para a escola atualizar turmas e vagas.

Site estático (HTML, CSS e JS puros, sem build), hospedado na Vercel. As turmas ficam no Supabase (projeto `acqua-azul`, São Paulo).

| Arquivo | O que é |
| --- | --- |
| `index.html`, `styles.css`, `site.js` | Site público. Lê as turmas ativas do Supabase. |
| `admin.html`, `admin.css`, `admin.js` | Painel em `/admin`: resumo, pedidos, turmas, textos, história, avisos, fotos, planos, depoimentos e usuários. |
| `privacidade.html` | Política de privacidade (LGPD). |
| `config.js` | URL e chave pública do Supabase, número do WhatsApp. |
| `vercel.json` | Cabeçalhos de segurança (CSP etc.). |
| `vendor/supabase.js` | supabase-js 2.45.4 (cópia local, sem CDN). |
| `supabase/functions/pedido/` | Edge Function que recebe o formulário, confere o Cloudflare Turnstile e grava o pedido. |
| `supabase/functions/usuarios/` | Edge Function (só dono) que cria, lista, muda o papel e remove usuários do painel. |

## Segurança

- A chave em `config.js` é a publishable: pública por desenho. Quem protege os dados são as regras RLS do banco.
- Tabelas: `turmas`, `conteudo` (textos soltos), `marcos` (história), `avisos`, `fotos` + bucket público `fotos`, `planos`, `depoimentos`, `pedidos`.
- Papéis em `admins.papel`: `dono` mexe em tudo; `recepcao` vê o resumo, atende pedidos e edita turmas (sem criar nem apagar). Funções `is_admin()`, `is_dono()` e `meu_papel()`.
- Visitantes só leem o que está ativo/vigente. Criar, editar e apagar exige login **e** estar na tabela `admins`.
- Fotos são reduzidas no navegador (máx. 1600 px, JPEG) antes do upload; o bucket aceita só JPEG/WebP até 3 MB.
- Pedidos de aula experimental: visitante não acessa a tabela `pedidos`; o envio passa pela função `pedido` (Turnstile + campo-isca + até 3 pedidos/hora por IP e 60/hora no total). Só admin lê.
- LGPD: consentimento obrigatório no formulário e job `apagar-pedidos-antigos` (pg_cron) que apaga pedidos com mais de 6 meses todo dia.
- Turnstile: `turnstileSiteKey` em `config.js` e o segredo `TURNSTILE_SECRET` nas Edge Functions do Supabase (widget "Acqua Azul" no Cloudflare; ao trocar de domínio, adicionar o novo hostname no widget).

## Dar acesso ao painel

Pelo próprio painel: aba **Usuários** (só para dono), com e-mail, senha provisória e papel.

Se não houver nenhum dono (primeiro acesso): crie a conta em Supabase › Authentication › Users › **Add user** e rode no SQL Editor
`insert into public.admins (user_id, papel) select id, 'dono' from auth.users where email = 'email@da.pessoa';`

## Rodar localmente

Qualquer servidor estático na pasta, por exemplo `npx serve .`.
