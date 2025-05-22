## 1- Arquitetura do Sistema e Funcionamento

![Arquitetura 2PC](https://github.com/user-attachments/assets/99bf76a8-b8bd-4b6f-a39f-5b2a8c52bae7)

## 2- Metodologia para Escrita em Arquivos Distribuídos

O sistema mantém consistência forte em arquivos locais (log.txt) usando o protocolo 2PC:

- Definição do recurso – Cada instância possui um arquivo de texto próprio, armazenado no diretório da aplicação.

- Transação proposta – A mensagem enviada via /start contém a linha a ser escrita.

- Isolamento até Commit – A linha não é gravada imediatamente; ela viaja junto na segunda fase e só é persistida após decisão commit.

- Execução atômica – Se qualquer nó votar abort ou falhar, nenhum arquivo é modificado.

## 3- Estratégias para Simulação de Falhas e Impacto na Decisão

- Cada participante pode votar abort com base em uma chance definida em "commitProbability" (padrão: 0.8).

- Caso um participante não responda ou vote abort, a transação é cancelada.

## 4- Desafios Enfrentados e Decisões de Projeto

- Código único & papel dinâmico – Reduziu duplicidade, mas exigiu lógica clara para alternar entre coordenador e participante.
  
- Gerenciamento de peers – config.json manual para simplicidade; descoberta automática foi considerada, mas postergada.
  
- Persistência mínima – log.txt simples cumpre requisito, mas falha de coordenador pós‑commit revelaria necessidade de logs de recuperação

## 5- Exemplos de Execução e Resultados Esperados
### 5.1 Execução com Commit

#### Nó A inicia transação
curl -X POST http://localhost:3001/start \
     -H "Content-Type: application/json" \
     -d '{ "message": "Transação X concluída com sucesso" }'

Saída nos terminais:

> [COORDENADOR] Votos recebidos: commit, commit

> [COORDENADOR] Decisão final: commit

> [PARTICIPANTE 3002] Decisão: commit (escreveu) 

Conteúdo dos arquivos antes:

> #### log.txt vazio em todos os nós

Conteúdo dos arquivos depois:

> Transação X concluída com sucesso

6.2 Execução com Abort

Um nó responde abort (probabilidade 0.2):

> [COORDENADOR] Votos recebidos: commit, abort

> [COORDENADOR] Decisão final: abort

Arquivos permanecem inalterados:

> #### log.txt continua vazio
