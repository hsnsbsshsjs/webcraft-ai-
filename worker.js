export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    /*
     * WEBSITE GENERATION API
     */
    if (url.pathname === "/api/generate" && request.method === "POST") {

      try {

        const body = await request.json();

        const prompt = String(body.prompt || "").trim();

        if (!prompt) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Please provide a website description."
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        const systemPrompt = `
You are WebCraft AI, an expert website designer and developer.

Create a complete, beautiful and professional website based on the user's request.

IMPORTANT RULES:

1. Return ONLY complete HTML.
2. Start with <!DOCTYPE html>.
3. Include all CSS inside <style>.
4. Include JavaScript inside <script> when useful.
5. Make the website responsive on phones, tablets and computers.
6. Create a modern professional design.
7. Use realistic content based on the user's request.
8. Include working navigation and buttons where appropriate.
9. Do not use Markdown.
10. Do not use code fences.
11. Do not explain anything.
12. Return ONLY the HTML.

USER REQUEST:
${prompt}
`;

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

        let website = "";

        if (
          result &&
          result.choices &&
          result.choices[0] &&
          result.choices[0].message
        ) {
          website = result.choices[0].message.content || "";
        }

        if (!website && result && result.response) {
          website = result.response;
        }

        if (!website && result && result.output_text) {
          website = result.output_text;
        }

        if (typeof website !== "string") {
          website = JSON.stringify(website);
        }

        // Remove accidental Markdown code fences
        website = website
          .replace(/^```html\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        if (!website || website.length < 50) {
          throw new Error("AI returned an empty website.");
        }

        return new Response(
          JSON.stringify({
            success: true,
            website: website
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );

      } catch (error) {

        console.error("Generation error:", error);

        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || "Website generation failed."
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }

    /*
     * SERVE THE WEBCRAFT AI WEBSITE
     */
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "WebCraft AI is running.",
      {
        status: 200,
        headers: corsHeaders
      }
    );
  }
};
