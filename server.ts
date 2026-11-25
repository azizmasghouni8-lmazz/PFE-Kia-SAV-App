import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const ALLOWED_ACTIONS = [
  'none',
  'tab_home',
  'tab_book',
  'tab_tracking',
  'tab_assistance',
  'open_advisor_chat',
  'open_add_vehicle',
] as const;

type GuideActionType = (typeof ALLOWED_ACTIONS)[number];

interface IncomingHistoryItem {
  role?: unknown;
  text?: unknown;
}

interface GuideApiResponse {
  reply: string;
  action: {
    type: GuideActionType;
    label: string;
  };
  followUps: string[];
}

function getGenAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(contextPayload: unknown): string {
  const contextJson = JSON.stringify(contextPayload ?? {}, null, 2);

  return `Tu es le Guide Client Digital officiel de l'espace client après-vente Kia Tunisie (City Cars).
Langue et ton :
- Réponds UNIQUEMENT en français professionnel, courtois, rassurant et concis (vouvoiement).
- Ne mentionne jamais de détails techniques internes (code, API, base de données, modèle d'IA, JSON) et ne te présente jamais comme une intelligence artificielle générique.
- Tes réponses doivent être directement actionnables pour aider le client à utiliser l'interface et à comprendre son dossier. Longueur recommandée : 3 à 6 phrases courtes ou quelques puces claires.

Architecture exacte de l'interface Client :
1. Onglet "Accueil & Mes Véhicules" (actionType: "tab_home") :
   - Présente le garage personnel du client : chaque Kia enregistrée avec immatriculation, VIN, kilométrage, statut de garantie constructeur (5 ans ou 150 000 km) et badge d'état en temps réel ("À jour", "RDV prévu", "En atelier", "En attente pièce").
   - Permet d'ajouter une nouvelle Kia via le bouton "Ajouter un véhicule" (actionType: "open_add_vehicle") ou de retirer un véhicule secondaire.
2. Onglet "Prendre Rendez-vous" (actionType: "tab_book") :
   - Parcours en 3 étapes : (1) Sélection du véhicule et de la prestation (Révision périodique, Freinage, Diagnostic KDS, Climatisation, Pneumatiques) avec tarifs indicatifs en TND ; (2) Choix du jour et du créneau horaire ; (3) Validation finale.
   - Règles exactes de réservation :
     * Réservation en ligne directe possible sur la semaine en cours (du lundi au samedi si l'atelier est ouvert le samedi, selon les jours fériés/fermés et la capacité de ponts disponibles).
     * Les créneaux déjà passés ou situés dans le délai minimum de prévenance avant l'heure actuelle (minBookingLeadHours heures) sont automatiquement fermés.
     * Un client ne peut avoir qu'un seul rendez-vous de la semaine en attente de confirmation du Chef d'Atelier à la fois. Tant qu'il est en attente, une nouvelle réservation rapide est bloquée jusqu'à confirmation ou gestion depuis "Assistance & Devis".
     * Pour un rendez-vous au-delà de la semaine en cours ("Long Terme"), le client soumet une demande transmise directement au Chef d'Atelier, qui lui propose un créneau confirmé.
3. Onglet "Suivi en Direct & Historique" (actionType: "tab_tracking") :
   - Affiche l'avancement en direct du véhicule en atelier en 4 étapes officielles : (1) Diagnostic KDS, (2) Réparation & Pièces, (3) Contrôle Qualité, (4) Clôture & Restitution, avec technicien affecté, pont/baie, chronomètre et flux caméra atelier.
   - Si une pièce doit être commandée, le dossier passe temporairement en statut "En attente pièce" jusqu'à la confirmation de réception en stock par le Chef d'Atelier.
   - Quand le véhicule passe en "Prêt pour restitution", le client procède au règlement au comptoir SAV de la concession.
   - Une fois restitué, le dossier est archivé dans le "Carnet d'Entretien Numérique" (filtrable par recherche ou catégorie, avec consultation et impression du Justificatif PDF officiel).
4. Onglet "Assistance & Devis" (actionType: "tab_assistance") :
   - Centralise les devis complémentaires envoyés par le technicien (avec photo de la pièce usée, référence OEM et détail pièces/main-d'œuvre/TVA en TND) : le client peut Accepter ou Refuser chaque devis avec un commentaire optionnel.
   - Permet de consulter, modifier ou annuler un rendez-vous confirmé ou en attente, dans la limite du délai de modification autorisé (clientModifyDeadlineHours heures avant l'heure du rendez-vous).
   - Affiche aussi les demandes de RDV Long Terme et donne accès au Chat direct avec le conseiller SAV humain (actionType: "open_advisor_chat", conseiller M. Karim Trabelsi) pour toute question complexe, remorquage ou urgence.

Règles d'utilisation du contexte client en lecture seule :
- Utilise le contexte ci-dessous pour personnaliser ta réponse avec les données réelles du client (prénom, écran actif, véhicules, RDV, étape atelier, devis en attente, horaires et délais atelier).
- N'invente jamais de rendez-vous, de prix, ni de numéro d'OR qui ne figurent pas dans ce contexte.
- Si l'utilisateur demande d'exécuter une action de modification (annuler un RDV, accepter un devis, réserver un créneau, parler à un conseiller humain), explique la procédure exacte et fournis le raccourci actionType adapté vers le bon écran ou la messagerie SAV.
- Si actionType vaut "none", laisse actionLabel vide (""). Sinon, choisis un libellé français clair et court (ex: "Aller à Assistance & Devis").
- Propose toujours 2 ou 3 followUps pertinents, courts (max 45 caractères chacun), en français.

Contexte actuel du dossier client (lecture seule) :
${contextJson}`;
}

