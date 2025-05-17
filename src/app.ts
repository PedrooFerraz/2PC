/*
 * Two‑Phase Commit (2PC)
 * ---------------------------------------------------------------
 * Como rodar a aplicação:
 *   1) Crie um arquivo chamado "config.json" na pasta /src, e.g.
 *      {
 *        "port": 3001,
 *        "peers": ["http://localhost:3002", "http://localhost:3003"],
 *        "commitProbability": 0.8 // optional, default 0.8
 *      }
 *   2) PORT e peer devem ser unicos para cada instância.
 *   3) Rode o Código:  npm run start
 *   4) Inicie uma transação (o nó se torna coordenador):
 *      curl -X POST http://localhost:${port}/start -H "Content-Type: application/json" \
 *           -d '{"message":"Mensagem que deseja gravar"}'
 */

import express from 'express';
import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';

interface Config {
  port: number;
  peers: string[];            // URLs dos outros nós (http(s)://host:port)
  commitProbability?: number; // Possibilidade do voto ser "commit"
}

// ------- Carrega o arquivo de configuração -------------------------------------------------
const CONFIG_PATH = path.resolve(__dirname, 'config.json');
const config: Config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const app = express();
app.use(express.json());

const LOG_FILE = path.resolve(__dirname, 'log.txt');
const commitProbability = config.commitProbability ?? 0.8; // Caso não específicado no config.json a chance de commit é 80%

function localVote(): 'Commitar' | 'Abortar' {
  return Math.random() < commitProbability ? 'Commitar' : 'Abortar';
}

// ------- Comportamento dos Participantes -------------------------------------------------
app.post('/canCommit', (_req, res) => {
  const vote = localVote();
  console.log(`[Nó ${config.port}] Votando: ${vote}`);
  res.json({ vote });
});

app.post('/doCommit', (req, res) => {
  const { decision, message } = req.body as { decision: 'Commitar' | 'Abortar'; message: string };
  console.log(`[Nó ${config.port}] Decisão recebida do coordenador: ${decision}`);
  try {
    setTimeout(() => {
    if (decision === 'Commitar') {

      //timeout de 10 seg para testar se caso o server fechar no meio da req
      fs.appendFileSync(LOG_FILE, message + '\n');
      console.log(`[${config.port}] Escreveu no arquivo: "${message}"`);
      
    }
    res.sendStatus(200);
  }, 10000);
  } catch (err) {
    console.error(`[Nó ${config.port}] Erro ao escrever no arquivo: ${err}`);
    res.sendStatus(500);
  }
});

// ------- Comportamento do Coordenador -------------------------------------------------
app.post('/start', async (req, res) => {
  const message: string = req.body?.message || `Transação-${Date.now()}`; // Se não for passado nenhuma mensagem no Body da requisição, ele apenas escreve a data atual no log
  const peers = config.peers;
  console.log(`\n[${config.port}] Iniciando 2PC para escrever no arquivo: "${message}"`);

  // ---- Fase 1: Votação ------------------------------------------------------
  const votes: string[] = [];
  for (const peer of peers) {
    try {
      const resp = await axios.post(`${peer}/canCommit`);
      votes.push(resp.data.vote);
      console.log(`Voto do Nó ${peer}: ${resp.data.vote}`);
    } catch (err) {
      console.log(`Erro ao contactar o nó: ${peer} \n Erro: ${err}`);
      votes.push('Abort');
    }
  }
  // Voto do próprio coordenador
  votes.push(localVote());

  const decision: 'Commitar' | 'Abortar' = votes.every(v => v === 'Commitar') ? 'Commitar' : 'Abortar';
  console.log(`[${config.port}] Decisão : ${decision}`);

  // ---- Fase 2: Decisão ------------------------------------------------------
  for (const peer of peers) {
    let responded = false;
    let resp: AxiosResponse = { status: 500 } as AxiosResponse;

    while (!responded) {
      try {
        resp = await axios.post(`${peer}/doCommit`, { decision, message });
        if (resp.status === 200) {
          responded = true;
        } else {
          console.log(`Erro ao contactar o nó ${peer} \nErro: ${resp.status}`);
          await new Promise(resolve => setTimeout(resolve, 15000));
          console.log(`\nTentando novamente contactar o nó ${peer}...`);
        }
      } catch (err: any) {
        const status = err?.response?.status || 'sem resposta';
        console.log(`Erro ao contactar o nó ${peer} \n Erro: ${status}`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        console.log(`\nTentando novamente contactar o nó ${peer}...`);
      }
    }
  }
  // Aplica localmente
  if (decision === 'Commitar') {
    fs.appendFileSync(LOG_FILE, message + '\n');
    console.log(`[${config.port}] Escreveu no arquivo: "${message}"`);
  }
  else{
    console.log(`[${config.port}] Transação abortada`);
  }

  res.json({ decision });
});

// ---------------------------------------------------------------------------
app.listen(config.port, () => {
  console.log(`\nNode 2PC rodando na porta ${config.port}`);
  console.log(`Peers configurados: ${config.peers.join(', ') || 'nenhum'}`);
  console.log('Use POST /start para iniciar uma transação nesta instância.');
});
