package com.vk.MentalWellness.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mood_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MoodLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Integer moodLevel; // 1 (Very Sad) to 5 (Very Happy)

    @Column(columnDefinition = "TEXT")
    private String feelings; // Comma separated list of feelings: e.g., Anxious, Tired, Excited

    @Column(nullable = false)
    private Integer stressLevel; // 1 to 10

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(nullable = true)
    private Double sleepHours;

    @Column(nullable = true)
    private Double studyHours;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
}
