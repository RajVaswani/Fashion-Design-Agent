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

CRITICAL RULES FOR REFERENCE ADHERENCE:
- You MUST study every reference image provided and extract: silhouette shape, proportions, color palette, fabric textures, construction details, and styling.
- Your generated designs MUST maintain the same overall aesthetic, brand DNA, and design language visible in the references.
- The garment TYPE must match what is described in the prompt — do NOT change it to a different garment.
- Proportions (sleeve length, hem length, fit tightness, shoulder width) must be realistic and consistent with the references.
- If annotations are provided, they contain specific design notes from the brand's collection — treat them as mandatory requirements.

OUTPUT STYLE: Fashion illustration — bold, expressive, clear design communication. Show the garment from a front 3/4 angle. Multiple variations encouraged but all must stay within the design language of the references.`,

  design: `You are an expert fashion designer AI. Your task is to REFINE and detail a selected clothing design.

CRITICAL RULES FOR REFERENCE ADHERENCE:
- The reference images are SELECTED CONCEPTS from the previous stage — you MUST use them as the direct base.
- Do NOT change the fundamental silhouette, garment type, or proportions from the reference designs.
- ONLY modify what the user explicitly asks to change in their refinement prompt.
- Add detail: fabric texture, stitching, seams, darts, closures, embellishments, pattern placement.
- Maintain the exact color palette unless the user asks to change it.
- The output should look like a detailed technical fashion sketch or flat with clear construction details.
- Keep proportions anatomically correct and garment-appropriate.

OUTPUT STYLE: Detailed fashion design sketch / technical flat. Show construction lines, fabric grain, button/zip placement, topstitching.`,

  realistic: `You are an expert fashion designer AI. Your task is to create a PHOTOREALISTIC product render.

CRITICAL RULES FOR REFERENCE ADHERENCE:
- The reference images are REFINED DESIGNS — reproduce them exactly as a real garment.
- Do NOT alter the design, silhouette, proportions, colors, or details in ANY way.
- Show the garment on a model in a professional studio or e-commerce setting.
- The output must look like a real product photograph or lookbook image.
- Fabric should look physically accurate (silk should drape, denim should be rigid, knit should have texture).
- Lighting should be professional studio lighting.

OUTPUT STYLE: Professional e-commerce / lookbook photography. Clean background, proper model proportions, real fabric behavior.`,
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

    // Build rich user message
    const outputStyleDescriptions: Record<string, string> = {
      sketch: "Output as a hand-drawn fashion sketch/illustration with pencil or ink style linework, expressive strokes, and fashion figure proportions.",
      "flat-2d": "Output as a clean 2D technical flat / spec drawing. Show the garment laid flat with precise construction lines, no model, white background, front and back views if possible.",
      "3d-model": "Output as a 3D rendered garment on a mannequin or dress form. Show realistic fabric drape and form with studio lighting, no human model.",
      realistic: "Output as a photorealistic image of the garment worn by a model in a professional studio or e-commerce setting.",
    };

    let userText = `## Output Style\n${outputStyleDescriptions[outputStyle] || outputStyleDescriptions.sketch}\n\n`;
    userText += `## Reference Strength\n${strengthInstruction}\n\n`;
    userText += `## Design Prompt\n${prompt}\n`;

    if (styleTags.length > 0) {
      userText += `\n## Style Tags (incorporate these attributes)\n${styleTags.join(", ")}\n`;
    }

    if (annotationContext) {
      userText += `\n## Brand Collection Notes (MUST follow these)\n${annotationContext}\n`;
    }

    if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
      userText += `\n## Reference Images\nI am providing ${referenceImages.length} reference image(s). Study them carefully and follow the rules above.`;
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
