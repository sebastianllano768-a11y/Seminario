/* ═══════════════════════════════════════════════════
   SeminarIA — Groq AI Evaluation Service (v2)
   
   FEATURES:
   ✅ Multi-model fallback — if one model exhausts its quota,
      the system automatically tries the next one silently.
   ✅ Standardized academic prompt — all models receive the same
      rigorous base prompt, guaranteeing consistent responses
      regardless of which model is actually used.
   ✅ Teacher-specific prompt injection — each deliverable can
      have custom evaluation instructions from the teacher,
      injected into the base prompt in a controlled section.
   ═══════════════════════════════════════════════════ */

const Groq = require('groq-sdk');

// ─── Multi-model priority list ───────────────────────
// The system tries models in this order. When one fails
// due to quota/rate-limit, it silently moves to the next.
const MODEL_PRIORITY = [
    'llama-3.3-70b-versatile',   // Primary: best quality
    'llama3-70b-8192',            // Fallback 1
    'gemma2-9b-it',               // Fallback 2
    'llama3-8b-8192',             // Fallback 3
    'mixtral-8x7b-32768'          // Fallback 4 (last resort)
];

// ─── Error detection for quota/rate-limit issues ─────
function isQuotaOrRateLimitError(err) {
    const msg = (err.message || '').toLowerCase();
    const status = err.status || err.statusCode || 0;
    return (
        status === 429 ||                         // Too Many Requests
        status === 503 ||                         // Service Unavailable
        msg.includes('rate_limit') ||
        msg.includes('rate limit') ||
        msg.includes('quota') ||
        msg.includes('tokens per') ||
        msg.includes('requests per') ||
        msg.includes('overloaded') ||
        msg.includes('context_length_exceeded')
    );
}

// ─── Groq client singleton ───────────────────────────
let groqClient = null;

