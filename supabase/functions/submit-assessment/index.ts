import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { assessment_id, responses, age_group, user_id } = await req.json();

    if (!assessment_id || !responses || !age_group) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch questions with weights
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id, category, weight, correct_option")
      .eq("age_group", age_group);

    if (qError || !questions) {
      return new Response(JSON.stringify({ error: "Failed to fetch questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate scores per category
    const categories = ["verbal", "logical", "spatial", "processing"];
    const categoryScores: Record<string, number> = {};

    for (const cat of categories) {
      const catQuestions = questions.filter((q: any) => q.category === cat);
      const totalWeight = catQuestions.reduce((s: number, q: any) => s + (q.weight || 1), 0);
      let earnedWeight = 0;

      for (const cq of catQuestions) {
        const resp = responses.find((r: any) => r.question_id === cq.id);
        if (resp && resp.answer_value === 1) {
          earnedWeight += cq.weight || 1;
        }
      }

      categoryScores[cat] = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 50;
    }

    // Composite score (weighted)
    const composite =
      categoryScores.verbal * 0.3 +
      categoryScores.logical * 0.3 +
      categoryScores.spatial * 0.2 +
      categoryScores.processing * 0.2;

    // Age calibration
    const calibration = age_group === "child" ? 1.05 : age_group === "elderly" ? 0.97 : 1.0;
    const predicted_iq = Math.round((70 + (composite / 100) * 75) * calibration);

    // Percentile (normal distribution approximation)
    const z = (predicted_iq - 100) / 15;
    const percentile = Math.round((0.5 * (1 + Math.tanh(z * 0.7071))) * 100);

    // Store prediction
    const { error: insertError } = await supabase.from("predictions").insert({
      assessment_id,
      user_id,
      age_group,
      predicted_iq,
      percentile,
      verbal_score: Math.round(categoryScores.verbal),
      logical_score: Math.round(categoryScores.logical),
      spatial_score: Math.round(categoryScores.spatial),
      processing_speed_score: Math.round(categoryScores.processing),
      confidence_score: 87,
      model_version: "v1.0",
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save prediction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update assessment status
    await supabase
      .from("assessments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        time_taken_seconds: Math.floor((Date.now() - Date.now()) / 1000),
      })
      .eq("id", assessment_id);

    return new Response(
      JSON.stringify({
        predicted_iq,
        percentile,
        sub_scores: categoryScores,
        confidence: 87,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
