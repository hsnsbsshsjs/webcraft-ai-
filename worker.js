/*
========================================================
 WEBCRAFT AI
 AI WEBSITE GENERATOR + EDITOR
========================================================

 API:

 POST /api/generate

 CREATE:
 {
   "mode": "create",
   "prompt": "Create a professional website for..."
 }

 EDIT:
 {
   "mode": "edit",
   "prompt": "Add a pricing section...",
   "website": "<existing HTML>"
 }

 EDIT WITH UPLOADED IMAGE:
 {
   "mode": "edit",
   "prompt": "Use my uploaded image in the hero section",
   "website": "<existing HTML>",
   "image": "data:image/jpeg;base64,..."
 }

 Required Wrangler binding:

 "ai": {
   "binding": "AI"
 }

 Static assets:

 "assets": {
   "directory": "./public/",
   "binding": "ASSETS"
 }
========================================================
*/


/* ======================================================
   CONFIGURATION
====================================================== */

const MODEL =
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MAX_IMAGE_LENGTH =
    8 * 1024 * 1024;

const MAX_WEBSITE_LENGTH =
    500000;


/* ======================================================
   CORS
====================================================== */

const CORS_HEADERS = {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
        "Content-Type, Authorization",

    "Access-Control-Max-Age":
        "86400"

};


/* ======================================================
   JSON RESPONSE
====================================================== */

function jsonResponse(data, status = 200) {

    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json; charset=utf-8",

                ...CORS_HEADERS
            }
        }
    );

}


/* ======================================================
   HTML RESPONSE
====================================================== */

function htmlResponse(html, status = 200) {

    return new Response(
        html,
        {
            status,

            headers: {
                "Content-Type":
                    "text/html; charset=utf-8",

                ...CORS_HEADERS
            }
        }
    );

}


/* ======================================================
   CLEAN AI OUTPUT
====================================================== */

