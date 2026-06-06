package com.vk.MentalWellness.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StressTriggerRequest {
    @NotBlank(message = "Trigger type is required")
    private String triggerType;

    private String note;

    private Integer testScore;

    private Integer maxScore;

    private String subjectTopic;
}
