/*
========================================================
 WEBCRAFT AI - CLOUDFLARE WORKER
========================================================

 FEATURES:
 - Serves index.html and other static files
 - /api/generate
 - AI website generation
 - Automatic AI image generation
 - /api/image/:id
 - CORS
 - Safe error handling
 - Works with AI binding named "AI"
 - Works with KV binding named "WEBCRAFT_SITES" OR "SITES"

========================================================
*/

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";


/*
========================================================
 MAIN WORKER
========================================================
*/

export default {

    async fetch(request, env, ctx) {

        try {

            const url = new URL(request.url);


            /*
            --------------------------------------------
            CORS
            --------------------------------------------
            */

            if (request.method === "OPTIONS") {

                return new Response(null, {
                    status: 204,
                    headers: corsHeaders()
                });

            }


            /*
            --------------------------------------------
            API: GENERATE WEBSITE
            --------------------------------------------
            */

            if (
                url.pathname === "/api/generate" &&
                request.method === "POST"
            ) {

                return await generateWebsite(request, env);

            }


            /*
            --------------------------------------------
            API: GET GENERATED IMAGE
            --------------------------------------------
            */

            if (
                url.pathname.startsWith("/api/image/")
            ) {

                return await getImage(request, env);

            }


            /*
            --------------------------------------------
            API STATUS
            --------------------------------------------
            */

            if (
                url.pathname === "/api/status"
            ) {

                return jsonResponse({

                    success: true,

                    message: "WebCraft AI Worker is running.",

                    ai: !!env.AI,

                    storage: !!getKV(env)

                });

            }


            /*
            --------------------------------------------
            SERVE WEBSITE FILES
            --------------------------------------------

            VERY IMPORTANT:
            Everything that is not an API request is
            passed to Cloudflare Static Assets.
            */

            if (env.ASSETS) {

                return env.ASSETS.fetch(request);

            }


            /*
            --------------------------------------------
            FALLBACK
            --------------------------------------------
            */

            return new Response(
                "WebCraft AI is running, but the ASSETS binding is missing.",
                {
                    status: 500,
                    headers: {
                        "Content-Type": "text/plain"
                    }
                }
            );

        }

        catch (error) {

            console.error(
                "WEBCRAFT WORKER ERROR:",
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
 CORS HEADERS
========================================================
*/

function corsHeaders() {

    return {

        "Access-Control-Allow-Origin": "*",

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

function jsonResponse(data, status = 200) {

    return new Response(

        JSON.stringify(data),

        {

            status,

            headers: {

                "Content-Type":
                    "application/json; charset=UTF-8",

                ...corsHeaders()

            }

        }

    );

}


/*
========================================================
 GET KV STORAGE
========================================================

 Supports either:

 WEBCRAFT_SITES

 OR

 SITES
========================================================
*/

function getKV(env) {

    return (
        env.WEBCRAFT_SITES ||
        env.SITES ||
        null
    );

}


/*
========================================================
 GENERATE WEBSITE
========================================================
*/

async function generateWebsite(request, env) {

    /*
    --------------------------------------------
    Read request
    --------------------------------------------
    */

    let body;

    try {

        body = await request.json();

    }

    catch {

        return jsonResponse({

            success: false,

            error: "Invalid JSON request."

        }, 400);

    }


    const prompt =
        typeof body?.prompt === "string"
            ? body.prompt.trim()
            : "";


    if (!prompt) {

        return jsonResponse({

            success: false,

            error: "Please provide a website prompt."

        }, 400);

    }


    if (prompt.length > 10000) {

        return jsonResponse({

            success: false,

            error: "Your prompt is too long."

        }, 400);

    }


    /*
    --------------------------------------------
    Make sure AI binding exists
    --------------------------------------------
    */

    if (!env.AI) {

        return jsonResponse({

            success: false,

            error:
                "Cloudflare Workers AI binding 'AI' is missing."

        }, 500);

    }


    /*
    --------------------------------------------
    Website generation instructions
    --------------------------------------------
    */

    const systemPrompt = `

You are WebCraft AI, a professional website designer
and developer.

Create a COMPLETE modern responsive website based on
the user's request.

IMPORTANT RULES:

1. Return ONLY the complete HTML document.

2. Start with:
<!DOCTYPE html>

3. End with:
</html>

4. Include all CSS inside <style>.

5. Include JavaScript inside <script> when useful.

6. Do not use Markdown.

7. Do not use code fences.

8. Do not explain anything outside the HTML.

9. Make the website beautiful and professional.

10. Make it mobile responsive.

11. Use semantic HTML.

12. Include realistic content based on the user's request.

13. Use attractive sections such as:
    - Hero
    - About
    - Services
    - Products/menu when appropriate
    - Gallery
    - Testimonials
    - Contact
    - Location
    - Opening hours
    - Footer

14. IMPORTANT IMAGE SYSTEM:

For important visual sections, create image placeholders
using this exact format:

<img
data-ai-image="DESCRIPTION OF THE IMAGE"
alt="DESCRIPTION"
class="ai-generated-image"
>

For example:

<img
data-ai-image="Professional modern Kampala cleaning team cleaning a luxury office"
alt="Professional cleaning team"
class="ai-generated-image"
>

Do NOT use external image URLs.

Do NOT use Unsplash.

Do NOT use placeholder.com.

Use between 1 and 4 AI image placeholders where
appropriate.

The data-ai-image description must be detailed enough
for an AI image generator to understand what to create.

15. Do not put sensitive personal information into
the website.

USER REQUEST:

${prompt}

`;


    /*
    --------------------------------------------
    Ask Workers AI for website
    --------------------------------------------
    */

    let aiResult;

    try {

        aiResult = await env.AI.run(
            TEXT_MODEL,
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
                (error?.message || "Unknown AI error.")

        }, 500);

    }


    /*
    --------------------------------------------
    Extract generated HTML
    --------------------------------------------
    */

    let website =
        aiResult?.response ||
        aiResult?.result?.response ||
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
    --------------------------------------------
    Clean Markdown code fences if AI added them
    --------------------------------------------
    */

    website = cleanHTML(website);


    /*
    --------------------------------------------
    Generate automatic AI images
    --------------------------------------------
    */

    try {

        website =
            await processAIImages(
                website,
                env
            );

    }

    catch (error) {

        /*
        Do NOT destroy the whole website if image
        generation fails.

        The website can still be returned.
        */

        console.error(
            "IMAGE GENERATION ERROR:",
            error
        );

    }


    /*
    --------------------------------------------
    Return generated website
    --------------------------------------------
    */

    return jsonResponse({

        success: true,

        website: website,

        prompt: prompt

    });

}


/*
========================================================
 CLEAN GENERATED HTML
========================================================
*/

function cleanHTML(html) {

    let result = html.trim();


    /*
    Remove ```html
    */

    result = result.replace(
        /^```html\s*/i,
        ""
    );


    /*
    Remove ```
    */

    result = result.replace(
        /\s*```$/i,
        ""
    );


    /*
    If AI put text before <!DOCTYPE html>,
    remove it.
    */

    const doctypeIndex =
        result.toLowerCase().indexOf(
            "<!doctype html>"
        );


    if (doctypeIndex > 0) {

        result =
            result.substring(
                doctypeIndex
            );

    }


    return result.trim();

}


/*
========================================================
 PROCESS AI IMAGES
========================================================
*/

async function processAIImages(
    html,
    env
) {

    /*
    Find:

    data-ai-image="..."

    */

    const regex =
        /data-ai-image=["']([^"']+)["']/gi;


    const matches = [];

    let match;


    while (
        (match = regex.exec(html)) !== null
    ) {

        const description =
            match[1].trim();


        if (
            description &&
            !matches.includes(description)
        ) {

            matches.push(description);

        }


        /*
        Maximum 4 images per website.
        */

        if (matches.length >= 4) {

            break;

        }

    }


    /*
    No images requested.
    */

    if (!matches.length) {

        return html;

    }


    /*
    If image AI is unavailable,
    leave placeholders alone.
    */

    if (!env.AI) {

        return html;

    }


    /*
    KV is needed to store generated images.
    */

    const kv = getKV(env);


    /*
    If KV isn't available, we can still generate
    images as data URIs, but that can make the HTML
    extremely large.

    Therefore, for safety, don't embed huge images.
    */

    if (!kv) {

        console.warn(
            "No KV binding available for AI images."
        );

        return html;

    }


    let updatedHTML = html;


    /*
    --------------------------------------------
    Generate images one by one
    --------------------------------------------
    */

    for (
        let i = 0;
        i < matches.length;
        i++
    ) {

        const description =
            matches[i];


        try {

            console.log(
                "Generating AI image:",
                description
            );


            const imageResult =
                await env.AI.run(
                    IMAGE_MODEL,
                    {
                        prompt:
                            description,

                        steps: 4,

                        seed:
                            Math.floor(
                                Math.random() *
                                2147483647
                            )

                    }
                );


            if (
                !imageResult ||
                !imageResult.image
            ) {

                console.warn(
                    "No image returned for:",
                    description
                );

                continue;

            }


            /*
            ------------------------------------
            Create unique image ID
            ------------------------------------
            */

            const imageId =
                createID();


            /*
            ------------------------------------
            Save image in KV
            ------------------------------------
            */

            await kv.put(

                "image:" + imageId,

                imageResult.image,

                {

                    expirationTtl:
                        60 * 60 * 24 * 30

                }

            );


            /*
            ------------------------------------
            Replace image placeholder with
            WebCraft image endpoint.
            ------------------------------------
            */

            const escapedDescription =
                escapeRegExp(
                    description
                );


            const imageRegex =
                new RegExp(
                    `data-ai-image=["']${escapedDescription}["']`,
                    "i"
                );


            updatedHTML =
                updatedHTML.replace(

                    imageRegex,

                    `src="/api/image/${imageId}" data-ai-image="${escapeAttribute(description)}"`

                );


            /*
            If the AI didn't put src before the
            data attribute, we have now inserted it.
            */

        }

        catch (error) {

            console.error(
                "Failed generating image:",
                description,
                error
            );

        }

    }


    return updatedHTML;

}


/*
========================================================
 SERVE AI IMAGE
========================================================
*/

async function getImage(
    request,
    env
) {

    const url =
        new URL(request.url);


    /*
    Get everything after:

    /api/image/
    */

    const imageId =
        decodeURIComponent(
            url.pathname.substring(
                "/api/image/".length
            )
        );


    if (!imageId) {

        return new Response(
            "Image ID missing.",
            {
                status: 400
            }
        );

    }


    const kv =
        getKV(env);


    if (!kv) {

        return new Response(
            "Image storage is not configured.",
            {
                status: 500
            }
        );

    }


    /*
    --------------------------------------------
    Read Base64 image
    --------------------------------------------
    */

    const base64 =
        await kv.get(
            "image:" + imageId
        );


    if (!base64) {

        return new Response(
            "Image not found or expired.",
            {
                status: 404
            }
        );

    }


    /*
    --------------------------------------------
    Convert Base64 to binary
    --------------------------------------------
    */

    try {

        const binaryString =
            atob(base64);


        const bytes =
            new Uint8Array(
                binaryString.length
            );


        for (
            let i = 0;
            i < binaryString.length;
            i++
        ) {

            bytes[i] =
                binaryString.charCodeAt(i);

        }


        return new Response(
            bytes,
            {

                status: 200,

                headers: {

                    "Content-Type":
                        "image/jpeg",

                    "Cache-Control":
                        "public, max-age=2592000",

                    ...corsHeaders()

                }

            }
        );

    }

    catch (error) {

        console.error(
            "IMAGE DECODE ERROR:",
            error
        );


        return new Response(
            "Could not decode image.",
            {
                status: 500
            }
        );

    }

}


/*
========================================================
 CREATE RANDOM ID
========================================================
*/

function createID() {

    return (

        Date.now().toString(36) +

        "-" +

        Math.random()
            .toString(36)
            .substring(2, 12)

    );

}


/*
========================================================
 ESCAPE REGULAR EXPRESSION
========================================================
*/

function escapeRegExp(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


/*
========================================================
 ESCAPE HTML ATTRIBUTE
========================================================
*/

function escapeAttribute(text) {

    return text

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        );

         }
