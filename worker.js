export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    /*
     * CORS
     */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    /*
     * ================================
     * WEBSITE FILES
     * ================================
     */

    if (request.method === "GET") {

      /*
       * Homepage
       */
      if (
        url.pathname === "/" ||
        url.pathname === "/index.html"
      ) {
        return env.ASSETS.fetch(
          new Request(
            new URL("/index.html", request.url),
            request
          )
        );
      }

      /*
       * Preview page
       */
      if (url.pathname === "/preview.html") {
        return env.ASSETS.fetch(
          new Request(
            new URL("/preview.html", request.url),
            request
          )
        );
      }

      /*
       * Other static files
       */
      if (!url.pathname.startsWith("/api/")) {
        return env.ASSETS.fetch(request);
      }
    }


    /*
     * ================================
     * AI GENERATION API
     * ================================
     *
     * POST /api/generate
     */

    if (
      request.method === "POST" &&
      url.pathname === "/api/generate"
    ) {

      try {

        /*
         * Read request body
         */

        let body;

        try {

          body = await request.json();

        } catch (error) {

          return json(
            {
              success: false,
              error: "Invalid JSON request."
            },
            400
          );

        }


        /*
         * Get request values
         */

        const mode =
          body.mode || "create";

        const prompt =
          typeof body.prompt === "string"
            ? body.prompt.trim()
            : "";

        const existingWebsite =
          typeof body.website === "string"
            ? body.website
            : "";


        /*
         * Validate prompt
         */

        if (!prompt) {

          return json(
            {
              success: false,
              error:
                "Please provide a prompt."
            },
            400
          );

        }


        /*
         * ================================
         * CREATE MODE
         * ================================
         */

        if (mode === "create") {

          const systemPrompt = `
You are WebCraft AI, an expert website designer and developer.

Create a complete, beautiful, professional and responsive website based on the user's request.

IMPORTANT RULES:

1. Return ONLY complete HTML.
2. Start with <!DOCTYPE html>.
3. Include all CSS inside <style>.
4. Include JavaScript inside <script> when useful.
5. Make the website responsive on phones, tablets and computers.
6. Create a modern professional design.
7. Include realistic useful content.
8. Make buttons and navigation functional where possible.
9. Use semantic HTML.
10. Do not use Markdown.
11. Do not use code fences.
12. Do not explain anything.
13. Return ONLY HTML.

USER REQUEST:

${prompt}
`;


          return await generateWebsite(
            systemPrompt,
            prompt
          );

        }


        /*
         * ================================
         * EDIT MODE
         * ================================
         */

        if (mode === "edit") {

          /*
           * Check existing website
           */

          if (!existingWebsite) {

            return json(
              {
                success: false,
                error:
                  "No existing website was provided."
              },
              400
            );

          }


          /*
           * Prevent accidentally sending
           * an impossibly large request.
           */

          if (existingWebsite.length > 900000) {

            return json(
              {
                success: false,
                error:
                  "The existing website is too large to edit."
              },
              413
            );

          }


          const systemPrompt = `
You are WebCraft AI, an expert website editor.

The user already has a complete website.

Your job is to modify the existing website according to the user's instructions.

IMPORTANT RULES:

1. Return the COMPLETE modified HTML.
2. Start with <!DOCTYPE html>.
3. Preserve existing features unless the user asks to remove them.
4. Preserve existing content unless the user asks to change it.
5. Make the requested changes accurately.
6. Keep the website responsive.
7. Keep the website professional.
8. Keep existing JavaScript functionality unless changes are requested.
9. Do not use Markdown.
10. Do not use code fences.
11. Do not explain anything.
12. Return ONLY HTML.

USER'S EDITING REQUEST:

${prompt}

EXISTING WEBSITE:

${existingWebsite}
`;


          return await generateWebsite(
            systemPrompt,
            prompt
          );

        }


        /*
         * ================================
         * UNKNOWN MODE
         * ================================
         */

        return json(
          {
            success: false,
            error:
              "Unknown mode: " + mode
          },
          400
        );


      } catch (error) {

        /*
         * NEVER allow the Worker to return
         * an empty response.
         */

        console.error(
          "WORKER ERROR:",
          error
        );

        return json(
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
     * ================================
     * UNKNOWN REQUEST
     * ================================
     */

    return json(
      {
        success: false,
        error:
          "Not found."
      },
      404
    );


    /*
     * ================================
     * AI GENERATION FUNCTION
     * ================================
     */

    async function generateWebsite(
      systemPrompt,
      userPrompt
    ) {

      try {

        /*
         * Check AI binding
         */

        if (!env.AI) {

          return json(
            {
              success: false,
              error:
                "Workers AI binding is not available."
            },
            500
          );

        }


        /*
         * Run Workers AI
         */

        const result =
          await env.AI.run(
            "@cf/zai-org/glm-4.7-flash",
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

              temperature: 0.6
            }
          );


        console.log(
          "AI RESULT RECEIVED"
        );


        /*
         * Extract generated HTML
         */

        let website = "";


        /*
         * Standard chat completion response
         */

        if (
          result &&
          Array.isArray(result.choices) &&
          result.choices.length > 0
        ) {

          const choice =
            result.choices[0];

          if (
            choice &&
            choice.message
          ) {

            website =
              choice.message.content ||
              "";

          }

          /*
           * Some response formats
           * may use text directly.
           */

          if (
            !website &&
            choice &&
            typeof choice.text === "string"
          ) {

            website =
              choice.text;

          }

        }


        /*
         * Other possible Workers AI
         * response formats
         */

        if (
          !website &&
          result &&
          typeof result.response === "string"
        ) {

          website =
            result.response;

        }


        if (
          !website &&
          result &&
          typeof result.output_text === "string"
        ) {

          website =
            result.output_text;

        }


        /*
         * Handle direct string response
         */

        if (
          !website &&
          typeof result === "string"
        ) {

          website =
            result;

        }


        /*
         * Convert anything else to string
         */

        if (
          website &&
          typeof website !== "string"
        ) {

          website =
            JSON.stringify(website);

        }


        /*
         * Remove Markdown code fences
         */

        if (typeof website === "string") {

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

        }


        /*
         * Validate generated HTML
         */

        if (
          !website ||
          website.length < 50
        ) {

          console.error(
            "EMPTY AI RESPONSE:",
            JSON.stringify(result)
          );

          return json(
            {
              success: false,
              error:
                "AI did not return a complete website. Please try again."
            },
            502
          );

        }


        /*
         * Make sure AI actually returned HTML.
         *
         * Some models may occasionally put
         * text before the HTML.
         */

        const htmlStart =
          website.indexOf(
            "<!DOCTYPE html>"
          );

        if (htmlStart > 0) {

          website =
            website.substring(
              htmlStart
            );

        }


        /*
         * If there is no DOCTYPE but there
         * is HTML, allow it.
         */

        if (
          !website.includes("<html") &&
          !website.includes("<!DOCTYPE html>")
        ) {

          console.error(
            "AI RESPONSE WAS NOT HTML"
          );

          return json(
            {
              success: false,
              error:
                "AI returned an invalid website. Please try again."
            },
            502
          );

        }


        /*
         * SUCCESS
         */

        return json(
          {
            success: true,
            website: website
          },
          200
        );


      } catch (error) {

        console.error(
          "AI GENERATION ERROR:",
          error
        );


        /*
         * Always return valid JSON
         */

        return json(
          {
            success: false,
            error:
              error &&
              error.message
                ? error.message
                : "AI generation failed."
          },
          500
        );

      }

    }


    /*
     * ================================
     * JSON RESPONSE HELPER
     * ================================
     */

    function json(
      data,
      status = 200
    ) {

      return new Response(
        JSON.stringify(data),
        {
          status: status,
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8",

            "Cache-Control":
              "no-store",

            ...corsHeaders
          }
        }
      );

    }

  }
};
