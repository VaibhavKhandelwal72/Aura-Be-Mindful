package com.vk.MentalWellness.controller;

import com.vk.MentalWellness.dto.JournalRequest;
import com.vk.MentalWellness.model.JournalEntry;
import com.vk.MentalWellness.model.User;
import com.vk.MentalWellness.repository.JournalEntryRepository;
import com.vk.MentalWellness.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/journal")
public class JournalController {

    private final UserService userService;
    private final JournalEntryRepository journalEntryRepository;

    public JournalController(UserService userService, JournalEntryRepository journalEntryRepository) {
        this.userService = userService;
        this.journalEntryRepository = journalEntryRepository;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createEntry(@Valid @RequestBody JournalRequest request, Principal principal) {
        User user = userService.getUserByUsername(principal.getName());
        String sentiment = analyzeSentiment(request.getContent());

        JournalEntry entry = JournalEntry.builder()
                .user(user)
                .title(request.getTitle())
                .content(request.getContent())
                .sentiment(sentiment)
                .build();

        journalEntryRepository.save(entry);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Journal entry created successfully");
        response.put("sentiment", sentiment);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getEntries(Principal principal) {
        User user = userService.getUserByUsername(principal.getName());
        List<JournalEntry> entries = journalEntryRepository.findByUserOrderByTimestampDesc(user);

        List<Map<String, Object>> response = entries.stream().map(entry -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", entry.getId());
            map.put("title", entry.getTitle());
            map.put("content", entry.getContent());
            map.put("sentiment", entry.getSentiment());
            map.put("timestamp", entry.getTimestamp());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteEntry(@PathVariable Long id, Principal principal) {
        User user = userService.getUserByUsername(principal.getName());
        JournalEntry entry = journalEntryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Journal entry not found"));

        if (!entry.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Unauthorized action");
        }

        journalEntryRepository.delete(entry);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Journal entry deleted successfully");
        return ResponseEntity.ok(response);
    }

    private String analyzeSentiment(String content) {
        if (content == null || content.trim().isEmpty()) {
            return "Neutral";
        }
        String lower = content.toLowerCase();

        List<String> positiveWords = Arrays.asList(
                "happy", "glad", "proud", "good", "great", "joy", "excited", "peace", 
                "calm", "confident", "satisfied", "success", "won", "hopeful", "motivated", "relax"
        );

        List<String> negativeWords = Arrays.asList(
                "sad", "stressed", "bad", "anxious", "fail", "fear", "depressed", "worry", 
                "worried", "exhausted", "tired", "backlog", "low", "lost", "frustrated", "burnout", "broken"
        );

        long posCount = positiveWords.stream().filter(lower::contains).count();
        long negCount = negativeWords.stream().filter(lower::contains).count();

        if (posCount > negCount) {
            return "Positive";
        } else if (negCount > posCount) {
            return "Negative";
        }
        return "Neutral";
    }
}
