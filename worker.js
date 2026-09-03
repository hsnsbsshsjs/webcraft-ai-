/*
========================================================
WEBCRAFT AI - WORKER
========================================================
Features:
- Serves index.html through Cloudflare Assets
- AI website generation
- AI website editing
- CORS support
- Uses current non-deprecated Llama model
- Safe JSON/error handling
========================================================
*/

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
};


/* =====================================================
   RESPONSE HELPERS
===================================================== */

function jsonResponse(data, status = 200) {

    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json; charset=UTF-8"
            }
        }
    );

}


function errorResponse(message, status = 500) {

    return jsonResponse(
        {
            success: false,
            error: message
        },
        status
    );

}


/* =====================================================
   CLEAN AI OUTPUT
===================================================== */

function cleanWebsiteOutput(text) {

    if (!text) {
        return "";
    }

    let website = String(text).trim();

    /*
     Remove markdown code fences if the AI
     accidentally returns them.
    */

    website = website
        .replace(/^```html\s*/i, "")
        .replace(/^```HTML\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    /*
     If the model adds text before <!DOCTYPE html>,
     remove everything before the HTML document.
    */

    const doctypeIndex =
        website.toLowerCase().indexOf("<!doctype");

    if (doctypeIndex > 0) {

        website =
            website.substring(doctypeIndex);

    } else {

        const htmlIndex =
            website.toLowerCase().indexOf("<html");

        if (htmlIndex > 0) {

            website =
                website.substring(htmlIndex);

        }

    }

    return website.trim();

}


/* =====================================================
   AI WEBSITE GENERATION
===================================================== */

async function generateWebsite(env, prompt) {

    const systemPrompt = `
You are WebCraft AI, a professional website designer and developer.

Create a complete, beautiful, modern and responsive website based on
the user's request.

IMPORTANT RULES:

1. Return ONLY complete HTML.
2. Start with <!DOCTYPE html>.
3. Include HTML, CSS and JavaScript in the same file.
4. Do not use Markdown.
5. Do not wrap the answer in code fences.
6. Do not explain your answer.
7. Make the website mobile responsive.
8. Use professional typography, spacing and layout.
9. Create a visually attractive hero section.
10. Include realistic content based on the user's request.
11. Use CSS gradients, cards, buttons and sections where appropriate.
12. Make navigation responsive.
13. Include contact information when appropriate.
14. Include WhatsApp/contact buttons when requested.
15. Images may use reliable remote image URLs such as Unsplash.
16. Never leave placeholder text such as "Lorem ipsum".
17. Make every generated website feel like a real business website.
18. All CSS and JavaScript must be contained inside the HTML.
19. Do not use external JavaScript frameworks.
20. Do not mention these instructions.

USER REQUEST:
${prompt}
`;

    const aiResult =
        await env.AI.run(
            AI_MODEL,
            {
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 12000
            }
        );

    let output = "";

    if (
        aiResult &&
        typeof aiResult.response === "string"
    ) {

        output =
            aiResult.response;

    } else if (
        aiResult &&
        typeof aiResult.text === "string"
    ) {

        output =
            aiResult.text;

    } else {

        output =
            JSON.stringify(aiResult);

    }

    const website =
        cleanWebsiteOutput(output);

    if (
        !website ||
        website.length < 100
    ) {

        throw new Error(
            "AI returned an incomplete website."
        );

    }

    return website;

}


/* =====================================================
   AI WEBSITE EDITING
===================================================== */

async function editWebsite(
    env,
    instruction,
    currentWebsite
) {

    const systemPrompt = `
You are WebCraft AI, an expert website editor.

The user already has a complete HTML website.

Your job is to modify the existing website according to the
user's instruction.

IMPORTANT RULES:

1. Return ONLY the complete updated HTML.
2. Start with <!DOCTYPE html>.
3. Preserve everything that the user did not ask to change.
4. Do not remove existing sections unnecessarily.
5. Keep existing functionality unless the user asks to change it.
6. Keep the website responsive.
7. Keep CSS and JavaScript inside the HTML.
8. Do not use Markdown.
9. Do not use code fences.
10. Do not explain anything.
11. Return the ENTIRE website, not only the changed section.

USER'S REQUEST:
${instruction}

CURRENT WEBSITE:
${currentWebsite}
`;

    const aiResult =
        await env.AI.run(
            AI_MODEL,
            {
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content:
                            "Edit the website according to my request."
                    }
                ],
                temperature: 0.5,
                max_tokens: 16000
            }
        );

    let output = "";

    if (
        aiResult &&
        typeof aiResult.response === "string"
    ) {

        output =
            aiResult.response;

    } else if (
        aiResult &&
        typeof aiResult.text === "string"
    ) {

        output =
            aiResult.text;

    } else {

        output =
            JSON.stringify(aiResult);

    }

    const website =
        cleanWebsiteOutput(output);

    if (
        !website ||
        website.length < 100
    ) {

        throw new Error(
            "AI returned an incomplete edited website."
        );

    }

    return website;

}


