export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // ================================
    // CORS
    // ================================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    // ================================
    // PREVIEW PAGE
    // ================================

    if (
      request.method === "GET" &&
      url.pathname === "/preview.html"
    ) {
      return new Response(getPreviewHTML(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Cache-Control": "no-store"
        }
      });
    }

    // ================================
    // HOMEPAGE
    // ================================

    if (
      request.method === "GET" &&
      (
        url.pathname === "/" ||
        url.pathname === "/index.html"
      )
    ) {
      return env.ASSETS.fetch(
        new Request(
          new URL("/index.html", request.url),
          request
        )
      );
    }

    // ================================
    // OTHER STATIC FILES
    // ================================

    if (
      request.method === "GET" &&
      !url.pathname.startsWith("/api/")
    ) {
      return env.ASSETS.fetch(request);
    }

    // ================================
    // AI GENERATION
    // ================================

    if (
      request.method === "POST" &&
      url.pathname === "/api/generate"
    ) {

      try {

        let body;

        try {
          body = await request.json();
        } catch (error) {

          return json({
            success: false,
            error: "Invalid JSON request."
          }, 400);

        }

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

        // ================================
        // VALIDATE PROMPT
        // ================================

        if (!prompt) {

          return json({
            success: false,
            error: "Please provide a prompt."
          }, 400);

        }

        // ================================
        // CREATE WEBSITE
        // ================================

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

The website should look like a real professional website, not a simple demo.

USER REQUEST:

${prompt}
`;

          return await generateWebsite(
            systemPrompt,
            prompt,
            env
          );
        }

        // ================================
        // EDIT WEBSITE
        // ================================

        if (mode === "edit") {

          if (!existingWebsite) {

            return json({
              success: false,
              error: "No existing website was provided."
            }, 400);

          }

          if (existingWebsite.length > 900000) {

            return json({
              success: false,
              error: "The existing website is too large to edit."
            }, 413);

          }

          const systemPrompt = `
You are WebCraft AI, an expert website editor.

The user already has a complete website.

Modify the existing website according to the user's instructions.

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
            prompt,
            env
          );
        }

        // ================================
        // UNKNOWN MODE
        // ================================

        return json({
          success: false,
          error: "Unknown mode: " + mode
        }, 400);

      } catch (error) {

        console.error(
          "WORKER ERROR:",
          error
        );

        return json({
          success: false,
          error:
            error && error.message
              ? error.message
              : "Website generation failed."
        }, 500);
      }
    }

    // ================================
    // NOT FOUND
    // ================================

    return json({
      success: false,
      error: "Not found."
    }, 404);


    // ================================
    // AI FUNCTION
    // ================================

    async function generateWebsite(
      systemPrompt,
      userPrompt,
      env
    ) {

      try {

        if (!env.AI) {

          return json({
            success: false,
            error: "Workers AI binding is not available."
          }, 500);

        }

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

        let website = "";

        // ================================
        // EXTRACT AI RESPONSE
        // ================================

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
              choice.message.content || "";

          }

          if (
            !website &&
            choice &&
            typeof choice.text === "string"
          ) {

            website =
              choice.text;

          }
        }

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

        if (
          !website &&
          typeof result === "string"
        ) {

          website =
            result;

        }

        // ================================
        // CLEAN RESPONSE
        // ================================

        if (
          website &&
          typeof website !== "string"
        ) {

          website =
            JSON.stringify(website);

        }

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

        // ================================
        // VALIDATE
        // ================================

        if (
          !website ||
          website.length < 50
        ) {

          console.error(
            "EMPTY AI RESPONSE:",
            JSON.stringify(result)
          );

          return json({
            success: false,
            error:
              "AI did not return a complete website. Please try again."
          }, 502);

        }

        // ================================
        // FIND HTML
        // ================================

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

        // ================================
        // ALLOW HTML WITHOUT DOCTYPE
        // ================================

        if (
          !website.includes("<html") &&
          !website.includes("<!DOCTYPE html>")
        ) {

          console.error(
            "AI RESPONSE WAS NOT HTML"
          );

          return json({
            success: false,
            error:
              "AI returned an invalid website. Please try again."
          }, 502);

        }

        // ================================
        // SUCCESS
        // ================================

        return json({
          success: true,
          website: website
        }, 200);

      } catch (error) {

        console.error(
          "AI GENERATION ERROR:",
          error
        );

        return json({
          success: false,
          error:
            error && error.message
              ? error.message
              : "AI generation failed."
        }, 500);
      }
    }


    // ================================
    // JSON HELPER
    // ================================

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


    // ================================
    // PREVIEW PAGE
    // ================================

    function getPreviewHTML() {

      return `<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>WebCraft AI - Preview</title>

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
}

body {
  background: #0b0b10;
  color: white;
  font-family: Arial, Helvetica, sans-serif;
}

/* HEADER */

.topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: #0b0b10;
  border-bottom: 1px solid #292933;
  padding: 18px 24px;
}

.topbar-inner {
  max-width: 1200px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.logo {
  font-size: 24px;
  font-weight: 800;
}

.logo span {
  color: #9b5cff;
}

.actions {
  display: flex;
  gap: 10px;
}

.btn {
  border: none;
  border-radius: 12px;
  padding: 13px 20px;
  color: white;
  font-weight: 700;
  cursor: pointer;
  font-size: 15px;
}

.back {
  background: #24242d;
}

.download {
  background: #9b5cff;
}

/* EDITOR */

.editor {
  max-width: 1200px;
  margin: auto;
  padding: 20px;
}

.edit-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 12px;
}

#editPrompt {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  border-radius: 14px;
  border: 1px solid #34343f;
  background: #191920;
  color: white;
  padding: 16px;
  font-size: 16px;
  outline: none;
}

#editPrompt:focus {
  border-color: #9b5cff;
}

.edit-button {
  width: 100%;
  margin-top: 12px;
  border: none;
  border-radius: 13px;
  min-height: 55px;
  background: #9b5cff;
  color: white;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
}

.edit-button:disabled {
  opacity: 0.6;
}

#editStatus {
  min-height: 25px;
  margin: 12px 0;
  color: #aaaab5;
}

/* DEVICE BUTTONS */

.devices {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.device {
  border: 1px solid #292933;
  background: #202029;
  color: #dddde5;
  padding: 12px 25px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  font-size: 15px;
}

.device.active {
  background: #9b5cff;
  color: white;
  border-color: #9b5cff;
}

/* PREVIEW */

.preview-area {
  width: 100%;
  min-height: 700px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #19191f;
  border-radius: 18px;
  padding: 25px;
  overflow: auto;
}

#previewFrame {
  display: block;
  border: none;
  background: white;
  box-shadow: 0 15px 50px rgba(0,0,0,0.4);
  transition: width 0.3s ease;
  width: 100%;
  min-height: 850px;
}

#previewFrame.desktop {
  width: 100%;
}

#previewFrame.tablet {
  width: 768px;
  max-width: 768px;
}

#previewFrame.mobile {
  width: 390px;
  max-width: 390px;
}

@media (max-width: 700px) {

  .topbar {
    padding: 15px;
  }

  .topbar-inner {
    flex-direction: column;
  }

  .actions {
    width: 100%;
  }

  .actions .btn {
    flex: 1;
  }

  .editor {
    padding: 14px;
  }

  .preview-area {
    padding: 10px;
  }

  #previewFrame.desktop {
    width: 100%;
  }
}

</style>

</head>

<body>

<header class="topbar">

<div class="topbar-inner">

<div class="logo">
✨ WebCraft <span>AI</span>
</div>

<div class="actions">

<button
class="btn back"
onclick="goBack()">
← Back
</button>

<button
class="btn download"
onclick="downloadWebsite()">
📥 Download
</button>

</div>

</div>

</header>


<section class="editor">

<div class="edit-title">
✏️ Edit your website with AI
</div>

<textarea
id="editPrompt"
placeholder="Tell AI what you want to change...

Example:
Change the website colors to green and white.
Make the hero section more attractive.
Add a WhatsApp contact button."></textarea>

<button
id="editButton"
class="edit-button"
onclick="editWebsite()">
✨ Edit Website
</button>

<div id="editStatus"></div>


<div class="devices">

<button
id="desktopBtn"
class="device active"
onclick="setDevice('desktop')">
🖥️ Desktop
</button>

<button
id="tabletBtn"
class="device"
onclick="setDevice('tablet')">
📱 Tablet
</button>

<button
id="mobileBtn"
class="device"
onclick="setDevice('mobile')">
📱 Mobile
</button>

</div>


<div class="preview-area">

<iframe
id="previewFrame"
class="desktop"
title="Website Preview">
</iframe>

</div>

</section>


<script>

let currentWebsite =
  localStorage.getItem("generatedWebsite") || "";

const frame =
  document.getElementById("previewFrame");

const editButton =
  document.getElementById("editButton");

const editPrompt =
  document.getElementById("editPrompt");

const editStatus =
  document.getElementById("editStatus");


// ================================
// LOAD WEBSITE
// ================================

function loadWebsite() {

  currentWebsite =
    localStorage.getItem("generatedWebsite") || "";

  if (!currentWebsite) {

    editStatus.textContent =
      "⚠️ No generated website found. Go back and generate a website first.";

    return;
  }

  frame.srcdoc =
    currentWebsite;
}


// ================================
// DEVICE PREVIEW
// ================================

function setDevice(device) {

  frame.className =
    device;

  document
    .querySelectorAll(".device")
    .forEach(function(button) {

      button.classList.remove(
        "active"
      );

    });

  document
    .getElementById(
      device + "Btn"
    )
    .classList.add("active");
}


// ================================
// BACK
// ================================

function goBack() {

  window.location.href =
    "/";
}


// ================================
// DOWNLOAD
// ================================

function downloadWebsite() {

  if (!currentWebsite) {

    alert(
      "No website available to download."
    );

    return;
  }

  const blob =
    new Blob(
      [currentWebsite],
      {
        type: "text/html"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "webcraft-website.html";

  document
    .body
    .appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}


// ================================
// AI EDIT
// ================================

async function editWebsite() {

  const prompt =
    editPrompt.value.trim();

  if (!prompt) {

    editStatus.textContent =
      "⚠️ Tell the AI what you want to change.";

    return;
  }

  if (!currentWebsite) {

    editStatus.textContent =
      "⚠️ No website is loaded.";

    return;
  }

  editButton.disabled = true;

  editButton.textContent =
    "✨ AI is editing...";

  editStatus.textContent =
    "🧠 Updating your website...";

  try {

    const response =
      await fetch(
        "/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            mode: "edit",

            prompt: prompt,

            website:
              currentWebsite

          })
        }
      );

    const text =
      await response.text();

    let data;

    try {

      data =
        JSON.parse(text);

    } catch (error) {

      throw new Error(
        "The server returned an invalid response."
      );

    }

    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.error ||
        "AI editing failed."
      );

    }

    currentWebsite =
      data.website;

    localStorage.setItem(
      "generatedWebsite",
      currentWebsite
    );

    frame.srcdoc =
      currentWebsite;

    editPrompt.value =
      "";

    editStatus.textContent =
      "✅ Website updated successfully!";

  } catch (error) {

    console.error(
      "EDIT ERROR:",
      error
    );

    editStatus.textContent =
      "❌ " +
      (
        error.message ||
        "Something went wrong."
      );

  } finally {

    editButton.disabled =
      false;

    editButton.textContent =
      "✨ Edit Website";
  }
}


// ================================
// INITIALIZE
// ================================

loadWebsite();

</script>

</body>

</html>`;
  }
};