function cleanAIOutput(text) {

    if (!text) {
        return "";
    }

    let result =
        String(text).trim();


    /* Remove opening Markdown fence */

    result =
        result.replace(
            /^```html\s*/i,
            ""
        );


    result =
        result.replace(
            /^```\s*/i,
            ""
        );


    /* Remove closing Markdown fence */

    result =
        result.replace(
            /\s*```$/i,
            ""
        );


    /* Find DOCTYPE */

    const lower =
        result.toLowerCase();

    const doctypeIndex =
        lower.indexOf(
            "<!doctype html>"
        );

    if (doctypeIndex > 0) {

        result =
            result.substring(
                doctypeIndex
            );

    }


    /* If DOCTYPE is missing, find <html> */

    const htmlIndex =
        result
            .toLowerCase()
            .indexOf("<html");


    if (
        !result
            .toLowerCase()
            .startsWith("<!doctype html>") &&
        htmlIndex > 0
    ) {

        result =
            result.substring(
                htmlIndex
            );

    }


    return result.trim();

}


/* ======================================================
   GET AI TEXT
====================================================== */

function getAIText(result) {

    if (!result) {
        return "";
    }


    if (
        typeof result === "object" &&
        typeof result.response === "string"
    ) {

        return result.response;

    }


    if (
        typeof result === "string"
    ) {

        return result;

    }


    if (
        typeof result === "object" &&
        typeof result.text === "string"
    ) {

        return result.text;

    }


    return "";

}


/* ======================================================
   VALIDATE IMAGE
====================================================== */

function validateImage(image) {

    if (!image) {
        return true;
    }


    if (
        typeof image !== "string"
    ) {

        return false;

    }


    if (
        !image.startsWith(
            "data:image/"
        )
    ) {

        return false;

    }


    const allowedTypes = [
        "data:image/jpeg",
        "data:image/jpg",
        "data:image/png",
        "data:image/webp",
        "data:image/gif"
    ];


    const validType =
        allowedTypes.some(
            type =>
                image.startsWith(type)
        );


    if (!validType) {
        return false;
    }


    if (
        image.length >
        MAX_IMAGE_LENGTH
    ) {

        return false;

    }


    return true;

}


/* ======================================================
   GENERATE AND STORE A CUSTOM HERO IMAGE
====================================================== */

async function generateHeroImage(env, prompt, origin) {
    if (!env || !env.AI || !env.SITES) {
        throw new Error("Image generation requires the AI and SITES bindings.");
    }

    const result = await env.AI.run(
        "@cf/black-forest-labs/flux-1-schnell",
        {
            prompt:
                "Create a premium, photorealistic website hero photograph for this business: " +
                String(prompt).slice(0, 1200) +
                ". Professional commercial photography, natural lighting, excellent composition, " +
                "realistic details, wide landscape composition, no text, no letters, no watermark.",
            steps: 4
        }
    );

    if (!result || typeof result.image !== "string" || !result.image) {
        throw new Error("The AI image model did not return an image.");
    }

    const imageId = crypto.randomUUID();
    await env.SITES.put("webcraft-images/" + imageId, result.image);

    return origin + "/api/image/" + imageId;
}


/* ======================================================
   INSERT UPLOADED IMAGE
====================================================== */

function insertUploadedImage(
    website,
    image
) {

    if (!website) {
        return website;
    }


    /*
       If there is an uploaded image,
       replace every WebCraft placeholder.
    */

    if (image) {

        website =
            website.replaceAll(
                "__WEBCRAFT_UPLOADED_IMAGE__",
                image
            );

        website =
            website.replaceAll(
                "{{UPLOADED_IMAGE}}",
                image
            );


        /*
           If the AI did not use the placeholder,
           replace the first existing image.

           This makes image upload reliable even if
           the AI forgets the placeholder.
        */

        if (
            !website.includes(image)
        ) {

            const imageRegex =
                /<img\b([^>]*?)\bsrc\s*=\s*(['"])[^'"]*\2([^>]*)>/i;


            if (
                imageRegex.test(website)
            ) {

                website =
                    website.replace(
                        imageRegex,
                        function (
                            match,
                            before,
                            quote,
                            after
                        ) {

                            return (
                                "<img" +
                                before +
                                "src=" +
                                quote +
                                image +
                                quote +
                                after +
                                ">"
                            );

                        }
                    );

            } else {

                /*
                   If there is no image at all,
                   inject the uploaded image after <body>.
                */

                const bodyRegex =
                    /<body\b[^>]*>/i;


                if (
                    bodyRegex.test(website)
                ) {

                    website =
                        website.replace(
                            bodyRegex,
                            function(match) {

                                return (
                                    match +
                                    "\n" +
                                    '<div style="width:100%;display:flex;justify-content:center;padding:20px;">' +
                                    '<img src="' +
                                    image +
                                    '" alt="Uploaded image" style="max-width:100%;height:auto;border-radius:20px;display:block;">' +
                                    "</div>"
                                );

                            }
                        );

                }

            }

        }

    } else {

        /*
           Remove placeholders if there is no image.
        */

        website =
            website.replaceAll(
                "__WEBCRAFT_UPLOADED_IMAGE__",
                ""
            );

        website =
            website.replaceAll(
                "{{UPLOADED_IMAGE}}",
                ""
            );

    }


    return website;

}


/* ======================================================
   VALIDATE WEBSITE
====================================================== */

function validateWebsite(website) {

    if (!website) {

        throw new Error(
            "AI returned an empty website."
        );

    }


    if (
        website.length >
        MAX_WEBSITE_LENGTH
    ) {

        throw new Error(
            "The generated website is too large. Please try a shorter request."
        );

    }


    const lower =
        website.toLowerCase();


    const hasHTML =
        lower.includes("<html");


    const hasHead =
        lower.includes("<head");


    const hasBody =
        lower.includes("<body");


    const hasClosingHTML =
        lower.includes("</html>");


    if (!hasHTML) {

        throw new Error(
            "AI returned invalid HTML: missing <html>."
        );

    }


    if (!hasHead) {

        throw new Error(
            "AI returned incomplete HTML: missing <head>."
        );

    }


    if (!hasBody) {

        throw new Error(
            "AI returned incomplete HTML: missing <body>."
        );

    }


    if (!hasClosingHTML) {

        throw new Error(
            "AI returned incomplete HTML. The website appears to have been cut off."
        );

    }


    return true;

}


/* ======================================================
   CREATE SYSTEM PROMPT
====================================================== */

const CREATE_SYSTEM_PROMPT = `

You are WebCraft AI.

You are a senior professional website designer,
UX/UI designer, frontend developer, copywriter,
conversion specialist and SEO specialist working
as a premium web-development agency.

Your job is to create COMPLETE, PROFESSIONAL,
MODERN, REAL-WORLD BUSINESS WEBSITES.

The website must NEVER look like:

- a toy project
- a school assignment
- a basic HTML exercise
- a tiny demo
- a generic one-section landing page
- an unfinished template
- a website with placeholder nonsense

The final result should look like something a
professional web-development agency could deliver
to a paying client.

========================================================
OUTPUT RULES
========================================================

Return ONLY the complete HTML document.

Do NOT return:

- Markdown
- explanations
- comments outside the HTML
- code fences
- "Here is your website"
- descriptions of what you created

Start with:

<!DOCTYPE html>

and finish with:

</html>

The HTML must be complete.

========================================================
TECHNOLOGY
========================================================

Create a self-contained website using:

- HTML
- CSS
- JavaScript

Do not require React.

Do not require Vue.

Do not require external build tools.

Do not require npm.

Do not require a backend.

The generated document must work when placed
directly inside an iframe using srcdoc.

Use modern CSS.

Use semantic HTML.

Use responsive design.

Use JavaScript only where it improves functionality.

========================================================
BUSINESS UNDERSTANDING
========================================================

Carefully understand the user's business.

Use the information supplied by the user.

Turn short descriptions into useful professional
website content.

For example, if the user says:

"cleaning company in Kampala"

do not create only:

"Welcome to our cleaning company."

Instead build a convincing professional cleaning
company website with meaningful sections such as:

- Hero
- About
- Services
- Detailed service information
- Benefits
- Why choose us
- How the service works
- Service process
- Gallery
- FAQ
- Contact
- CTA
- Footer

The exact sections should depend on the business.

========================================================
IMPORTANT FACTUAL RULE
========================================================

Never invent specific factual claims that the user
did not provide.

Do NOT invent:

- fake phone numbers
- fake email addresses
- fake physical addresses
- fake awards
- fake certifications
- fake statistics
- fake years of experience
- fake branches
- fake clients
- fake testimonials
- fake reviews
- fake prices
- fake guarantees

If information is missing, use neutral wording.

For example:

"Contact us for a customized quote."

instead of inventing a price.

Testimonials should only be included if the user
provides testimonials or clearly requests sample
testimonials.

========================================================
WEBSITE STRUCTURE
========================================================

Create approximately 10-14 meaningful sections
when appropriate for the business.

Do not force unnecessary sections.

Possible sections include:

1. Navigation
2. Hero
3. About
4. Services / Products
5. Detailed service information
6. Benefits
7. Why choose us
8. Process
9. Gallery
10. Testimonials
11. FAQ
12. Contact
13. CTA
14. Footer

Every section must contain useful content.

Do not create empty cards.

Do not repeat the same sentence across sections.

========================================================
HERO SECTION
========================================================

Create a strong visual hero.

Include:

- business name
- strong headline
- supporting text
- primary CTA
- secondary CTA where appropriate
- professional visual area

The hero should immediately explain:

WHO the business is

WHAT it provides

WHO it helps

WHY someone should care

========================================================
NAVIGATION
========================================================

Create a professional navigation bar.

Include:

- logo/business name
- navigation links
- CTA button where appropriate

On mobile, create a functional mobile menu.

The mobile menu should actually open and close
using JavaScript.

Navigation links should point to real sections
using anchor IDs.

========================================================
DESIGN
========================================================

Create a premium visual identity.

Use:

- strong typography
- excellent spacing
- modern cards
- subtle borders
- rounded corners where appropriate
- professional buttons
- attractive section layouts
- visual hierarchy
- responsive grids
- subtle hover effects
- tasteful animations

Avoid excessive animations.

Do not make everything look like identical cards.

Use varied layouts.

========================================================
COLOR
========================================================

Choose colors appropriate to the business.

Maintain strong contrast.

Ensure text is readable.

Do not use dozens of random colors.

Use a coherent color system.

========================================================
IMAGES
========================================================

When the user has NOT uploaded an image,
you may use reliable remote image URLs.

Do not use fake local paths such as:

images/photo.jpg

unless the user specifically supplied such a path.

If an uploaded image exists, the user-uploaded
image will be provided through this exact placeholder:

__WEBCRAFT_UPLOADED_IMAGE__

When using the placeholder:

<img
  src="__WEBCRAFT_UPLOADED_IMAGE__"
  alt="..."
>

Use it prominently and appropriately.

Do not omit it.

Do not create a fake replacement local path.

========================================================
RESPONSIVENESS
========================================================

The website MUST work on:

- mobile phones
- tablets
- laptops
- desktop computers

Use responsive CSS.

Avoid:

- horizontal overflow
- fixed widths that break mobile
- tiny text
- buttons too small to tap
- content extending outside the viewport

Use media queries.

========================================================
FUNCTIONALITY
========================================================

Where appropriate, include:

- mobile navigation
- smooth scrolling
- FAQ accordion
- buttons
- interactive cards
- simple form validation
- gallery interactions
- back-to-top button
- scroll animations

Do not create fake backend functionality.

Forms can display a friendly message indicating
that the request has been prepared or that the
business should be contacted directly.

========================================================
CONTACT
========================================================

If the user provides:

- phone
- WhatsApp
- email
- address
- opening hours

use them accurately.

If WhatsApp is provided, create a WhatsApp CTA.

Do not invent contact details.

========================================================
SEO
========================================================

Include:

- meaningful title
- meta description
- viewport
- semantic headings
- useful alt text
- appropriate HTML structure

The title should reflect the business.

========================================================
CONTENT QUALITY
========================================================

Write polished, human-sounding copy.

Avoid generic AI filler such as:

"Welcome to our world of excellence."

unless genuinely appropriate.

Make copy specific to the business.

Service descriptions should explain:

- what the service is
- who it is for
- its benefits
- what customers can expect

========================================================
FINAL QUALITY CHECK
========================================================

Before returning the website, check that:

- HTML is complete
- CSS is complete
- JavaScript is complete
- all tags are properly closed
- </html> exists
- navigation works
- mobile layout works
- buttons are usable
- sections are substantial
- there are no obvious placeholder errors
- there are no fake business facts
- the website looks professionally designed

Return ONLY the final HTML.
`;


/* ======================================================
   EDIT SYSTEM PROMPT
====================================================== */

const EDIT_SYSTEM_PROMPT = `

You are WebCraft AI.

You are a senior frontend developer,
professional UI/UX designer and website editor.

You will receive:

1. An existing complete website.
2. A user's requested modification.

Your job is to professionally modify the existing
website while preserving useful existing information.

========================================================
OUTPUT RULES
========================================================

Return ONLY the COMPLETE updated HTML document.

Do NOT return:

- Markdown
- explanations
- code fences
- descriptions
- partial HTML

Start with:

<!DOCTYPE html>

and finish with:

</html>

========================================================
PRESERVE EXISTING CONTENT
========================================================

Unless the user explicitly asks you to remove or
change something, preserve:

- business name
- business information
- phone numbers
- emails
- addresses
- WhatsApp details
- opening hours
- services
- useful descriptions
- existing navigation
- existing sections
- useful functionality
- responsive behavior

Do not unnecessarily rewrite the entire business.

========================================================
IMPLEMENT THE USER'S REQUEST
========================================================

Actually make the requested change.

If the user asks:

"Add a pricing section"

create a complete professional pricing section.

Do not simply add:

"Pricing coming soon."

If information about actual prices was not provided,
use clearly labelled neutral pricing language such as:

"Request a Quote"

or

"Contact us for pricing."

Do not invent actual prices.

If the user asks:

"Add testimonials"

and no real testimonials were supplied, do not
pretend the testimonials are genuine.

Use a clearly neutral approach or explain through
the UI that testimonials can be added by the business.

========================================================
UPLOADED IMAGE
========================================================

If the user uploaded an image, the exact image is
available through this placeholder:

__WEBCRAFT_UPLOADED_IMAGE__

Use this placeholder in the HTML.

Place the image where it makes sense.

Do not use a fake local file path.

Do not omit the uploaded image.

========================================================
DESIGN QUALITY
========================================================

The modification must match the existing design.

Maintain:

- typography
- spacing
- colors
- button style
- cards
- responsive behavior
- visual hierarchy

Do not make the new section look like it belongs
to a completely different website.

========================================================
MOBILE
========================================================

Everything you add must work properly on:

- phones
- tablets
- laptops
- desktop

Do not introduce horizontal scrolling.

========================================================
FUNCTIONALITY
========================================================

If the requested change requires JavaScript,
include complete JavaScript.

Do not break existing functionality.

If the website already has a mobile menu,
FAQ system, gallery, buttons or other functionality,
preserve it unless the user asks to change it.

========================================================
FINAL CHECK
========================================================

Before returning the result, verify:

- complete HTML
- valid structure
- </html> exists
- CSS is complete
- JavaScript is complete
- existing business information is preserved
- requested change is actually implemented
- mobile responsive
- no fake factual information
- no unfinished sections
- no Markdown

Return ONLY the COMPLETE updated HTML.
`;


/* ======================================================
   BUILD CREATE PROMPT
====================================================== */

function buildCreatePrompt(
    prompt,
    hasImage
) {

    let imageInstruction = "";


    if (hasImage) {

        imageInstruction = `

========================================================
UPLOADED IMAGE
========================================================

The user uploaded an image.

Use this exact placeholder:

__WEBCRAFT_UPLOADED_IMAGE__

Use it as an important visual element,
preferably in the hero or another appropriate
high-visibility section.

Do NOT invent a local image path.

Do NOT omit the uploaded image.

`;

    } else {

        imageInstruction = `

========================================================
IMAGES
========================================================

The user did not upload an image.

Use appropriate reliable remote image URLs where
visuals improve the design.

Do not create fake local image paths.

`;

    }


    return `

========================================================
USER WEBSITE REQUEST
========================================================

${prompt}

${imageInstruction}

========================================================
CREATE THE WEBSITE
========================================================

Understand the business request deeply.

Create a polished, professional website suitable
for a real paying business client.

Make the website substantial, visually impressive,
responsive and functional.

Use the user's actual information.

Do not invent factual business information.

Return the complete HTML now.

`;

}


/* ======================================================
   BUILD EDIT PROMPT
====================================================== */

function buildEditPrompt(
    instruction,
    website,
    hasImage
) {

    let imageInstruction = "";


    if (hasImage) {

        imageInstruction = `

========================================================
UPLOADED IMAGE
========================================================

The user uploaded an image.

Use this exact placeholder wherever appropriate:

__WEBCRAFT_UPLOADED_IMAGE__

Make sure the image is actually used.

`;

    }


    return `

========================================================
USER'S REQUESTED CHANGE
========================================================

${instruction}

${imageInstruction}

========================================================
EXISTING WEBSITE
========================================================

${website}

========================================================
EDIT THE WEBSITE
========================================================

Apply the requested modification professionally.

Preserve existing useful business information.

Preserve existing functionality unless the user
specifically asks to change it.

Return the COMPLETE updated HTML.

Do not return explanations.

Do not return Markdown.

Do not return a partial document.

Return only HTML.

`;

}


/* ======================================================
   CALL WORKERS AI
====================================================== */

async function runAI(
    env,
    systemPrompt,
    userPrompt
) {

    if (
        !env ||
        !env.AI ||
        typeof env.AI.run !== "function"
    ) {

        throw new Error(
            "Workers AI binding is missing. Make sure wrangler.jsonc contains an AI binding named AI."
        );

    }


    try {

        const result =
            await env.AI.run(
                MODEL,
                {
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: userPrompt
                        }
                    ],

                    max_tokens:
                        12000,

                    temperature:
                        0.35,

                    top_p:
                        0.9,

                    repetition_penalty:
                        1.05,

                    stream:
                        false
                }
            );


        const text =
            getAIText(result);


        if (!text) {

            throw new Error(
                "Workers AI returned no website content."
            );

        }


        return text;

    } catch (error) {

        console.error(
            "Workers AI error:",
            error
        );


        throw new Error(
            error?.message ||
            "Workers AI request failed."
        );

    }

}


/* ======================================================
   GENERATE WEBSITE
====================================================== */

async function generateWebsite(
    env,
    body
) {

    const mode =
        body.mode || "create";


    const prompt =
        typeof body.prompt === "string"
            ? body.prompt.trim()
            : "";


    if (!prompt) {

        throw new Error(
            "Please provide a website prompt."
        );

    }


    let rawWebsite = "";
    let imageToInsert = body.image || "";


    /* ==================================================
       CREATE
    ================================================== */

    if (mode === "create") {

        if (
            body.image &&
            !validateImage(body.image)
        ) {

            throw new Error(
                "The uploaded image is invalid or too large."
            );

        }


        if (!body.image) {
            try {
                imageToInsert = await generateHeroImage(
                    env,
                    prompt,
                    body.assetOrigin || ""
                );
            } catch (imageError) {
                console.error("Hero image generation failed; continuing without a custom image:", imageError);
                imageToInsert = "";
            }
        }

        const hasImage = Boolean(imageToInsert);

        const userPrompt =
            buildCreatePrompt(
                prompt,
                hasImage
            );


        rawWebsite =
            await runAI(
                env,
                CREATE_SYSTEM_PROMPT,
                userPrompt
            );

    }


    /* ==================================================
       EDIT
    ================================================== */

    else if (mode === "edit") {

        const website =
            typeof body.website === "string"
                ? body.website
                : "";


        if (!website.trim()) {

            throw new Error(
                "No existing website was provided for editing."
            );

        }


        if (
            website.length >
            MAX_WEBSITE_LENGTH
        ) {

            throw new Error(
                "The existing website is too large to edit."
            );

        }


        if (
            body.image &&
            !validateImage(body.image)
        ) {

            throw new Error(
                "The uploaded image is invalid or too large."
            );

        }


        const hasImage =
            Boolean(body.image);


        const userPrompt =
            buildEditPrompt(
                prompt,
                website,
                hasImage
            );


        rawWebsite =
            await runAI(
                env,
                EDIT_SYSTEM_PROMPT,
                userPrompt
            );

    }


    /* ==================================================
       INVALID MODE
    ================================================== */

    else {

        throw new Error(
            `Unknown generation mode: ${mode}`
        );

    }


    /* ==================================================
       CLEAN AI OUTPUT
    ================================================== */

    let website =
        cleanAIOutput(
            rawWebsite
        );


    /* ==================================================
       VALIDATE AI HTML
    ================================================== */

    validateWebsite(
        website
    );


    /* ==================================================
       INSERT USER IMAGE
    ================================================== */

    website =
        insertUploadedImage(
            website,
            imageToInsert
        );


    /* ==================================================
       FINAL VALIDATION
    ================================================== */

    validateWebsite(
        website
    );


    if (
        website.length >
        MAX_WEBSITE_LENGTH
    ) {

        throw new Error(
            "The generated website is too large."
        );

    }


    return website;

}


/* ======================================================
   HEALTH CHECK
====================================================== */

function healthCheck(env) {

    return jsonResponse(
        {
            success: true,

            service:
                "WebCraft AI",

            status:
                "online",

            model:
                MODEL,

            workersAI:
                Boolean(
                    env &&
                    env.AI
                ),

            assets:
                Boolean(
                    env &&
                    env.ASSETS
                )
        },
        200
    );

}


/* ======================================================
   API HANDLER
====================================================== */

async function handleAPI(
    request,
    env
) {

    const url =
        new URL(
            request.url
        );


    const pathname =
        url.pathname;


    const method =
        request.method.toUpperCase();


    /* ==================================================
       SERVE GENERATED IMAGES
    ================================================== */

    if (pathname.startsWith("/api/image/") && method === "GET") {
        const imageId = pathname.slice("/api/image/".length);

        if (!/^[0-9a-f-]{36}$/i.test(imageId)) {
            return new Response("Invalid image ID.", {
                status: 400,
                headers: CORS_HEADERS
            });
        }

        if (!env || !env.SITES) {
            return new Response("Image storage is unavailable.", {
                status: 503,
                headers: CORS_HEADERS
            });
        }

        const imageBase64 = await env.SITES.get("webcraft-images/" + imageId);

        if (!imageBase64) {
            return new Response("Image not found.", {
                status: 404,
                headers: CORS_HEADERS
            });
        }

        let binary;
        try {
            binary = atob(imageBase64);
        } catch (error) {
            return new Response("Stored image is invalid.", {
                status: 500,
                headers: CORS_HEADERS
            });
        }

        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));

        return new Response(bytes, {
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=86400",
                "X-Content-Type-Options": "nosniff"
            }
        });
    }


    /* ==================================================
       CORS PREFLIGHT
    ================================================== */

    if (
        method === "OPTIONS"
    ) {

        return new Response(
            null,
            {
                status: 204,

                headers:
                    CORS_HEADERS
            }
        );

    }


    /* ==================================================
       HEALTH
    ================================================== */

    if (
        pathname === "/api/health" &&
        method === "GET"
    ) {

        return healthCheck(
            env
        );

    }


    /* ==================================================
       GENERATE
    ================================================== */

    if (
        pathname === "/api/generate"
    ) {

        if (
            method !== "POST"
        ) {

            return jsonResponse(
                {
                    success: false,

                    error:
                        "Method not allowed. Use POST."
                },
                405
            );

        }


        try {

            let body;


            try {

                body =
                    await request.json();

            } catch (error) {

                return jsonResponse(
                    {
                        success: false,

                        error:
                            "Invalid JSON request."
                    },
                    400
                );

            }


            if (
                !body ||
                typeof body !== "object"
            ) {

                return jsonResponse(
                    {
                        success: false,

                        error:
                            "Invalid request body."
                    },
                    400
                );

            }


            body.assetOrigin = url.origin;

            const website =
                await generateWebsite(
                    env,
                    body
                );


            return jsonResponse(
                {
                    success: true,

                    website: website
                },
                200
            );


        } catch (error) {

            console.error(
                "Generation error:",
                error
            );


            return jsonResponse(
                {
                    success: false,

                    error:
                        error?.message ||
                        "Website generation failed."
                },
                500
            );

        }

    }


    /* ==================================================
       UNKNOWN API ROUTE
    ================================================== */

    if (
        pathname.startsWith(
            "/api/"
        )
    ) {

        return jsonResponse(
            {
                success: false,

                error:
                    "API endpoint not found."
            },
            404
        );

    }


    return null;

}


/* ======================================================
   MAIN WORKER
====================================================== */

export default {

    async fetch(
        request,
        env
    ) {

        try {

            /*
               Handle API routes first.
            */

            const apiResponse =
                await handleAPI(
                    request,
                    env
                );


            if (apiResponse) {

                return apiResponse;

            }


            /*
               Serve files from the public directory
               through the ASSETS binding.
            */

            if (
                env &&
                env.ASSETS &&
                typeof env.ASSETS.fetch === "function"
            ) {

                return env.ASSETS.fetch(
                    request
                );

            }


            /*
               Helpful diagnostic if the ASSETS binding
               has not been configured.
            */

            return htmlResponse(
                `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WebCraft AI</title>
<style>
body{
    margin:0;
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#0b0b10;
    color:#fff;
    font-family:Arial,sans-serif;
    padding:24px;
}
.box{
    max-width:600px;
    background:#15151d;
    border:1px solid #292936;
    border-radius:20px;
    padding:30px;
}
h1{
    margin-top:0;
}
p{
    color:#b8b8c5;
    line-height:1.7;
}
code{
    color:#c18cff;
}
</style>
</head>
<body>
<div class="box">
<h1>✨ WebCraft AI</h1>
<p>
The Worker is running successfully, but the
<code>ASSETS</code> binding is not configured.
</p>
<p>
Make sure your wrangler.jsonc contains an assets
binding named <code>ASSETS</code> pointing to the
<code>./public/</code> directory.
</p>
</div>
</body>
</html>
                `,
                500
            );


        } catch (error) {

            console.error(
                "Worker error:",
                error
            );


            return jsonResponse(
                {
                    success: false,

                    error:
                        error?.message ||
                        "Internal Worker error."
                },
                500
            );

        }

    }

};
