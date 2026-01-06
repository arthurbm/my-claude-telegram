# Claude Code Telegram Notifier

Notificador Telegram para Claude Code com botões de aprovação e suporte a texto livre.

## Estrutura

```
src/
├── notify.ts    # CLI principal (chamado pelos hooks)
├── telegram.ts  # Wrapper da API do Telegram
├── config.ts    # Gerenciamento de configuração
└── types.ts     # Tipos TypeScript
setup.ts         # Wizard de configuração interativa
```

## Comandos

```sh
bun run setup.ts      # Configuração inicial
bun run src/notify.ts --test  # Testar conexão
```

## Como Funciona

1. Claude Code dispara hook quando precisa de aprovação
2. `notify.ts` recebe JSON via stdin com detalhes da ação
3. Envia mensagem pro Telegram com botões [Approve] [Deny] [Skip] [Reply]
4. Aguarda resposta via polling
5. Retorna para Claude Code via exit code:
   - 0 = aprovado
   - 2 = negado (stderr tem mensagem)

## Configuração

Armazenada em `~/.claude-telegram/config.json`:
```json
{
  "botToken": "...",
  "chatId": "...",
  "timeout": 3600
}
```

Hooks em `~/.claude/settings.json`:
```json
{
  "hooks": {
    "Notification": [{
      "matcher": "permission_prompt",
      "hooks": [{
        "type": "command",
        "command": "bun run /path/to/src/notify.ts"
      }]
    }]
  }
}
```

## Desenvolvimento

- Use Bun, não Node.js
- Zero dependências externas (só usa fetch nativo do Bun)
- Tipos em `src/types.ts`
