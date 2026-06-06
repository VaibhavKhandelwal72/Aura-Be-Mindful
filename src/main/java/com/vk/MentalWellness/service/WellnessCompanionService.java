package com.vk.MentalWellness.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Service
public class WellnessCompanionService {

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private final HttpClient httpClient;
    private static final String SYSTEM_INSTRUCTION = 
        "You are Aura, a warm, empathetic, and friendly mental wellness companion for students preparing for competitive exams like JEE, NEET, CAT, UPSC, and board exams. " +
        "You are not a professional therapist, but you provide emotional support, active listening, study wellness tips (like Pomodoro, box breathing, micro-breaks), " +
        "and validation. Keep responses supportive, concise (2-4 sentences), and constructive. If the student expresses severe distress, remind them they can talk to family, " +
        "teachers, or professional counselors.";

    public WellnessCompanionService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public String generateResponse(String userMessage, String examType) {
        String apiKey = geminiApiKey;
        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getenv("GEMINI_API_KEY");
        }
        if (apiKey != null && !apiKey.trim().isEmpty()) {
            try {
                return callGeminiApi(apiKey.trim(), userMessage, examType);
            } catch (Exception e) {
                // Fallback to local responder if API fails
                System.err.println("Gemini API call failed, falling back: " + e.getMessage());
            }
        }
        return getFallbackResponse(userMessage, examType);
    }

    private String callGeminiApi(String apiKey, String message, String examType) throws Exception {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

        // Construct request body using JSONObject/JSONArray
        JSONObject textPart = new JSONObject().put("text", "Student Exam Context: " + examType + "\nStudent Message: " + message);
        JSONArray partsArray = new JSONArray().put(textPart);
        JSONObject contentObject = new JSONObject().put("parts", partsArray).put("role", "user");
        JSONArray contentsArray = new JSONArray().put(contentObject);

        JSONObject systemTextPart = new JSONObject().put("text", SYSTEM_INSTRUCTION);
        JSONArray systemPartsArray = new JSONArray().put(systemTextPart);
        JSONObject systemInstructionObject = new JSONObject().put("parts", systemPartsArray);

        JSONObject requestBody = new JSONObject()
                .put("contents", contentsArray)
                .put("systemInstruction", systemInstructionObject);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 200) {
            JSONObject responseJson = new JSONObject(response.body());
            return responseJson.getJSONArray("candidates")
                    .getJSONObject(0)
                    .getJSONObject("content")
                    .getJSONArray("parts")
                    .getJSONObject(0)
                    .getString("text");
        } else {
            throw new RuntimeException("Gemini API returned status code " + response.statusCode() + ": " + response.body());
        }
    }

    private String getFallbackResponse(String message, String examType) {
        String lowerMsg = message.toLowerCase();
        
        if (lowerMsg.contains("stress") || lowerMsg.contains("anxious") || lowerMsg.contains("anxiety")) {
            return "I hear you. Preparing for " + examType + " is incredibly demanding, and it is completely normal to feel stressed. Try taking a deep breath right now, and let's focus on one small task at a time. Have you tried a 4-7-8 breathing session today?";
        }
        if (lowerMsg.contains("score") || lowerMsg.contains("mock") || lowerMsg.contains("test") || lowerMsg.contains("marks")) {
            return "Mock tests can feel discouraging, but remember they are only diagnostic tools to help you identify areas of improvement. They do not define your final capability. Analyze the mistakes, take a short walk, and start fresh.";
        }
        if (lowerMsg.contains("backlog") || lowerMsg.contains("syllabus") || lowerMsg.contains("finish")) {
            return "Syllabus pressure is real! Instead of looking at the massive backlog, pick just one sub-topic to cover in the next 25 minutes. Small, consistent steps build momentum.";
        }
        if (lowerMsg.contains("parent") || lowerMsg.contains("expect") || lowerMsg.contains("family") || lowerMsg.contains("pressure")) {
            return "Family expectations often come from a place of care, but they can feel heavy. Remember to communicate how you're feeling when you're calm, and focus on doing your best day by day. You are more than your exam ranks.";
        }
        if (lowerMsg.contains("tired") || lowerMsg.contains("sleep") || lowerMsg.contains("exhausted") || lowerMsg.contains("burnout")) {
            return "Burnout is a sign that your body needs rest. Please step away from your study table, drink some water, and aim for a solid night of sleep. A rested mind learns and retains information far more effectively.";
        }
        if (lowerMsg.contains("hello") || lowerMsg.contains("hi") || lowerMsg.contains("hey")) {
            return "Hello! I'm Aura, your wellness companion. How is your " + examType + " preparation going today, and how are you feeling?";
        }

        return "Thank you for sharing that with me. Remember to give yourself credit for the hard work you're putting into " + examType + ". Make sure you take a 5-minute break soon to stretch and drink some water. I'm here if you want to write down more of your thoughts.";
    }
}