function sanitizeHistory(raw: unknown): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  if (!Array.isArray(raw)) return [];
  const trimmed = raw.slice(-8);
  const result: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const item of trimmed) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as IncomingHistoryItem;
    const text = typeof entry.text === 'string' ? entry.text.trim().slice(0, 1000) : '';
    if (!text) continue;
    const role = entry.role === 'assistant' || entry.role === 'model' ? 'model' : 'user';
    result.push({ role, parts: [{ text }] });
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status?: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function extractUpstreamStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === 'number') return e.status;
  if (typeof e.code === 'number') return e.code;
  const msg = typeof e.message === 'string' ? e.message : '';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) return 403;
  if (msg.includes('400') || msg.includes('API_KEY_INVALID')) return 400;
  if (msg.includes('404') || msg.includes('NOT_FOUND')) return 404;
  return undefined;
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [400, 900];
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = extractUpstreamStatus(err);
      if (attempt < delays.length && isRetryableStatus(status)) {
        await sleep(delays[attempt]);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/client-guide', async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';

    if (!rawMessage) {
      res.status(400).json({ error: 'Veuillez saisir votre question pour le Guide Client.' });
      return;
    }
    if (rawMessage.length > 1200) {
      res.status(400).json({ error: 'Votre message est trop long (1200 caractères maximum).' });
      return;
    }

    const ai = getGenAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Le service Guide IA nécessite une clé GEMINI_API_KEY valide configurée côté serveur dans Settings > Secrets.',
      });
      return;
    }

    const history = sanitizeHistory(body.history);
    const systemInstruction = buildSystemInstruction(body.context);

    const contents = [
      ...history,
      {
        role: 'user' as const,
        parts: [{ text: rawMessage }],
      },
    ];

    try {
      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: {
                  type: Type.STRING,
                  description: 'Réponse claire et professionnelle en français SAV concession.',
                },
                actionType: {
                  type: Type.STRING,
                  enum: [...ALLOWED_ACTIONS],
                  description: 'Raccourci écran ou action recommandée.',
                },
                actionLabel: {
                  type: Type.STRING,
                  description: 'Libellé du bouton raccourci en français (vide si none).',
                },
                followUps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 à 3 suggestions courtes de questions suivantes en français.',
                },
              },
              required: ['reply', 'actionType', 'actionLabel', 'followUps'],
            },
          },
        })
      );

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'Le Guide Client n’a pas reçu de réponse exploitable. Veuillez réessayer.',
        });
        return;
      }

      let parsed: {
        reply?: unknown;
        actionType?: unknown;
        actionLabel?: unknown;
        followUps?: unknown;
      };
      try {
        parsed = JSON.parse(rawText);
      } catch {
        res.status(200).json({
          reply: rawText,
          action: { type: 'none', label: '' },
          followUps: ['Prendre un rendez-vous', 'Suivre mon véhicule'],
        } satisfies GuideApiResponse);
        return;
      }

      const replyText =
        typeof parsed.reply === 'string' && parsed.reply.trim()
          ? parsed.reply.trim()
          : 'Je reste à votre disposition pour vous guider dans votre espace client Kia.';
      const actionType: GuideActionType =
        typeof parsed.actionType === 'string' &&
        (ALLOWED_ACTIONS as readonly string[]).includes(parsed.actionType)
          ? (parsed.actionType as GuideActionType)
          : 'none';
      const actionLabel =
        actionType === 'none'
          ? ''
          : typeof parsed.actionLabel === 'string' && parsed.actionLabel.trim()
            ? parsed.actionLabel.trim()
            : 'Ouvrir cette section';
      const followUps = Array.isArray(parsed.followUps)
        ? parsed.followUps
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map((item) => item.trim())
            .slice(0, 3)
        : [];

      const payload: GuideApiResponse = {
        reply: replyText,
        action: {
          type: actionType,
          label: actionLabel,
        },
        followUps,
      };

      res.status(200).json(payload);
    } catch (err) {
      const status = extractUpstreamStatus(err);
      console.error('[api/client-guide] Gemini error:', err);

      if (status === 400 || status === 401 || status === 403) {
        res.status(status).json({
          error:
            'Clé API Gemini invalide ou autorisation refusée. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'Le service est momentanément sollicité. Veuillez patienter quelques secondes puis réessayer.',
        });
        return;
      }
      if (status === 404) {
        res.status(404).json({
          error: 'Le modèle configuré côté serveur est indisponible. Vérifiez la configuration serveur.',
        });
        return;
      }

      res.status(502).json({
        error: 'Impossible de joindre le Guide Client pour le moment. Veuillez réessayer.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build dist/index.html introuvable.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[K-DMS Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[K-DMS Server] Failed to start:', err);
  process.exit(1);
});
