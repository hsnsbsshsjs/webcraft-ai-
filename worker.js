/*
========================================================
 WEBCRAFT AI WORKER
========================================================
*/

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

const IMAGE_MODEL =
    "@cf/black-forest-labs/flux-1-schnell";


export default {

    async fetch(request, env) {

        try {

            const url =
                new URL(request.url);


            /*
            ====================================================
            CORS
            ====================================================
            */

            if (request.method === "OPTIONS") {

                return new Response(null, {
                    status: 204,
                    headers: corsHeaders()
                });

            }


            /*
            ====================================================
            GENERATE WEBSITE
            ====================================================
            */

            if (
                url.pathname === "/api/generate" &&
                request.method === "POST"
            ) {

                return await generateWebsite(
                    request,
                    env
                );

            }


            /*
            ====================================================
            GENERATE IMAGE
            ====================================================
            */

            if (
                url.pathname === "/api/image" &&
                request.method === "POST"
            ) {

                return await generateImage(
                    request,
                    env
                );

            }


            /*
            ====================================================
            WORKER STATUS
            ====================================================
            */

            if (
                url.pathname === "/api/status"
            ) {

                return jsonResponse({

                    success: true,

                    message:
                        "WebCraft AI Worker is running.",

                    ai:
                        !!env.AI

                });

            }


            /*
            ====================================================
            SERVE WEBSITE
            ====================================================
            */

            if (env.ASSETS) {

                return env.ASSETS.fetch(request);

            }


            return new Response(
                "WebCraft AI is running, but ASSETS is not configured.",
                {
                    status: 500,
                    headers: {
                        "Content-Type":
                            "text/plain"
                    }
                }
            );

        }

        catch (error) {

            console.error(
                "WEBCRAFT ERROR:",
                error
            );

            return jsonResponse({

                success: false,

                error:
                    error?.message ||
                    "Internal Worker error."

            }, 500);

        }

    }

};


/*
========================================================
 CORS
========================================================
*/

function corsHeaders() {

    return {

        "Access-Control-Allow-Origin":
            "*",

        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers":
            "Content-Type, Accept"

    };

}


/*
========================================================
 JSON RESPONSE
========================================================
*/

function jsonResponse(
    data,
    status = 200
) {

    return new Response(

        JSON.stringify(data),

        {

            status: status,

            headers: {

                "Content-Type":
                    "application/json",

                ...corsHeaders()

            }

        }

    );

}


/*
========================================================
 GENERATE WEBSITE
========================================================
*/

async function generateWebsite(
    request,
    env
) {

    /*
    ----------------------------------------------------
    CHECK AI
    ----------------------------------------------------
    */

    if (!env.AI) {

        return jsonResponse({

            success: false,

            error:
                "AI binding is missing. Make sure your Wrangler AI binding is named AI."

        }, 500);

    }


    /*
    ----------------------------------------------------
    READ REQUEST
    ----------------------------------------------------
    */

    let body;

    try {

        body =
            await request.json();

    }

    catch {

        return jsonResponse({

            success: false,

            error:
                "Invalid JSON request."

        }, 400);

    }


    const prompt =
        typeof body?.prompt === "string"
            ? body.prompt.trim()
            : "";


    if (!prompt) {

        return jsonResponse({

            success: false,

            error:
                "Please describe the website you want."

        }, 400);

    }


    /*
    ----------------------------------------------------
    AI INSTRUCTIONS
    ----------------------------------------------------
    */

    const systemPrompt = `

You are WebCraft AI.

You are an expert professional website designer
and frontend developer.

Create a complete beautiful responsive website
from the user's request.

IMPORTANT:

Return ONLY HTML.

Start with:

<!DOCTYPE html>

End with:

</html>

Do not use Markdown.

Do not use code fences.

Put all CSS inside <style>.

Put JavaScript inside <script>.

Make the website responsive on phones,
tablets and computers.

Create professional layouts.

Use attractive typography.

Use good spacing.

Use modern buttons.

Use professional sections.

Depending on the business, include appropriate
sections such as:

- Navigation
- Hero
- About
- Services
- Products
- Menu
- Pricing
- Gallery
- Testimonials
- Team
- Contact
- Location
- Opening hours
- Footer

IMAGE RULE:

When the website needs an image, DO NOT use
external image websites.

Instead create an image placeholder like this:

<img
    data-ai-image="Professional modern coffee shop interior with warm lighting and wooden furniture"
    alt="Coffee shop interior"
    class="ai-generated-image"
>

You can create up to 3 image placeholders.

Make every image description detailed.

Example:

<img
    data-ai-image="Professional Kampala cleaning team wearing modern uniforms cleaning a luxury office interior"
    alt="Professional cleaning team"
    class="ai-generated-image"
>

IMPORTANT:

The generated website must still work if images
are unavailable.

USER REQUEST:

${prompt}

`;


    /*
    ----------------------------------------------------
    CALL CLOUDFLARE AI
    ----------------------------------------------------
    */

    let result;

    try {

        result =
            await env.AI.run(
                TEXT_MODEL,
                {

                    messages: [

                        {
                            role: "system",
                            content:
                                systemPrompt
                        },

                        {
                            role: "user",
                            content:
                                prompt
                        }

                    ],

                    max_tokens: 12000,

                    temperature: 0.7

                }
            );

    }

    catch (error) {

        console.error(
            "TEXT AI ERROR:",
            error
        );

        return jsonResponse({

            success: false,

            error:
                "AI website generation failed: " +
                (
                    error?.message ||
                    "Unknown AI error."
                )

        }, 500);

    }


    /*
    ----------------------------------------------------
    GET HTML
    ----------------------------------------------------
    */

    let website =
        result?.response ||
        result?.result?.response ||
        "";


    if (
        typeof website !== "string" ||
        !website.trim()
    ) {

        return jsonResponse({

            success: false,

            error:
                "AI returned an empty website."

        }, 500);

    }


    /*
    ----------------------------------------------------
    CLEAN HTML
    ----------------------------------------------------
    */

    website =
        cleanHTML(website);


    /*
    ----------------------------------------------------
    RETURN WEBSITE
    ----------------------------------------------------
    */

    return jsonResponse({

        success: true,

        website: website,

        prompt: prompt

    });

}


