// ---------------------------------------------------------------------------
// Mutagenix – Bot Cycle Runner
// ---------------------------------------------------------------------------
// Chiama l'endpoint cron dei bot per far combattere e iniettare i bot.
//
// Uso:
//   npx tsx scripts/run-bot-cycle.ts
//   # oppure
//   curl "http://localhost:3004/api/cron/bot-battles?key=mutagenix-bot-secret-2026"
// ---------------------------------------------------------------------------

const BASE_URL = process.env.MUTAGENIX_URL ?? 'http://localhost:3004';
const CRON_SECRET = 'mutagenix-bot-secret-2026';

async function runBotCycle(): Promise<void> {
  const url = `${BASE_URL}/api/cron/bot-battles?key=${CRON_SECRET}`;

  console.log(`[Bot Cycle] Chiamata a ${url}...`);
  console.log(`[Bot Cycle] Orario: ${new Date().toISOString()}`);
  console.log('---');

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`[Bot Cycle] Errore HTTP ${response.status}:`, data);
      process.exit(1);
    }

    const result = data.data;

    console.log(`[Bot Cycle] Battaglie giocate: ${result.battlesPlayed}`);
    console.log(`[Bot Cycle] Iniezioni eseguite: ${result.injectionsPerformed}`);
    console.log('');

    if (result.results.length > 0) {
      console.log('--- RISULTATI BATTAGLIE ---');
      for (const r of result.results) {
        const winnerStr = r.winner ?? 'PAREGGIO';
        console.log(`  ${r.challenger} vs ${r.defender} => ${winnerStr} (ELO: ${r.eloChange})`);
      }
      console.log('');
    }

    if (result.injections.length > 0) {
      console.log('--- INIEZIONI ---');
      for (const inj of result.injections) {
        console.log(`  ${inj.bot}: ${inj.creature} -> giorno ${inj.newDay}`);
      }
      console.log('');
    }

    if (result.log.length > 0) {
      console.log('--- LOG DETTAGLIATO ---');
      for (const line of result.log) {
        console.log(`  ${line}`);
      }
    }

    console.log('---');
    console.log('[Bot Cycle] Completato.');
  } catch (err) {
    console.error('[Bot Cycle] Errore di connessione:', err instanceof Error ? err.message : err);
    console.error('[Bot Cycle] Assicurati che il server sia in esecuzione su', BASE_URL);
    process.exit(1);
  }
}

runBotCycle();
