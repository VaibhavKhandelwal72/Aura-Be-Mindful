package com.vk.MentalWellness.controller;

import com.vk.MentalWellness.dto.MoodLogRequest;
import com.vk.MentalWellness.dto.StressTriggerRequest;
import com.vk.MentalWellness.model.MoodLog;
import com.vk.MentalWellness.model.StressTrigger;
import com.vk.MentalWellness.model.User;
import com.vk.MentalWellness.repository.MoodLogRepository;
import com.vk.MentalWellness.repository.StressTriggerRepository;
import com.vk.MentalWellness.service.AnalyticsService;
import com.vk.MentalWellness.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/wellness")
public class WellnessController {

    private final UserService userService;
    private final MoodLogRepository moodLogRepository;
    private final StressTriggerRepository stressTriggerRepository;
    private final AnalyticsService analyticsService;

    public WellnessController(UserService userService, MoodLogRepository moodLogRepository,
                              StressTriggerRepository stressTriggerRepository, AnalyticsService analyticsService) {
        this.userService = userService;
        this.moodLogRepository = moodLogRepository;
        this.stressTriggerRepository = stressTriggerRepository;
        this.analyticsService = analyticsService;
    }

    @PostMapping("/mood")
    public ResponseEntity<Map<String, String>> logMood(@Valid @RequestBody MoodLogRequest request, Principal principal) {
        User user = userService.getUserByUsername(principal.getName());

        MoodLog log = MoodLog.builder()
                .user(user)
                .moodLevel(request.getMoodLevel())
                .feelings(request.getFeelings())
                .stressLevel(request.getStressLevel())
                .note(request.getNote())
                .sleepHours(request.getSleepHours())
                .studyHours(request.getStudyHours())
                .build();

        moodLogRepository.save(log);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Mood logged successfully");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mood")
    public ResponseEntity<List<Map<String, Object>>> getMoodHistory(Principal principal) {
        User user = userService.getUserByUsername(principal.getName());
        List<MoodLog> logs = moodLogRepository.findByUserOrderByTimestampDesc(user);

        List<Map<String, Object>> response = logs.stream().map(log -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", log.getId());
            map.put("moodLevel", log.getMoodLevel());
            map.put("feelings", log.getFeelings());
            map.put("stressLevel", log.getStressLevel());
            map.put("note", log.getNote());
            map.put("sleepHours", log.getSleepHours());
            map.put("studyHours", log.getStudyHours());
            map.put("timestamp", log.getTimestamp());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/trigger")
    public ResponseEntity<Map<String, String>> logTrigger(@Valid @RequestBody StressTriggerRequest request, Principal principal) {
        User user = userService.getUserByUsername(principal.getName());

        StressTrigger trigger = StressTrigger.builder()
                .user(user)
                .triggerType(request.getTriggerType())
                .note(request.getNote())
                .testScore(request.getTestScore())
                .maxScore(request.getMaxScore())
                .subjectTopic(request.getSubjectTopic())
                .build();

        stressTriggerRepository.save(trigger);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Stress trigger logged successfully");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/trigger")
    public ResponseEntity<List<Map<String, Object>>> getTriggers(Principal principal) {
        User user = userService.getUserByUsername(principal.getName());
        List<StressTrigger> triggers = stressTriggerRepository.findByUserOrderByTimestampDesc(user);

        List<Map<String, Object>> response = triggers.stream().map(t -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", t.getId());
            map.put("triggerType", t.getTriggerType());
            map.put("note", t.getNote());
            map.put("testScore", t.getTestScore());
            map.put("maxScore", t.getMaxScore());
            map.put("subjectTopic", t.getSubjectTopic());
            map.put("timestamp", t.getTimestamp());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics(Principal principal) {
        User user = userService.getUserByUsername(principal.getName());
        Map<String, Object> metrics = analyticsService.getWellnessMetrics(user);
        return ResponseEntity.ok(metrics);
    }
}
