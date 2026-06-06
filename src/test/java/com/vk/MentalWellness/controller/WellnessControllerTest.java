package com.vk.MentalWellness.controller;

import com.vk.MentalWellness.model.User;
import com.vk.MentalWellness.repository.UserRepository;
import com.vk.MentalWellness.repository.MoodLogRepository;
import com.vk.MentalWellness.repository.StressTriggerRepository;
import com.vk.MentalWellness.repository.JournalEntryRepository;
import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class WellnessControllerTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MoodLogRepository moodLogRepository;

    @Autowired
    private StressTriggerRepository stressTriggerRepository;

    @Autowired
    private JournalEntryRepository journalEntryRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();

        journalEntryRepository.deleteAll();
        moodLogRepository.deleteAll();
        stressTriggerRepository.deleteAll();
        userRepository.deleteAll();
        
        // Seed default user used in @WithMockUser tests
        User defaultUser = User.builder()
                .username("teststudent")
                .password("hashedpwd123")
                .examType("JEE")
                .createdAt(LocalDateTime.now())
                .build();
        userRepository.save(defaultUser);
    }

    @Test
    void testRegisterUser_Success() throws Exception {
        JSONObject request = new JSONObject()
                .put("username", "newstudent")
                .put("password", "password123")
                .put("examType", "NEET");

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully"));
    }

    @Test
    void testRegisterUser_InvalidPayload_ReturnsBadRequest() throws Exception {
        JSONObject request = new JSONObject()
                .put("username", "") // Invalid blank username
                .put("password", "123") // Too short
                .put("examType", "UPSC");

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request.toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teststudent")
    void testLogMood_Success() throws Exception {
        JSONObject request = new JSONObject()
                .put("moodLevel", 4)
                .put("stressLevel", 3)
                .put("feelings", "Calm,Focused")
                .put("note", "Feeling good today.")
                .put("sleepHours", 7.5)
                .put("studyHours", 8.0);

        mockMvc.perform(post("/api/wellness/mood")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mood logged successfully"));
    }

    @Test
    @WithMockUser(username = "teststudent")
    void testLogMood_OutofBoundsLevel_ReturnsBadRequest() throws Exception {
        JSONObject request = new JSONObject()
                .put("moodLevel", 6) // Invalid out of range (max 5)
                .put("stressLevel", 12); // Invalid out of range (max 10)

        mockMvc.perform(post("/api/wellness/mood")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request.toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teststudent")
    void testCreateJournalEntry_Success() throws Exception {
        JSONObject request = new JSONObject()
                .put("title", "Physics Class reflection")
                .put("content", "I understood electrostatics today, felt happy!");

        mockMvc.perform(post("/api/journal")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Journal entry created successfully"))
                .andExpect(jsonPath("$.sentiment").value("Positive"));
    }

    @Test
    @WithMockUser(username = "teststudent")
    void testGetMetrics_Success() throws Exception {
        mockMvc.perform(get("/api/wellness/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalLogs").value(0))
                .andExpect(jsonPath("$.averageMood").value(0.0))
                .andExpect(jsonPath("$.averageStress").value(0.0))
                .andExpect(jsonPath("$.averageSleep").value(0.0))
                .andExpect(jsonPath("$.averageStudy").value(0.0))
                .andExpect(jsonPath("$.burnoutRisk").value(0))
                .andExpect(jsonPath("$.streak").value(0));
    }

    @Test
    @WithMockUser(username = "teststudent")
    void testLogStressTrigger_Success() throws Exception {
        JSONObject request = new JSONObject()
                .put("triggerType", "Mock Tests")
                .put("note", "Scored low in test.")
                .put("testScore", 150)
                .put("maxScore", 300)
                .put("subjectTopic", "Physics - Electromagnetism");

        mockMvc.perform(post("/api/wellness/trigger")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Stress trigger logged successfully"));
    }
}