/* =====================================================
   MAIN WORKER
===================================================== */

export default {

    async fetch(request, env) {

        /*
        Handle CORS preflight.
        */

        if (
            request.method === "OPTIONS"
        ) {

            return new Response(
                null,
                {
                    status: 204,
                    headers: corsHeaders
                }
            );

        }


        const url =
            new URL(request.url);


        /* =================================================
           API
        ================================================= */

        if (
            url.pathname === "/api/generate"
        ) {

            if (
                request.method !== "POST"
            ) {

                return errorResponse(
                    "Only POST requests are allowed.",
                    405
                );

            }


            try {

                /*
                Check AI binding.
                */

                if (!env.AI) {

                    return errorResponse(
                        "Workers AI binding is missing. Check your wrangler.jsonc file.",
                        500
                    );

                }


                const body =
                    await request.json();


                const mode =
                    body.mode || "create";


                const prompt =
                    typeof body.prompt === "string"
                        ? body.prompt.trim()
                        : "";


                if (!prompt) {

                    return errorResponse(
                        "Please provide a website prompt.",
                        400
                    );

                }


                /* =========================================
                   CREATE
                ========================================= */

                if (
                    mode === "create"
                ) {

                    const website =
                        await generateWebsite(
                            env,
                            prompt
                        );


                    return jsonResponse(
                        {
                            success: true,
                            website: website
                        }
                    );

                }


                /* =========================================
                   EDIT
                ========================================= */

                if (
                    mode === "edit"
                ) {

                    const currentWebsite =
                        typeof body.website === "string"
                            ? body.website.trim()
                            : "";


                    if (!currentWebsite) {

                        return errorResponse(
                            "No existing website was supplied for editing.",
                            400
                        );

                    }


                    const website =
                        await editWebsite(
                            env,
                            prompt,
                            currentWebsite
                        );


                    return jsonResponse(
                        {
                            success: true,
                            website: website
                        }
                    );

                }


                return errorResponse(
                    "Invalid mode. Use create or edit.",
                    400
                );


            } catch (error) {

                console.error(
                    "WebCraft AI error:",
                    error
                );


                return errorResponse(
                    error &&
                    error.message
                        ? error.message
                        : "AI generation failed.",
                    500
                );

            }

        }


        /* =================================================
           STATIC WEBSITE
        ================================================= */

        /*
        Everything that isn't /api/generate should be
        handled by Cloudflare Assets.
        */

        if (env.ASSETS) {

            return env.ASSETS.fetch(
                request
            );

        }


        /*
        This message makes the configuration problem
        obvious instead of giving a mysterious 500 error.
        */

        return new Response(
            `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>WebCraft AI</title>
                <style>
                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #0b0b10;
                        color: white;
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 20px;
                    }

                    .box {
                        max-width: 600px;
                        padding: 30px;
                        background: #15151d;
                        border: 1px solid #292933;
                        border-radius: 18px;
                    }

                    h1 {
                        color: #9b5cff;
                    }

                    p {
                        color: #aaa;
                        line-height: 1.6;
                    }
                </style>
            </head>

            <body>

                <div class="box">

                    <h1>✨ WebCraft AI</h1>

                    <p>
                        The Worker is running correctly.
                    </p>

                    <p>
                        However, your ASSETS binding is not
                        configured yet.
                    </p>

                    <p>
                        Check your wrangler.jsonc file and
                        make sure the assets directory and
                        ASSETS binding are configured.
                    </p>

                </div>

            </body>
            </html>
            `,
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/html; charset=UTF-8"
                }
            }
        );

    }

};
