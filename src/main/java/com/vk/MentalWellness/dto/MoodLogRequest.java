package com.vk.MentalWellness.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MoodLogRequest {
    @NotNull(message = "Mood level is required")
    @Min(value = 1, message = "Mood level must be at least 1")
    @Max(value = 5, message = "Mood level must be at most 5")
    private Integer moodLevel;

    private String feelings;

    @NotNull(message = "Stress level is required")
    @Min(value = 1, message = "Stress level must be at least 1")
    @Max(value = 10, message = "Stress level must be at most 10")
    private Integer stressLevel;

    private String note;

    @Min(value = 0, message = "Sleep hours cannot be negative")
    @Max(value = 24, message = "Sleep hours cannot exceed 24")
    private Double sleepHours;

    @Min(value = 0, message = "Study hours cannot be negative")
    @Max(value = 24, message = "Study hours cannot exceed 24")
    private Double studyHours;
}
