package com.vk.MentalWellness.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatRequest {
    @NotBlank(message = "Message cannot be blank")
    private String message;
}
