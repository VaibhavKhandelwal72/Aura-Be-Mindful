package com.vk.MentalWellness.service;

import com.vk.MentalWellness.model.MoodLog;
import com.vk.MentalWellness.model.StressTrigger;
import com.vk.MentalWellness.model.User;
import com.vk.MentalWellness.repository.MoodLogRepository;
import com.vk.MentalWellness.repository.StressTriggerRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final MoodLogRepository moodLogRepository;
    private final StressTriggerRepository stressTriggerRepository;

    public AnalyticsService(MoodLogRepository moodLogRepository, StressTriggerRepository stressTriggerRepository) {
        this.moodLogRepository = moodLogRepository;
        this.stressTriggerRepository = stressTriggerRepository;
    }

    public Map<String, Object> getWellnessMetrics(User user) {
        List<MoodLog> moodLogs = moodLogRepository.findByUserOrderByTimestampAsc(user);
        List<StressTrigger> triggers = stressTriggerRepository.findByUserOrderByTimestampDesc(user);

        Map<String, Object> metrics = new HashMap<>();

        // 1. Average Mood, Stress, Sleep, Study Hours
        double avgMood = moodLogs.stream().mapToInt(MoodLog::getMoodLevel).average().orElse(0.0);
        double avgStress = moodLogs.stream().mapToInt(MoodLog::getStressLevel).average().orElse(0.0);
        double avgSleep = moodLogs.stream()
                .filter(log -> log.getSleepHours() != null)
                .mapToDouble(MoodLog::getSleepHours)
                .average().orElse(0.0);
        double avgStudy = moodLogs.stream()
                .filter(log -> log.getStudyHours() != null)
                .mapToDouble(MoodLog::getStudyHours)
                .average().orElse(0.0);

        metrics.put("averageMood", Math.round(avgMood * 100.0) / 100.0);
        metrics.put("averageStress", Math.round(avgStress * 100.0) / 100.0);
        metrics.put("averageSleep", Math.round(avgSleep * 100.0) / 100.0);
        metrics.put("averageStudy", Math.round(avgStudy * 100.0) / 100.0);
        metrics.put("totalLogs", moodLogs.size());

        // Calculate Check-in Streak
        int streak = calculateStreak(moodLogs);
        metrics.put("streak", streak);

        // Calculate Burnout Risk % (Based on stress, low sleep, and study fatigue)
        double burnoutRisk = 0.0;
        if (!moodLogs.isEmpty()) {
            double stressFactor = avgStress * 5.0; // max 50%
            double sleepFactor = Math.max(0.0, (7.0 - avgSleep) * 7.0); // max 49%
            double studyFactor = avgStudy > 11.0 ? (avgStudy - 11.0) * 5.0 : 0.0; // study fatigue
            burnoutRisk = Math.min(100.0, Math.max(5.0, stressFactor + sleepFactor + studyFactor));
        }
        metrics.put("burnoutRisk", Math.round(burnoutRisk));

        // 2. Trend Data for charts (with Sleep & Study correlation)
        List<Map<String, Object>> trend = moodLogs.stream()
                .map(log -> {
                    Map<String, Object> dataPoint = new HashMap<>();
                    dataPoint.put("timestamp", log.getTimestamp());
                    dataPoint.put("mood", log.getMoodLevel());
                    dataPoint.put("stress", log.getStressLevel());
                    dataPoint.put("sleep", log.getSleepHours() != null ? log.getSleepHours() : 0.0);
                    dataPoint.put("study", log.getStudyHours() != null ? log.getStudyHours() : 0.0);
                    return dataPoint;
                })
                .collect(Collectors.toList());
        metrics.put("trend", trend);

        // 3. Top Triggers Analysis
        Map<String, Long> triggerCounts = triggers.stream()
                .collect(Collectors.groupingBy(StressTrigger::getTriggerType, Collectors.counting()));
        metrics.put("triggersDistribution", triggerCounts);

        // 4. Smart Insights & Recommendations
        List<String> insights = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();

        if (moodLogs.isEmpty()) {
            insights.add("No check-ins yet. Log your first check-in to generate insights!");
            recommendations.add("Start by logging your mood today or try a 2-minute breathing exercise.");
        } else {
            // Analyze stress levels
            if (avgStress > 7.0) {
                insights.add("Your average stress level is elevated (" + String.format("%.1f", avgStress) + "/10). This is very common during intense preparation.");
                recommendations.add("Take regular 10-minute breaks every hour using the Pomodoro timer.");
                recommendations.add("Try our Guided Box Breathing exercise to lower immediate physiological stress.");
            } else if (avgStress > 4.0) {
                insights.add("Your stress level is moderate. You're balancing well, but keep monitoring.");
                recommendations.add("Keep a daily journal entry to reflect on what is going well.");
            } else {
                insights.add("Great job! Your stress levels are well-managed.");
                recommendations.add("Maintain your routine and share your positive state with peers.");
            }

            // Analyze mood
            if (avgMood < 2.5) {
                insights.add("Your average mood has been on the lower side. Remember, preparation is a marathon, not a sprint.");
                recommendations.add("Try writing a positive reflection journal to highlight small daily wins.");
                recommendations.add("Talk to our wellness companion 'Aura' for support.");
            }

            // Analyze triggers
            if (!triggerCounts.isEmpty()) {
                String topTrigger = Collections.max(triggerCounts.entrySet(), Map.Entry.comparingByValue()).getKey();
                insights.add("'" + topTrigger + "' is your most frequent source of stress.");
                
                switch (topTrigger) {
                    case "Mock Tests":
                        recommendations.add("Remember that mock tests are diagnostic tools to spot gaps, not final scores. Analyze errors, don't dwell on marks.");
                        break;
                    case "Backlog":
                        recommendations.add("Break down your backlog into micro-tasks of 15 minutes. Progress, no matter how small, counts.");
                        break;
                    case "Peer Pressure":
                    case "Parental Expectations":
                        recommendations.add("Focus on your personal growth graph. Minimize competitive group chats during high-stress weeks.");
                        break;
                    case "Sleep Issues":
                        recommendations.add("Prioritize 7 hours of sleep. A sleep-deprived brain retains 40% less information.");
                        break;
                }
            }
        }

        metrics.put("insights", insights);
        metrics.put("recommendations", recommendations);

        return metrics;
    }

    private int calculateStreak(List<MoodLog> moodLogs) {
        if (moodLogs == null || moodLogs.isEmpty()) {
            return 0;
        }

        // Extract sorted, distinct check-in dates
        List<java.time.LocalDate> dates = moodLogs.stream()
                .map(log -> log.getTimestamp().toLocalDate())
                .distinct()
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());

        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate yesterday = today.minusDays(1);

        // Streak only counts if they logged today or yesterday
        if (!dates.get(0).equals(today) && !dates.get(0).equals(yesterday)) {
            return 0;
        }

        int streak = 1;
        java.time.LocalDate current = dates.get(0);

        for (int i = 1; i < dates.size(); i++) {
            java.time.LocalDate prev = dates.get(i);
            if (prev.equals(current.minusDays(1))) {
                streak++;
                current = prev;
            } else if (prev.equals(current)) {
                // Same day, skip
            } else {
                break;
            }
        }
        return streak;
    }
}