/*
========================================================
 CLEAN HTML
========================================================
*/

function cleanHTML(html) {

    let result =
        html.trim();


    result =
        result.replace(
            /^```html\s*/i,
            ""
        );


    result =
        result.replace(
            /\s*```$/i,
            ""
        );


    const doctype =
        result
            .toLowerCase()
            .indexOf(
                "<!doctype html>"
            );


    if (doctype > 0) {

        result =
            result.substring(
                doctype
            );

    }


    return result.trim();

}


/*
========================================================
 GENERATE IMAGE
========================================================

This endpoint can be called by the generated website.

POST:

/api/image

Body:

{
    "prompt": "coffee shop interior"
}

========================================================
*/

async function generateImage(
    request,
    env
) {

    /*
    ----------------------------------------------------
    CHECK AI
    ----------------------------------------------------
    */

    if (!env.AI) {

        return jsonResponse({

            success: false,

            error:
                "AI binding is missing."

        }, 500);

    }


    /*
    ----------------------------------------------------
    READ REQUEST
    ----------------------------------------------------
    */

    let body;

    try {

        body =
            await request.json();

    }

    catch {

        return jsonResponse({

            success: false,

            error:
                "Invalid JSON."

        }, 400);

    }


    const prompt =
        typeof body?.prompt === "string"
            ? body.prompt.trim()
            : "";


    if (!prompt) {

        return jsonResponse({

            success: false,

            error:
                "Image prompt is required."

        }, 400);

    }


    /*
    ----------------------------------------------------
    LIMIT PROMPT
    ----------------------------------------------------
    */

    const imagePrompt =
        prompt.substring(
            0,
            2048
        );


    /*
    ----------------------------------------------------
    GENERATE IMAGE
    ----------------------------------------------------
    */

    try {

        const result =
            await env.AI.run(
                IMAGE_MODEL,
                {

                    prompt:
                        imagePrompt,

                    steps: 4,

                    seed:
                        Math.floor(
                            Math.random() *
                            999999999
                        )

                }
            );


        if (
            !result ||
            !result.image
        ) {

            return jsonResponse({

                success: false,

                error:
                    "Image AI returned no image."

            }, 500);

        }


        /*
        ------------------------------------------------
        RETURN IMAGE
        ------------------------------------------------
        */

        return jsonResponse({

            success: true,

            image:
                "data:image/jpeg;base64," +
                result.image

        });

    }

    catch (error) {

        console.error(
            "IMAGE AI ERROR:",
            error
        );

        return jsonResponse({

            success: false,

            error:
                "AI image generation failed: " +
                (
                    error?.message ||
                    "Unknown image error."
                )

        }, 500);

    }

 }
