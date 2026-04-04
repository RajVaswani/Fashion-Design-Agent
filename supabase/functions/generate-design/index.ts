import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stageSystemPrompts: Record<string, string> = {
  concept: `You are a fashion designer AI. Generate creative clothing design CONCEPTS based on the user's prompt and reference images. 
The output should be fashion illustration style — bold, expressive, showing the design idea clearly. 
Focus on silhouette, color palette, and overall mood. Multiple variations are encouraged.`,

  design: `You are a fashion designer AI. REFINE and improve the selected clothing design based on the user's refinement notes.
Focus on adding detail: fabric texture, stitching, embellishments, fit, construction details.
The output should look like a detailed fashion design sketch or technical flat with clear design elements.
Use the provided reference designs as the base and apply the requested changes.`,

  realistic: `You are a fashion designer AI. Create a PHOTOREALISTIC render of the clothing design.
Show the garment on a model in a professional studio or e-commerce setting.
The output should look like a real product photo or lookbook image.
Maintain the design details from the reference images while making it look like a real photograph.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, referenceImages, annotationContext, stage = "concept" } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "A prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = stageSystemPrompts[stage] || stageSystemPrompts.concept;

    // Build user message with context
    let userText = `Design prompt: ${prompt}`;
    if (annotationContext) {
      userText += `\n\nReference design notes from the brand collection: ${annotationContext}`;
    }

    const content: any[] = [{ type: "text", text: userText }];

    // Add reference images
    if (referenceImages && Array.isArray(referenceImages)) {
      for (const imgUrl of referenceImages.slice(0, 8)) {
        content.push({
          type: "image_url",
          image_url: { url: imgUrl },
        });
      }
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
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
    const images = data.choices?.[0]?.message?.images || [];
    const textContent = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ images, text: textContent }),
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
