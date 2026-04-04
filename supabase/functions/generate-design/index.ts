import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const strengthDescriptions: Record<string, string> = {
  low: "Use the reference images loosely for mood and inspiration only. Feel free to explore new silhouettes and proportions.",
  medium: "Follow the reference images closely for overall silhouette, proportions, and color palette, but allow creative interpretation of details.",
  high: "Replicate the reference images as faithfully as possible. Maintain exact silhouette, proportions, construction details, and color relationships. Only apply the specific changes requested in the prompt.",
};

const stageSystemPrompts: Record<string, string> = {
  concept: `You are an expert fashion designer AI. Your task is to generate clothing design CONCEPTS.

PROMPT HIERARCHY (follow strictly):
1. **Project Theme (Master Prompt)** = The overarching brand narrative, mood, and aesthetic guardrails. ALL designs must feel like they belong in this theme.
2. **Design Prompt** = The specific focus for THIS look. This is what makes this design unique within the theme.
3. **Reference Images** = Visual anchors. Follow them based on the Reference Strength level provided.
4. **Style Tags & Annotations** = Additional attributes to incorporate.

CRITICAL RULES:
- The garment TYPE must match the design prompt — do NOT change it.
- Proportions must be realistic and consistent with references.
- Stay within the project theme at all times.

OUTPUT STYLE: Fashion illustration — bold, expressive, clear design communication.

CITATION (MANDATORY): After generating the image, you MUST write a brief citation explaining:
- How the project theme influenced the design
- What specific elements came from the design prompt
- Which reference images influenced the silhouette, color, or details
- Which style tags were applied
Format: Start with "**Design Citation:**" followed by 2-4 sentences.`,

  design: `You are an expert fashion designer AI. Your task is to REFINE and detail a selected clothing design.

PROMPT HIERARCHY (follow strictly):
1. **Project Theme** = Guardrails — the design must stay within this aesthetic.
2. **Design Prompt** = Specific refinements to make to the selected concepts.
3. **Reference Images** = The selected concepts ARE your base. Do NOT change the fundamental silhouette unless asked.
4. **Design Notes** = Per-design annotations from the user about what to change.

CRITICAL RULES:
- ONLY modify what the user explicitly asks to change.
- Add detail: fabric texture, stitching, seams, closures, embellishments.
- Maintain the project theme throughout.

OUTPUT STYLE: Detailed fashion design sketch / technical flat.

CITATION (MANDATORY): After generating, write a brief citation explaining:
- What was kept from the original concept and why
- What specific changes were made per the refinement prompt
- How the project theme guided decisions
Format: Start with "**Design Citation:**" followed by 2-4 sentences.`,

  realistic: `You are an expert fashion designer AI. Your task is to create a PHOTOREALISTIC product render.

PROMPT HIERARCHY (follow strictly):
1. **Project Theme** = The mood, setting, and brand story for the photo.
2. **Design Prompt** = Specific styling, model, or photography direction.
3. **Reference Images** = The refined designs — reproduce them EXACTLY as real garments.

CRITICAL RULES:
- Do NOT alter the design, silhouette, proportions, colors, or details.
- Fabric should look physically accurate.
- Lighting and setting should reflect the project theme.

OUTPUT STYLE: Professional e-commerce / lookbook photography.

CITATION (MANDATORY): After generating, write a brief citation explaining:
- How the project theme influenced the photography style and setting
- How faithfully the design was reproduced
- Any styling choices made for the photoshoot
Format: Start with "**Design Citation:**" followed by 2-4 sentences.`,
};

const outputStyleDescriptions: Record<string, string> = {
  sketch: "Output as a hand-drawn fashion sketch/illustration with pencil or ink style linework, expressive strokes, and fashion figure proportions.",
  "flat-2d": "Output as a clean 2D technical flat / spec drawing. Show the garment laid flat with precise construction lines, no model, white background, front and back views if possible.",
  "3d-model": "Output as a 3D rendered garment on a mannequin or dress form. Show realistic fabric drape and form with studio lighting, no human model.",
  realistic: "Output as a photorealistic image of the garment worn by a model in a professional studio or e-commerce setting.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      prompt,
      referenceImages,
      annotationContext,
      stage = "concept",
      styleTags = [],
      referenceStrength = "high",
      outputStyle = "sketch",
      masterPrompt,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const userId = user?.id;

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "A prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = stageSystemPrompts[stage] || stageSystemPrompts.concept;
    const strengthInstruction = strengthDescriptions[referenceStrength] || strengthDescriptions.high;

    // Build structured user message with clear hierarchy
    let userText = "";

    if (masterPrompt) {
      userText += `## 1. PROJECT THEME (Master Prompt — guardrails for ALL designs)\n${masterPrompt}\n\n`;
    }

    userText += `## 2. OUTPUT STYLE\n${outputStyleDescriptions[outputStyle] || outputStyleDescriptions.sketch}\n\n`;
    userText += `## 3. DESIGN PROMPT (focus of this specific look)\n${prompt}\n\n`;
    userText += `## 4. REFERENCE STRENGTH\n${strengthInstruction}\n`;

    if (styleTags.length > 0) {
      userText += `\n## 5. STYLE TAGS (incorporate these attributes)\n${styleTags.join(", ")}\n`;
    }

    if (annotationContext) {
      userText += `\n## 6. DESIGN NOTES & ANNOTATIONS (MUST follow)\n${annotationContext}\n`;
    }

    if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
      userText += `\n## 7. REFERENCE IMAGES\nI am providing ${referenceImages.length} reference image(s). Study them carefully and follow the hierarchy above.`;
    }

    const content: any[] = [{ type: "text", text: userText }];

    if (referenceImages && Array.isArray(referenceImages)) {
      for (const imgUrl of referenceImages.slice(0, 8)) {
        content.push({ type: "image_url", image_url: { url: imgUrl } });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawImages = data.choices?.[0]?.message?.images || [];
    const textContent = data.choices?.[0]?.message?.content || "";

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const uploadedImages: { url: string }[] = [];

    for (const img of rawImages) {
      let publicUrl: string;

      if (img.data) {
        const bytes = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
        const ext = (img.mime_type || "image/png").split("/")[1] || "png";
        const folder = userId || "anonymous";
        const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await serviceClient.storage
          .from("design-outputs")
          .upload(fileName, bytes, { contentType: img.mime_type || "image/png" });

        if (uploadError) { console.error("Upload error:", uploadError); continue; }

        const { data: urlData } = serviceClient.storage.from("design-outputs").getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      } else if (img.image_url?.url) {
        publicUrl = img.image_url.url;
      } else if (typeof img === "string") {
        const bytes = Uint8Array.from(atob(img), (c) => c.charCodeAt(0));
        const folder = userId || "anonymous";
        const fileName = `${folder}/${crypto.randomUUID()}.png`;
        const { error: uploadError } = await serviceClient.storage
          .from("design-outputs")
          .upload(fileName, bytes, { contentType: "image/png" });
        if (uploadError) { console.error("Upload error:", uploadError); continue; }
        const { data: urlData } = serviceClient.storage.from("design-outputs").getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      } else {
        continue;
      }

      uploadedImages.push({ url: publicUrl });
    }

    return new Response(
      JSON.stringify({ images: uploadedImages, text: textContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-design error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
