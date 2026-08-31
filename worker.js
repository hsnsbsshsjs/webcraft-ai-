/*
=========================================================
 WEBCRAFT AI
 AI WEBSITE GENERATOR + AI IMAGE GENERATOR
=========================================================
*/


/*
=========================================================
 CORS
=========================================================
*/

function corsHeaders() {

    return {

        "Access-Control-Allow-Origin": "*",

        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers":
            "Content-Type",

        "Access-Control-Max-Age":
            "86400"

    };

}


/*
=========================================================
 JSON RESPONSE
=========================================================
*/

function jsonResponse(data, status = 200) {

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
=========================================================
 GET KV NAMESPACE
=========================================================
*/

function getSitesKV(env) {

    /*
     * Your project has used both names
     * during development, so support either.
     */

    return (
        env.WEBCRAFT_SITES ||
        env.SITES ||
        null
    );

}


/*
=========================================================
 GENERATE UNIQUE IMAGE ID
=========================================================
*/

function createImageId() {

    return (
        "img_" +
        crypto.randomUUID()
    );

}


/*
=========================================================
 AI IMAGE GENERATION
=========================================================
*/

async function generateAIImage(
    env,
    prompt
) {

    if (!env.AI) {

        throw new Error(
            "Workers AI binding is missing. Make sure your wrangler.jsonc has the AI binding."
        );

    }


    const result =
        await env.AI.run(
            "@cf/black-forest-labs/flux-1-schnell",
            {
                prompt: prompt,

                steps: 4,

                seed:
                    Math.floor(
                        Math.random() *
                        2147483647
                    )
            }
        );


    if (
        !result ||
        !result.image
    ) {

        throw new Error(
            "AI image generation returned no image."
        );

    }


    return result.image;

}


/*
=========================================================
 SAVE IMAGE TO KV
=========================================================
*/

async function saveImage(
    env,
    base64Image
) {

    const kv =
        getSitesKV(env);


    if (!kv) {

        throw new Error(
            "KV namespace is missing. Add WEBCRAFT_SITES to your Worker."
        );

    }


    const imageId =
        createImageId();


    await kv.put(
        "image:" + imageId,
        base64Image
    );


    return imageId;

}


/*
=========================================================
 GET IMAGE FROM KV
=========================================================
*/

async function getImage(
    env,
    imageId
) {

    const kv =
        getSitesKV(env);


    if (!kv) {

        return null;

    }


    return await kv.get(
        "image:" + imageId
    );

}


/*
=========================================================
 GENERATE WEBSITE WITH AI
=========================================================
*/

async function generateWebsite(
    env,
    userPrompt
) {

    if (!env.AI) {

        throw new Error(
            "Workers AI binding is not available."
        );

    }


    const systemPrompt = `

You are WebCraft AI, an expert professional
website designer and developer.

Your job is to create a complete modern website
from the user's request.

IMPORTANT RULES:

1. Return ONLY complete HTML.

2. Do NOT use Markdown.

3. Do NOT use code fences.

4. Include HTML, CSS and JavaScript
   in the same HTML document.

5. Make the website fully responsive.

6. Make it look professional and modern.

7. Use semantic HTML.

8. Include:
   - navigation
   - hero section
   - services or main content
   - about section
   - testimonials when appropriate
   - gallery when appropriate
   - contact section
   - footer

9. Use attractive typography,
   spacing, cards, buttons and animations.

10. Make the website usable on mobile phones.

11. Do NOT use external image URLs.

12. IMPORTANT IMAGE SYSTEM:

Use these exact image placeholders
when an image would improve the website:

IMAGE_PLACEHOLDER_1

IMAGE_PLACEHOLDER_2

IMAGE_PLACEHOLDER_3

For example:

<img
src="IMAGE_PLACEHOLDER_1"
alt="Professional business image"
>

Do not change the placeholder names.

13. Use IMAGE_PLACEHOLDER_1 for the
main hero image.

14. Use IMAGE_PLACEHOLDER_2 for an
about/services image.

15. Use IMAGE_PLACEHOLDER_3 for a
gallery or supporting image.

16. Do not create fake image URLs.

17. Do not mention the placeholders
in visible website text.

18. If the user's business information
contains specific details, preserve them.

19. If prices, phone numbers, addresses,
opening hours or names are supplied,
use them accurately.

20. Never invent important business
information if it was provided by the user.

21. The final answer must be ONLY HTML.

`;


    const prompt =
        systemPrompt +
        "\n\nUSER REQUEST:\n" +
        userPrompt;


    /*
     * TEXT GENERATION MODEL
     */

    const result =
        await env.AI.run(
            "@cf/meta/llama-3.1-8b-instruct",
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
                            userPrompt
                    }
                ],

                max_tokens: 12000
            }
        );


    /*
     * Extract generated text
     */

    let website = "";


    if (
        result &&
        typeof result.response ===
            "string"
    ) {

        website =
            result.response;

    }


    /*
     * Some models may return
     * a different structure.
     */

    if (
        !website &&
        result &&
        result.response
    ) {

        website =
            String(
                result.response
            );

    }


    if (!website) {

        throw new Error(
            "The AI did not return website HTML."
        );

    }


    /*
     * Remove accidental Markdown fences
     */

    website =
        website
            .replace(
                /^```html\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();


    return website;

}


/*
=========================================================
 GENERATE ALL WEBSITE IMAGES
=========================================================
*/

async function generateWebsiteImages(
    env,
    userPrompt
) {

    /*
     * Generate three different images.
     */

    const imagePrompts = [

        `
Create a professional website hero photograph
based on this business request:

${userPrompt}

Requirements:
realistic professional photography,
high quality,
clean composition,
modern business appearance,
no text,
no logos,
suitable for a website hero section.
        `,

        `
Create a professional supporting business
photograph based on this request:

${userPrompt}

Requirements:
realistic photography,
professional,
clean environment,
high quality,
no text,
no logos,
suitable for an About or Services section.
        `,

        `
Create a beautiful website gallery photograph
based on this business request:

${userPrompt}

Requirements:
realistic professional photography,
high quality,
visually attractive,
modern,
no text,
no logos,
suitable for a business website gallery.
        `

    ];


    const imageIds = [];


    /*
     * Generate images one by one.
     *
     * This is slower than parallel generation
     * but is more reliable on a small Worker.
     */

    for (
        const imagePrompt
        of imagePrompts
    ) {

        try {

            const base64Image =
                await generateAIImage(
                    env,
                    imagePrompt
                );


            const imageId =
                await saveImage(
                    env,
                    base64Image
                );


            imageIds.push(
                imageId
            );

        }

        catch (error) {

            console.error(
                "Image generation error:",
                error
            );


            /*
             * Continue generating the
             * other images if one fails.
             */

            imageIds.push(null);

        }

    }


    return imageIds;

}


/*
=========================================================
 REPLACE IMAGE PLACEHOLDERS
=========================================================
*/

function insertImageURLs(
    website,
    imageIds,
    origin
) {

    let result =
        website;


    const image1 =
        imageIds[0]
            ? `${origin}/api/image/${imageIds[0]}`
            : "";


    const image2 =
        imageIds[1]
            ? `${origin}/api/image/${imageIds[1]}`
            : "";


    const image3 =
        imageIds[2]
            ? `${origin}/api/image/${imageIds[2]}`
            : "";


    /*
     * Replace all occurrences.
     */

    result =
        result.replaceAll(
            "IMAGE_PLACEHOLDER_1",
            image1
        );


    result =
        result.replaceAll(
            "IMAGE_PLACEHOLDER_2",
            image2
        );


    result =
        result.replaceAll(
            "IMAGE_PLACEHOLDER_3",
            image3
        );


    return result;

}


/*
=========================================================
 IMAGE ENDPOINT
=========================================================
*/

async function handleImageRequest(
    request,
    env,
    imageId
) {

    if (!imageId) {

        return new Response(
            "Image ID missing.",
            {
                status: 400
            }
        );

    }


    const base64Image =
        await getImage(
            env,
            imageId
        );


    if (!base64Image) {

        return new Response(
            "Image not found.",
            {
                status: 404
            }
        );

    }


    /*
     * Convert Base64 to bytes.
     */

    const binaryString =
        atob(base64Image);


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
                    "public, max-age=31536000, immutable",

                "Access-Control-Allow-Origin":
                    "*"

            }
        }
    );

}


/*
=========================================================
 MAIN WORKER
=========================================================
*/

export default {

    async fetch(
        request,
        env,
        ctx
    ) {

        const url =
            new URL(request.url);


        /*
         * Handle CORS preflight
         */

        if (
            request.method ===
            "OPTIONS"
        ) {

            return new Response(
                null,
                {
                    status: 204,

                    headers:
                        corsHeaders()
                }
            );

        }


        /*
         * IMAGE ROUTE
         *
         * /api/image/IMAGE_ID
         */

        if (
            url.pathname.startsWith(
                "/api/image/"
            )
        ) {

            const imageId =
                url.pathname
                    .replace(
                        "/api/image/",
                        ""
                    );


            return handleImageRequest(
                request,
                env,
                imageId
            );

        }


        /*
         * GENERATE WEBSITE ROUTE
         *
         * /api/generate
         */

        if (
            url.pathname ===
            "/api/generate"
        ) {

            if (
                request.method !==
                "POST"
            ) {

                return jsonResponse(
                    {
                        success: false,

                        error:
                            "Only POST requests are allowed."
                    },
                    405
                );

            }


            try {

                /*
                 * Read request
                 */

                let body;


                try {

                    body =
                        await request.json();

                }

                catch (error) {

                    return jsonResponse(
                        {
                            success: false,

                            error:
                                "Invalid JSON request."
                        },
                        400
                    );

                }


                const userPrompt =
                    body &&
                    typeof body.prompt ===
                        "string"
                        ? body.prompt.trim()
                        : "";


                /*
                 * Validate prompt
                 */

                if (!userPrompt) {

                    return jsonResponse(
                        {
                            success: false,

                            error:
                                "Please describe the website you want."
                        },
                        400
                    );

                }


                /*
                 * Prevent extremely large prompts
                 */

                if (
                    userPrompt.length >
                    12000
                ) {

                    return jsonResponse(
                        {
                            success: false,

                            error:
                                "Your prompt is too long. Please shorten it."
                        },
                        400
                    );

                }


                /*
                 * STEP 1
                 *
                 * Generate website HTML
                 */

                console.log(
                    "Generating website..."
                );


                let website =
                    await generateWebsite(
                        env,
                        userPrompt
                    );


                /*
                 * STEP 2
                 *
                 * Generate AI images
                 */

                console.log(
                    "Generating website images..."
                );


                const imageIds =
                    await generateWebsiteImages(
                        env,
                        userPrompt
                    );


                /*
                 * STEP 3
                 *
                 * Insert image URLs
                 */

                website =
                    insertImageURLs(
                        website,
                        imageIds,
                        url.origin
                    );


                /*
                 * STEP 4
                 *
                 * Return everything
                 */

                return jsonResponse(
                    {
                        success: true,

                        website:
                            website,

                        prompt:
                            userPrompt,

                        images:
                            imageIds.filter(
                                Boolean
                            )

                    },
                    200
                );

            }


            catch (error) {

                console.error(
                    "WebCraft AI generation error:",
                    error
                );


                return jsonResponse(
                    {
                        success: false,

                        error:
                            error &&
                            error.message
                                ? error.message
                                : "Website generation failed."
                    },
                    500
                );

            }

        }


        /*
         * HEALTH CHECK
         *
         * Opening /api/status
         * shows whether the Worker
         * is alive.
         */

        if (
            url.pathname ===
            "/api/status"
        ) {

            return jsonResponse(
                {
                    success: true,

                    service:
                        "WebCraft AI",

                    status:
                        "online",

                    imageGeneration:
                        Boolean(
                            env.AI
                        ),

                    imageStorage:
                        Boolean(
                            getSitesKV(env)
                        )
                }
            );

        }


        /*
         * FOR EVERYTHING ELSE
         *
         * Let Cloudflare Assets serve
         * index.html / preview.html /
         * CSS / JS / other files.
         */

        if (
            env.ASSETS &&
            typeof env.ASSETS.fetch ===
                "function"
        ) {

            return env.ASSETS.fetch(
                request
            );

        }


        /*
         * Fallback
         */

        return new Response(
            "WebCraft AI is running. API available at /api/generate",
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "text/plain; charset=utf-8"
                }
            }
        );

    }

};
