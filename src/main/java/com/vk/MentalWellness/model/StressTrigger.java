package com.vk.MentalWellness.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stress_triggers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StressTrigger {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String triggerType; // e.g. "Mock Tests", "Peer Pressure", "Backlog", "Sleep Issues", "Parental Expectations", "General Uncertainty"

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "test_score")
    private Integer testScore;

    @Column(name = "max_score")
    private Integer maxScore;

    @Column(name = "subject_topic")
    private String subjectTopic;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
}
