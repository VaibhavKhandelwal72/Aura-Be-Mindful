package com.vk.MentalWellness.repository;

import com.vk.MentalWellness.model.JournalEntry;
import com.vk.MentalWellness.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {
    List<JournalEntry> findByUserOrderByTimestampDesc(User user);
}
