package com.vk.MentalWellness.controller;

import com.vk.MentalWellness.dto.ChatRequest;
import com.vk.MentalWellness.model.User;
import com.vk.MentalWellness.service.UserService;
import com.vk.MentalWellness.service.WellnessCompanionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/companion")
public class CompanionController {

    private final UserService userService;
    private final WellnessCompanionService companionService;

    public CompanionController(UserService userService, WellnessCompanionService companionService) {
        this.userService = userService;
        this.companionService = companionService;
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> chat(@Valid @RequestBody ChatRequest request, Principal principal) {
        User user = userService.getUserByUsername(principal.getName());
        String responseText = companionService.generateResponse(request.getMessage(), user.getExamType());

        Map<String, String> response = new HashMap<>();
        response.put("reply", responseText);
        return ResponseEntity.ok(response);
    }
}