function getClient() {
    if (!groqClient && process.env.GROQ_API_KEY) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

function isAvailable() {
    return !!process.env.GROQ_API_KEY;
}

// ─── Core fallback caller ────────────────────────────
/**
 * Attempts to call the Groq API using each model in priority order.
 * Silently skips to the next model on quota/rate-limit errors.
 * @returns {{ content: string, modelUsed: string }}
 */
async function callWithFallback(messages, maxTokens = 800, temperature = 0.2) {
    const client = getClient();
    if (!client) throw new Error('GROQ_API_KEY no está configurada');

    let lastError = null;

    for (const model of MODEL_PRIORITY) {
        try {
            const response = await client.chat.completions.create({
                model,
                messages,
                temperature,
                max_tokens: maxTokens
            });

            const content = response.choices[0]?.message?.content || '';
            console.log(`🤖 [Groq] Modelo utilizado: ${model}`);
            return { content, modelUsed: model };

        } catch (err) {
            if (isQuotaOrRateLimitError(err)) {
                console.warn(`⚠️ [Groq] Modelo "${model}" sin cuota disponible — probando siguiente...`);
                lastError = err;
                continue; // Try next model
            }
            // Non-quota error: re-throw immediately
            throw err;
        }
    }

    // All models exhausted
    throw new Error(
        `Todos los modelos de Groq han agotado su cuota. Último error: ${lastError?.message || 'desconocido'}`
    );
}

// ─── Standardized Academic Base Prompt ───────────────
/**
 * Builds the standardized system prompt that guarantees consistent
 * responses across all AI models. The teacher's specific instructions
 * are injected in a dedicated, clearly delimited section.
 *
 * @param {string|null} teacherPrompt - Custom instructions from the teacher for this deliverable
 * @returns {string}
 */
function buildStandardizedSystemPrompt(teacherPrompt) {
    const specificInstructions = teacherPrompt && teacherPrompt.trim()
        ? teacherPrompt.trim()
        : 'Evalúa el cumplimiento general de los estándares académicos de maestría en investigación.';

    return [
        'ROL: Eres un evaluador académico experto en trabajos de maestría en investigación científica.',
        'Tu misión es medir QUÉ TANTO cumple el trabajo del estudiante con lo que el docente solicita,',
        'y orientarlo hacia la mejora sin darle las respuestas.',
        '',
        'PRINCIPIOS FUNDAMENTALES — OBLIGATORIOS Y NO NEGOCIABLES:',
        '1. Responde SIEMPRE en español formal y académico.',
        '2. El puntaje (0 a 100) es el PORCENTAJE DE CUMPLIMIENTO: cuánto satisface el trabajo',
        '   los criterios definidos por el docente. 100 = cumple completamente; 0 = no cumple.',
        '3. NUNCA des la respuesta correcta al estudiante. NUNCA pongas ejemplos que constituyan',
        '   la solución. Señala QUÉ falta y en QUÉ dirección debe mejorar, sin más.',
        '4. Basa tu evaluación EXCLUSIVAMENTE en el contenido presentado, contrastado con los',
        '   criterios del docente.',
        '5. Sé específico: el estudiante debe saber exactamente qué aspectos mejorar.',
        '6. Mantén un tono académico, respetuoso y motivador.',
        '',
        'CRITERIOS ACADÉMICOS BASE (siempre aplicables, complementan los criterios del docente):',
        '- Coherencia y solidez de la argumentación',
        '- Uso adecuado de terminología académico-científica',
        '- Fundamentación teórica y empírica',
        '- Estructura y organización lógica del documento',
        '',
        '╔══════════════════════════════════════════════════════╗',
        '║  LO QUE EL DOCENTE QUIERE EVALUAR EN ESTA ENTREGA  ║',
        '║  (Estos criterios determinan el 100% del puntaje)  ║',
        '╠══════════════════════════════════════════════════════╣',
        specificInstructions,
        '╚══════════════════════════════════════════════════════╝',
        '',
        'FORMATO DE RESPUESTA — ESTRICTO E INVARIABLE:',
        'Responde ÚNICAMENTE con JSON válido. Sin texto adicional, sin markdown, sin backticks.',
        '{',
        '  "score": <entero 0-100: % en que el trabajo cumple los criterios del docente>,',
        '  "strengths": "<2-3 oraciones: qué aspectos SÍ cumplen con lo solicitado y por qué son positivos>",',
        '  "improvements": "<2-3 oraciones: qué aspectos NO cumplen aún y en qué dirección debe trabajar el estudiante. SIN dar la respuesta ni ejemplos que la sustituyan.>",',
        '  "summary": "<1-2 oraciones: veredicto del nivel de cumplimiento respecto a lo solicitado>"',
        '}'
    ].join('\n');
}

// ═══════════════════════════════════════════════════
// EVALUACIÓN POR PARÁMETRO
// ═══════════════════════════════════════════════════

/**
 * Evaluate a submission against a single parameter.
 * Returns structured JSON: { score, strengths, improvements, summary, modelUsed }
 */
async function evaluateParameter({ content, parameterName, parameterDescription, deliverableTitle, teacherPrompt }) {
    const systemPrompt = buildStandardizedSystemPrompt(teacherPrompt);

    const userPrompt = `ENTREGA: "${deliverableTitle}"
PARÁMETRO A EVALUAR: "${parameterName}"
DESCRIPCIÓN DEL PARÁMETRO: "${parameterDescription}"

CONTENIDO DEL TRABAJO DEL ESTUDIANTE:
${content.substring(0, 6000)}

Tarea: Evalúa cuánto cumple este trabajo con los criterios del docente para este parámetro. El score es el porcentaje de cumplimiento (0 = no cumple nada, 100 = cumple completamente). Señala qué sí cumple, qué falta y hacia dónde mejorar. SIN dar la respuesta directa. Responde solo con el JSON.`;

    try {
        const { content: raw, modelUsed } = await callWithFallback([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 900, 0.2);

        // Robustly extract JSON from response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('❌ La IA no devolvió JSON válido:', raw.substring(0, 200));
            return { score: 0, strengths: '', improvements: '', summary: 'Error al procesar la evaluación', modelUsed };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
            score: Math.min(100, Math.max(0, parseInt(parsed.score) || 0)),
            strengths: parsed.strengths || '',
            improvements: parsed.improvements || '',
            summary: parsed.summary || '',
            modelUsed
        };
    } catch (err) {
        console.error('❌ Error en evaluación de parámetro:', err.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════
// PIPELINE DE EVALUACIÓN COMPLETO
// ═══════════════════════════════════════════════════

/**
 * Evaluate a submission against ALL parameters for a deliverable.
 * Calls evaluateParameter for each parameter, stores results in DB.
 */
async function evaluateSubmission({ pool, submissionId, deliverableId, content }) {
    if (!isAvailable()) {
        console.log('⚠️ GROQ_API_KEY no configurada, omitiendo evaluación');
        return { evaluated: false, reason: 'API key no configurada' };
    }

    try {
        // Get deliverable info including teacher's custom prompt
        const delResult = await pool.query(
            'SELECT title, ai_prompt FROM deliverables WHERE id = $1',
            [deliverableId]
        );
        if (delResult.rows.length === 0) return { evaluated: false, reason: 'Entrega no encontrada' };

        const { title: deliverableTitle, ai_prompt: teacherPrompt } = delResult.rows[0];

        if (teacherPrompt) {
            console.log(`📋 [Groq] Prompt docente detectado para entrega "${deliverableTitle}"`);
        } else {
            console.log(`📋 [Groq] Sin prompt específico del docente — usando criterios estándar`);
        }

        // Get parameters for this deliverable
        const paramsResult = await pool.query(
            'SELECT id, name, description, weight FROM deliverable_parameters WHERE deliverable_id = $1 ORDER BY sort_order',
            [deliverableId]
        );

        if (paramsResult.rows.length === 0) {
            console.log('⚠️ Sin parámetros definidos para la entrega', deliverableId);
            return { evaluated: false, reason: 'Sin parámetros definidos' };
        }

        const parameters = paramsResult.rows;
        let totalWeightedScore = 0;
        let totalWeight = 0;
        const results = [];
        let lastModelUsed = MODEL_PRIORITY[0];

        // Evaluate each parameter sequentially (respect rate limits)
        for (const param of parameters) {
            console.log(`🔍 [Groq] Evaluando parámetro: "${param.name}"`);

            const result = await evaluateParameter({
                content,
                parameterName: param.name,
                parameterDescription: param.description,
                deliverableTitle,
                teacherPrompt  // Inject teacher's prompt into every parameter evaluation
            });

            if (result) {
                if (result.modelUsed) lastModelUsed = result.modelUsed;

                // Save per-parameter feedback to DB
                await pool.query(
                    `INSERT INTO submission_feedback (submission_id, parameter_id, score, max_score, strengths, improvements, summary)
                     VALUES ($1, $2, $3, 100, $4, $5, $6)`,
                    [submissionId, param.id, result.score, result.strengths, result.improvements, result.summary]
                );

                totalWeightedScore += result.score * param.weight;
                totalWeight += param.weight;
                results.push({ parameter: param.name, ...result });
            }

            // Delay between API calls to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        // Calculate overall weighted score
        const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

        // Build overall summary text
        const overallSummary = results
            .map(r => `• ${r.parameter}: ${r.score}/100 — ${r.summary}`)
            .join('\n');

        // Save AI summary (upsert to handle retries)
        await pool.query(
            `INSERT INTO submission_ai_summary (submission_id, overall_score, overall_summary, status, evaluated_at)
             VALUES ($1, $2, $3, 'completed', NOW())
             ON CONFLICT (submission_id) DO UPDATE
             SET overall_score = $2, overall_summary = $3, status = 'completed', evaluated_at = NOW()`,
            [submissionId, overallScore, overallSummary]
        );

        console.log(`✅ [Groq] Evaluación completada para envío ${submissionId}: ${overallScore}/100 (modelo: ${lastModelUsed})`);
        return { evaluated: true, overallScore, results, modelUsed: lastModelUsed };

    } catch (err) {
        console.error('❌ [Groq] Error en pipeline de evaluación:', err.message);

        await pool.query(
            `INSERT INTO submission_ai_summary (submission_id, overall_score, overall_summary, status)
             VALUES ($1, 0, $2, 'error')
             ON CONFLICT (submission_id) DO UPDATE SET status = 'error', overall_summary = $2`,
            [submissionId, `Error: ${err.message}`]
        ).catch(() => {});

        return { evaluated: false, reason: err.message };
    }
}

// ═══════════════════════════════════════════════════
// RESUMEN DE SESIÓN
// ═══════════════════════════════════════════════════

/**
 * Generate an AI summary for a session's evaluations.
 */
async function generateSessionSummary(evaluations) {
    if (!isAvailable()) return { available: false };

    try {
        const evalData = evaluations.map(e => ({
            rating: e.rating,
            contenido: e.score_contenido,
            docente: e.score_docente,
            material: e.score_material,
            participacion: e.score_participacion,
            fortalezas: e.fortalezas,
            mejoras: e.mejoras,
            comentarios: e.comentarios
        }));

        const { content: summary, modelUsed } = await callWithFallback([
            {
                role: 'system',
                content: 'Eres un analista de evaluaciones académicas experto. Resume las evaluaciones proporcionadas identificando patrones claros, fortalezas principales y áreas de mejora prioritarias. Usa español formal y académico. Sé conciso pero completo.'
            },
            {
                role: 'user',
                content: `Analiza estas ${evaluations.length} evaluaciones y genera un resumen ejecutivo estructurado:\n\n${JSON.stringify(evalData, null, 2)}`
            }
        ], 1500, 0.4);

        return { available: true, summary, modelUsed };
    } catch (err) {
        console.error('❌ [Groq] Error generando resumen de sesión:', err.message);
        return { available: true, error: true, message: err.message };
    }
}

module.exports = {
    isAvailable,
    evaluateParameter,
    evaluateSubmission,
    generateSessionSummary
};
