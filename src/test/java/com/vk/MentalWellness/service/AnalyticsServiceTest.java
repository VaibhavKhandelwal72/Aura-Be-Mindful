package com.vk.MentalWellness.service;

import com.vk.MentalWellness.model.MoodLog;
import com.vk.MentalWellness.model.StressTrigger;
import com.vk.MentalWellness.model.User;
import com.vk.MentalWellness.repository.MoodLogRepository;
import com.vk.MentalWellness.repository.StressTriggerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AnalyticsServiceTest {

    private AnalyticsService analyticsService;

    @Mock
    private MoodLogRepository moodLogRepository;

    @Mock
    private StressTriggerRepository stressTriggerRepository;

    private User user;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        analyticsService = new AnalyticsService(moodLogRepository, stressTriggerRepository);

        user = User.builder()
                .username("teststudent")
                .password("hashedpwd")
                .examType("JEE")
                .build();
    }

    @Test
    void testGetWellnessMetrics_EmptyLogs() {
        when(moodLogRepository.findByUserOrderByTimestampAsc(user)).thenReturn(Collections.emptyList());
        when(stressTriggerRepository.findByUserOrderByTimestampDesc(user)).thenReturn(Collections.emptyList());

        Map<String, Object> metrics = analyticsService.getWellnessMetrics(user);

        assertNotNull(metrics);
        assertEquals(0.0, metrics.get("averageMood"));
        assertEquals(0.0, metrics.get("averageStress"));
        assertEquals(0.0, metrics.get("averageSleep"));
        assertEquals(0.0, metrics.get("averageStudy"));
        assertEquals(0, metrics.get("totalLogs"));
        assertEquals(0, metrics.get("streak"));
        assertEquals(0L, metrics.get("burnoutRisk"));
        
        List<String> insights = (List<String>) metrics.get("insights");
        assertFalse(insights.isEmpty());
        assertTrue(insights.get(0).contains("No check-ins yet"));
    }

    @Test
    void testGetWellnessMetrics_CalculateAveragesAndBurnoutRisk() {
        LocalDateTime now = LocalDateTime.now();
        List<MoodLog> logs = Arrays.asList(
                MoodLog.builder().user(user).moodLevel(4).stressLevel(3).sleepHours(8.0).studyHours(6.0).timestamp(now.minusDays(2)).build(),
                MoodLog.builder().user(user).moodLevel(3).stressLevel(5).sleepHours(6.0).studyHours(8.0).timestamp(now.minusDays(1)).build(),
                MoodLog.builder().user(user).moodLevel(2).stressLevel(8).sleepHours(5.0).studyHours(12.0).timestamp(now).build()
        );

        when(moodLogRepository.findByUserOrderByTimestampAsc(user)).thenReturn(logs);
        when(stressTriggerRepository.findByUserOrderByTimestampDesc(user)).thenReturn(Collections.emptyList());

        Map<String, Object> metrics = analyticsService.getWellnessMetrics(user);

        // Averages:
        // Mood: (4+3+2)/3 = 3.0
        // Stress: (3+5+8)/3 = 5.33
        // Sleep: (8+6+5)/3 = 6.33
        // Study: (6+8+12)/3 = 8.67
        assertEquals(3.0, metrics.get("averageMood"));
        assertEquals(5.33, metrics.get("averageStress"));
        assertEquals(6.33, metrics.get("averageSleep"));
        assertEquals(8.67, metrics.get("averageStudy"));
        assertEquals(3, metrics.get("totalLogs"));

        // Burnout risk calculations:
        // stressFactor = 5.33 * 5 = 26.65
        // sleepFactor = (7 - 6.33) * 7 = 4.69
        // studyFactor = 8.67 < 11.0 => 0.0
        // Expected: 26.65 + 4.69 = 31.34 => Rounded: 31%
        assertEquals(31L, metrics.get("burnoutRisk"));
    }

    @Test
    void testCalculateStreak_ConsecutiveLogs() {
        LocalDateTime now = LocalDateTime.now();
        List<MoodLog> logs = Arrays.asList(
                MoodLog.builder().user(user).moodLevel(4).stressLevel(3).sleepHours(8.0).studyHours(6.0).timestamp(now.minusDays(2)).build(),
                MoodLog.builder().user(user).moodLevel(3).stressLevel(5).sleepHours(6.0).studyHours(8.0).timestamp(now.minusDays(1)).build(),
                MoodLog.builder().user(user).moodLevel(2).stressLevel(8).sleepHours(5.0).studyHours(12.0).timestamp(now).build()
        );

        when(moodLogRepository.findByUserOrderByTimestampAsc(user)).thenReturn(logs);
        when(stressTriggerRepository.findByUserOrderByTimestampDesc(user)).thenReturn(Collections.emptyList());

        Map<String, Object> metrics = analyticsService.getWellnessMetrics(user);
        assertEquals(3, metrics.get("streak"));
    }

    @Test
    void testCalculateStreak_BrokenStreak() {
        LocalDateTime now = LocalDateTime.now();
        List<MoodLog> logs = Arrays.asList(
                MoodLog.builder().user(user).moodLevel(4).stressLevel(3).sleepHours(8.0).studyHours(6.0).timestamp(now.minusDays(4)).build(),
                MoodLog.builder().user(user).moodLevel(3).stressLevel(5).sleepHours(6.0).studyHours(8.0).timestamp(now.minusDays(3)).build(),
                MoodLog.builder().user(user).moodLevel(2).stressLevel(8).sleepHours(5.0).studyHours(12.0).timestamp(now).build()
        );

        when(moodLogRepository.findByUserOrderByTimestampAsc(user)).thenReturn(logs);
        when(stressTriggerRepository.findByUserOrderByTimestampDesc(user)).thenReturn(Collections.emptyList());

        Map<String, Object> metrics = analyticsService.getWellnessMetrics(user);
        
        // Active log is today, next is 3 days ago. Streak should be 1.
        assertEquals(1, metrics.get("streak"));
    }

    @Test
    void testCalculateStreak_NoRecentLogs_ReturnsZero() {
        LocalDateTime now = LocalDateTime.now();
        List<MoodLog> logs = Arrays.asList(
                MoodLog.builder().user(user).moodLevel(4).stressLevel(3).sleepHours(8.0).studyHours(6.0).timestamp(now.minusDays(5)).build(),
                MoodLog.builder().user(user).moodLevel(3).stressLevel(5).sleepHours(6.0).studyHours(8.0).timestamp(now.minusDays(3)).build()
        );

        when(moodLogRepository.findByUserOrderByTimestampAsc(user)).thenReturn(logs);
        when(stressTriggerRepository.findByUserOrderByTimestampDesc(user)).thenReturn(Collections.emptyList());

        Map<String, Object> metrics = analyticsService.getWellnessMetrics(user);
        assertEquals(0, metrics.get("streak"));
    }
}
