package com.vk.MentalWellness.repository;

import com.vk.MentalWellness.model.MoodLog;
import com.vk.MentalWellness.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MoodLogRepository extends JpaRepository<MoodLog, Long> {
    List<MoodLog> findByUserOrderByTimestampDesc(User user);
    List<MoodLog> findByUserOrderByTimestampAsc(User user);
}
