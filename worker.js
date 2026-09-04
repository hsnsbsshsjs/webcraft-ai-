/*
========================================================
 WEBCRAFT AI
 AI WEBSITE GENERATOR + EDITOR
========================================================

 Required Wrangler binding:

 "ai": {
   "binding": "AI"
 }

 This Worker provides:

 POST /api/generate

 mode: "create"
 mode: "edit"

 Optional image:
 image: "data:image/jpeg;base64,..."

========================================================
*/


/* ======================================================
   CONFIGURATION
====================================================== */

const MODEL =
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast";


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


    /*
     Remove markdown code fences.
    */

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

    result =
        result.replace(
            /\s*```$/i,
            ""
        );


    /*
     Sometimes the model puts explanations
     before the HTML.

     Try to start at <!DOCTYPE html>
     if present.
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


    /*
     If the model forgot DOCTYPE but
     returned <html>, start there.
    */

    if (
        !result
            .toLowerCase()
            .startsWith("<!doctype html>") &&
        result
            .toLowerCase()
            .indexOf("<html") > 0
    ) {

        const htmlIndex =
            result
                .toLowerCase()
                .indexOf("<html");

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


    /*
     Workers AI normally returns:

     {
       response: "..."
     }
    */

    if (
        typeof result === "object" &&
        typeof result.response === "string"
    ) {

        return result.response;

    }


    /*
     Some model responses can be
     represented differently.
    */

    if (
        typeof result === "string"
    ) {

        return result;

    }


    /*
     Try common alternatives.
    */

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


    /*
     Only allow data URI images.

     Example:

     data:image/jpeg;base64,...
    */

    if (
        !image.startsWith(
            "data:image/"
        )
    ) {

        return false;

    }


    /*
     Prevent extremely large requests.
     Approximately 6MB of encoded image.
    */

    const MAX_IMAGE_LENGTH =
        8 * 1024 * 1024;


    if (
        image.length >
        MAX_IMAGE_LENGTH
    ) {

        return false;

    }


    return true;

}


/* ======================================================
   REPLACE IMAGE PLACEHOLDER
====================================================== */

function insertUploadedImage(
    website,
    image
) {

    if (
        !image ||
        !website
    ) {

        return website;

    }


    /*
     The AI is instructed to use:

     __WEBCRAFT_UPLOADED_IMAGE__

     Replace every occurrence.
    */

    let result =
        website.replaceAll(
            "__WEBCRAFT_UPLOADED_IMAGE__",
            image
        );


    /*
     Also support a second placeholder.
    */

    result =
        result.replaceAll(
            "{{UPLOADED_IMAGE}}",
            image
        );


    return result;

}


/* ======================================================
   BASIC HTML SAFETY
====================================================== */

function limitWebsiteSize(
    website
) {

    /*
     Keep extremely abnormal responses
     from being returned.

     Normal websites should fit comfortably
     below this.
    */

    const MAX_WEBSITE_LENGTH =
        500000;


    if (
        website.length >
        MAX_WEBSITE_LENGTH
    ) {

        return website.substring(
            0,
            MAX_WEBSITE_LENGTH
        );

    }


    return website;

}


/* ======================================================
   CREATE WEBSITE SYSTEM PROMPT
====================================================== */

const CREATE_SYSTEM_PROMPT = `

You are WebCraft AI, a professional senior website designer,
UX designer, copywriter and frontend developer.

Your job is to create COMPLETE, PREMIUM, PROFESSIONAL,
REAL-WORLD BUSINESS WEBSITES.

The website must NEVER look like a short demo, toy project,
school assignment or basic template.

The user may provide only a short description.

You must intelligently expand that information into a
complete professional website without inventing dangerous
or obviously false claims.

============================================================
OUTPUT RULE
============================================================

Return ONLY the complete HTML document.

Start with:

<!DOCTYPE html>

End with:

</html>

DO NOT explain the website.

DO NOT use Markdown.

DO NOT use:

\`\`\`html

DO NOT put explanations before or after the HTML.

============================================================
TECHNOLOGY
============================================================

Create a complete self-contained website.

Use:

HTML5
CSS3
JavaScript

Put CSS inside:

<style>

Put JavaScript inside:

<script>

Do not require npm.

Do not require React.

Do not require external build tools.

The website must work when saved as a single .html file.

============================================================
DESIGN QUALITY
============================================================

The website must look like it was designed by a professional
web agency.

Use:

- strong visual hierarchy
- modern typography
- excellent spacing
- professional navigation
- polished buttons
- attractive cards
- responsive layouts
- subtle animations
- hover effects
- professional color palette
- modern hero section
- attractive section transitions
- mobile navigation
- good accessibility
- readable contrast
- premium visual presentation

Avoid:

- huge empty spaces
- childish designs
- excessive gradients
- generic plain text
- tiny sections
- unfinished sections
- placeholder paragraphs
- lorem ipsum
- "coming soon"
- "website generated by AI"
- fake testimonials presented as real
- fake awards
- fake certifications
- fake statistics

============================================================
BUSINESS UNDERSTANDING
============================================================

Study the user's description carefully.

Identify:

- business type
- business name
- location
- services
- products
- target customers
- important benefits
- contact information
- opening hours
- calls to action
- unique selling points

If information is missing, write useful neutral copy based
on the business type.

Do NOT invent specific phone numbers,
email addresses, addresses or prices.

If information is not provided, use sensible labels such as:

"Contact us for pricing"

"Call us to discuss your requirements"

"Visit us"

rather than inventing factual information.

============================================================
WEBSITE LENGTH
============================================================

Create a substantial website.

Prefer approximately:

250-450 lines of HTML/CSS/JS

when appropriate.

The website should contain enough useful information to
feel like a real business website.

Do NOT artificially make sections long with meaningless text.

============================================================
REQUIRED STRUCTURE
============================================================

Choose sections appropriate to the business.

Normally include:

1. Sticky navigation

2. Hero section
   - strong headline
   - supporting description
   - primary CTA
   - secondary CTA
   - attractive visual

3. About / company introduction

4. Services or products

5. Why choose us

6. Detailed service/product information

7. Process / how it works

8. Gallery or visual showcase

9. Testimonials section
   Only if testimonials were supplied.
   Otherwise create a "Why customers choose us"
   section instead.

10. FAQ

11. Contact section

12. Location information if provided

13. Opening hours if provided

14. Strong final CTA

15. Professional footer

============================================================
CONTENT QUALITY
============================================================

Write specific useful copy.

For example, instead of:

"We offer cleaning services."

write useful business-oriented copy describing:

- what is cleaned
- who the service is for
- benefits
- frequency
- professional process
- customer experience

Do this intelligently for restaurants,
schools, portfolios, construction companies,
salons, hotels, shops, agencies, clinics,
cleaning companies and other businesses.

============================================================
CALLS TO ACTION
============================================================

Use meaningful CTA buttons such as:

Get a Quote
Book a Service
Contact Us
Call Now
WhatsApp Us
View Services
Explore Our Work
Make an Enquiry
Book Now

Only use actions relevant to the business.

============================================================
WHATSAPP
============================================================

If a WhatsApp number is provided by the user,
create a WhatsApp button using it.

Never invent a WhatsApp number.

============================================================
IMAGES
============================================================

If the user uploads an image, use:

__WEBCRAFT_UPLOADED_IMAGE__

as the image source.

Example:

<img
src="__WEBCRAFT_UPLOADED_IMAGE__"
alt="Professional business image"
>

If an uploaded image exists, use it prominently,
especially in the hero section when appropriate.

If there is no uploaded image, use tasteful remote
image URLs from Unsplash Source or Unsplash images
when suitable.

Do not make the website dependent on a local image file
that does not exist.

============================================================
IMAGE DESIGN
============================================================

Use images in:

- hero section
- about section
- services when useful
- gallery
- CTA sections when appropriate

Do not overload the page with images.

Use:

object-fit: cover;

rounded corners where appropriate.

============================================================
RESPONSIVENESS
============================================================

The website MUST work on:

- Android phones
- iPhones
- tablets
- laptops
- desktop screens

Include responsive CSS.

Use media queries.

Make navigation usable on mobile.

============================================================
ANIMATIONS
============================================================

Add tasteful JavaScript/CSS animations such as:

- fade-in sections
- hover effects
- button transitions
- card animations
- smooth scrolling

Do not make animations excessive.

============================================================
FUNCTIONALITY
============================================================

Add useful frontend interactions when appropriate:

- mobile menu
- smooth scrolling
- FAQ accordion
- contact form UI
- gallery interactions
- scroll reveal
- back-to-top button

Do not claim that a form actually sends email
unless a backend is provided.

============================================================
SEO
============================================================

Include:

<title>

<meta name="description">

<meta name="viewport">

semantic headings

alt text

Open Graph metadata when appropriate.

============================================================
FINAL QUALITY CHECK
============================================================

Before returning the HTML, mentally verify:

- Is it complete?
- Does it look professional?
- Is the content useful?
- Does it represent the business?
- Does it have enough sections?
- Does it work on mobile?
- Are buttons styled?
- Is navigation present?
- Is the footer complete?
- Are images handled correctly?
- Is there any placeholder text?
- Is there any Markdown?
- Is there any explanation outside the HTML?

Return ONLY the finished HTML.

`;


/* ======================================================
   EDIT SYSTEM PROMPT
====================================================== */

const EDIT_SYSTEM_PROMPT = `

You are WebCraft AI, a senior frontend developer,
UI/UX designer and website editor.

You will receive:

1. An existing complete website.
2. A user's requested modification.

Your job is to modify the existing website professionally.

============================================================
OUTPUT
============================================================

Return ONLY the complete updated HTML document.

Start with:

<!DOCTYPE html>

End with:

</html>

No Markdown.

No explanations.

No code fences.

============================================================
IMPORTANT
============================================================

DO NOT destroy existing content unnecessarily.

Preserve:

- business information
- existing sections
- navigation
- contact details
- useful content
- existing functionality
- responsive behavior

unless the user's instruction specifically asks
to remove or replace something.

============================================================
DESIGN
============================================================

Improve the website rather than making it simpler.

Maintain or improve:

- professional visual hierarchy
- spacing
- typography
- buttons
- responsive design
- animations
- accessibility
- navigation
- mobile usability

============================================================
IMAGE HANDLING
============================================================

If an uploaded image is supplied, use:

__WEBCRAFT_UPLOADED_IMAGE__

as the image source.

Use the uploaded image where the user requests it.

For example:

<img
src="__WEBCRAFT_UPLOADED_IMAGE__"
alt="Uploaded business image"
>

Do not replace an uploaded image with a nonexistent
local file path.

============================================================
CONTENT
============================================================

If the user asks to add a section,
create a complete useful section.

Do not add only a heading and one sentence.

If the user asks for:

"Add pricing"

create a professional pricing section.

If the user asks for:

"Add services"

create detailed service cards.

If the user asks for:

"Make it more professional"

improve layout, typography, spacing,
colors, content structure and visual hierarchy.

============================================================
RESPONSIVE DESIGN
============================================================

Always preserve mobile responsiveness.

The final HTML must work on:

phones
tablets
laptops
desktop computers.

============================================================
FINAL CHECK
============================================================

Return the COMPLETE website.

Do not return only the changed section.

Do not explain your changes.

Return ONLY HTML.

`;


/* ======================================================
   CREATE USER PROMPT
====================================================== */

function buildCreatePrompt(
    prompt,
    hasImage
) {

    let imageInstruction = "";


    if (hasImage) {

        imageInstruction = `

IMPORTANT:

The user has uploaded an image.

Use this exact placeholder wherever the uploaded
image should appear:

__WEBCRAFT_UPLOADED_IMAGE__

Use the uploaded image prominently in the website,
preferably in the hero section or another visually
important section appropriate to the business.

Do not create a fake local image path.

Do not omit the image.

`;

    }


    return `

USER'S WEBSITE REQUEST:

${prompt}

${imageInstruction}

Create the complete professional website now.

`;

}


/* ======================================================
   EDIT USER PROMPT
====================================================== */

function buildEditPrompt(
    instruction,
    website,
    hasImage
) {

    let imageInstruction = "";


    if (hasImage) {

        imageInstruction = `

IMPORTANT:

The user has uploaded an image.

The uploaded image is available through:

__WEBCRAFT_UPLOADED_IMAGE__

Use this placeholder in the HTML wherever the user
requests the uploaded image.

`;

    }


    return `

USER'S REQUESTED CHANGE:

${instruction}

${imageInstruction}

============================================================
EXISTING WEBSITE
============================================================

${website}

============================================================

Now return the COMPLETE updated HTML.

Do not return explanations.

Do not return Markdown.

Return only HTML.

`;

}


/* ======================================================
   CALL AI
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

                max_tokens: 12000,

                temperature: 0.35,

                top_p: 0.9,

                repetition_penalty: 1.05,

                stream: false
                            });


        /* =====================================
           PROCESS AI RESPONSE
        ===================================== */

        let website = "";

        if (typeof aiResponse === "string") {
            website = aiResponse;
        } else if (aiResponse && typeof aiResponse.response === "string") {
            website = aiResponse.response;
        } else if (aiResponse && typeof aiResponse.result === "string") {
            website = aiResponse.result;
        } else if (aiResponse && typeof aiResponse.output === "string") {
            website = aiResponse.output;
        }


        /* =====================================
           CHECK AI RESPONSE
        ===================================== */

        if (!website || website.trim().length < 100) {

            return jsonResponse({
                success: false,
                error: "AI did not return a complete website."
            }, 500);

        }


        website = website.trim();


        /* =====================================
           REMOVE MARKDOWN CODE FENCES
           IF AI ADDS THEM
        ===================================== */

        if (website.startsWith("```html")) {
            website = website
                .replace(/^```html\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();
        }

        else if (website.startsWith("```")) {
            website = website
                .replace(/^```\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();
        }


        /* =====================================
           IMAGE SUPPORT
        ===================================== */

        /*
         * If the user uploaded an image,
         * make sure the AI receives instructions
         * to actually use it in the generated website.
         */

        if (image && typeof image === "string") {

            /*
             * The image is already supplied to the AI
             * through the user prompt.
             *
             * We do NOT place the image directly
             * into the HTML here because that can
             * make the generated website extremely large.
             */

            if (
                !website.includes(image) &&
                !website.includes("data:image")
            ) {

                /*
                 * Leave the AI-generated HTML unchanged.
                 *
                 * The AI is responsible for deciding
                 * where the uploaded image belongs.
                 */

            }

        }


        /* =====================================
           BASIC HTML VALIDATION
        ===================================== */

        const lowerWebsite =
            website.toLowerCase();


        const looksLikeHTML =
            lowerWebsite.includes("<html") ||
            lowerWebsite.includes("<!doctype") ||
            lowerWebsite.includes("<body") ||
            lowerWebsite.includes("<main") ||
            lowerWebsite.includes("<section");


        if (!looksLikeHTML) {

            return jsonResponse({
                success: false,
                error: "AI returned content that is not a valid website."
            }, 500);

        }


        /* =====================================
           RETURN GENERATED WEBSITE
        ===================================== */

        return jsonResponse({

            success: true,

            website: website

        });


    } catch (error) {

        console.error(
            "WEBCRAFT AI ERROR:",
            error
        );


        return jsonResponse({

            success: false,

            error:
                error && error.message
                    ? error.message
                    : "Website generation failed."

        }, 500);

    }

}


/* =====================================
   JSON RESPONSE HELPER
===================================== */

function jsonResponse(data, status = 200) {

    return new Response(
        JSON.stringify(data),
        {
            status: status,

            headers: {
                "Content-Type":
                    "application/json; charset=utf-8",

                "Access-Control-Allow-Origin":
                    "*",

                "Access-Control-Allow-Methods":
                    "POST, OPTIONS",

                "Access-Control-Allow-Headers":
                    "Content-Type, Accept"
            }
        }
    );

}

      
