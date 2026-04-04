const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extract text surrounding an image in the HTML for context */
function extractContext(html: string, imgIndex: number): string {
  // Grab a window of ~1500 chars around the image tag
  const start = Math.max(0, imgIndex - 800);
  const end = Math.min(html.length, imgIndex + 800);
  const window = html.substring(start, end);

  const parts: string[] = [];

  // Nearby headings
  const headings = window.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || [];
  for (const h of headings) {
    const text = h.replace(/<[^>]+>/g, "").trim();
    if (text) parts.push(text);
  }

  // Product name patterns (common e-commerce classes)
  const namePatterns = [
    /class="[^"]*(?:product[-_]?(?:name|title)|card[-_]?title|item[-_]?name)[^"]*"[^>]*>([\s\S]*?)<\//gi,
    /<(?:span|p|div|a)[^>]*>([\s\S]{5,80})<\/(?:span|p|div|a)>/gi,
  ];
  for (const pat of namePatterns) {
    let m;
    while ((m = pat.exec(window)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      if (text && text.length > 3 && text.length < 120 && !text.includes("{")) {
        parts.push(text);
      }
    }
  }

  // Price
  const priceMatch = window.match(/[\$€£¥]\s*[\d,.]+/);
  if (priceMatch) parts.push(`Price: ${priceMatch[0]}`);

  // Deduplicate
  const unique = [...new Set(parts)];
  return unique.slice(0, 5).join(" | ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: "Firecrawl is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping store URL:", formattedUrl);

    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["html"],
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error("Firecrawl error:", scrapeData);
      return new Response(
        JSON.stringify({ error: scrapeData.error || "Failed to scrape page" }),
        { status: scrapeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = scrapeData.data?.html || scrapeData.html || "";

    // Extract images with context
    const images: { src: string; description: string }[] = [];
    const imgRegex = /<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const imgTag = match[0];
      const src = match[1];
      const imgPosition = match.index;

      if (
        !src ||
        src.startsWith("data:") ||
        src.endsWith(".svg") ||
        src.includes("pixel") ||
        src.includes("track") ||
        src.includes("spacer") ||
        src.includes("icon") ||
        src.length < 10
      ) {
        continue;
      }

      const widthMatch = imgTag.match(/width=["']?(\d+)/i);
      const width = widthMatch ? parseInt(widthMatch[1]) : null;
      if (width !== null && width < 50) continue;

      // 1. Direct attributes
      const altMatch = imgTag.match(/alt=["']([^"']*?)["']/i);
      const titleMatch = imgTag.match(/title=["']([^"']*?)["']/i);
      const directDesc = (altMatch?.[1] || titleMatch?.[1] || "").trim();

      // 2. Surrounding context
      const contextDesc = extractContext(html, imgPosition);

      // Combine: prefer alt text first, then context
      const descParts: string[] = [];
      if (directDesc && directDesc.length > 2) descParts.push(directDesc);
      if (contextDesc) descParts.push(contextDesc);
      const description = descParts.join(" — ");

      let absoluteSrc = src;
      if (src.startsWith("//")) {
        absoluteSrc = "https:" + src;
      } else if (src.startsWith("/")) {
        const urlObj = new URL(formattedUrl);
        absoluteSrc = urlObj.origin + src;
      }

      images.push({ src: absoluteSrc, description });
    }

    // Deduplicate by src
    const seen = new Set<string>();
    const uniqueImages = images.filter((img) => {
      if (seen.has(img.src)) return false;
      seen.add(img.src);
      return true;
    });

    console.log(`Found ${uniqueImages.length} unique images`);

    // --- AI auto-annotation for images missing good descriptions ---
    const needsAI = uniqueImages.filter(
      (img) => !img.description || img.description.length < 10
    );

    if (needsAI.length > 0) {
      console.log(`Running AI annotation on ${needsAI.length} images...`);
      const aiApiKey = Deno.env.get("LOVABLE_API_KEY");

      if (aiApiKey) {
        // Batch up to 8 images for AI annotation
        const batch = needsAI.slice(0, 8);
        const aiPromises = batch.map(async (img) => {
          try {
            const resp = await fetch(
              "https://api.lovable.dev/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${aiApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "You are a fashion design analyst. Describe this clothing/fashion image in 1-2 concise sentences. Focus on: garment type, silhouette, fabric texture, color palette, key design details (e.g. stitching, embellishments, cut). Be specific and professional.",
                        },
                        { type: "image_url", image_url: { url: img.src } },
                      ],
                    },
                  ],
                  max_tokens: 150,
                }),
              }
            );
            if (resp.ok) {
              const data = await resp.json();
              const aiDesc =
                data.choices?.[0]?.message?.content?.trim() || "";
              if (aiDesc) {
                img.description = img.description
                  ? `${img.description} — ${aiDesc}`
                  : aiDesc;
              }
            } else {
              await resp.text(); // consume body
            }
          } catch (e) {
            console.error("AI annotation failed for image:", e);
          }
        });

        await Promise.all(aiPromises);
      }
    }

    return new Response(JSON.stringify({ images: uniqueImages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
