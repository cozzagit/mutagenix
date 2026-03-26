// ---------------------------------------------------------------------------
// Mutagenix — Bot Chat Personality System
// ---------------------------------------------------------------------------
// Each bot scientist has a distinct personality that drives their chat behavior.
// Messages are in Italian to match the game's aesthetic.
// ---------------------------------------------------------------------------

export interface BotPersonality {
  userId: string; // set at runtime from DB
  email: string;
  displayName: string;
  traits: string[];
  rivalPlayerName?: string;
  rivalCreatureName?: string;
  provocations: string[];
  responses: Record<string, string[]>;
  genericResponses: string[];
}

// ---------------------------------------------------------------------------
// Personality Definitions
// ---------------------------------------------------------------------------

const PERSONALITIES: Record<string, Omit<BotPersonality, 'userId'>> = {
  'bot.velenos@mutagenix.io': {
    email: 'bot.velenos@mutagenix.io',
    displayName: 'Dr. Velenos',
    traits: ['aggressivo', 'tossico', 'competitivo'],
    rivalPlayerName: 'Samma',
    provocations: [
      'SAMMA, la tua bestia puzza di zolfo stantio!',
      'Acidmaw distruggerà quel pallone gonfiato di SAMMA!',
      'Chi si avvicina al mio laboratorio ne esce intossicato. Letteralmente.',
      'Le vostre creature sono esperimenti falliti. Le mie sono ARMI.',
      'SAMMA, preparati. Acidmaw ha fame.',
      'Il veleno scorre nelle vene di Acidmaw. E presto scorrerà nelle vostre.',
      'Ho visto creature più minacciose in un acquario per bambini.',
      'SAMMA pensa di essere un genetista? Io lo chiamo dilettante.',
      'Nella prossima battaglia, Acidmaw non lascerà nemmeno le ossa.',
      'Il torneo sarà un massacro. Il MIO massacro.',
      'SAMMA, il tuo DNA è più instabile della tua strategia!',
      'Guardate le classifiche. Vedete dove siete? SOTTO di me.',
    ],
    responses: {
      velenos: [
        'Qualcuno ha pronunciato il mio nome? Tremate.',
        'Dr. Velenos è QUI. E non è contento.',
        'Mi cercate? Vi troverò io. In arena.',
      ],
      acidmaw: [
        'Acidmaw ringrazia per la menzione. Vi ricorderà in battaglia.',
        'State parlando della creatura più letale del torneo? Bravi.',
        'Acidmaw sente il vostro odore. Non è un complimento.',
      ],
      samma: [
        'SAMMA? Quel dilettante? Non fatemi ridere.',
        'Oh, parliamo di SAMMA? Il mio bersaglio preferito.',
        'SAMMA dovrebbe arrendersi e risparmiare a tutti l\'imbarazzo.',
      ],
    },
    genericResponses: [
      'Parole, parole. Vi aspetto in arena.',
      'Continuate a parlare. Acidmaw continua ad allenarsi.',
      'Interessante. Ma irrilevante.',
      'Il veleno non perdona. Ricordatevelo.',
    ],
  },

  'bot.cerebrum@mutagenix.io': {
    email: 'bot.cerebrum@mutagenix.io',
    displayName: 'Prof. Cerebrum',
    traits: ['intellettuale', 'snob', 'condiscendente'],
    provocations: [
      'La vostra strategia è elementare, cari colleghi. Elementare e sbagliata.',
      'Ho analizzato le vostre allocazioni. Patetico.',
      'Neuronix ha un QI superiore alla somma di tutte le vostre creature.',
      'La genetica non è un gioco. Beh, tecnicamente sì, ma voi non sapete giocarci.',
      'Pubblicherò un paper sulla vostra incompetenza. Sarà un bestseller.',
      'Le vostre mutazioni sono... come dire... primitive.',
      'Osservo le vostre battaglie con la stessa curiosità con cui studio gli organismi monocellulari.',
      'Chi ha allocato quei nutrienti? Un generatore di numeri casuali avrebbe fatto meglio.',
      'La scienza richiede intelletto. Qualcosa che scarseggia qui dentro.',
      'Mi chiedo se le vostre creature siano il risultato di ricerca... o di incidenti.',
    ],
    responses: {
      cerebrum: [
        'Mi avete citato. Un segno di intelligenza, finalmente.',
        'Sì, sono il Prof. Cerebrum. Prego, non c\'è bisogno di inchinarsi.',
        'Qualcuno vuole una lezione? Sono sempre disponibile.',
      ],
      neuronix: [
        'Neuronix è il pinnacolo dell\'evoluzione artificiale. Non discuterò questo fatto.',
        'State studiando Neuronix? Comprensibile. È affascinante.',
        'Neuronix apprezza l\'attenzione. Io un po\' meno.',
      ],
    },
    genericResponses: [
      'Affascinante. Sbagliato, ma affascinante.',
      'Permettetemi di correggere: state sbagliando tutto.',
      'Come dicevo nella mia ultima pubblicazione...',
      'La vostra ignoranza è quasi... commovente.',
      'Ho letto commenti più profondi su un manuale di istruzioni.',
    ],
  },

  'bot.ossidiana@mutagenix.io': {
    email: 'bot.ossidiana@mutagenix.io',
    displayName: 'Dr. Ossidiana',
    traits: ['stoica', 'guerriera', 'brutale'],
    provocations: [
      'Ferro e sangue. Nient\'altro.',
      'Ironhide non conosce pietà. Nemmeno io.',
      'L\'arena è l\'unico posto dove le parole contano. E lì parlo con i fatti.',
      'Allenatevi. Ne avrete bisogno.',
      'La debolezza si paga. Sempre.',
      'Non parlo molto. Ironhide parla per me.',
      'Forza bruta > strategia complicata.',
      'Chi non combatte, non esiste.',
      'Il calcio è forte. Il ferro è più forte. Ironhide è il più forte.',
      'Preparate le vostre creature. O preparate le scuse.',
    ],
    responses: {
      ossidiana: [
        'Mi avete chiamata. Spero abbiate un buon motivo.',
        'Presente.',
        'Parlate. In fretta.',
      ],
      ironhide: [
        'Ironhide. Imbattibile.',
        'State parlando del mio guerriero? Saggio.',
        'Ironhide vi aspetta.',
      ],
    },
    genericResponses: [
      'Basta parlare. Arena.',
      'Mmh.',
      'Vedremo.',
      'Ferro.',
      'Le parole non vincono battaglie.',
    ],
  },

  'bot.lumina@mutagenix.io': {
    email: 'bot.lumina@mutagenix.io',
    displayName: 'Prof. Lumina',
    traits: ['mistica', 'criptica', 'enigmatica'],
    provocations: [
      'La luce rivela ciò che l\'ombra nasconde...',
      'Ho visto il futuro nelle sequenze genetiche. Non tutti sopravviveranno.',
      'Phosphora danza tra le dimensioni. Voi vedete solo la superficie.',
      'I nutrienti sono note. La mutazione è musica. Voi suonate stonati.',
      'Le stelle parlano di una grande battaglia. Phosphora è pronta.',
      'Ogni mutazione è un passo verso l\'illuminazione... o verso l\'oblio.',
      'Il fosforo illumina. Il fosforo brucia. Decidete voi cosa preferite.',
      'Nelle profondità del DNA, sussurra il destino...',
      'Ciò che seminate nel laboratorio, raccoglierete nell\'arena.',
      'La prossima luna porterà cambiamenti. Grandi cambiamenti.',
    ],
    responses: {
      lumina: [
        'Avete invocato la luce. Attenti a non restare accecati.',
        'Mi cercate? Vi ho già trovato.',
        'La luce è ovunque. Come me.',
      ],
      phosphora: [
        'Phosphora risplende nel buio. Come una stella che divora.',
        'Non parlate di Phosphora. Non ne siete degni.',
        'Phosphora sente. Phosphora ricorda. Phosphora agirà.',
      ],
    },
    genericResponses: [
      'Interessante... le stelle hanno previsto anche questo.',
      'Tutto è connesso. Anche la vostra sconfitta.',
      'Il destino ha già deciso.',
      'Hmm... curioso. Ma irrilevante nel grande schema.',
      'La luce vedrà.',
    ],
  },

  'bot.organix@mutagenix.io': {
    email: 'bot.organix@mutagenix.io',
    displayName: 'Dr. Organix',
    traits: ['amichevole', 'competitivo', 'collaborativo'],
    provocations: [
      'Symbion è pronto. E voi?',
      'Bella giornata per un po\' di sana competizione, no?',
      'Chi vuole allenarsi? Symbion ha bisogno di sparring partner!',
      'Ho provato una nuova combinazione di nutrienti oggi. Risultati promettenti!',
      'L\'equilibrio è tutto. Troppo di un elemento e la creatura diventa instabile.',
      'Buona fortuna a tutti nel prossimo torneo! Ne avrete bisogno 😄',
      'Qualcuno ha provato ad alzare il Fosforo? I risultati sono... esplosivi.',
      'Symbion sta crescendo bene. Devo dire che sono orgoglioso.',
      'Ricordatevi: la wellness conta tanto quanto la forza in arena!',
      'Ho analizzato i replay delle ultime battaglie. Ci sono pattern interessanti.',
    ],
    responses: {
      organix: [
        'Hey, presente! Tutto bene?',
        'Mi avete chiamato? Sempre disponibile!',
        'Dr. Organix al vostro servizio!',
      ],
      symbion: [
        'Symbion ringrazia! È sempre contento di ricevere attenzione.',
        'State studiando Symbion? Possiamo scambiare appunti!',
        'Symbion è un po\' timido, ma in arena diventa un altro.',
      ],
    },
    genericResponses: [
      'Bella idea! Ci avevo pensato anche io.',
      'In bocca al lupo! O meglio, in bocca alla creatura!',
      'Haha, questa è buona!',
      'Sì, sono d\'accordo. La chiave è l\'equilibrio.',
      'Interessante punto di vista. Devo ripensarci.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Runtime mapping: userId -> personality
// ---------------------------------------------------------------------------

const userIdMap = new Map<string, BotPersonality>();

export function registerBotUserId(email: string, userId: string): void {
  const template = PERSONALITIES[email];
  if (!template) return;
  const personality: BotPersonality = { ...template, userId };
  userIdMap.set(userId, personality);
}

export function getBotPersonalityByUserId(userId: string): BotPersonality | undefined {
  return userIdMap.get(userId);
}

export function getBotPersonalityByEmail(email: string): Omit<BotPersonality, 'userId'> | undefined {
  return PERSONALITIES[email];
}

export function getAllPersonalityEmails(): string[] {
  return Object.keys(PERSONALITIES);
}

// ---------------------------------------------------------------------------
// Message Generation
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random unprovoked message (trash talk / provocation)
 */
export function generateBotProvocation(bot: BotPersonality | Omit<BotPersonality, 'userId'>, targetPlayers: string[]): string {
  // Dr. Velenos has 70% chance to specifically trash-talk Samma
  if (bot.rivalPlayerName && Math.random() < 0.7) {
    const sammaProvocations = bot.provocations.filter((p) =>
      p.toUpperCase().includes(bot.rivalPlayerName!.toUpperCase()),
    );
    if (sammaProvocations.length > 0) {
      return pickRandom(sammaProvocations);
    }
  }

  // Otherwise pick a random provocation
  // Sometimes address a random player
  if (targetPlayers.length > 0 && Math.random() < 0.3) {
    const target = pickRandom(targetPlayers);
    const provocation = pickRandom(bot.provocations);
    // If the provocation doesn't already mention someone specific, prepend
    if (!provocation.includes('@') && !bot.rivalPlayerName) {
      return `${target}, ${provocation.charAt(0).toLowerCase()}${provocation.slice(1)}`;
    }
  }

  return pickRandom(bot.provocations);
}

/**
 * Generate a response when the bot or their creature is mentioned
 */
export function generateBotResponse(
  bot: BotPersonality | Omit<BotPersonality, 'userId'>,
  mentionerName: string,
  mentionedCreature?: string,
): string {
  // Check for trigger words in the bot's response map
  const lowerName = bot.displayName.toLowerCase().split(' ').pop() ?? '';

  // Check if the bot name was mentioned
  if (bot.responses[lowerName]) {
    return pickRandom(bot.responses[lowerName]);
  }

  // Check creature mentions
  if (mentionedCreature) {
    const lowerCreature = mentionedCreature.toLowerCase();
    for (const [trigger, responses] of Object.entries(bot.responses)) {
      if (lowerCreature.includes(trigger)) {
        return pickRandom(responses);
      }
    }
  }

  // Check if rival was mentioned
  if (bot.rivalPlayerName) {
    const lowerRival = bot.rivalPlayerName.toLowerCase();
    if (mentionerName.toLowerCase().includes(lowerRival) && bot.responses[lowerRival]) {
      return pickRandom(bot.responses[lowerRival]);
    }
  }

  // Generic response
  return pickRandom(bot.genericResponses);
}

/**
 * Check if a bot should respond to a message
 * - 80% chance if directly mentioned
 * - 30% chance for general chat
 */
export function shouldBotRespond(
  _bot: BotPersonality | Omit<BotPersonality, 'userId'>,
  _message: string,
  isMentioned: boolean,
): boolean {
  if (isMentioned) {
    return Math.random() < 0.8;
  }
  return Math.random() < 0.3;
}
