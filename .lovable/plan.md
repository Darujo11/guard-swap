

## Plano: Cor mista nos dias trocados (90% minha equipe + 10% equipe original)

### Alteração

**Arquivo:** `src/components/schedule/GuardPersonalCalendar.tsx`

1. **Interface `WorkingDay`**: Adicionar campo `originalTeamColor` para guardar a cor da equipe original do dia trocado.

2. **Lógica de swap (linhas 99-125)**: Ao criar o dia trocado, guardar a cor da outra equipe em `originalTeamColor` e usar a cor da própria equipe (`teamColor`) como cor principal.

3. **Renderização (linha 226)**: Para dias trocados, usar CSS `linear-gradient` misturando 90% da cor do segurança com 10% da cor original:
   ```
   background: linear-gradient(135deg, {myColor} 90%, {otherColor} 10%)
   ```

4. **Legenda**: Manter a legenda dinâmica com as cores das outras equipes para referência.

### Resultado
- Dias normais: 100% cor da equipe do segurança
- Dias trocados: 90% cor da própria equipe + 10% cor da equipe de quem era o dia (faixa diagonal no canto)

