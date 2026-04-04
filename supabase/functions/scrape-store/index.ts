import { corsHeaders } from "@supabase/supabase-js/cors";

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

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
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

    // Scrape the page for HTML + markdown + links
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["html", "links"],
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

    // Extract images with alt text / nearby text from HTML
    const images: { src: string; description: string }[] = [];
    const imgRegex = /<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const imgTag = match[0];
      const src = match[1];

      // Skip tiny images, icons, tracking pixels, SVGs, base64
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

      // Extract alt text
      const altMatch = imgTag.match(/alt=["']([^"']*?)["']/i);
      const titleMatch = imgTag.match(/title=["']([^"']*?)["']/i);
      const description = altMatch?.[1] || titleMatch?.[1] || "";

      // Make URL absolute
      let absoluteSrc = src;
      if (src.startsWith("//")) {
        absoluteSrc = "https:" + src;
      } else if (src.startsWith("/")) {
        const urlObj = new URL(formattedUrl);
        absoluteSrc = urlObj.origin + src;
      }

      // Filter likely product images (heuristic: decent size images)
      const widthMatch = imgTag.match(/width=["']?(\d+)/i);
      const width = widthMatch ? parseInt(widthMatch[1]) : null;
      if (width !== null && width < 50) continue;

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

    return new Response(
      JSON.stringify({ images: uniqueImages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
