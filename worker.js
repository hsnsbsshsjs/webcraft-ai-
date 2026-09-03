/*
===========================================================
 WEBCRAFT AI - CLOUDFLARE WORKER
===========================================================

 FEATURES
 - AI website generation
 - AI website editing
 - Automatic hero image generation
 - User image upload support
 - CORS support
 - Static website serving through ASSETS
 - Safe JSON responses
 - Current Cloudflare Workers AI models

===========================================================
*/


/* =========================================================
   MODELS
========================================================= */

const TEXT_MODEL =
    "@cf/meta/llama-3.1-8b-instruct-fast";

const IMAGE_MODEL =
    "@cf/black-forest-labs/flux-1-schnell";


/* =========================================================
   CORS
========================================================= */

function corsHeaders() {

    return {

        "Access-Control-Allow-Origin": "*",

        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers":
            "Content-Type, Accept",

        "Access-Control-Max-Age":
            "86400"

    };

}


/* =========================================================
   JSON RESPONSE
========================================================= */

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
                    "application/json; charset=utf-8",

                ...corsHeaders()

            }
        }
    );

}


/* =========================================================
   HTML RESPONSE
========================================================= */

function htmlResponse(
    html,
    status = 200
) {

    return new Response(
        html,
        {
            status: status,

            headers: {

                "Content-Type":
                    "text/html; charset=utf-8",

                ...corsHeaders()

            }
        }
    );

}


/* =========================================================
   CLEAN AI HTML RESPONSE
========================================================= */

