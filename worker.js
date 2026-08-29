export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    /*
     * CORS preflight
     */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    /*
     * Serve the website files from /public
     */
    if (request.method === "GET") {

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return env.ASSETS.fetch(
          new Request(
            new URL("/index.html", request.url),
            request
          )
        );
      }

      if (url.pathname === "/preview.html") {
        return env.ASSETS.fetch(
          new Request(
            new URL("/preview.html", request.url),
            request
          )
        );
      }

      /*
       * Allow other static files
       */
      if (!url.pathname.startsWith("/api/")) {
        return env.ASSETS.fetch(request);
      }
    }


    /*
     * AI GENERATION API
     *
     * POST /api/generate
     */
    if (
      request.method === "POST" &&
      url.pathname === "/api/generate"
    ) {

      try {

        const body = await request.json();

        const mode = body.mode || "create";
        const prompt = body.prompt || "";
        const existingWebsite =
          body.website || "";


        if (!prompt) {

          return json(
            {
              success: false,
              error: "Please provide a prompt."
            },
            400
          );

        }


        let systemPrompt;


        /*
         * CREATE MODE
         */

        if (mode === "create") {

          systemPrompt = `
You are WebCraft AI, an expert website designer and developer.

Create a complete, beautiful, professional and responsive website based on the user's request.

RULES:

- Return ONLY complete HTML.
- Start with <!DOCTYPE html>.
- Include CSS inside <style>.
- Include JavaScript inside <script> when useful.
- Make the website responsive on phones, tablets and computers.
- Create a professional modern design.
- Include realistic useful content.
- Make navigation and buttons functional where possible.
- Use semantic HTML.
- Make the website visually attractive.
- Do not use Markdown.
- Do not use code fences.
- Do not explain anything.
- Return ONLY HTML.

USER REQUEST:
${prompt}
`;

        }


        /*
         * EDIT MODE
         */

        else if (mode === "edit") {

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


          systemPrompt = `
You are WebCraft AI, an expert website editor.

The user already has a website.

Modify the existing website according to the user's instructions.

IMPORTANT RULES:

- Return the COMPLETE modified HTML.
- Start with <!DOCTYPE html>.
- Preserve existing features unless the user asks to remove them.
- Preserve existing content unless the user asks to change it.
- Make requested changes accurately.
- Keep the website responsive.
- Keep the design professional.
- Do not use Markdown.
- Do not use code fences.
- Do not explain anything.
- Return ONLY HTML.

USER REQUEST:
${prompt}

EXISTING WEBSITE:
${existingWebsite}
`;

        }


        else {

          return json(
            {
              success: false,
              error: "Unknown mode."
            },
            400
          );

        }


        /*
         * CALL CLOUDFLARE WORKERS AI
         */

        const result = await env.AI.run(
          "@cf/zai-org/glm-4.7-flash",
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
            max_tokens: 8000,
            temperature: 0.6
          }
        );


        /*
         * GET AI RESPONSE
         */

        let website = "";


        if (
          result &&
          result.choices &&
          result.choices[0] &&
          result.choices[0].message
        ) {

          website =
            result.choices[0].message.content || "";

        }


        if (
          !website &&
          result &&
          result.response
        ) {

          website = result.response;

        }


        if (
          !website &&
          result &&
          result.output_text
        ) {

          website = result.output_text;

        }


        /*
         * Make sure response is a string
         */

        if (typeof website !== "string") {

          website = JSON.stringify(website);

        }


        /*
         * Remove accidental Markdown code fences
         */

        website = website
          .replace(/^```html\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();


        /*
         * Validate response
         */

        if (
          !website ||
          website.length < 50
        ) {

          return json(
            {
              success: false,
              error:
                "AI returned an empty website."
            },
            500
          );

        }


        /*
         * Return generated website
         */

        return json({
          success: true,
          website: website
        });


      }

      catch (error) {

        console.error(
          "AI ERROR:",
          error
        );


        return json(
          {
            success: false,
            error:
              error.message ||
              "Website generation failed."
          },
          500
        );

      }

    }


    /*
     * Unknown request
     */

    return json(
      {
        success: false,
        error: "Not found."
      },
      404
    );


    /*
     * JSON RESPONSE HELPER
     */

    function json(data, status = 200) {

      return new Response(
        JSON.stringify(data),
        {
          status: status,
          headers: {
            "Content-Type":
              "application/json",
            ...corsHeaders
          }
        }
      );

    }

  }
};
