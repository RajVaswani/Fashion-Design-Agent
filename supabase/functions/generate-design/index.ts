import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Extract user id from auth header
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

    let userText = `Design prompt: ${prompt}`;
    if (annotationContext) {
      userText += `\n\nReference design notes from the brand collection: ${annotationContext}`;
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

    // Upload base64 images to Supabase Storage and return public URLs
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const uploadedImages: { url: string }[] = [];

    for (const img of rawImages) {
      // img may be { data: "base64...", mime_type: "image/png" } or { image_url: { url: "..." } }
      let publicUrl: string;

      if (img.data) {
        // Base64 image — upload to storage
        const bytes = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
        const ext = (img.mime_type || "image/png").split("/")[1] || "png";
        const folder = userId || "anonymous";
        const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await serviceClient.storage
          .from("design-outputs")
          .upload(fileName, bytes, { contentType: img.mime_type || "image/png" });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: urlData } = serviceClient.storage
          .from("design-outputs")
          .getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      } else if (img.image_url?.url) {
        publicUrl = img.image_url.url;
      } else if (typeof img === "string") {
        // Could be a direct base64 string
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