function cleanHTML(text) {

    if (!text) {
        return "";
    }


    let html = String(text).trim();


    /*
     * Remove markdown code fences.
     */

    html = html.replace(
        /^```html\s*/i,
        ""
    );

    html = html.replace(
        /^```\s*/i,
        ""
    );

    html = html.replace(
        /\s*```$/i,
        ""
    );


    /*
     * Sometimes the model adds explanation before
     * the actual HTML. Try to start at <!DOCTYPE
     * or <html>.
     */

    const doctypeIndex =
        html.toLowerCase().indexOf(
            "<!doctype"
        );

    const htmlIndex =
        html.toLowerCase().indexOf(
            "<html"
        );


    if (doctypeIndex >= 0) {

        html =
            html.substring(
                doctypeIndex
            );

    } else if (htmlIndex >= 0) {

        html =
            html.substring(
                htmlIndex
            );

    }


    return html.trim();

}


/* =========================================================
   EXTRACT AI TEXT
========================================================= */

function extractText(result) {

    if (!result) {
        return "";
    }


    if (
        typeof result === "string"
    ) {

        return result;

    }


    if (
        typeof result.response === "string"
    ) {

        return result.response;

    }


    if (
        typeof result.output_text === "string"
    ) {

        return result.output_text;

    }


    if (
        typeof result.text === "string"
    ) {

        return result.text;

    }


    /*
     * Some responses may contain choices.
     */

    if (
        Array.isArray(result.choices) &&
        result.choices.length > 0
    ) {

        const choice =
            result.choices[0];


        if (
            choice.message &&
            typeof choice.message.content === "string"
        ) {

            return choice.message.content;

        }


        if (
            typeof choice.text === "string"
        ) {

            return choice.text;

        }

    }


    return "";

}


/* =========================================================
   GENERATE IMAGE
========================================================= */

async function generateImage(
    env,
    imagePrompt
) {

    if (
        !env ||
        !env.AI
    ) {

        throw new Error(
            "Workers AI binding is not configured."
        );

    }


    const result =
        await env.AI.run(
            IMAGE_MODEL,
            {
                prompt:
                    imagePrompt,

                steps:
                    4,

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

        throw new Error(
            "The AI image model did not return an image."
        );

    }


    return (
        "data:image/jpeg;base64," +
        result.image
    );

}


/* =========================================================
   CREATE WEBSITE
========================================================= */

async function createWebsite(
    env,
    prompt
) {

    if (
        !env ||
        !env.AI
    ) {

        throw new Error(
            "Workers AI binding is missing."
        );

    }


    /*
     * First create a description of the image.
     */

    let imageDataURI = "";


    try {

        const imagePrompt =
            await env.AI.run(
                TEXT_MODEL,
                {

                    messages: [

                        {
                            role:
                                "system",

                            content:
                                `
You create short image-generation prompts.

Return ONLY one concise image prompt.

The image should be suitable as the main hero image
for a professional business website.

Do not include text, logos, phone numbers,
website addresses or watermarks.
                                `
                        },

                        {
                            role:
                                "user",

                            content:
                                prompt
                        }

                    ],

                    max_tokens:
                        150,

                    temperature:
                        0.7

                }
            );


        const generatedImagePrompt =
            extractText(
                imagePrompt
            ).trim();


        if (
            generatedImagePrompt
        ) {

            try {

                imageDataURI =
                    await generateImage(
                        env,
                        generatedImagePrompt
                    );

            } catch (imageError) {

                console.error(
                    "IMAGE GENERATION ERROR:",
                    imageError
                );

                /*
                 * Website creation continues even if
                 * image generation fails.
                 */

                imageDataURI = "";

            }

        }

    } catch (imagePromptError) {

        console.error(
            "IMAGE PROMPT ERROR:",
            imagePromptError
        );

    }


    /* =====================================================
       WEBSITE GENERATION PROMPT
    ===================================================== */

    const systemPrompt = `

You are WebCraft AI,
a professional website designer and frontend developer.

Create a COMPLETE, BEAUTIFUL and PROFESSIONAL
responsive website based on the user's request.

IMPORTANT RULES:

1. Return ONLY complete HTML.

2. Start with <!DOCTYPE html>.

3. Include:
   - <!DOCTYPE html>
   - <html>
   - <head>
   - <meta charset="UTF-8">
   - viewport meta tag
   - <title>
   - complete CSS
   - <body>

4. Do NOT use Markdown.

5. Do NOT use code fences.

6. Do NOT explain anything outside the HTML.

7. The website must work as a standalone HTML file.

8. Use modern responsive CSS.

9. Make the website look professional.

10. Use attractive typography.

11. Include mobile responsive design.

12. Include a professional navigation bar.

13. Include a strong hero section.

14. Include appropriate sections based on
    the user's request.

15. Include realistic placeholder business content
    where the user did not provide exact information.

16. Do not invent sensitive information.

17. Do not use external JavaScript libraries.

18. Do not depend on Bootstrap.

19. Do not depend on React.

20. Do not depend on external CSS frameworks.

21. You may use Google Fonts through CSS if useful.

22. Use Font Awesome only through a CDN if needed.

23. Make buttons functional where possible.

24. Include a professional footer.

25. If an image is supplied below,
    use it as the main hero image.

IMAGE:

${imageDataURI
    ? imageDataURI
    : "No generated image is available. Use a beautiful CSS gradient or a remote royalty-free image URL."}

IMPORTANT:

If the image above is supplied,
use this EXACT image URL as the hero image:

${imageDataURI || "NONE"}

Do not modify the image URL.

USER REQUEST:

${prompt}

`;


    const result =
        await env.AI.run(
            TEXT_MODEL,
            {

                messages: [

                    {
                        role:
                            "system",

                        content:
                            systemPrompt
                    },

                    {
                        role:
                            "user",

                        content:
                            prompt
                    }

                ],

                max_tokens:
                    12000,

                temperature:
                    0.6

            }
        );


    const html =
        cleanHTML(
            extractText(result)
        );


    if (
        !html ||
        html.length < 200
    ) {

        throw new Error(
            "AI returned an incomplete website."
        );

    }


    return html;

}


/* =========================================================
   EDIT WEBSITE
========================================================= */

async function editWebsite(
    env,
    instruction,
    website,
    uploadedImage
) {

    if (
        !env ||
        !env.AI
    ) {

        throw new Error(
            "Workers AI binding is missing."
        );

    }


    let workingWebsite =
        String(
            website || ""
        ).trim();


    if (
        !workingWebsite
    ) {

        throw new Error(
            "No website was supplied for editing."
        );

    }


    /*
     * Limit extremely large uploaded images.
     */

    if (
        uploadedImage &&
        uploadedImage.length > 7_000_000
    ) {

        throw new Error(
            "Uploaded image is too large. Please use an image under 5MB."
        );

    }


    /*
     * If the user uploaded an image,
     * put it into the existing website.
     *
     * We don't send the huge base64 image through
     * the text model because that wastes context.
     */

    if (
        uploadedImage &&
        uploadedImage.startsWith(
            "data:image/"
        )
    ) {

        const safeImage =
            uploadedImage
                .replace(/"/g, "&quot;");


        /*
         * Try to replace the first existing image.
         */

        const imageRegex =
            /<img\b[^>]*src\s*=\s*["'][^"']*["'][^>]*>/i;


        if (
            imageRegex.test(
                workingWebsite
            )
        ) {

            workingWebsite =
                workingWebsite.replace(
                    imageRegex,
                    `<img src="${safeImage}" alt="Website image" style="max-width:100%;height:auto;">`
                );

        } else {

            /*
             * No image exists.
             * Insert the uploaded image at the beginning
             * of the body.
             */

            workingWebsite =
                workingWebsite.replace(
                    /<body([^>]*)>/i,
                    `<body$1>
<img src="${safeImage}"
     alt="Website image"
     style="display:block;width:100%;max-width:100%;height:auto;object-fit:cover;">`
                );

        }

    }


    /* =====================================================
       EDIT PROMPT
    ===================================================== */

    const systemPrompt = `

You are WebCraft AI,
an expert website editor and frontend developer.

You will receive an existing HTML website
and an instruction.

Your job is to modify the website according
to the instruction.

IMPORTANT RULES:

1. Return ONLY the complete HTML website.

2. Start with <!DOCTYPE html>.

3. Do not use Markdown.

4. Do not use code fences.

5. Do not explain your changes.

6. Preserve existing useful content unless
   the user specifically asks to remove it.

7. Preserve the overall functionality.

8. Keep the website responsive.

9. Keep CSS inside the HTML unless necessary.

10. Do not use React.

11. Do not use Bootstrap.

12. Do not break existing buttons.

13. Do not remove sections unnecessarily.

14. If the user asks for an image change,
    use the supplied uploaded image.

15. Make the requested changes professionally.

16. Return a complete standalone HTML document.

USER'S EDITING INSTRUCTION:

${instruction}

EXISTING WEBSITE:

${workingWebsite}

`;


    const result =
        await env.AI.run(
            TEXT_MODEL,
            {

                messages: [

                    {
                        role:
                            "system",

                        content:
                            systemPrompt
                    },

                    {
                        role:
                            "user",

                        content:
                            instruction
                    }

                ],

                max_tokens:
                    12000,

                temperature:
                    0.5

            }
        );


    let html =
        cleanHTML(
            extractText(result)
        );


    if (
        !html ||
        html.length < 200
    ) {

        throw new Error(
            "AI returned an incomplete edited website."
        );

    }


    /*
     * If an uploaded image was supplied,
     * make sure the image survives the AI edit.
     */

    if (
        uploadedImage &&
        uploadedImage.startsWith(
            "data:image/"
        )
    ) {

        const safeImage =
            uploadedImage
                .replace(/"/g, "&quot;");


        const imageRegex =
            /<img\b[^>]*src\s*=\s*["'][^"']*["'][^>]*>/i;


        if (
            imageRegex.test(html)
        ) {

            html =
                html.replace(
                    imageRegex,
                    `<img src="${safeImage}" alt="Website image" style="max-width:100%;height:auto;object-fit:cover;">`
                );

        } else {

            html =
                html.replace(
                    /<body([^>]*)>/i,
                    `<body$1>
<img src="${safeImage}"
     alt="Website image"
     style="display:block;width:100%;max-width:100%;height:auto;object-fit:cover;">`
                );

        }

    }


    return html;

}


/* =========================================================
   API HANDLER
========================================================= */

async function handleAPI(
    request,
    env
) {

    const url =
        new URL(
            request.url
        );


    /*
     * OPTIONS
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
     * Health check
     */

    if (
        url.pathname ===
        "/api/health"
    ) {

        return jsonResponse({

            success:
                true,

            service:
                "WebCraft AI",

            status:
                "online",

            textModel:
                TEXT_MODEL,

            imageModel:
                IMAGE_MODEL

        });

    }


    /*
     * Image-only endpoint
     */

    if (
        url.pathname ===
        "/api/image"
    ) {

        if (
            request.method !==
            "POST"
        ) {

            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        "POST required."
                },
                405
            );

        }


        try {

            const body =
                await request.json();


            const prompt =
                String(
                    body.prompt || ""
                ).trim();


            if (!prompt) {

                return jsonResponse(
                    {
                        success:
                            false,

                        error:
                            "Image prompt is required."
                    },
                    400
                );

            }


            const image =
                await generateImage(
                    env,
                    prompt
                );


            return jsonResponse({

                success:
                    true,

                image:
                    image

            });

        } catch (error) {

            console.error(
                "IMAGE API ERROR:",
                error
            );


            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        error.message ||
                        "Image generation failed."
                },
                500
            );

        }

    }


    /*
     * Website generation endpoint
     */

    if (
        url.pathname !==
        "/api/generate"
    ) {

        return null;

    }


    if (
        request.method !==
        "POST"
    ) {

        return jsonResponse(
            {
                success:
                    false,

                error:
                    "POST required."
            },
            405
        );

    }


    try {

        const body =
            await request.json();


        const mode =
            String(
                body.mode || "create"
            ).toLowerCase();


        const prompt =
            String(
                body.prompt || ""
            ).trim();


        if (!prompt) {

            return jsonResponse(
                {
                    success:
                        false,

                    error:
                        "Please provide a prompt."
                },
                400
            );

        }


        /* =================================================
           CREATE
        ================================================= */

        if (
            mode ===
            "create"
        ) {

            const website =
                await createWebsite(
                    env,
                    prompt
                );


            return jsonResponse({

                success:
                    true,

                website:
                    website

            });

        }


        /* =================================================
           EDIT
        ================================================= */

        if (
            mode ===
            "edit"
            "edit"
  ) {
    const instruction = String(body.prompt || "").trim();
    const originalWebsite = String(body.website || "").trim();
    const uploadedImage = body.image || null;

    if (!instruction) {
      return jsonResponse(
        {
          success: false,
          error: "Please provide an edit instruction."
        },
        400
      );
    }

    if (!originalWebsite) {
      return jsonResponse(
        {
          success: false,
          error: "No website was provided for editing."
        },
        400
      );
    }

    try {
      const website = await editWebsite(
        env,
        instruction,
        originalWebsite,
        uploadedImage
      );

      return jsonResponse({
        success: true,
        website
      });
    } catch (error) {
      return jsonResponse(
        {
          success: false,
          error: error.message || "Failed to edit website."
        },
        500
      );
    }
  }

  return jsonResponse(
    {
      success: false,
      error: "Invalid mode. Use create or edit."
    },
    400
  );
}


/* ============================================================
   MAIN WORKER
   ============================================================ */

export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    /*
     * API routes
     */
    if (url.pathname.startsWith("/api/")) {
      return handleAPI(request, env);
    }

    /*
     * CORS preflight
     */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    /*
     * Serve the WebCraft AI website
     */
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    /*
     * Helpful error if Assets binding is missing
     */
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WebCraft AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #111827;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
          }

          .box {
            max-width: 600px;
            padding: 30px;
          }

          h1 {
            margin-bottom: 10px;
          }

          p {
            color: #cbd5e1;
            line-height: 1.6;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <h1>WebCraft AI</h1>
          <p>
            The Worker is running, but the ASSETS binding is not configured.
          </p>
          <p>
            Check your wrangler.jsonc file and make sure the public folder
            is configured as the Assets directory.
          </p>
        </div>
      </body>
      </html>
      `,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=UTF-8"
        }
      }
    );
  }
};
